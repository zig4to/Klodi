import { THEME_SCRIPT } from "@/lib/theme";

// Renderira se v <head> korenskega layouta. Brez tega bi ob nalaganju za hip
// posvetila napačna tema (utrip), ker localStorage ni na voljo med SSR.
export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
