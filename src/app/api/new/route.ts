import { admin } from "@/lib/supabase/admin";
import { activeRun, body, HttpError, openSession, openThread, ownRepo, requireUser, route } from "@/lib/cloud";

// Nov pogovor: zapre trenutno sejo (naslednji prompt začne brez --resume).
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  const thread = await openThread(repo);
  if (await activeRun(thread.id)) throw new HttpError(409, "Najprej ustavi Clauda");
  if (await openSession(thread.id)) throw new HttpError(409, "Najprej končaj živo sejo");
  await admin().from("cloud_threads").update({ closed_at: new Date().toISOString() }).eq("id", thread.id);
  const fresh = await openThread(repo);
  return { ok: true, thread_id: fresh.id };
});
