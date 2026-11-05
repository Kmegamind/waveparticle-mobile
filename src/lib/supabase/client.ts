import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseEnv } from "./env";

/** Supabase client for code that runs in the browser. Uses only the public key. */
export function createSupabaseBrowserClient() {
  // Next.js only inlines NEXT_PUBLIC_* variables when they are written out in full.
  const { url, anonKey } = readSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return createBrowserClient(url, anonKey);
}
