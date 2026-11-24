import { cookies } from "next/headers";
import { readAccountHelpLine } from "@/lib/hotlines/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkSession } from "@/lib/supabase/session";

// The account's help line for the copy on the phone (#118, SAFETY-REGION-STORE): the user id, the
// chosen country and its published entry. A public path (src/lib/supabase/session.ts). It answers
// `{ signedIn: false }`, and nothing else, only when there is no session: no session cookie, or the
// auth server says the session is missing, invalid or expired (401/403). Any other auth error is
// `{ signedIn: true, ok: false }` with no user id, so the phone keeps its copy (review of #406,
// I-R1). Always 200, so the browser logs no error.
export async function GET() {
  const headers = { "cache-control": "no-store" };
  try {
    const store = await cookies();
    const client = await createSupabaseServerClient();
    const session = await checkSession(
      client,
      store.getAll().map((cookie) => cookie.name),
    );
    if (session.kind === "none") return Response.json({ signedIn: false }, { headers });
    if (session.kind === "error") return Response.json({ signedIn: true, ok: false }, { headers });
    const { ok, copy } = await readAccountHelpLine(client, session.user.id);
    return Response.json({ signedIn: true, userId: session.user.id, ok, copy }, { headers });
  } catch {
    // No user id here: HelpLineSync then leaves the copy and the session as they are.
    return Response.json({ signedIn: true, ok: false }, { headers });
  }
}
