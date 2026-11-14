import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { readProfile } from "@/lib/me/supabase-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { SignalsScreen } from "./signals-screen";

export const instant = false;

// SIG (#74): a child page of Me with the tab bar.
export default function Signals() {
  return <SignalsContent />;
}

async function SignalsContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const profile = await readProfile(client, user.id);
  return (
    <main className="app-screen me-page">
      <Link aria-label="Back to Me" className="life-back" href="/me">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">Me</span>
      </Link>
      <h1>Signals</h1>
      <SignalsScreen keepClockRunning={profile.keepClockRunning} />
    </main>
  );
}
