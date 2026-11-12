"use client";

import { useEffect } from "react";

/**
 * Za primer, ko je uporabnik že prijavljen in ga hub vseeno pripelje z
 * `#sb_at=…&sb_rt=…` do zaščitene strani (middleware ga spusti mimo): iz
 * naslovne vrstice odstranimo žetona, da dolgoživi refresh token ne obtiči
 * v URL-ju in zgodovini brskalnika. Ne izvede prijave — to počne SsoBridge
 * na /login.
 */
export default function SsoHashCleanup() {
  useEffect(() => {
    // Če je pre-paint skript (glej src/lib/sso.ts) postavil nalagalnik,
    // ga tu umaknemo — uporabnik je že prijavljen, obrazca ni.
    document.documentElement.setAttribute("data-sso", "idle");

    const raw = window.location.hash.replace(/^#/, "");
    if (raw.indexOf("sb_at=") === -1 && raw.indexOf("sb_rt=") === -1) return;
    const params = new URLSearchParams(raw);
    params.delete("sb_at");
    params.delete("sb_rt");
    const rest = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + (rest ? "#" + rest : ""),
    );
  }, []);

  return null;
}
