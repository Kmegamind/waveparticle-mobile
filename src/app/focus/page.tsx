import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { readProfile } from "@/lib/me/supabase-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { NoPlan } from "../_session/focus-body";
import { ACCOUNT_PATHS } from "../_session/paths";
import { AccountFocus } from "./account-focus";
import { loadFocusPlan } from "./account-progress";

export const instant = false;

// /focus (#257): the shared focus page for a signed-in user, on the account's Goal and session.
// `?goal=<id>` comes from Start on /goal; without it the open session's Goal continues.
// `?companion=<id>` (#521) is the Companion of a new session, from his Life Path and goal dialogue;
// the default Companion without it. A Companion the account may not play opens nothing.
export default function FocusPage({ searchParams }: PageProps<"/focus">) {
  return <FocusContent searchParams={searchParams} />;
}

async function FocusContent({ searchParams }: Pick<PageProps<"/focus">, "searchParams">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const { goal, companion } = await searchParams;
  const [loaded, profile] = await Promise.all([
    // A failed read (the research flag included, #114) opens nothing: the page says so.
    loadFocusPlan(
      client,
      user.id,
      typeof goal === "string" ? goal : null,
      true,
      typeof companion === "string" && companion !== "" ? companion : undefined,
    ).catch(() => "failed" as const),
    // #71: the saved "Keep the clock running when I leave"; off if it cannot be read.
    readProfile(client, user.id).catch(() => ({ keepClockRunning: false })),
  ]);
  return (
    <AppTextProvider texts={await getAppTexts()}>
      {loaded === "failed" ? (
        <NoPlan paths={ACCOUNT_PATHS} text="Could not open this Goal. Try again." />
      ) : (
        <AccountFocus
          goalLine={loaded?.goalLine ?? ""}
          keepClockRunning={profile.keepClockRunning}
          plan={loaded?.plan ?? null}
          portrait={loaded?.companion.portrait}
          who={loaded?.who ?? ""}
        />
      )}
    </AppTextProvider>
  );
}
