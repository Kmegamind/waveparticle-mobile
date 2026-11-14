import { redirect } from "next/navigation";
import { connection } from "next/server";
import { homeView } from "@/lib/home/home-view";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { continueHref } from "./continue-link";
import { ProtectedHome } from "./protected-home";

export const instant = false;

export default function Home() {
  return <HomeContent />;
}

// Home reads only the signed-in account (issues 268 and 90): the same Home on every device.
async function HomeContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const progress = await createSupabaseProgressStore(client).read(user.id, user.id);
  const view = homeView(progress);

  // Continue (issue 69) and the links to /goal exist only while the session pages do (test builds).
  const enabled = isPrototypeEnabled();
  const href =
    view.kind === "goal"
      ? continueHref({ id: view.card.goalId, status: view.card.status }, enabled)
      : null;
  return <ProtectedHome continueHref={href} sessionPagesEnabled={enabled} view={view} />;
}
