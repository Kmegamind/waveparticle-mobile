import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { screenState } from "@/lib/progress/account-progress";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
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

  return <ProtectedHome email={user.email ?? ""} goalTitles={screenState(progress).home} />;
}
