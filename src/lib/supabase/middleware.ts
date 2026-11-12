import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/registracija"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() po potrebi osveži sejo (pretečen dostopni žeton zamenja z
  // osvežitvenim in nove piškotke zapiše prek setAll) in podpis žetona
  // preveri lokalno (ES256) — brez klica na Supabase Auth ob vsaki zahtevi.
  let user: unknown = null;
  // Začasna napaka (izpad omrežja, Supabase nedosegljiv) NI odjava: če ima
  // obiskovalec piškotek s sejo, ga ne preusmerimo na prijavo, da se ne bi
  // moral po nepotrebnem prijavljati znova.
  let transientError = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    user = data?.claims?.sub ?? null;
    if (error && isAuthRetryableFetchError(error)) transientError = true;
  } catch (error) {
    console.error("Supabase auth.getClaims() ni uspel:", error);
    transientError = true;
  }
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  const path = request.nextUrl.pathname;
  const isAuthPage = AUTH_PAGES.some((p) => path.startsWith(p));
  // API route same preverijo prijavo (vrnejo 401 JSON); runner in webhook nimata seje.
  // /runner/bridge.mjs prenese GitHub Actions.
  const isPublic = path.startsWith("/api/") || path.startsWith("/runner/");

  if (isPublic) {
    return response;
  }

  if (!user && transientError && hasSessionCookie) {
    return response;
  }

  if (!user && !isAuthPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
