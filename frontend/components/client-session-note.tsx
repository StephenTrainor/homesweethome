"use client";

import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

/** Live client-side session indicator (pairs with server `getVerifiedAuthUser`). */
export function ClientSessionNote() {
  const state = useSupabaseAuth();

  if (state.status === "unconfigured") return null;
  if (state.status === "loading") {
    return (
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>
        Checking browser session…
      </p>
    );
  }

  const active = Boolean(state.session);
  return (
    <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>
      Browser session (client):{" "}
      <strong>{active ? "active" : "none"}</strong>
    </p>
  );
}
