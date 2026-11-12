import { body, HttpError, ownRepo, requireUser, route, startRun } from "@/lib/cloud";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string; prompt?: string; plan?: boolean }>(req);
  const prompt = (b.prompt || "").trim();
  if (!prompt) throw new HttpError(400, "Prazen prompt");
  if (prompt.length > 20_000) throw new HttpError(400, "Prompt je predolg.");
  const repo = await ownRepo(user.id, b.repo_id);
  const run = await startRun(req, repo, prompt, !!b.plan);
  return { ok: true, run_id: run.id };
});
