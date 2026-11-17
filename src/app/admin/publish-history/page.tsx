import { connection } from "next/server";
import { Suspense } from "react";
import { readContentRole } from "@/lib/admin/roles";
import { publishHistoryEntries, readPublishHistory } from "@/lib/publish-history/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HistoryRowAction } from "./roll-back-button";

// ADM-12 Publish history (#289, docs/decisions/0018): every publish and roll back, newest first,
// with a Roll back button. The layout already checked the role; the rows come through the
// signed-in user's own client from public.list_publish_history(), which answers editors only.
export default function AdminPublishHistory() {
  return (
    <>
      <h1>Publish history</h1>
      <p className="admin-lede">
        Every publish and roll back, newest first. Roll back puts that version back on phones within
        a minute and adds its own row here. Times are in UTC.
      </p>
      <Suspense fallback={null}>
        <PublishHistoryList />
      </Suspense>
    </>
  );
}

async function PublishHistoryList() {
  await connection();
  const client = await createSupabaseServerClient();
  const [read, role] = await Promise.all([
    readPublishHistory(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    }),
    readContentRole(client),
  ]);
  const entries = publishHistoryEntries(read.rows, role);

  if (!read.ok) {
    return (
      <p className="admin-notice" role="alert">
        The publish history could not be read. Try again later.
      </p>
    );
  }
  if (entries.length === 0) {
    return <p className="admin-lede">Nothing has been published yet.</p>;
  }
  return (
    <ol className="admin-text-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <article
            aria-label={`${entry.key} v${entry.version}, ${entry.actionLabel}`}
            className="admin-text"
          >
            <header className="admin-text-head">
              <h2 className="admin-text-key">{entry.key}</h2>
              <p className="admin-text-screen">{entry.kindLabel}</p>
            </header>
            <dl className="admin-history-facts">
              <dt>Action</dt>
              <dd>
                {entry.actionLabel} <span className="admin-page-id">v{entry.version}</span>
              </dd>
              <dt>By</dt>
              <dd>{entry.person}</dd>
              <dt>When</dt>
              <dd>
                <time dateTime={entry.dateTime}>{entry.time}</time>
              </dd>
            </dl>
            <HistoryRowAction
              canRollBack={entry.canRollBack}
              isCurrent={entry.isCurrent}
              itemKey={entry.key}
              kind={entry.kind}
              version={entry.version}
            />
          </article>
        </li>
      ))}
    </ol>
  );
}
