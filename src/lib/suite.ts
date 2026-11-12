import suite from "./suite-apps.json";

// Barve in ikone aplikacij iz zbirke (zaganjalnik/apps.json, ključ = github repo, male črke).
// Ostali repozitoriji dobijo barvo iz imena.
type Style = { name: string; accent: string; accent2: string; icon: string };
const SUITE = suite as Record<string, Style>;

const PALETTE: [string, string][] = [
  ["#0ea5e9", "#6366f1"], ["#10b981", "#0e7490"], ["#f59e0b", "#ef4444"], ["#ec4899", "#8b5cf6"],
  ["#22c55e", "#16a34a"], ["#6366f1", "#a855f7"], ["#f43f5e", "#f97316"], ["#14b8a6", "#3b82f6"],
];
// Lucide folder-git-2
const DEFAULT_ICON = '<path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/>';

export function suiteStyle(fullName: string): { accent: string; accent2: string; icon: string } {
  const s = SUITE[fullName.toLowerCase()];
  if (s) return { accent: s.accent, accent2: s.accent2, icon: s.icon };
  let h = 0;
  for (const c of fullName) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [accent, accent2] = PALETTE[h % PALETTE.length];
  return { accent, accent2, icon: DEFAULT_ICON };
}

/** Prikazno ime: ime iz zbirke ali del za poševnico. */
export function repoTitle(fullName: string): string {
  return SUITE[fullName.toLowerCase()]?.name ?? fullName.split("/").pop() ?? fullName;
}
