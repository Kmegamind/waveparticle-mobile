import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { GoalsProgress } from "../progress-view";

export const instant = false;

export default function Goals() {
  return <GoalsContent />;
}

async function GoalsContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const progress = await createSupabaseProgressStore(client).read(user.id, user.id);

  return (
    <main className="app-screen">
      <h1>Goals</h1>
      <GoalsProgress canContinue={isPrototypeEnabled()} progress={progress} />
    </main>
  );
}
