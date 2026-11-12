"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";
import clsx from "@/lib/utils/clsx";

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(pref: ThemePreference) {
  const resolved = pref === "system" ? systemTheme() : pref;
  document.documentElement.setAttribute("data-theme", resolved);
}

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage ni na voljo (privatno okno ipd.)
  }
  return DEFAULT_THEME;
}

const SunIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <circle cx="12" cy="12" r="4" />
    <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MonitorIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path strokeLinecap="round" d="M8 21h8m-4-4v4" />
  </svg>
);

const MoonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  </svg>
);

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "light", label: "Svetla tema", icon: SunIcon },
  { value: "system", label: "Sistemska tema", icon: MonitorIcon },
  { value: "dark", label: "Temna tema", icon: MoonIcon },
];

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>(DEFAULT_THEME);

  // Po montaži preberi dejansko izbiro iz localStorage (SSR je ne pozna) in
  // znova nastavi atribut — React ga ob dev-remountu pobriše, kar bi sicer
  // razveljavilo delo inline skripte.
  useLayoutEffect(() => {
    const stored = readStored();
    // Namerno: sinhronizacija z localStorage, ki je SSR ne pozna (glej
    // Next.js "preventing flash before hydration").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(stored);
    applyTheme(stored);
  }, []);

  // Ko je izbrana "system", sledi spremembam nastavitve OS v živo.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = useCallback((value: ThemePreference) => {
    setPref(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // ni ključne škode, tema se vseeno uveljavi za to sejo
    }
    applyTheme(value);
  }, []);

  return (
    <div
      role="group"
      aria-label="Tema"
      className="inline-flex items-center rounded-md border border-gray-300 p-0.5 dark:border-gray-700"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => choose(opt.value)}
          aria-pressed={pref === opt.value}
          title={opt.label}
          className={clsx(
            "flex items-center justify-center rounded p-1.5 transition-colors",
            pref === opt.value
              ? "bg-violet-600 text-white"
              : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          )}
        >
          {opt.icon}
          <span className="sr-only">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
