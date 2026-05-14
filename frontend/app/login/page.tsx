import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getVerifiedAuthUser } from "@/lib/supabase/auth-session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const configured = hasSupabaseConfig();
  const user = configured ? await getVerifiedAuthUser() : null;

  if (user) {
    redirect("/");
  }

  const query = await searchParams;
  const oauthError = query.error === "oauth";

  return (
    <main className="login-page">
      <div className="login-card">
        <h1 className="login-title">Welcome</h1>
        <p className="login-subtitle">Sign in to continue</p>

        {oauthError && (
          <p role="alert" className="login-error">
            Google sign-in did not complete. Please try again.
          </p>
        )}

        {!configured ? (
          <p className="login-config-warning">
            Supabase is not configured. Add your environment variables to get started.
          </p>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}
