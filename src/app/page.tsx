import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { getStoryContentForViewer } from "@/lib/content/repository";
import { homeView } from "@/lib/home/home-view";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
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
  const [progress, content] = await Promise.all([
    createSupabaseProgressStore(client).read(user.id, user.id),
    getStoryContentForViewer(client),
  ]);
  const view = homeView(progress, content.companions);

  // Continue (issue 69) and the links to /goal show in every environment (issue 278).
  const href =
    view.kind === "goal" ? continueHref({ id: view.card.goalId, status: view.card.status }) : null;
  return (
    <AppTextProvider texts={await getAppTexts()}>
      <ProtectedHome companions={content.companions} continueHref={href} view={view} />
    </AppTextProvider>
  );
}
