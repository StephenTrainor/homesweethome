/**
 * Publishable key is preferred; legacy anon key is supported until Supabase retires it.
 * @see https://supabase.com/docs/guides/getting-started/api-keys
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return { url, key };
}

export function hasSupabaseConfig(): boolean {
  const { url, key } = getSupabaseEnv();
  return Boolean(url && key);
}
