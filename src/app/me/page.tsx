import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getStoryContent } from "@/lib/content/repository";
import { readPublishedEntry } from "@/lib/hotlines/repository";
import { meView } from "@/lib/me/me-view";
import { readProfile } from "@/lib/me/supabase-profile";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { continueHref } from "../continue-link";
import { MeSafetyGate } from "./me-safety-gate";
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
  const [progress, profile, content] = await Promise.all([
    createSupabaseProgressStore(client).read(user.id, user.id),
    readProfile(client, user.id),
    getStoryContent(),
  ]);
  const view = meView(progress, content.companions);
  // #118: the chosen country and its published entry, for the Country row and the phone copy.
  const entry = profile.helpCountry
    ? await readPublishedEntry(client, profile.helpCountry)
    : { ok: true, entry: null };
  const helpLine = { ok: entry.ok, copy: { country: profile.helpCountry, entry: entry.entry } };
  const email = user.email ?? "";
  const href = view.current
    ? continueHref({ id: view.current.goalId, status: "in_progress" })
    : null;
  return (
    // #392: S1 shows in place of Me when the display name is flagged (MeSafetyGate).
    <MeSafetyGate>
      <main className="app-screen me-page">
        <h1>Me</h1>
        <MeScreen
          continueHref={href}
          email={email}
          helpLine={helpLine}
          name={profile.nickname ?? (email.split("@")[0] || "You")}
          since={user.created_at}
          view={view}
        />
      </main>
    </MeSafetyGate>
  );
}
