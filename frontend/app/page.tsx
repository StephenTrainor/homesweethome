import { redirect } from "next/navigation";
import { getVerifiedAuthUser } from "@/lib/supabase/auth-session";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export default async function Home() {
  const configured = hasSupabaseConfig();
  const user = configured ? await getVerifiedAuthUser() : null;

  if (!user) {
    redirect("/login");
  }

  const displayName = user.email?.split("@")[0] ?? "there";

  return (
    <main className="home-page">
      <div className="home-content">
        <h1 className="home-greeting">Hello, {displayName}</h1>
        <p className="home-subtitle">Welcome to Home Sweet Home</p>
      </div>
    </main>
  );
}
