import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

export function supabaseBrowser() {
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  );
}
