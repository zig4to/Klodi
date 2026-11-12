"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { IconCheck, IconCopy, IconTrash } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import type { CloudRepo } from "@/lib/types/database.types";

type GhRepo = { installation_id: number; full_name: string; private: boolean; description: string | null; enabled: boolean };

const CARD = "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";
const STEP = "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white";

async function api<T = { ok: boolean }>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Napaka ${r.status}`);
  return d as T;
}

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={ok ? "Kopirano!" : "Kopiraj"}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        });
      }}
      className={`rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800 ${ok ? "text-green-500 outline outline-1 outline-offset-1 outline-green-500" : ""}`}
    >
      {ok ? <IconCheck /> : <IconCopy />}
    </button>
  );
}

function Cmd({ text }: { text: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 font-mono text-xs text-gray-100">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{text}</code>
      <Copy text={text} />
    </div>
  );
}

export default function Setup() {
  const params = useSearchParams();
  const ghMsg = params.get("gh");
  const [installations, setInstallations] = useState<string[] | null>(null);
  const [available, setAvailable] = useState<GhRepo[]>([]);
  const [mine, setMine] = useState<CloudRepo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, own] = await Promise.all([
        api<{ repos: GhRepo[]; installations: string[] }>("/api/repos", "GET"),
        createClient().from("cloud_repos").select("*").order("full_name"),
      ]);
      setInstallations(r.installations);
      setAvailable(r.repos);
      setMine(own.data || []);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const connected = !!installations?.length;

  return (
    <div className="space-y-4">
      {ghMsg && ghMsg !== "ok" && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{ghMsg}</p>
      )}
      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{err}</p>}

      {/* 1. GitHub */}
      <section className={CARD}>
        <div className="flex items-start gap-3">
          <span className={STEP} style={{ background: connected ? "#16a34a" : "#0ea5e9" }}>{connected ? "✓" : "1"}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Poveži GitHub</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Namesti aplikacijo GitHub <b>Claude Cloud</b> na repozitorije, nad katerimi naj dela Claude. Claude teče v GitHub
              Actions tvojega repozitorija (tvoje minute).
            </p>
            {installations === null ? (
              <p className="mt-3 text-sm text-gray-400">Nalagam …</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {installations.map((l) => (
                  <span key={l} className="rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs dark:bg-gray-800">{l}</span>
                ))}
                <a href="/api/github/install">
                  <Button type="button" variant={connected ? "secondary" : "primary"}>
                    {connected ? "Dodaj račun ali repozitorije" : "Poveži GitHub"}
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Claude */}
      <section className={CARD}>
        <div className="flex items-start gap-3">
          <span className={STEP} style={{ background: "#0ea5e9" }}>2</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Poveži Claude</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Claude Code uporablja <b>tvojo</b> naročnino ali API ključ. Žeton dodaš <b>sam</b> kot secret v GitHub repozitorij —
              Claude Cloud ga nikoli ne vidi (tako zahtevajo pogoji Anthropic).
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              <li>
                Na računalniku s prijavljenim Claude Code ustvari dolgoživ žeton naročnine:
                <Cmd text="claude setup-token" />
              </li>
              <li>
                Dodaj ga v repozitorij kot secret <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">CLAUDE_CODE_OAUTH_TOKEN</code>{" "}
                (gumb „Dodaj secret“ pri repozitoriju spodaj) ali z GitHub CLI:
                <Cmd text="gh secret set CLAUDE_CODE_OAUTH_TOKEN -R <lastnik>/<repo>" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">
                Namesto naročnine lahko uporabiš API ključ: secret <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ANTHROPIC_API_KEY</code>.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* 3. Repozitoriji */}
      <section id="repozitoriji" className={CARD}>
        <div className="flex items-start gap-3">
          <span className={STEP} style={{ background: "#0ea5e9" }}>3</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Repozitoriji</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Omogoči repozitorij: Claude Cloud vanj zapiše <code>.github/workflows/claude-cloud.yml</code>.
            </p>

            <div className="mt-3 space-y-3">
              {mine.map((r) => {
                const gh = `https://github.com/${r.full_name}`;
                return (
                  <div key={r.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">{r.full_name}</span>
                      <button
                        type="button"
                        title="Odstrani iz Claude Cloud"
                        disabled={!!busy}
                        onClick={() => act("del" + r.id, () => api("/api/repos", "DELETE", { repo_id: r.id }))}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                      >
                        <IconTrash />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${r.workflow_installed_at ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                        {r.workflow_installed_at ? "Workflow nameščen" : "Ni workflowa"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${r.secret_name ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                        {r.secret_name ? r.secret_name : "Manjka secret"}
                      </span>
                      {!r.secret_name && (
                        <a href={`${gh}/settings/secrets/actions/new`} target="_blank" rel="noopener" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                          Dodaj secret
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => act("chk" + r.id, () => api("/api/repos/check", "POST", { repo_id: r.id }))}
                        className="font-medium text-sky-600 hover:underline disabled:opacity-50 dark:text-sky-400"
                      >
                        {busy === "chk" + r.id ? "Preverjam …" : "Preveri"}
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-gray-500 dark:text-gray-400">
                        Spremembe
                        <select
                          value={r.mode}
                          disabled={!!busy}
                          onChange={(e) => act("mode" + r.id, () => api("/api/repos", "PATCH", { repo_id: r.id, mode: e.target.value }))}
                          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        >
                          <option value="main">Direktno v {r.default_branch}</option>
                          <option value="pr">Veja + pull request</option>
                        </select>
                      </label>
                      <label className="text-xs text-gray-500 dark:text-gray-400">
                        Predogled (objavljen naslov)
                        <input
                          defaultValue={r.deploy_url || ""}
                          placeholder="https://…"
                          inputMode="url"
                          onBlur={(e) => {
                            if (e.target.value.trim() !== (r.deploy_url || "")) {
                              act("url" + r.id, () => api("/api/repos", "PATCH", { repo_id: r.id, deploy_url: e.target.value }));
                            }
                          }}
                          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              {connected && (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                  {available.filter((r) => !r.enabled).length === 0 && (
                    <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                      Vsi repozitoriji iz namestitve so že omogočeni. Več jih dodaš z gumbom „Dodaj račun ali repozitorije“.
                    </p>
                  )}
                  {available.filter((r) => !r.enabled).map((r) => (
                    <div key={r.full_name} className="flex items-center gap-2 p-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm">{r.full_name}</span>
                        {r.description && <span className="block truncate text-xs text-gray-500">{r.description}</span>}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!!busy}
                        onClick={() => act("en" + r.full_name, () => api("/api/repos", "POST", { installation_id: r.installation_id, full_name: r.full_name }))}
                      >
                        {busy === "en" + r.full_name ? "Nameščam …" : "Omogoči"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
