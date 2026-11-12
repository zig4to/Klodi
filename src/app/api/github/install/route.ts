import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/cloud";
import { appInstallUrl } from "@/lib/github";

// "Poveži GitHub": na stran za namestitev GitHub App; state v piškotku proti CSRF.
export const GET = route(async () => {
  await requireUser();
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(appInstallUrl(state));
  res.cookies.set("cc_gh_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 900, path: "/" });
  return res;
});
