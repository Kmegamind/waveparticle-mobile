import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Returns the signed-in user, or null when the request has no valid session. */
export async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
