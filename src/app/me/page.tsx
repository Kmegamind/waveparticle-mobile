import { redirect } from "next/navigation";
import { connection } from "next/server";
import { meView } from "@/lib/me/me-view";
import { readProfile } from "@/lib/me/supabase-profile";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { continueHref } from "../continue-link";
import { MeScreen } from "./me-screen";

export const instant = false;

// ME (#81): the account, the Goal in progress and the settings, read from the account.
export default function Me() {
  return <MeContent />;
}

async function MeContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const [progress, profile] = await Promise.all([
    createSupabaseProgressStore(client).read(user.id, user.id),
    readProfile(client, user.id),
  ]);
  const view = meView(progress);
  const email = user.email ?? "";
  const href = view.current
    ? continueHref({ id: view.current.goalId, status: "in_progress" })
    : null;
  return (
    <main className="app-screen me-page">
      <h1>Me</h1>
      <MeScreen
        continueHref={href}
        email={email}
        name={profile.nickname ?? (email.split("@")[0] || "You")}
        since={user.created_at}
        view={view}
      />
    </main>
  );
}
