import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { readContentRole } from "@/lib/admin/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { AdminShell } from "./admin-shell";
import { adminFontVariables } from "./fonts";
import "./admin.css";

// The content admin (#287). The proxy already answers 404 without a role; this server check is
// the second gate, through the signed-in user's own client (no key with full database rights).
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={null}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  if (!user || !role) notFound();
  return <AdminShell fontClassName={adminFontVariables}>{children}</AdminShell>;
}
