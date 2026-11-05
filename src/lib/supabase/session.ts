import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseEnv } from "./env";

/** Returns the signed-in user, or null when the request has no valid session. */
export async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = readSupabaseEnv();
  const cookies: CookieMethodsServer = {
    getAll: () => request.cookies.getAll(),
    setAll: (items, headers) => {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
    },
  };
  const supabase = createServerClient(url, anonKey, { cookies });
  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth/");

  if (!data.user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  if (data.user && pathname === "/auth/sign-in") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
