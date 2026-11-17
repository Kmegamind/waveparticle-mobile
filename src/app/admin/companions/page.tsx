import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { readCompanionsData } from "@/lib/content-fields/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ADM-03 Companions (#309): every Companion in display order with its mode and number of stories.
// The layout already checked the role; the rows come through the signed-in user's own client.
export default function AdminCompanions() {
  return (
    <>
      <h1>Companions</h1>
      <p className="admin-lede">
        Open a Companion to edit his name, tags, &quot;Who I am&quot;, the names of his Life Path
        periods and the fields of each story. A save makes a draft; the app keeps showing the
        published text until an admin publishes.
      </p>
      <Suspense fallback={null}>
        <CompanionTable />
      </Suspense>
    </>
  );
}

async function CompanionTable() {
  await connection();
  const client = await createSupabaseServerClient();
  const data = await readCompanionsData(client);
  return (
    <>
      {data.ok ? null : (
        <p className="admin-notice" role="alert">
          The Companions could not be read. Try again later.
        </p>
      )}
      <ol aria-label="Companions" className="admin-text-list">
        {data.companions.map((companion) => (
          <li key={companion.id}>
            <article aria-label={companion.name} className="admin-text">
              <header className="admin-text-head">
                <h2 className="admin-story-title">
                  <Link href={`/admin/companions/${companion.id}`}>{companion.name}</Link>
                </h2>
                <p className="admin-text-key">chr.{companion.key_code}</p>
              </header>
              <dl className="admin-history-facts">
                <dt>Mode</dt>
                <dd>{companion.mode === "fictional" ? "Fictional" : "Historical"}</dd>
                <dt>Stories</dt>
                <dd>
                  {data.stories.filter((story) => story.companion_id === companion.id).length}
                </dd>
              </dl>
            </article>
          </li>
        ))}
      </ol>
    </>
  );
}
