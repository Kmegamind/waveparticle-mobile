import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { AccountFocus } from "./account-focus";
import { loadFocusPlan } from "./account-progress";

export const instant = false;

// /focus (#257): the shared focus page for a signed-in user, on the account's Goal and session.
// `?goal=<id>` comes from Start on /goal; without it the open session's Goal continues.
export default function FocusPage({ searchParams }: PageProps<"/focus">) {
  return <FocusContent searchParams={searchParams} />;
}

async function FocusContent({ searchParams }: Pick<PageProps<"/focus">, "searchParams">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const { goal } = await searchParams;
  const loaded = await loadFocusPlan(
    client,
    user.id,
    typeof goal === "string" ? goal : null,
    true,
  ).catch(() => null);
  return (
    <AppTextProvider texts={await getAppTexts()}>
      <AccountFocus goalLine={loaded?.goalLine ?? ""} plan={loaded?.plan ?? null} />
    </AppTextProvider>
  );
}
