"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginAction, type AuthState } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/theme/ThemeToggle";
const initialState: AuthState = {};

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  // Prijava v ozadju iz huba (Bitneverse). Povezava lahko nosi fragment
  // `#sb_at=<access_token>&sb_rt=<refresh_token>`. Middleware neprijavljene
  // obiskovalce preusmeri sem, fragment pa brskalnik prenese s sabo. Žetona
  // zamenjamo za sejo; ob uspehu gremo na `/`, ob neuspehu skrijemo nalagalnik
  // in pokaže se običajni prijavni obrazec.
  useEffect(() => {
    const root = document.documentElement;
    // "idle" pokaže prijavni obrazec, "pending" pokaže nalagalnik.
    const showForm = () => root.setAttribute("data-sso", "idle");

    const raw = window.location.hash.replace(/^#/, "");
    if (raw.indexOf("sb_at=") === -1 || raw.indexOf("sb_rt=") === -1) {
      showForm();
      return;
    }

    // Pokaži nalagalnik (pre-paint skript v <head> to praviloma stori že prej,
    // tu pa poskrbimo še za primere, ko se stran ne naloži na novo).
    root.setAttribute("data-sso", "pending");

    const params = new URLSearchParams(raw);
    const accessToken = params.get("sb_at");
    const refreshToken = params.get("sb_rt");

    // Iz naslovne vrstice odstranimo le SSO parametra, ostalo pustimo.
    params.delete("sb_at");
    params.delete("sb_rt");
    const rest = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + (rest ? "#" + rest : ""),
    );

    if (!accessToken || !refreshToken) {
      showForm();
      return;
    }

    // Varovalka: če se izmenjava nikoli ne zaključi (Supabase nedosegljiv),
    // po nekaj sekundah vseeno pokažemo obrazec.
    const timeout = window.setTimeout(showForm, 10000);

    let cancelled = false;
    createClient()
      .auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error }) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        if (error) {
          showForm();
          return;
        }
        router.replace("/");
        router.refresh();
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        showForm();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* Nalagalnik med samodejno prijavo iz huba. Privzeto skrit (globals.css),
          pokaže ga atribut `data-sso="pending"` na <html>. */}
      <div
        id="sso-loader"
        className="flex-col items-center gap-4 text-center"
        role="status"
        aria-live="polite"
      >
        <span
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-gray-300 border-t-violet-600 dark:border-gray-700 dark:border-t-violet-400"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Prijavljanje v aplikacijo …
        </p>
      </div>

      <div
        id="login-card"
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/40"
      >
        <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Prijava — Klodi
        </h1>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          Prijava z računom Bitneverse.
        </p>
        <form action={formAction} className="space-y-4">
          <Field label="E-pošta" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Geslo" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Prijavljanje …" : "Prijava"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Nimaš računa?{" "}
          <Link
            href="/registracija"
            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Registracija
          </Link>
        </p>
      </div>
    </div>
  );
}
