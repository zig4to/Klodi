import { body, ownRepo, requireUser, route, startRun } from "@/lib/cloud";

// Izvedi načrt: nadaljuje isto sejo v običajnem načinu.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string; note?: string }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  const prompt = "Načrt je odobren. Izvedi ga v celoti." + (b.note ? " Dodatno: " + b.note : "");
  const run = await startRun(req, repo, prompt, false);
  return { ok: true, run_id: run.id };
});
