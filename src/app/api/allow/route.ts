import { body, HttpError, ownRepo, requireUser, route, startRun } from "@/lib/cloud";
import { allowRule, forbidden, forbiddenReason } from "@/lib/rules";

// Dovoli: ukaz doda med dovoljene za ta pogovor in nadaljuje.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string; command?: string; tool?: string }>(req);
  const command = (b.command || "").trim();
  if (forbidden(command)) throw new HttpError(400, forbiddenReason(command));
  const rule = allowRule(command, b.tool || "Bash");
  if (!rule) throw new HttpError(400, "Ni ukaza");
  const repo = await ownRepo(user.id, b.repo_id);
  const run = await startRun(req, repo, "Dovolil sem: " + (command || b.tool) + ". Zaženi ga in nadaljuj.", false, rule);
  return { ok: true, run_id: run.id };
});
