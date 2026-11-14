import { redirect } from "next/navigation";
import { connection } from "next/server";
import { readGoalsData } from "@/lib/goals/goals-reader";
import { parseTab } from "@/lib/goals/goals-view";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { GoalsScreen } from "./goals-screen";

export const instant = false;

/** Goals (#73, #77, #79, #80): read once from the account, drawn by the client screen. */
export default function Goals(props: PageProps<"/goals">) {
  return <GoalsContent {...props} />;
}

async function GoalsContent({ searchParams }: PageProps<"/goals">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const [data, params] = await Promise.all([readGoalsData(client, user.id), searchParams]);
  return <GoalsScreen data={data} initialTab={parseTab(params.tab)} />;
}
