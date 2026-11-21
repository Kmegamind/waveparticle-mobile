import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { parseLine } from "@/lib/goals/goals-view";
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
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  // #77: New goal and Start on Goals open the dialogue with their line in the composer.
  const { line } = await searchParams;
  return (
    <AppTextProvider texts={await getAppTexts()}>
      <GoalDialogue
        focusPath="/focus"
        home={{ href: "/", label: "Back to Home" }}
        initialDraft={parseLine(line)}
        turn={goalTurnForAccountAction}
        start={startGoalAction}
      />
    </AppTextProvider>
  );
}
