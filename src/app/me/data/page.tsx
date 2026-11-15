import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { DataRows } from "./data-rows";

export const instant = false;

// Data (#103): a child page of Me with the tab bar.
export default function Data() {
  return <DataContent />;
}

async function DataContent() {
  await connection();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  return (
    <main className="app-screen me-page">
      <Link aria-label="Back to Me" className="life-back" href="/me">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">Me</span>
      </Link>
      <h1>Data</h1>
      <DataRows />
    </main>
  );
}
