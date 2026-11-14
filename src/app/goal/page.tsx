import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { parseLine } from "@/lib/goals/goals-view";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { GoalDialogue } from "../try/goal/goal-dialogue";
import { splitGoalForAccountAction, startGoalAction } from "./actions";

export const instant = false;

export default function GoalPage(props: PageProps<"/goal">) {
  return <GoalContent {...props} />;
}

async function GoalContent({ searchParams }: PageProps<"/goal">) {
  await connection();
  if (!isPrototypeEnabled()) notFound();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  // #77: New goal and Start on Goals open the dialogue with their line in the composer.
  const { line } = await searchParams;
  return (
    <GoalDialogue
      focusPath="/focus"
      initialDraft={parseLine(line)}
      split={splitGoalForAccountAction}
      start={startGoalAction}
    />
  );
}
