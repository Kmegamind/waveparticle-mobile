import { readAccountHelpLine } from "@/lib/hotlines/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// The account's help line for the copy on the phone (#118, SAFETY-REGION-STORE): the chosen
// country and its published entry. Always 200, so the browser logs no error: `signedIn: false`
// tells the app to remove the copy, `ok: false` to keep the one it has.
export async function GET() {
  const headers = { "cache-control": "no-store" };
  try {
    const client = await createSupabaseServerClient();
    const user = await getCurrentUser(client);
    if (!user) return Response.json({ signedIn: false }, { headers });
    const { ok, copy } = await readAccountHelpLine(client, user.id);
    return Response.json({ signedIn: true, ok, copy }, { headers });
  } catch {
    return Response.json({ signedIn: true, ok: false }, { headers });
  }
}
