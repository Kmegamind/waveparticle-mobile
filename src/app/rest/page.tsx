import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppTexts } from "@/lib/app-text/repository";
import { AppTextProvider } from "@/lib/app-text/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { loadFocusPlan } from "../focus/account-progress";
import { AccountRest } from "./account-rest";

export const instant = false;

// /rest (#257): the shared rest page for a signed-in user. Pause on /focus opens it. It only
// continues the account's open session; it never opens one.
export default function RestPage() {
  return <RestContent />;
}

async function RestContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const loaded = await loadFocusPlan(client, user.id, null, false).catch(() => null);
  return (
    <AppTextProvider texts={await getAppTexts()}>
      <AccountRest plan={loaded?.plan ?? null} />
    </AppTextProvider>
  );
}
