import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createBrowserSupabaseClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return createBrowserClient(url, key);
}
