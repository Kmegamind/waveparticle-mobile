import { redirect } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { companionsForViewer } from "@/lib/content/companion-access";
import { getFullStoryContent } from "@/lib/content/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { CompanionsList } from "./companions-list";

export const instant = false;

/** COMP (#268, #93): choose who sits at the desk; Enter on Oppenheimer opens his Life Path. */
export default function Companions() {
  return <CompanionsContent />;
}

async function CompanionsContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  // #521: an admin or writer also gets Enter on a Companion who is not public yet (a preview);
  // every other account sees him as before, with Enter off.
  const [content, role] = await Promise.all([getFullStoryContent(), readContentRole(client)]);

  return (
    <main className="app-screen comp-page">
      <h1>Companions</h1>
      <p className="comp-subtitle">Choose who sits at the desk with you.</p>
      <CompanionsList companions={companionsForViewer(content, role)} />
    </main>
  );
}
