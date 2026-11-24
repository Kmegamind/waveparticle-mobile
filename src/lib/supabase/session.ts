import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPrototypeEnabled, isTryPath } from "../prototype/config";
import { adminAnswer, isAdminPath, readContentRole, withAdminCacheControl } from "../admin/roles";
import { readSupabaseEnv } from "./env";

/** No page lives here, so a rewrite to it renders the app's normal 404 page with status 404. */
const NOT_FOUND_PATH = "/_no-such-page";

/** Keeps any refreshed session cookies on a response that replaces the default one. */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

/** Returns the signed-in user, or null when the request has no valid session. */
export async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Paths a signed-out visitor may open. /try is public only while the test path is enabled (#208). */
export function isPublicPath(pathname: string, prototypeEnabled: boolean): boolean {
  if (pathname.startsWith("/auth/")) return true;
  if (pathname === "/safety" || pathname.startsWith("/safety/")) return true;
  // The privacy notice (#102) and the Terms (#104) can be read before an account exists.
  if (pathname === "/privacy" || pathname === "/terms") return true;
  // #118: the phone copy's refresh answers a signed-out request with { signedIn: false } only.
  if (pathname === "/me/help-line") return true;
  if (prototypeEnabled && isTryPath(pathname)) return true;
  return false;
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

  // The content admin (#287): no account with a role → the normal 404, before the sign-in redirect.
  if (isAdminPath(pathname)) {
    const role = data.user ? await readContentRole(supabase) : null;
    // Admin responses are never stored by the browser (#288), the 404 included.
    if (adminAnswer(pathname, Boolean(data.user), role) === "not-found") {
      return withAdminCacheControl(
        withCookies(NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url)), response),
      );
    }
    return withAdminCacheControl(response);
  }

  if (!data.user && !isPublicPath(pathname, isPrototypeEnabled())) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  if (data.user && pathname === "/auth/sign-in") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
