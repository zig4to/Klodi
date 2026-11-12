"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Prijava v ozadju iz huba (TomsStudios).
 *
 * Povezava do te aplikacije lahko nosi fragment
 * `#sb_at=<access_token>&sb_rt=<refresh_token>`. Ker middleware neprijavljene
 * obiskovalce preusmeri na `/login`, brskalnik ta fragment prenese sem (cilj
 * preusmeritve svojega fragmenta nima). Tu žetona zamenjamo za sejo —
 * `@supabase/ssr` browser klient zapiše piškotke `sb-<ref>-auth-token(.0/.1…)`,
 * ki jih bere isti strežniški klient v middleware — počistimo naslovno vrstico
 * in osvežimo usmerjevalnik; middleware ob tem vidi svežo sejo in nas z
 * `/login` preusmeri na `/`. Ob neuspehu (žeton preklican/potekel) ostane
 * običajni prijavni obrazec.
 */
export default function SsoBridge() {
  const router = useRouter();

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (raw.indexOf("sb_at=") === -1 || raw.indexOf("sb_rt=") === -1) return;

    const params = new URLSearchParams(raw);
    const accessToken = params.get("sb_at");
    const refreshToken = params.get("sb_rt");

    // Iz URL-ja odstranimo le SSO parametra, ostalo pustimo.
    params.delete("sb_at");
    params.delete("sb_rt");
    const rest = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + (rest ? "#" + rest : ""),
    );

    if (!accessToken || !refreshToken) return;

    let cancelled = false;
    createClient()
      .auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error }) => {
        if (cancelled || error) return;
        router.replace("/");
        router.refresh();
      })
      .catch(() => {
        /* neveljaven žeton — ostane prijavni obrazec */
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
