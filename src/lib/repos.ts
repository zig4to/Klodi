import { admin } from "@/lib/supabase/admin";
import { gh, GitHubError, SECRET_NAMES, WORKFLOW_PATH } from "@/lib/github";
import { workflowYaml } from "@/lib/workflow";
import type { CloudRepo } from "@/lib/types/database.types";

/** Zapiše (ali posodobi) .github/workflows/klodi.yml v privzeto vejo repozitorija. */
export async function installWorkflow(repo: CloudRepo, apiBase: string): Promise<void> {
  const api = await gh(repo.installation_id);
  const content = workflowYaml(apiBase);
  let sha: string | undefined;
  try {
    const cur = await api<{ sha: string; content: string }>("GET",
      `/repos/${repo.full_name}/contents/${WORKFLOW_PATH}?ref=${encodeURIComponent(repo.default_branch)}`);
    sha = cur.sha;
    if (Buffer.from(cur.content, "base64").toString("utf8") === content) {
      await markInstalled(repo.id);
      return;
    }
  } catch (e) {
    if (!(e instanceof GitHubError && e.status === 404)) throw e;
  }
  await api("PUT", `/repos/${repo.full_name}/contents/${WORKFLOW_PATH}`, {
    message: sha ? "Klodi: posodobi workflow" : "Klodi: dodaj workflow",
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: repo.default_branch,
    ...(sha ? { sha } : {}),
  });
  await markInstalled(repo.id);
}

async function markInstalled(id: string) {
  await admin().from("cloud_repos").update({ workflow_installed_at: new Date().toISOString() }).eq("id", id);
}

/** Ime secreta, ki ga je uporabnik sam nastavil (vrednosti GitHub nikoli ne vrne). */
export async function checkSecret(repo: CloudRepo): Promise<string | null> {
  const api = await gh(repo.installation_id);
  const r = await api<{ secrets: { name: string }[] }>("GET", `/repos/${repo.full_name}/actions/secrets?per_page=100`);
  const names = new Set(r.secrets.map((s) => s.name));
  const found = SECRET_NAMES.find((n) => names.has(n)) ?? null;
  await admin().from("cloud_repos").update({ secret_name: found }).eq("id", repo.id);
  return found;
}
