import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthUser = { id: string; email: string | null };

/**
 * Prijavljeni uporabnik iz JWT žetona v piškotku. Projekt uporablja
 * asimetrične ključe (ES256), zato `getClaims()` podpis preveri lokalno (javni
 * ključ se enkrat prenese in predpomni) — brez klica na Supabase Auth ob vsaki
 * zahtevi, kot pri `getUser()`. Pretečen žeton se pred tem sam osveži.
 */
export async function getAuthUser(supabase: {
  auth: SupabaseClient["auth"];
}): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}
