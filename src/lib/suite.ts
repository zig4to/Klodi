import suite from "./suite-apps.json";

// Barve in ikone aplikacij iz zbirke: ikone in barve iz plošče Bitneverse
// (apps-registry.js v repozitoriju TomsStudios, id = ime repozitorija), ostalo iz
// zaganjalnik/apps.json. Ključ = github repo, male črke. Ikona je cel <svg>.
// Ostali repozitoriji dobijo barvo iz imena.
type Style = { name: string; accent: string; accent2: string; icon: string };
const SUITE = suite as Record<string, Style>;

const PALETTE: [string, string][] = [
  ["#0ea5e9", "#6366f1"], ["#10b981", "#0e7490"], ["#f59e0b", "#ef4444"], ["#ec4899", "#8b5cf6"],
  ["#22c55e", "#16a34a"], ["#6366f1", "#a855f7"], ["#f43f5e", "#f97316"], ["#14b8a6", "#3b82f6"],
];
// Lucide folder-git-2
const DEFAULT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/></svg>';

export function suiteStyle(fullName: string): { accent: string; accent2: string; icon: string } {
  const s = SUITE[fullName.toLowerCase()];
  if (s) return { accent: s.accent, accent2: s.accent2, icon: s.icon };
  let h = 0;
  for (const c of fullName) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [accent, accent2] = PALETTE[h % PALETTE.length];
  return { accent, accent2, icon: DEFAULT_ICON };
}

/** Barve in ikona za prikaz: aplikacije iz zbirke vedno iz zbirke (ne stara vrednost v bazi). */
export function repoStyle(r: { full_name: string; accent: string | null; accent2: string | null; icon: string | null }) {
  if (inSuite(r.full_name)) return suiteStyle(r.full_name);
  const d = suiteStyle(r.full_name);
  return { accent: r.accent || d.accent, accent2: r.accent2 || d.accent2, icon: r.icon || d.icon };
}

/** Ikona kot cel <svg>; starejši zapisi so le vsebina 24×24 črtne ikone. */
export function iconSvg(icon: string): string {
  const i = icon.trim();
  return i.startsWith("<svg")
    ? i
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i}</svg>`;
}

/** Prikazno ime: ime iz zbirke ali del za poševnico. */
export function repoTitle(fullName: string): string {
  return SUITE[fullName.toLowerCase()]?.name ?? fullName.split("/").pop() ?? fullName;
}

/** Aplikacija iz zbirke Bitneverse (isti Supabase projekt ProjektiBaze kot Klodi). */
export function inSuite(fullName: string): boolean {
  return !!SUITE[fullName.toLowerCase()];
}

/** Barva za besedilo/obrobe vklopljenih gumbov: pretemno barvo (npr. Bitneverse #2e1065) posvetli, odtenek ostane. */
export function accentFg(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (l >= 0.45) return hex;
  const d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return `hsl(${Math.round(((h * 60) + 360) % 360)} ${Math.round(Math.min(sat, 0.9) * 100)}% 66%)`;
}
