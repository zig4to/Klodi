import { appBase, body, ownRepo, requireUser, route } from "@/lib/cloud";
import { checkSecret, installWorkflow } from "@/lib/repos";

// Ponovno preveri secret in (po potrebi) posodobi workflow.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  await installWorkflow(repo, appBase(req));
  const secret = await checkSecret(repo);
  return { ok: true, secret };
});
