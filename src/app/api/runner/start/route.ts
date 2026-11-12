import { admin } from "@/lib/supabase/admin";
import { body, route, runnerRun } from "@/lib/cloud";
import { claudeArgs } from "@/lib/rules";

// Runner ob zagonu: dobi prompt in argumente za `claude` (ne gredo skozi vhode workflowa).
export const POST = route(async (req: Request) => {
  const b = await body<{ run_id: string; gh_run_id?: string; gh_run_url?: string }>(req);
  const run = await runnerRun(req, b.run_id);
  const db = admin();
  const { data: thread } = await db.from("cloud_threads").select("*").eq("id", run.thread_id).single();
  const { data: repo } = await db.from("cloud_repos").select("*").eq("id", thread!.repo_id).single();
  await db.from("cloud_runs").update({
    status: "running",
    gh_run_id: b.gh_run_id ? Number(b.gh_run_id) : null,
    gh_run_url: b.gh_run_url || null,
  }).eq("id", run.id);
  return {
    prompt: run.prompt,
    args: claudeArgs({ plan: run.plan, auto: repo!.auto, allowed: thread!.allowed }),
    resume: thread!.session_id,
    mode: run.plan ? "plan" : repo!.mode,
    branch: repo!.default_branch,
  };
});
