import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getStoryContent } from "@/lib/content/repository";
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
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");

  return (
    <main className="app-screen comp-page">
      <h1>Companions</h1>
      <p className="comp-subtitle">Choose who sits at the desk with you.</p>
      <CompanionsList companions={(await getStoryContent()).companions} />
    </main>
  );
}
