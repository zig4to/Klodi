import { SSO_PREPAINT_SCRIPT } from "@/lib/sso";

// Renderira se v <head> korenskega layouta, tik ob ThemeScript. Brez tega bi
// ob prihodu iz huba za hip posvetil prijavni obrazec, preden se v ozadju
// izvede samodejna prijava (utrip). Glej src/lib/sso.ts.
export default function SsoPrepaintScript() {
  return <script dangerouslySetInnerHTML={{ __html: SSO_PREPAINT_SCRIPT }} />;
}
