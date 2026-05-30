import { redirect } from "next/navigation";
import { getVerifiedAuthUser } from "@/lib/supabase/auth-session";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { ChatView } from "./chat-view";

export default async function ChatPage() {
  const configured = hasSupabaseConfig();
  const user = configured ? await getVerifiedAuthUser() : null;

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="chat-page">
      <ChatView currentUserId={user.userId} />
    </main>
  );
}
