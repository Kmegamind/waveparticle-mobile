import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { companionHref } from "@/lib/content/companion-access";
import { getStoryContentForViewer } from "@/lib/content/repository";
import { storyRecord } from "@/lib/me/records";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { StoryRecordScreen } from "../../record-screens";

export const instant = false;

// The record of a finished Story (#94), from the session record's "His chapter ›" or from a
// finished row on the Life Path (`?from=life-path`, whose back link returns there).
export default function StoryRecordPage({
  params,
  searchParams,
}: PageProps<"/me/history/[session]/chapter">) {
  return <StoryRecordContent params={params} searchParams={searchParams} />;
}

async function StoryRecordContent({
  params,
  searchParams,
}: Pick<PageProps<"/me/history/[session]/chapter">, "params" | "searchParams">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const { session } = await params;
  const id = decodeURIComponent(session);
  const progress = await createSupabaseProgressStore(client).read(user.id, user.id);
  const record = storyRecord(await getStoryContentForViewer(client), progress, id);
  if (!record) notFound();
  const { from } = await searchParams;
  const fromLifePath = from === "life-path";
  // #521: back to the Life Path of the session's own Companion.
  const backHref = fromLifePath
    ? companionHref(record.companionId)
    : `/me/history/${encodeURIComponent(id)}`;
  return (
    <main className="app-screen me-page">
      <StoryRecordScreen
        backHref={backHref}
        backLabel={fromLifePath ? "Life Path" : "Session record"}
        record={record}
      />
    </main>
  );
}
