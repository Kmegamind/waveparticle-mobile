import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { readProfile } from "@/lib/me/supabase-profile";
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
  const [loaded, profile] = await Promise.all([
    loadFocusPlan(client, user.id, typeof goal === "string" ? goal : null, true).catch(() => null),
    // #71: the saved "Keep the clock running when I leave"; off if it cannot be read.
    readProfile(client, user.id).catch(() => ({ keepClockRunning: false })),
  ]);
  return (
    <AppTextProvider texts={await getAppTexts()}>
      <AccountFocus
        goalLine={loaded?.goalLine ?? ""}
        keepClockRunning={profile.keepClockRunning}
        plan={loaded?.plan ?? null}
        who={loaded?.who ?? ""}
      />
    </AppTextProvider>
  );
}
