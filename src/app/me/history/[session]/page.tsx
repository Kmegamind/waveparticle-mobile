import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getStoryContent } from "@/lib/content/repository";
import { sessionRecord } from "@/lib/me/records";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { SessionRecordScreen } from "../record-screens";

export const instant = false;

// ME-REC (#75): one session of this account as a plain record.
export default function SessionRecordPage({ params }: PageProps<"/me/history/[session]">) {
  return <SessionRecordContent params={params} />;
}

async function SessionRecordContent({
  params,
}: Pick<PageProps<"/me/history/[session]">, "params">) {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const { session } = await params;
  const [progress, content] = await Promise.all([
    createSupabaseProgressStore(client).read(user.id, user.id),
    getStoryContent(),
  ]);
  const record = sessionRecord(progress, decodeURIComponent(session), content.companions);
  if (!record) notFound();
  return (
    <main className="app-screen me-page">
      <SessionRecordScreen record={record} />
    </main>
  );
}
