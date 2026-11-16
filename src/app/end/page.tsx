import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { getStoryContent } from "@/lib/content/repository";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { summaryOf } from "@/lib/summary/finish-run";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { EndScreen, NoSummary } from "./end-screen";

export const instant = false;

// /end?session=<id> (END, #258): opened by the last Done of the signed-in focus page (#257).
export default function EndPage({ searchParams }: PageProps<"/end">) {
  return <EndContent searchParams={searchParams} />;
}

async function EndContent({ searchParams }: Pick<PageProps<"/end">, "searchParams">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const { session } = await searchParams;
  const progress = await createSupabaseProgressStore(client)
    .read(user.id, user.id)
    .catch(() => null);
  const content = await getStoryContent().catch(() => null);
  const view =
    progress && content && typeof session === "string"
      ? summaryOf(content, progress, session)
      : null;
  return (
    <AppTextProvider texts={await getAppTexts()}>
      {view ? <EndScreen view={view} /> : <NoSummary />}
    </AppTextProvider>
  );
}
