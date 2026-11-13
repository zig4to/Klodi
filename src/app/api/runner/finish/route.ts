import { admin } from "@/lib/supabase/admin";
import { body, route, runnerRun } from "@/lib/cloud";
import type { ChatItem, RunResult } from "@/lib/types/database.types";

type Finish = {
  run_id: string;
  status?: "done" | "error";
  result?: RunResult;
  session_id?: string | null;
  commit_sha?: string;
  commit_url?: string;
  pr_url?: string;
  error?: string;
};

// Runner na koncu: rezultat, commit ali PR.
export const POST = route(async (req: Request) => {
  const b = await body<Finish>(req);
  const run = await runnerRun(req, b.run_id);
  const db = admin();

  const extra: ChatItem[] = [];
  if (b.commit_url) extra.push({ k: "git", text: "Objavljeno v main: " + (b.commit_sha || "").slice(0, 7), url: b.commit_url });
  if (b.pr_url) extra.push({ k: "git", text: "Odprt PR", url: b.pr_url });
  if (b.error) extra.push({ k: "err", text: b.error });
  if (extra.length) {
    const { data: last } = await db.from("cloud_events").select("seq").eq("run_id", run.id)
      .order("seq", { ascending: false }).limit(1).maybeSingle();
    let seq = (last?.seq ?? -1) + 1;
    await db.from("cloud_events").insert(extra.map((item) => ({ run_id: run.id, user_id: run.user_id, seq: seq++, item })));
  }
  if (b.session_id) await db.from("cloud_threads").update({ session_id: b.session_id }).eq("id", run.thread_id);
  await db.from("cloud_runs").update({
    status: b.status === "error" ? "error" : "done",
    result: b.result ?? null,
    commit_sha: b.commit_sha ?? null,
    commit_url: b.commit_url ?? null,
    pr_url: b.pr_url ?? null,
    error: b.error ?? null,
    finished_at: new Date().toISOString(),
  }).eq("id", run.id);
  // živa seja: števec nedejavnosti začne znova
  if (run.session_id) await db.from("cloud_sessions").update({ last_activity_at: new Date().toISOString() }).eq("id", run.session_id);
  return { ok: true };
});
