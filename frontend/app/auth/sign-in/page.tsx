import Link from "next/link";
import { SignInForm } from "./sign-in-form";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const configured = hasSupabaseConfig();
  const query = await searchParams;
  const oauthError = query.error === "oauth";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <h1 style={{ marginTop: 0 }}>Sign in with Google</h1>
        {oauthError ? (
          <p role="alert" style={{ color: "#b00020", marginTop: 0 }}>
            Google sign-in did not complete. Try again.
          </p>
        ) : null}
        {!configured ? (
          <p style={{ color: "#555" }}>
            Add{" "}
            <code style={{ fontSize: "0.9em" }}>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code style={{ fontSize: "0.9em" }}>
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </code>{" "}
            (or <code style={{ fontSize: "0.9em" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) to{" "}
            <code style={{ fontSize: "0.9em" }}>.env.local</code> in the{" "}
            <code style={{ fontSize: "0.9em" }}>frontend</code> folder, then restart{" "}
            <code style={{ fontSize: "0.9em" }}>npm run dev</code>.
          </p>
        ) : (
          <SignInForm />
        )}
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/">Back to home</Link>
        </p>
      </div>
    </main>
  );
}
