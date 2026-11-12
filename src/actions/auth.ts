"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Vnesi e-poštni naslov in geslo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Napačen e-poštni naslov ali geslo." };
  }

  redirect("/");
}

export async function signupAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");

  if (!email || !password) {
    return { error: "Vnesi e-poštni naslov in geslo." };
  }
  if (password.length < 6) {
    return { error: "Geslo mora imeti vsaj 6 znakov." };
  }
  if (password !== password2) {
    return { error: "Gesli se ne ujemata." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: "Registracija ni uspela: " + error.message };
  }

  // Če je v Supabase Auth vklopljena potrditev e-pošte, seje še ni.
  if (!data.session) {
    return {
      info: "Račun je ustvarjen. Preveri e-pošto za potrditveno povezavo, nato se prijavi.",
    };
  }

  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
