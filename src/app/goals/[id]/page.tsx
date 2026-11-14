import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isGoalId, readGoalsData } from "@/lib/goals/goals-reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { GoalDetailScreen } from "./goal-detail-screen";

export const instant = false;

/** Goal detail (prototype v4 G4, G4-N, G4-H; #78, #39 AC2, #79). */
// Async at the top (not a streamed child) so that a missing Goal answers with a 404 status.
export default async function GoalDetailPage({ params }: PageProps<"/goals/[id]">) {
  await connection();
  const { id } = await params;
  if (!isGoalId(id)) notFound();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  // Row-level security keeps the read to this account: another account's Goal is simply absent.
  const data = await readGoalsData(client, user.id);
  if (!data.goals.some((goal) => goal.id === id)) notFound();
  return <GoalDetailScreen data={data} goalId={id} />;
}
