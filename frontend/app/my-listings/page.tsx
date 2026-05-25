import { redirect } from "next/navigation";
import { getVerifiedAuthUser } from "@/lib/supabase/auth-session";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { MyListingsView } from "./my-listings-view";

export default async function MyListingsPage() {
  const configured = hasSupabaseConfig();
  const user = configured ? await getVerifiedAuthUser() : null;

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="my-listings-page">
      <div className="my-listings-container">
        <div className="my-listings-header">
          <h1 className="my-listings-title">My Listings</h1>
          <p className="my-listings-subtitle">
            View and manage your property listings
          </p>
        </div>

        <MyListingsView />
      </div>
    </main>
  );
}
