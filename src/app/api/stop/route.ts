import { admin } from "@/lib/supabase/admin";
import { activeRun, addEvent, body, openThread, ownRepo, requireUser, route } from "@/lib/cloud";
import { gh } from "@/lib/github";

// Ustavi: prekliče tek v GitHub Actions. V živi seji ustavi samo trenutni prompt
// (runner ob 410 ubije Clauda, stroj in predogled ostaneta).
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  const thread = await openThread(repo);
  const run = await activeRun(thread.id);
  if (!run) return { ok: true };
  const db = admin();
  if (run.gh_run_id && !run.session_id) {
    try {
      const api = await gh(repo.installation_id);
      await api("POST", `/repos/${repo.full_name}/actions/runs/${run.gh_run_id}/cancel`);
    } catch (e) {
      console.error("cancel:", e);
    }
  }
  await addEvent(run, { k: "err", text: "Ustavljeno" }, 1000);
  await db.from("cloud_runs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", run.id);
  return { ok: true };
});
