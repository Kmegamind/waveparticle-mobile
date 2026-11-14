import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { DeleteAccountScreen } from "./delete-account-screen";

export const instant = false;

// ACCOUNT-DELETE (#103): below Me, without the tab bar (shell-rules HIDDEN_BELOW_TABS).
export default function DeleteAccount() {
  return <DeleteAccountContent />;
}

async function DeleteAccountContent() {
  await connection();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  return (
    <main className="app-screen me-page delete-page">
      <Link aria-label="Back to Data" className="life-back" href="/me/data">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">Me</span>
      </Link>
      <DeleteAccountScreen />
    </main>
  );
}
