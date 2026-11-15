import type { SupabaseClient } from "@supabase/supabase-js";

// Who may open the content admin at /admin (#287, docs/decisions/0016). Server code only: the proxy
// and the admin layout ask the database through the signed-in user's own client. No key with full
// database rights is involved; public.content_role() answers for auth.uid() only.

export type ContentRole = "admin" | "writer";

const ROLES: readonly string[] = ["admin", "writer"];

/** True for /admin and every path under it. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** The signed-in account's role, or null. Any failure to read it counts as no role. */
export async function readContentRole(client: SupabaseClient): Promise<ContentRole | null> {
  try {
    const { data, error } = await client.rpc("content_role");
    if (error || typeof data !== "string" || !ROLES.includes(data)) return null;
    return data as ContentRole;
  } catch {
    return null;
  }
}

/**
 * What the proxy does with a request. An admin path without a signed-in account with a role gets
 * the normal 404, so the admin is not advertised (no sign-in redirect, no "forbidden" page).
 */
export function adminAnswer(
  pathname: string,
  hasUser: boolean,
  role: ContentRole | null,
): "pass" | "not-found" {
  if (!isAdminPath(pathname)) return "pass";
  return hasUser && role !== null ? "pass" : "not-found";
}
