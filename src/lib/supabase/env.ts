/** Reads the public Supabase settings. Throws a clear error when a name is missing. */
export type SupabaseEnv = { url: string; anonKey: string };

export function readSupabaseEnv(
  source: Record<string, string | undefined> = process.env,
): SupabaseEnv {
  const url = source.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.",
    );
  }
  return { url, anonKey };
}
