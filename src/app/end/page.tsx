import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { storyProfiles } from "@/lib/prototype/story-inputs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { EndScreen } from "./end-screen";

export const instant = false;

export default function EndPage() {
  return <EndContent />;
}

async function EndContent() {
  await connection();
  if (!isPrototypeEnabled()) notFound();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  const titles = Object.fromEntries(storyProfiles().map((story) => [story.id, story.title]));
  return <EndScreen titles={titles} />;
}
