import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

// Service role: samo na strežniku (API route). Obide RLS, zato vsak klic sam preveri lastnika.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function admin() {
  if (!client) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Manjka SUPABASE_SERVICE_ROLE_KEY");
    client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
