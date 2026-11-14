import { exportFileName, readAccountExport } from "@/lib/account/export";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// Export my data (#103 AC1): the signed-in account's own rows as one readable JSON file.
export async function GET() {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) {
    return Response.json({ error: "Sign in to export your data." }, { status: 401 });
  }
  const now = new Date();
  try {
    const file = await readAccountExport(client, { id: user.id, email: user.email ?? null }, now);
    return new Response(JSON.stringify(file, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${exportFileName(now)}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Could not export your data. Please try again." },
      { status: 500 },
    );
  }
}
