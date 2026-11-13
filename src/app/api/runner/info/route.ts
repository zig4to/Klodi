import { admin } from "@/lib/supabase/admin";
import { body, route, runnerRun } from "@/lib/cloud";

// Job „objavi“ (workflow v3): kam in kako objaviti. Iz baze, ne iz datotek prvega joba,
// ki jih je lahko spremenil Claude. Tek, ki je že končan (načrt, napaka, ustavljen), vrne 410.
export const POST = route(async (req: Request) => {
  const b = await body<{ run_id: string }>(req);
  const run = await runnerRun(req, b.run_id);
  const db = admin();
  const { data: thread } = await db.from("cloud_threads").select("repo_id").eq("id", run.thread_id).single();
  const { data: repo } = await db.from("cloud_repos").select("mode,default_branch").eq("id", thread!.repo_id).single();
  const p = run.prompt.replace(/\s+/g, " ").trim();
  return {
    skip: run.plan,
    mode: repo!.mode,
    branch: repo!.default_branch,
    title: "Klodi: " + (p.length > 60 ? p.slice(0, 60) + "…" : p),
    message: run.prompt.slice(0, 2000),
  };
});
