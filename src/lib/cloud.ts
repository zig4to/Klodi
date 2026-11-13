import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, type AuthUser } from "@/lib/supabase/auth";
import { admin } from "@/lib/supabase/admin";
import { gh, GitHubError, WORKFLOW_PATH } from "@/lib/github";
import { installWorkflow } from "@/lib/repos";
import type { ChatItem, CloudRepo, CloudRun, CloudSession, CloudThread, SessionStatus } from "@/lib/types/database.types";

export const APP_ID = "klodi";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Ovije API route: napake postanejo { error } z ustrezno kodo. */
export function route<A extends unknown[]>(fn: (...a: A) => Promise<unknown>) {
  return async (...a: A) => {
    try {
      const out = await fn(...a);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      const status = e instanceof HttpError || e instanceof GitHubError ? e.status : 500;
      if (status === 500) console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
    }
  };
}

/** Prijavljen uporabnik z dostopom do Klodi (app_access v hubu). */
export async function requireUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) throw new HttpError(401, "Nisi prijavljen.");
  const { data } = await supabase.rpc("has_app_access", { p_app: APP_ID });
  if (!data) throw new HttpError(403, "Nimaš dostopa do Klodi.");
  return user;
}

export async function hasAccess(): Promise<{ user: AuthUser | null; access: boolean }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { user: null, access: false };
  const { data } = await supabase.rpc("has_app_access", { p_app: APP_ID });
  return { user, access: !!data };
}

export function appBase(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function ownRepo(userId: string, repoId: string): Promise<CloudRepo> {
  const { data } = await admin().from("cloud_repos").select("*").eq("id", repoId).eq("user_id", userId).maybeSingle();
  if (!data) throw new HttpError(404, "Repozitorija ni.");
  return data;
}

/** Odprt pogovor repozitorija (ustvari ga, če ga ni). */
export async function openThread(repo: CloudRepo): Promise<CloudThread> {
  const db = admin();
  const { data } = await db.from("cloud_threads").select("*").eq("repo_id", repo.id).is("closed_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (data) return data;
  const { data: t, error } = await db.from("cloud_threads").insert({ user_id: repo.user_id, repo_id: repo.id }).select("*").single();
  if (error) throw error;
  return t;
}

export async function activeRun(threadId: string): Promise<CloudRun | null> {
  const { data } = await admin().from("cloud_runs").select("*").eq("thread_id", threadId)
    .in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const newToken = () => randomBytes(24).toString("base64url");
const OPEN_SESSION: SessionStatus[] = ["starting", "ready", "ending"];

/** Odprta živa seja pogovora (starting/ready/ending) ali null. */
export async function openSession(threadId: string): Promise<CloudSession | null> {
  const { data } = await admin().from("cloud_sessions").select("*").eq("thread_id", threadId)
    .in("status", OPEN_SESSION).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

/** workflow_dispatch v repozitoriju uporabnika (Klodi workflow v privzeti veji). */
export async function dispatch(req: Request, repo: CloudRepo, inputs: Record<string, string>): Promise<void> {
  const api = await gh(repo.installation_id);
  const path = `/repos/${repo.full_name}/actions/workflows/${encodeURIComponent(WORKFLOW_PATH.split("/").pop()!)}/dispatches`;
  const send = () => api("POST", path, { ref: repo.default_branch, inputs: { ...inputs, api: appBase(req) } });
  try {
    await send();
  } catch (e) {
    // pravkar posodobljen workflow GitHub včasih vidi z zamikom ("Unexpected inputs")
    if (!(e instanceof GitHubError && e.status === 422)) throw e;
    await new Promise((r) => setTimeout(r, 4000));
    await send();
  }
}

/** Element pogovora s strani strežnika (za zadnjim elementom teka). */
export async function addEvent(run: { id: string; user_id: string }, item: ChatItem, gap = 1): Promise<void> {
  const db = admin();
  const { data: last } = await db.from("cloud_events").select("seq").eq("run_id", run.id)
    .order("seq", { ascending: false }).limit(1).maybeSingle();
  await db.from("cloud_events").insert({ run_id: run.id, user_id: run.user_id, seq: (last?.seq ?? -1) + gap, item });
}

/**
 * Nov tek: vrstica v cloud_runs + workflow_dispatch v repozitoriju uporabnika.
 * Če ima pogovor odprto živo sejo, gre prompt samo v vrsto (runner seje ga pobere).
 */
export async function startRun(req: Request, repo: CloudRepo, prompt: string, plan: boolean, extraAllow?: string): Promise<CloudRun> {
  if (!repo.workflow_installed_at) throw new HttpError(409, "Workflow še ni nameščen v repozitorij.");
  const db = admin();
  const thread = await openThread(repo);
  if (await activeRun(thread.id)) throw new HttpError(409, "Claude že dela na tem repozitoriju.");
  const session = await openSession(thread.id);
  if (session?.status === "ending") throw new HttpError(409, "Živa seja se zaključuje, počakaj na objavo.");
  if (extraAllow && !thread.allowed.includes(extraAllow)) {
    await db.from("cloud_threads").update({ allowed: [...thread.allowed, extraAllow] }).eq("id", thread.id);
  }
  const token = newToken();
  const { data: run, error } = await db.from("cloud_runs")
    .insert({
      user_id: repo.user_id, thread_id: thread.id, prompt, plan,
      // v seji runner uporablja žeton seje
      token_hash: session ? session.token_hash : hashToken(token),
      session_id: session?.id ?? null,
    })
    .select("*").single();
  if (error) throw error;
  if (session) {
    await db.from("cloud_sessions").update({ last_activity_at: new Date().toISOString() }).eq("id", session.id);
    return run;
  }
  try {
    // workflow vedno najnovejši (v3: objava v ločenem jobu); brez spremembe ni commita
    await installWorkflow(repo, appBase(req));
    await dispatch(req, repo, { run_id: run.id, thread_id: thread.id, token });
  } catch (e) {
    await db.from("cloud_runs").update({ status: "error", error: (e as Error).message, finished_at: new Date().toISOString() }).eq("id", run.id);
    throw e;
  }
  return run;
}

/** Runner žive seje: preveri žeton seje. */
export async function runnerSession(req: Request, sessionId: string): Promise<CloudSession> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !sessionId) throw new HttpError(401, "Žeton ni veljaven.");
  const { data } = await admin().from("cloud_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!data || data.token_hash !== hashToken(token)) throw new HttpError(401, "Žeton ni veljaven.");
  if (!OPEN_SESSION.includes(data.status)) throw new HttpError(410, "Seja je končana.");
  return data;
}

/** Runner: preveri enkratni žeton teka. */
export async function runnerRun(req: Request, runId: string): Promise<CloudRun> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || !runId) throw new HttpError(401, "Žeton ni veljaven.");
  const { data } = await admin().from("cloud_runs").select("*").eq("id", runId).maybeSingle();
  if (!data || data.token_hash !== hashToken(token)) throw new HttpError(401, "Žeton ni veljaven.");
  if (data.status !== "queued" && data.status !== "running") throw new HttpError(410, "Tek je končan ali preklican.");
  return data;
}
