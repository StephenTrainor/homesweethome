import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);

  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin), { status: 303 });
}
