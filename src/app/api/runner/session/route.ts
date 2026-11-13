import { admin } from "@/lib/supabase/admin";
import { addEvent, body, route, runnerSession } from "@/lib/cloud";
import { claudeArgs } from "@/lib/rules";
import { inSuite } from "@/lib/suite";
import type { ChatItem } from "@/lib/types/database.types";

const IDLE_MIN = 20;

type B = {
  run_id: string; // id seje
  op: "start" | "preview" | "next" | "info" | "finish";
  gh_run_id?: string;
  gh_run_url?: string;
  url?: string | null;
  hot?: boolean;
  error?: string;
  commit_sha?: string;
  commit_url?: string;
  pr_url?: string;
};

// Runner žive seje: zagon, naslov predogleda, naslednji prompt, konec (commit/PR).
export const POST = route(async (req: Request) => {
  const b = await body<B>(req);
  const s = await runnerSession(req, b.run_id);
  const db = admin();
  const now = new Date().toISOString();
  const { data: repo } = await db.from("cloud_repos").select("*").eq("id", s.repo_id).single();

  if (b.op === "start") {
    await db.from("cloud_sessions").update({
      gh_run_id: b.gh_run_id ? Number(b.gh_run_id) : null,
      gh_run_url: b.gh_run_url || null,
      last_activity_at: now,
    }).eq("id", s.id);
    // javna ključa ProjektiBaze za aplikacije iz zbirke (dev strežnik jih rabi za prijavo/podatke)
    const env: Record<string, string> = {};
    if (inSuite(repo!.full_name)) {
      for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
        if (process.env[k]) env[k] = process.env[k]!;
      }
    }
    return { mode: repo!.mode, branch: repo!.default_branch, env, idle_min: IDLE_MIN };
  }

  if (b.op === "preview") {
    await db.from("cloud_sessions").update({
      status: s.status === "starting" ? "ready" : s.status,
      preview_url: b.url && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(b.url) ? b.url : null,
      preview_hot: !!b.hot,
      error: b.error ? b.error.slice(0, 600) : null,
      last_activity_at: now,
    }).eq("id", s.id);
    return { ok: true };
  }

  if (b.op === "next") {
    if (s.status === "ending") return { end: true };
    const { data: run } = await db.from("cloud_runs").select("*").eq("session_id", s.id).eq("status", "queued")
      .order("created_at").limit(1).maybeSingle();
    if (run) {
      const { data: thread } = await db.from("cloud_threads").select("*").eq("id", s.thread_id).single();
      await db.from("cloud_runs").update({ status: "running", gh_run_id: s.gh_run_id, gh_run_url: s.gh_run_url }).eq("id", run.id);
      return {
        run: {
          id: run.id,
          prompt: run.prompt,
          plan: run.plan,
          args: claudeArgs({ plan: run.plan, auto: repo!.auto, allowed: thread!.allowed }),
          resume: thread!.session_id,
        },
      };
    }
    if (Date.now() - Date.parse(s.last_activity_at) > IDLE_MIN * 60_000) {
      await db.from("cloud_sessions").update({ status: "ending" }).eq("id", s.id);
      return { end: true, idle: true };
    }
    return { wait: true };
  }

  // info (workflow v3, job „objavi“): kam in s kakšnim sporočilom objaviti — iz baze
  if (b.op === "info") {
    const { data: rs } = await db.from("cloud_runs").select("prompt").eq("session_id", s.id).order("created_at");
    const prompts = (rs || []).map((r) => r.prompt.replace(/\s+/g, " ").trim());
    const first = prompts[0] || "spremembe";
    return {
      mode: repo!.mode,
      branch: repo!.default_branch,
      title: "Klodi (živa seja): " + (first.length > 60 ? first.slice(0, 60) + "…" : first),
      message: prompts.map((p, i) => `${i + 1}. ${p.length > 400 ? p.slice(0, 400) + "…" : p}`).join("\n").slice(0, 4000) || "Živa seja",
    };
  }

  // finish: objava ob koncu seje
  const items: ChatItem[] = [];
  if (b.commit_url) items.push({ k: "git", text: "Živa seja objavljena v " + repo!.default_branch + ": " + (b.commit_sha || "").slice(0, 7), url: b.commit_url });
  if (b.pr_url) items.push({ k: "git", text: "Živa seja: odprt PR", url: b.pr_url });
  if (b.error) items.push({ k: "err", text: b.error.slice(0, 600) });
  if (!b.error && !b.commit_url && !b.pr_url) items.push({ k: "git", text: "Živa seja končana, brez sprememb za objavo." });
  const { data: last } = await db.from("cloud_runs").select("id,user_id").eq("session_id", s.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last) for (const it of items) await addEvent(last, it, 1000);
  await db.from("cloud_runs").update({ status: "cancelled", finished_at: now })
    .eq("session_id", s.id).in("status", ["queued", "running"]);
  await db.from("cloud_sessions").update({
    status: b.error ? "error" : "ended",
    commit_sha: b.commit_sha ?? null,
    commit_url: b.commit_url ?? null,
    pr_url: b.pr_url ?? null,
    error: b.error ? b.error.slice(0, 600) : null,
    ended_at: now,
  }).eq("id", s.id);
  return { ok: true };
});
