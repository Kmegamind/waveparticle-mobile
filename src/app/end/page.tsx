import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
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
  if (!isPrototypeEnabled()) notFound();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const { session } = await searchParams;
  const progress = await createSupabaseProgressStore(client)
    .read(user.id, user.id)
    .catch(() => null);
  const view = progress && typeof session === "string" ? summaryOf(progress, session) : null;
  return view ? <EndScreen view={view} /> : <NoSummary />;
}
