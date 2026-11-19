import { admin } from "@/lib/supabase/admin";
import { body, dispatch, hashToken, HttpError, newToken, ownRepo, requireUser, route, appBase } from "@/lib/cloud";
import { DB_SECRET, gh } from "@/lib/github";
import { checkSecret, installWorkflow } from "@/lib/repos";

// Migracija baze iz teka: op "run" (gumb Izvedi migracijo) zažene job „migriraj“ v repozitoriju
// uporabnika (svež stroj, edini s secretom SUPABASE_DB_URL), op "reject" jo zavrne.
// Vedno samo po kliku; v načinu PR šele, ko je PR združen.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string; migration_id: string; op?: "run" | "reject" }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  const db = admin();
  const { data: m } = await db.from("cloud_migrations").select("*").eq("id", b.migration_id).eq("repo_id", repo.id).maybeSingle();
  if (!m) throw new HttpError(404, "Migracije ni.");
  const now = new Date().toISOString();

  if (b.op === "reject") {
    if (m.status !== "pending" && m.status !== "error") throw new HttpError(409, "Migracije ni več mogoče zavrniti.");
    await db.from("cloud_migrations").update({ status: "rejected", finished_at: now }).eq("id", m.id);
    return { ok: true };
  }

  if (m.status !== "pending" && m.status !== "error") throw new HttpError(409, "Migracija je že v teku ali končana.");
  if (m.files.some((f) => f.big)) throw new HttpError(409, "Migracija je prevelika za samodejno izvedbo (> 120 KB).");
  const { data: older } = await db.from("cloud_migrations").select("id").eq("repo_id", repo.id)
    .in("status", ["pending", "error", "queued", "running"]).lt("created_at", m.created_at).limit(1);
  if (older?.length) throw new HttpError(409, "Najprej izvedi ali zavrni starejšo migracijo.");

  await checkSecret(repo);
  if (!repo.db_secrets.includes(DB_SECRET)) {
    throw new HttpError(409, `V repozitoriju manjka secret ${DB_SECRET} (Nastavitve → Baza).`);
  }
  if (m.pr_url) {
    const n = /\/pull\/(\d+)/.exec(m.pr_url)?.[1];
    const api = await gh(repo.installation_id);
    const pr = n ? await api<{ merged: boolean; state: string }>("GET", `/repos/${repo.full_name}/pulls/${n}`) : null;
    if (!pr?.merged) throw new HttpError(409, "PR še ni združen: najprej ga združi na GitHubu, nato izvedi migracijo.");
  }

  const token = newToken();
  const { data: claimed } = await db.from("cloud_migrations").update({
    status: "queued", token_hash: hashToken(token), error: null, output: null, gh_run_id: null, gh_run_url: null, finished_at: null,
  }).eq("id", m.id).in("status", ["pending", "error"]).select("id");
  if (!claimed?.length) throw new HttpError(409, "Migracija je že v teku.");
  try {
    await installWorkflow(repo, appBase(req)); // v4: job „migriraj“
    await dispatch(req, repo, { run_id: m.id, thread_id: m.thread_id, token, migrate: "1" });
  } catch (e) {
    await db.from("cloud_migrations").update({ status: "error", error: (e as Error).message, finished_at: new Date().toISOString() }).eq("id", m.id);
    throw e;
  }
  return { ok: true };
});
