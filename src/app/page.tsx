import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { ProtectedHome } from "./protected-home";

export const instant = false;

export default function Home() {
  return <HomeContent />;
}

async function HomeContent() {
  await connection();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");

  return <ProtectedHome email={user.email ?? ""} />;
}
