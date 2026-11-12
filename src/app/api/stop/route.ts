import { admin } from "@/lib/supabase/admin";
import { activeRun, body, openThread, ownRepo, requireUser, route } from "@/lib/cloud";
import { gh } from "@/lib/github";

// Ustavi: prekliče tek v GitHub Actions.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  const thread = await openThread(repo);
  const run = await activeRun(thread.id);
  if (!run) return { ok: true };
  const db = admin();
  if (run.gh_run_id) {
    try {
      const api = await gh(repo.installation_id);
      await api("POST", `/repos/${repo.full_name}/actions/runs/${run.gh_run_id}/cancel`);
    } catch (e) {
      console.error("cancel:", e);
    }
  }
  const { data: last } = await db.from("cloud_events").select("seq").eq("run_id", run.id)
    .order("seq", { ascending: false }).limit(1).maybeSingle();
  await db.from("cloud_events").insert({ run_id: run.id, user_id: run.user_id, seq: (last?.seq ?? -1) + 1000, item: { k: "err", text: "Ustavljeno" } });
  await db.from("cloud_runs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", run.id);
  return { ok: true };
});
