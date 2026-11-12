import { NextResponse, type NextRequest } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { appBase, requireUser } from "@/lib/cloud";
import { getInstallation, userCanAccessInstallation } from "@/lib/github";

// Setup URL GitHub App (z vklopljenim "Request user authorization during installation").
export async function GET(req: NextRequest) {
  const back = (msg: string) => NextResponse.redirect(`${appBase(req)}/nastavitve?gh=${encodeURIComponent(msg)}`);
  try {
    const user = await requireUser();
    const q = req.nextUrl.searchParams;
    const installationId = Number(q.get("installation_id"));
    const code = q.get("code");
    const state = q.get("state");
    // Posodobitev namestitve na GitHubu (brez state) je v redu, če namestitev že pripada uporabniku.
    if (!installationId) return back("Namestitev ni uspela.");
    const db = admin();
    const { data: existing } = await db.from("cloud_installations").select("*").eq("installation_id", installationId).maybeSingle();
    if (existing && existing.user_id === user.id) return back("ok");
    if (!code || !state || state !== req.cookies.get("cc_gh_state")?.value) return back("Povezava je potekla, poskusi znova.");
    const check = await userCanAccessInstallation(code, installationId);
    if (!check.ok) return back("Te namestitve ne moreš povezati.");
    if (existing && existing.user_id !== user.id) return back("Ta GitHub račun je že povezan z drugim uporabnikom.");
    const inst = await getInstallation(installationId);
    await db.from("cloud_installations").insert({ installation_id: installationId, user_id: user.id, account_login: inst.account.login });
    const res = back("ok");
    res.cookies.delete("cc_gh_state");
    return res;
  } catch (e) {
    console.error("github callback:", e);
    return back((e as Error).message || "Napaka");
  }
}
