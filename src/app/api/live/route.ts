import { admin } from "@/lib/supabase/admin";
import {
  activeRun, appBase, body, dispatch, hashToken, HttpError, newToken, openSession, openThread, ownRepo, requireUser, route,
} from "@/lib/cloud";
import { gh } from "@/lib/github";
import { installWorkflow } from "@/lib/repos";

// Živa seja: op "start" zažene tek v Actions, ki ostane prižgan (dev strežnik + tunel),
// op "end" ga zaključi (runner commita in pushne vse spremembe seje).
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string; op?: "start" | "end" }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  const db = admin();
  const thread = await openThread(repo);
  const cur = await openSession(thread.id);

  if (b.op === "end") {
    if (!cur) return { ok: true };
    if (cur.status === "starting") {
      // runner se še ni oglasil: nič za objavit, ugasni tek
      if (cur.gh_run_id) {
        try {
          const api = await gh(repo.installation_id);
          await api("POST", `/repos/${repo.full_name}/actions/runs/${cur.gh_run_id}/cancel`);
        } catch (e) {
          console.error("cancel:", e);
        }
      }
      await db.from("cloud_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", cur.id);
      await db.from("cloud_runs").update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("session_id", cur.id).in("status", ["queued", "running"]);
      return { ok: true };
    }
    if (await activeRun(thread.id)) throw new HttpError(409, "Claude še dela. Počakaj ali ga ustavi.");
    await db.from("cloud_sessions").update({ status: "ending" }).eq("id", cur.id);
    return { ok: true };
  }

  if (cur) return { ok: true, session_id: cur.id };
  if (!repo.secret_name) throw new HttpError(409, "V repozitoriju manjka secret CLAUDE_CODE_OAUTH_TOKEN ali ANTHROPIC_API_KEY.");
  if (await activeRun(thread.id)) throw new HttpError(409, "Claude že dela na tem repozitoriju.");
  // živa seja rabi workflow v2 (vhod live): posodobi, če je star
  await installWorkflow(repo, appBase(req));
  const token = newToken();
  const { data: s, error } = await db.from("cloud_sessions")
    .insert({ user_id: repo.user_id, repo_id: repo.id, thread_id: thread.id, token_hash: hashToken(token) })
    .select("*").single();
  if (error) throw error;
  try {
    await dispatch(req, repo, { run_id: s.id, thread_id: thread.id, token, live: "1" });
  } catch (e) {
    await db.from("cloud_sessions").update({ status: "error", error: (e as Error).message, ended_at: new Date().toISOString() }).eq("id", s.id);
    throw e;
  }
  return { ok: true, session_id: s.id };
});
