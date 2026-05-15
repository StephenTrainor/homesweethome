import { redirect } from "next/navigation";
import { getVerifiedAuthUser } from "@/lib/supabase/auth-session";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { ListForm } from "./list-form";

export default async function ListPage() {
  const configured = hasSupabaseConfig();
  const user = configured ? await getVerifiedAuthUser() : null;

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="list-page">
      <div className="list-container">
        <div className="list-header">
          <h1 className="list-title">Create a Listing</h1>
          <p className="list-subtitle">
            Fill out the details below to list your property for sublease
          </p>
        </div>

        <ListForm userId={user.userId} userEmail={user.email} />
      </div>
    </main>
  );
}
