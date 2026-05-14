"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type State =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "ready"; session: Session | null };

/**
 * Client-side session: good for UI state. For security-sensitive checks, use
 * `getVerifiedAuthUser()` on the server (JWT verified via `getClaims()`).
 */
export function useSupabaseAuth(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserSupabaseClient>;
    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      setState({ status: "unconfigured" });
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setState({ status: "ready", session: data.session });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setState({ status: "ready", session });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
