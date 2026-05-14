"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={pending}
        style={{
          padding: "0.6rem 1rem",
          font: "inherit",
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "Redirecting…" : "Continue with Google"}
      </button>
      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b00020", fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
