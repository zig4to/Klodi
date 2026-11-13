"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Osveži strežniške podatke strani vsakih `ms` (le ko je zavihek viden) — npr. značke živih sej. */
export default function AutoRefresh({ ms = 20_000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const t = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, ms]);
  return null;
}
