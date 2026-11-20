import { connection } from "next/server";
import { Suspense } from "react";
import { historyItemName } from "@/lib/admin/history-names";
import { readContentRole } from "@/lib/admin/roles";
import { readCompanionsData } from "@/lib/content-fields/reader";
import { PROMPT_PURPOSE } from "@/lib/prompts/admin";
import { publishHistoryEntries, readPublishHistory } from "@/lib/publish-history/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip } from "../admin-ui";
import { HistoryRowAction } from "./roll-back-button";

// ADM-12 Publish history (#289, docs/decisions/0018): every publish and roll back, newest first,
// with a Roll back button. The layout already checked the role; the rows come through the
// signed-in user's own client from public.list_publish_history(), which answers editors only.
// #313: the prototype's table (When, Who, What, Version), a short UTC date and a readable name
// before every key.
export default function AdminPublishHistory() {
  return (
    <>
      <Breadcrumb items={[{ label: "Review and logs" }]} />
      <h1>Publish history</h1>
      <p className="admin-lede">
        Who published what, and when, newest first. Roll back puts that version back on phones
        within a minute and adds its own row here. Times are in UTC.
      </p>
      <Suspense fallback={null}>
        <PublishHistoryTable />
      </Suspense>
    </>
  );
}

async function PublishHistoryTable() {
  await connection();
  const client = await createSupabaseServerClient();
  const [read, role, content] = await Promise.all([
    readPublishHistory(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    }),
    readContentRole(client),
    readCompanionsData(client),
  ]);
  const entries = publishHistoryEntries(read.rows, role);
  const lookup = {
    companions: content.companions,
    stories: content.stories,
    promptPurpose: PROMPT_PURPOSE,
  };

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
    <div className="admin-panel">
      <table aria-label="Publish history" className="admin-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Who</th>
            <th scope="col">What</th>
            <th scope="col">Version</th>
            <th scope="col">
              <span className="admin-diff-spoken">Roll back</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr aria-label={`${entry.key} v${entry.version}, ${entry.actionLabel}`} key={entry.id}>
              <td className="admin-cell-note">
                <time dateTime={entry.dateTime}>{entry.time}</time>
              </td>
              <td>{entry.person}</td>
              <td>
                {historyItemName(entry.kind, entry.key, lookup)} <KeyChip>{entry.key}</KeyChip>
              </td>
              <td>
                <KeyChip>v{entry.version}</KeyChip>
                {entry.actionLabel === "Rolled back" ? (
                  <span className="admin-cell-note"> Rolled back</span>
                ) : null}
              </td>
              <td>
                <HistoryRowAction
                  canRollBack={entry.canRollBack}
                  isCurrent={entry.isCurrent}
                  itemKey={entry.key}
                  kind={entry.kind}
                  version={entry.version}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
