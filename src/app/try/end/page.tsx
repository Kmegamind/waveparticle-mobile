import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

export const instant = false;

// The focus page's last Done opens /try/end. A signed-in run ends on the account summary /end
// (#258); the sign-in-free test path has no summary yet.
export default function TryEndPage() {
  return <TryEndContent />;
}

async function TryEndContent() {
  await connection();
  const user = await getCurrentUser(await createSupabaseServerClient()).catch(() => null);
  if (user) redirect("/end");
  return (
    <main className="app-screen try-screen" data-ready="true">
      <p>There is no summary to show.</p>
      <Link href="/try">Go back to the test home</Link>
    </main>
  );
}
