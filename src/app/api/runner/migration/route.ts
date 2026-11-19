import { admin } from "@/lib/supabase/admin";
import { body, route, runnerMigration } from "@/lib/cloud";

type B = { run_id: string; op: "start" | "finish"; gh_run_id?: string; gh_run_url?: string; output?: string; error?: string };

// Job „migriraj“ (workflow v4): start vrne potrjen SQL (iz baze, ne iz repozitorija), finish izid.
export const POST = route(async (req: Request) => {
  const b = await body<B>(req);
  const m = await runnerMigration(req, b.run_id);
  const db = admin();

  if (b.op === "start") {
    const { data: repo } = await db.from("cloud_repos").select("default_branch").eq("id", m.repo_id).single();
    await db.from("cloud_migrations").update({
      status: "running",
      gh_run_id: b.gh_run_id ? Number(b.gh_run_id) : null,
      gh_run_url: b.gh_run_url || null,
    }).eq("id", m.id);
    return { files: m.files.map((f) => ({ path: f.path, sql: f.sql })), branch: repo!.default_branch, pr: !!m.pr_url };
  }

  await db.from("cloud_migrations").update({
    status: b.error ? "error" : "done",
    output: b.output ? String(b.output).slice(0, 4000) : null,
    error: b.error ? String(b.error).slice(0, 2000) : null,
    finished_at: new Date().toISOString(),
  }).eq("id", m.id);
  return { ok: true };
});
