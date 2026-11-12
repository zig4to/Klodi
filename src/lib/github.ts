import { createSign, createHmac, timingSafeEqual } from "node:crypto";

// GitHub App "Claude Cloud" — brez Octokit: JWT (RS256) iz zasebnega ključa,
// nato installation token za klice v imenu namestitve.

const API = "https://api.github.com";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Manjka okoljska spremenljivka ${name}`);
  return v;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function appJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env("GITHUB_APP_ID") }));
  // Vercel env ne zna večvrstičnih vrednosti zanesljivo: dovoli tudi "\n"
  const key = env("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const sig = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(key);
  return `${header}.${payload}.${b64url(sig)}`;
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(token: string, method: string, path: string, body?: unknown, scheme = "token"): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `${scheme} ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "claude-cloud",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new GitHubError(res.status, data?.message || `GitHub ${res.status}`);
  return data as T;
}

const tokenCache = new Map<number, { token: string; exp: number }>();

export async function installationToken(installationId: number): Promise<string> {
  const hit = tokenCache.get(installationId);
  if (hit && hit.exp - Date.now() > 5 * 60_000) return hit.token;
  const r = await call<{ token: string; expires_at: string }>(
    appJwt(), "POST", `/app/installations/${installationId}/access_tokens`, undefined, "Bearer",
  );
  tokenCache.set(installationId, { token: r.token, exp: Date.parse(r.expires_at) });
  return r.token;
}

export async function getInstallation(installationId: number) {
  return call<{ id: number; account: { login: string } }>(
    appJwt(), "GET", `/app/installations/${installationId}`, undefined, "Bearer",
  );
}

/** Odjemalec za eno namestitev. */
export async function gh(installationId: number) {
  const token = await installationToken(installationId);
  return <T = unknown>(method: string, path: string, body?: unknown) => call<T>(token, method, path, body);
}

export type GhRepo = { full_name: string; default_branch: string; private: boolean; description: string | null };

export async function listInstallationRepos(installationId: number): Promise<GhRepo[]> {
  const api = await gh(installationId);
  const out: GhRepo[] = [];
  for (let page = 1; page < 20; page++) {
    const r = await api<{ repositories: GhRepo[] }>("GET", `/installation/repositories?per_page=100&page=${page}`);
    out.push(...r.repositories);
    if (r.repositories.length < 100) break;
  }
  return out;
}

export function verifyWebhook(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", env("GITHUB_WEBHOOK_SECRET")).update(body).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lastništvo namestitve: setup URL nosi installation_id, ki bi ga lahko kdorkoli ponaredil.
 * GitHub App ima vklopljeno "Request user authorization (OAuth) during installation", zato
 * povratni klic dobi tudi `code`. Z njim dobimo uporabniški žeton in preverimo, da je
 * namestitev res med tistimi, do katerih ima ta GitHub uporabnik dostop.
 */
export async function userCanAccessInstallation(code: string, installationId: number): Promise<{ ok: boolean; login?: string }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env("GITHUB_APP_CLIENT_ID"), client_secret: env("GITHUB_APP_CLIENT_SECRET"), code }),
    cache: "no-store",
  });
  const tok = (await res.json()) as { access_token?: string };
  if (!tok.access_token) return { ok: false };
  const user = await call<{ login: string }>(tok.access_token, "GET", "/user", undefined, "Bearer");
  for (let page = 1; page < 10; page++) {
    const r = await call<{ installations: { id: number }[] }>(
      tok.access_token, "GET", `/user/installations?per_page=100&page=${page}`, undefined, "Bearer",
    );
    if (r.installations.some((i) => i.id === installationId)) return { ok: true, login: user.login };
    if (r.installations.length < 100) break;
  }
  return { ok: false };
}

export function appInstallUrl(state: string): string {
  return `https://github.com/apps/${env("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}`;
}

export const WORKFLOW_PATH = ".github/workflows/claude-cloud.yml";
export const SECRET_NAMES = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"] as const;
