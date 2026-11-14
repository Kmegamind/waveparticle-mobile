import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

export const instant = false;

// Export my data (#103 AC1): its own screen below Data. The link downloads one JSON file.
export default function ExportData() {
  return <ExportContent />;
}

async function ExportContent() {
  await connection();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  return (
    <main className="app-screen me-page account-page">
      <Link aria-label="Back to Data" className="life-back" href="/me/data">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">Data</span>
      </Link>
      <h1>Export my data</h1>
      <p>
        One file with everything your account holds on our server: your profile, your Goals and
        their Steps, your sessions and the Steps you marked done, and the lines he showed you.
      </p>
      <p>
        It is a JSON file, a plain text format that any text editor can open. Your rest
        conversations are not in it, because they are never stored on our server.
      </p>
      <a className="button-filled" download href="/me/export/download">
        Download my data
      </a>
    </main>
  );
}
