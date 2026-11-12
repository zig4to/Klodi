import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Ujemi vse poti razen:
     * - _next/static, _next/image (statične datoteke Next.js)
     * - favicon.ico, manifest.webmanifest (metadata datoteke)
     * - datotek s končnico (slike, ikone, ipd.)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|js|mjs)$).*)",
  ],
};
