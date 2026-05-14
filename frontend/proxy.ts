import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, hasSupabaseConfig } from "./lib/supabase/env";

/**
 * Refreshes the Supabase session and syncs auth cookies before render.
 * Next.js 16 uses `proxy` (middleware is deprecated).
 */
export async function proxy(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return NextResponse.next();
  }

  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([headerName, headerValue]) => {
          response.headers.set(headerName, headerValue);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
