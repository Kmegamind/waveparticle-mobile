import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { playableCompanion } from "@/lib/content/companion-access";
import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";
import { getStoryContentForViewer } from "@/lib/content/repository";
import { parseLine } from "@/lib/goals/goals-view";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { storyProfile } from "@/lib/prototype/story-inputs";
import { storyForNewSession } from "@/lib/summary/life-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { GoalDialogue } from "../try/goal/goal-dialogue";
import { goalTurnForAccountAction, startGoalAction } from "./actions";

export const instant = false;

export default function GoalPage(props: PageProps<"/goal">) {
  return <GoalContent {...props} />;
}

async function GoalContent({ searchParams }: PageProps<"/goal">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  // #77: New goal and Start on Goals open the dialogue with their line in the composer.
  const { line, companion } = await searchParams;
  return (
    <AppTextProvider texts={await getAppTexts()}>
      <GoalDialogue
        focusPath="/focus"
        home={{ href: "/", label: "Back to Home" }}
        initialDraft={parseLine(line)}
        turn={goalTurnForAccountAction}
        start={startGoalAction}
        voice={await voiceFor(client, user.id, companion)}
      />
    </AppTextProvider>
  );
}

/**
 * #521: `?companion=<id>` from a Companion's Life Path. The default Companion (or none) keeps the
 * dialogue as it always was. Another Companion must have stories this account may play (a
 * Companion who is not public: admins and writers only); otherwise the page goes back to the
 * Companions list, where he shows with Enter off.
 */
async function voiceFor(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  value: string | string[] | undefined,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "" || raw === DEFAULT_COMPANION_ID) return undefined;
  const content = await getStoryContentForViewer(client);
  const companion = playableCompanion(content, raw);
  if (!companion) redirect("/companions");
  const progress = await createSupabaseProgressStore(client).read(userId, userId);
  const storyId = storyForNewSession(content, progress, companion.id);
  return {
    id: companion.id,
    name: companion.shortName,
    portrait: companion.portrait,
    opening: storyId ? storyProfile(content, storyId).opening : "",
  };
}
