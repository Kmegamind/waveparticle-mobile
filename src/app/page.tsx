import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { continueHref } from "./continue-link";
import { ProtectedHome } from "./protected-home";

export const instant = false;

export default function Home() {
  return <HomeContent />;
}

async function HomeContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const progress = await createSupabaseProgressStore(client).read(user.id, user.id);

  // Continue (#69 AC3) exists only while the signed-in focus page does (test builds).
  const enabled = isPrototypeEnabled();
  const goals = progress.goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    continueHref: continueHref(goal, enabled),
  }));
  return <ProtectedHome email={user.email ?? ""} goals={goals} />;
}
