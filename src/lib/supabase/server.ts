import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseEnv, type SupabaseEnv } from "./env";

/**
 * Supabase client for server code (server components, route handlers).
 * The cookie adapter is a parameter so that tests can pass a fake one.
 */
export function createSupabaseClient(cookieAdapter: CookieMethodsServer, env?: SupabaseEnv) {
  const { url, anonKey } = env ?? readSupabaseEnv();
  return createServerClient(url, anonKey, { cookies: cookieAdapter });
}

/** Supabase client bound to the cookies of the current request. */
export async function createSupabaseServerClient() {
  const store = await cookies();
  return createSupabaseClient({
    getAll: () => store.getAll(),
    setAll: (items) => {
      try {
        items.forEach(({ name, value, options }) => store.set(name, value, options));
      } catch {
        // Server components cannot set cookies. The session refresh in the proxy handles it.
      }
    },
  });
}
