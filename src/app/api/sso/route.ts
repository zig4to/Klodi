import { createClient } from "@supabase/supabase-js";
import { admin } from "@/lib/supabase/admin";
import { body, HttpError, ownRepo, requireUser, route } from "@/lib/cloud";
import { inSuite } from "@/lib/suite";

// Prijava za predogled (iframe) aplikacije iz zbirke: VSAKIČ NOVA seja istega
// uporabnika, ne Klodijeva. Če bi okvir dobil Klodijev refresh token, bi ga
// aplikacija ob osvežitvi zamenjala (rotacija); ko bi nato Klodi ali drug
// okvir uporabil starega, Supabase zazna ponovno uporabo in prekliče celo
// sejo (session_not_found) — SSO odpove in Klodi se ob naslednji osvežitvi odjavi.
// Magic link ustvari strežnik (admin, brez e-pošte) in ga takoj sam unovči.
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body<{ repo_id: string }>(req);
  const repo = await ownRepo(user.id, b.repo_id);
  if (!inSuite(repo.full_name)) throw new HttpError(400, "Samo za aplikacije iz zbirke");

  const { data: u, error: ue } = await admin().auth.admin.getUserById(user.id);
  const email = u?.user?.email;
  if (ue || !email) throw new HttpError(400, "Uporabnik nima e-pošte");

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Uporabnik ima naenkrat le en veljaven magic link: vzporeden klic (CloudChat ob
  // nalaganju zamenja naslov predogleda) prejšnjega razveljavi → otp_expired → znova.
  let last = "";
  for (let i = 0; i < 4; i++) {
    const { data: link, error: le } = await admin().auth.admin.generateLink({ type: "magiclink", email });
    if (le || !link?.properties?.hashed_token) throw new Error("generateLink: " + (le?.message ?? "brez žetona"));
    const { data, error } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    if (data.session) return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    last = error?.message ?? "brez seje";
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));
  }
  throw new Error("verifyOtp: " + last);
});
