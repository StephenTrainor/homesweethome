import { createClient } from "./server";
import { hasSupabaseConfig } from "./env";

export type VerifiedAuthUser = {
  userId: string;
  email: string | undefined;
};

/**
 * Server-only: uses `getClaims()` so the JWT is verified (do not rely on `getSession()` on the server).
 */
export async function getVerifiedAuthUser(): Promise<VerifiedAuthUser | null> {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string };
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
}
