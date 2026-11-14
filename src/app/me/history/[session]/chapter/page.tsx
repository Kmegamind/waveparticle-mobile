import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { storyRecord } from "@/lib/me/records";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { StoryRecordScreen } from "../../record-screens";

export const instant = false;

// The record of a finished Story (#94), from the session record's "His chapter ›".
export default function StoryRecordPage({ params }: PageProps<"/me/history/[session]/chapter">) {
  return <StoryRecordContent params={params} />;
}

async function StoryRecordContent({
  params,
}: Pick<PageProps<"/me/history/[session]/chapter">, "params">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const { session } = await params;
  const id = decodeURIComponent(session);
  const progress = await createSupabaseProgressStore(client).read(user.id, user.id);
  const record = storyRecord(progress, id);
  if (!record) notFound();
  return (
    <main className="app-screen me-page">
      <StoryRecordScreen backHref={`/me/history/${encodeURIComponent(id)}`} record={record} />
    </main>
  );
}
