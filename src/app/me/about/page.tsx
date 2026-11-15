import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { AboutStories } from "./about-stories";

export const instant = false;

// About these stories (#104): a child page of Me with the tab bar.
export default function About() {
  return <AboutContent />;
}

async function AboutContent() {
  await connection();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  return (
    <main className="app-screen me-page account-page">
      <Link aria-label="Back to Me" className="life-back" href="/me">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">Me</span>
      </Link>
      <h1>About the stories</h1>
      <AboutStories />
    </main>
  );
}
