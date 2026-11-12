"use client";

import { useEffect } from "react";

// Registrira service worker (/sw.js) — potreben za namestitev kot PWA na
// Androidu in za delovanje brez povezave. Teče samo v brskalniku, po
// prvem izrisu; napaka pri registraciji aplikacije ne podre.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Med razvojem (`next dev`) SW ne sme teči: /_next/static/* datoteke v
    // dev načinu ohranijo ime ob spremembi kode, SW (predpomnilnik najprej)
    // bi zato stregel star JS. Morebiten že registriran SW odstranimo.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => keys.filter((k) => k.startsWith("claudecloud-")).forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* brez SW aplikacija še vedno deluje, le ni namestljiva/offline */
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
