"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthState } from "@/actions/auth";
import { Field, Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SsoBridge from "@/components/auth/SsoBridge";

const initialState: AuthState = {};

export default function RegistracijaPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <SsoBridge />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/40">
        <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Ustvari račun
        </h1>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          Registriraj se z e-pošto in geslom.
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
              autoComplete="new-password"
              minLength={6}
              required
            />
          </Field>
          <Field label="Ponovi geslo" htmlFor="password2">
            <Input
              id="password2"
              name="password2"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </Field>
          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
          {state.info && (
            <p className="text-sm text-violet-600 dark:text-violet-400">
              {state.info}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Ustvarjanje …" : "Ustvari račun"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Že imaš račun?{" "}
          <Link
            href="/login"
            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Prijava
          </Link>
        </p>
      </div>
    </div>
  );
}
