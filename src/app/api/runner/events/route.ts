import { admin } from "@/lib/supabase/admin";
import { body, route, runnerRun } from "@/lib/cloud";
import { forbidden } from "@/lib/rules";
import type { ChatItem, RunResult } from "@/lib/types/database.types";

// Runner sproti pošilja elemente pogovora (paketi vsakih ~600 ms).
export const POST = route(async (req: Request) => {
  const b = await body<{ run_id: string; items?: { seq: number; item: ChatItem }[]; session_id?: string | null; result?: RunResult }>(req);
  const run = await runnerRun(req, b.run_id);
  const db = admin();
  const items = (b.items || []).slice(0, 500).map(({ seq, item }) => {
    if (item.k === "deny") item = { ...item, never: forbidden(item.command) };
    if ((item.k === "text" || item.k === "plan" || item.k === "err") && item.text.length > 100_000) {
      item = { ...item, text: item.text.slice(0, 100_000) + "…" };
    }
    return { run_id: run.id, user_id: run.user_id, seq, item };
  });
  if (items.length) {
    const { error } = await db.from("cloud_events").upsert(items, { onConflict: "run_id,seq", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (b.session_id) await db.from("cloud_threads").update({ session_id: b.session_id }).eq("id", run.thread_id);
  // workflow v3: rezultat (cena, čas) pošlje job „claude“, objavo javi job „objavi“
  if (b.result) await db.from("cloud_runs").update({ result: b.result }).eq("id", run.id);
  return { ok: true };
});
