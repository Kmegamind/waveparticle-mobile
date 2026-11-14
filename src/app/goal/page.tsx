import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { GoalDialogue } from "../try/goal/goal-dialogue";
import { splitGoalForAccountAction, startGoalAction } from "./actions";

export const instant = false;

export default function GoalPage() {
  return <GoalContent />;
}

async function GoalContent() {
  await connection();
  if (!isPrototypeEnabled()) notFound();
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) redirect("/auth/sign-in");
  return (
    <GoalDialogue focusPath="/focus" split={splitGoalForAccountAction} start={startGoalAction} />
  );
}
