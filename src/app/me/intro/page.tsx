import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { IntroPlayer } from "./intro-player";

export const instant = false;

// Replay intro (#480): opened from Me, no tab bar, can be skipped at any slide.
export default function Intro() {
  return <IntroContent />;
}

async function IntroContent() {
  await connection();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  return (
    <main className="app-screen me-page">
      <IntroPlayer />
    </main>
  );
}
