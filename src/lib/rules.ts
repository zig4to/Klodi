// Pravila orodij za Claude Code — prenesena iz zaganjalnik/claude.js (Live Claude).
// Runner je Linux (GitHub Actions), zato samo Bash; PowerShell pravila niso potrebna.

const ALLOWED = [
  "Read", "Edit", "Write", "Glob", "Grep", "TodoWrite",
  "Bash(npm run *)", "Bash(npm install*)", "Bash(npm ci*)", "Bash(npx *)", "Bash(node *)",
  "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git show*)",
  "Bash(git add*)", "Bash(git commit*)", "Bash(git restore*)", "Bash(git branch*)",
  "Bash(ls*)", "Bash(cat *)", "Bash(mkdir *)", "Bash(curl *)", "WebFetch", "WebSearch",
  // SUPABASE_DB_URL_RO: vloga brez pravic (samo shema) — omejitev je v bazi, ne tu
  "Bash(psql *)",
];
// Samodejno: vsi ukazi in splet brez vprašanja, razen DANGER
const AUTO = [
  "Read", "Edit", "Write", "Glob", "Grep", "TodoWrite", "NotebookEdit",
  "Bash", "WebFetch", "WebSearch", "Agent", "Task",
];
// Načrt: samo branje
const PLAN = ["Read", "Glob", "Grep", "WebFetch", "WebSearch", "TodoWrite"];

const DANGER = [
  "git push", "git reset --hard", "git clean", "git remote", "git config", "rm -rf", "rm -r ", "rm -fr",
  "shutdown", "curl -X POST", // runner ne sme sam klicati zunanjih API-jev s pisanjem
];
const DENIED = DANGER.map((c) => `Bash(${c.trim()}*)`);
const NEVER = /\bgit\s+push\b/i;

/** Ukaz vsebuje prepovedan del (tudi za && ali ;): gumb Dovoli ne bi pomagal. */
export function forbidden(cmd: string | null | undefined): boolean {
  const c = " " + String(cmd || "").toLowerCase().replace(/[;&|()]+/g, " ").replace(/\s+/g, " ");
  return DANGER.some((d) => c.indexOf(" " + d.toLowerCase().trim()) >= 0);
}

export function forbiddenReason(cmd: string): string {
  return NEVER.test(cmd) ? "Push naredi workflow sam po koncu." : "Ta ukaz je vedno prepovedan.";
}

/** Argumenti za `claude -p` (brez --resume; tega doda runner iz predpomnilnika). */
export function claudeArgs(opts: { plan: boolean; auto: boolean; allowed: string[] }): string[] {
  const tools = opts.plan ? PLAN : opts.auto ? AUTO : ALLOWED.concat(opts.allowed);
  return [
    "-p", "--output-format", "stream-json", "--verbose",
    "--permission-mode", opts.plan ? "plan" : "acceptEdits",
    "--allowedTools", ...tools,
    "--disallowedTools", ...DENIED,
  ];
}

/** Mapa, iz katere job „objavi“ pobere migracije za kartico v Klodiju. */
export const MIGRATIONS_DIR = "supabase/migrations/";

/** Dodatno sistemsko navodilo (--append-system-prompt): kako Claude spreminja bazo. */
export function systemPrompt(repo: { db_secrets?: string[] | null }): string {
  const s = repo.db_secrets || [];
  return [
    "Spremembe baze (Supabase/Postgres): nikoli jih ne izvajaj sam.",
    `Napiši novo datoteko ${MIGRATIONS_DIR}<YYYYMMDDHHMMSS>_<kratko_ime>.sql (idempotentno: if not exists, brez BEGIN/COMMIT — izvede se v eni transakciji) in po potrebi posodobi tipe v kodi.`,
    "Po objavi uporabnik SQL pregleda in migracijo izvede s klikom v Klodiju; v odgovoru na kratko povej, kaj migracija naredi.",
    s.includes("SUPABASE_DB_URL_RO")
      ? `Shemo trenutne baze lahko bereš: psql "$SUPABASE_DB_URL_RO" -c '\\d ime_tabele' (vloga samo za branje sheme, podatkov ne vidi).`
      : "",
  ].filter(Boolean).join(" ");
}

/** Pravilo za gumb Dovoli. */
export function allowRule(command: string, tool: string): string | null {
  if (command) return `${tool || "Bash"}(${command})`;
  return tool || null;
}
