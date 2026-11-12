import { admin } from "@/lib/supabase/admin";
import { appBase, body, HttpError, ownRepo, requireUser, route } from "@/lib/cloud";
import { listInstallationRepos } from "@/lib/github";
import { checkSecret, installWorkflow } from "@/lib/repos";
import { suiteStyle } from "@/lib/suite";

// GET: repozitoriji iz uporabnikovih namestitev GitHub App (za izbiro "Dodaj repozitorij").
export const GET = route(async () => {
  const user = await requireUser();
  const db = admin();
  const { data: inst } = await db.from("cloud_installations").select("*").eq("user_id", user.id);
  const { data: mine } = await db.from("cloud_repos").select("full_name").eq("user_id", user.id);
  const taken = new Set((mine || []).map((r) => r.full_name));
  const out: { installation_id: number; full_name: string; private: boolean; description: string | null; enabled: boolean }[] = [];
  for (const i of inst || []) {
    try {
      for (const r of await listInstallationRepos(i.installation_id)) {
        out.push({ installation_id: i.installation_id, full_name: r.full_name, private: r.private, description: r.description, enabled: taken.has(r.full_name) });
      }
    } catch (e) {
      console.error("repos:", e);
    }
  }
  out.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return { repos: out, installations: (inst || []).map((i) => i.account_login) };
});

// POST: omogoči repozitorij (vrstica + workflow + preverba secreta)
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ installation_id: number; full_name: string }>(req);
  const db = admin();
  const { data: inst } = await db.from("cloud_installations").select("*")
    .eq("installation_id", b.installation_id).eq("user_id", user.id).maybeSingle();
  if (!inst) throw new HttpError(404, "Namestitve ni.");
  const gh = (await listInstallationRepos(inst.installation_id)).find((r) => r.full_name === b.full_name);
  if (!gh) throw new HttpError(404, "Repozitorij ni v tej namestitvi.");
  const style = suiteStyle(gh.full_name);
  const { data: repo, error } = await db.from("cloud_repos").upsert({
    user_id: user.id,
    installation_id: inst.installation_id,
    full_name: gh.full_name,
    default_branch: gh.default_branch,
    ...style,
  }, { onConflict: "user_id,full_name" }).select("*").single();
  if (error) throw error;
  await installWorkflow(repo, appBase(req));
  const secret = await checkSecret(repo);
  return { ok: true, repo_id: repo.id, secret };
});

// PATCH: nastavitve repozitorija
export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string; mode?: "main" | "pr"; auto?: boolean; deploy_url?: string | null }>(req);
  await ownRepo(user.id, b.repo_id);
  const patch: { mode?: "main" | "pr"; auto?: boolean; deploy_url?: string | null } = {};
  if (b.mode === "main" || b.mode === "pr") patch.mode = b.mode;
  if (typeof b.auto === "boolean") patch.auto = b.auto;
  if (b.deploy_url !== undefined) {
    const u = (b.deploy_url || "").trim();
    if (u && !/^https:\/\//.test(u)) throw new HttpError(400, "Predogled mora biti https naslov.");
    patch.deploy_url = u || null;
  }
  const { data } = await admin().from("cloud_repos").update(patch).eq("id", b.repo_id).select("*").single();
  return { ok: true, repo: data };
});

// DELETE: odstrani iz Claude Cloud (workflow v repozitoriju ostane)
export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string }>(req);
  await ownRepo(user.id, b.repo_id);
  await admin().from("cloud_repos").delete().eq("id", b.repo_id);
  return { ok: true };
});
