import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { companionRow } from "@/lib/admin/companion-rows";
import { readContentRole } from "@/lib/admin/roles";
import { readCompanionsData } from "@/lib/content-fields/reader";
import {
  PUBLISH_HISTORY_WIDE_LIMIT,
  publishHistoryEntries,
  readPublishHistory,
} from "@/lib/publish-history/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead, StatePill } from "../admin-ui";

// ADM-03 Companions (#309): every Companion in display order with its mode and number of stories.
// The layout already checked the role; the rows come through the signed-in user's own client.
// #313: the prototype's table, with "Shown to users" (Published once phones can open one of his
// stories, otherwise Not ready) and "Last change" (the newest Publish history row that is his).
// #441: as in the prototype, each row is clickable and the name is bold text, not an underlined
// link. The name is still the row's one link (keyboard and screen readers); CSS stretches it over
// the row. The panel scrolls sideways (the prototype's `.panel.scroll`).
export default function AdminCompanions() {
  return (
    <>
      <Breadcrumb items={[{ label: "Content" }]} />
      <PageHead
        title="Companions"
        lede={
          <>
            Open a Companion to edit his name, tags, &quot;Who I am&quot;, the names of his Life
            Path periods and the fields of each story. A save makes a draft; the app keeps showing
            the published text until an admin publishes.
          </>
        }
      />
      <Suspense fallback={null}>
        <CompanionTable />
      </Suspense>
    </>
  );
}

async function CompanionTable() {
  await connection();
  const client = await createSupabaseServerClient();
  const [data, history, role] = await Promise.all([
    readCompanionsData(client),
    readPublishHistory(async (name, args) => {
      const { data: rows, error } = await client.rpc(name, args);
      return { data: rows, error };
    }, PUBLISH_HISTORY_WIDE_LIMIT),
    readContentRole(client),
  ]);
  const changes = publishHistoryEntries(history.rows, role).map((entry) => ({
    kind: entry.kind,
    item_key: entry.key,
    person: entry.person,
    acted_at: entry.dateTime,
  }));
  return (
    <>
      {data.ok ? null : (
        <p className="admin-notice" role="alert">
          The Companions could not be read. Try again later.
        </p>
      )}
      {history.ok ? null : (
        <p className="admin-notice" role="alert">
          Last change could not be read, so it shows &quot;—&quot; for now. Try again later.
        </p>
      )}
      <div className="admin-panel admin-panel-scroll">
        <table aria-label="Companions" className="admin-table">
          <thead>
            <tr>
              <th scope="col">Character</th>
              <th scope="col">Mode</th>
              <th className="admin-num" scope="col">
                Stories
              </th>
              <th scope="col">Shown to users</th>
              <th scope="col">Last change</th>
            </tr>
          </thead>
          <tbody>
            {data.companions.map((companion) => {
              const row = companionRow(companion, data.stories, changes);
              return (
                <tr aria-label={companion.name} className="admin-row-click" key={companion.id}>
                  <td>
                    <Link className="admin-row-link" href={`/admin/companions/${companion.id}`}>
                      {companion.name}
                    </Link>
                    <br />
                    <KeyChip>chr.{companion.key_code}</KeyChip>
                  </td>
                  <td>{companion.mode === "fictional" ? "Fictional" : "Historical"}</td>
                  <td className="admin-num">
                    {data.stories.filter((story) => story.companion_id === companion.id).length}
                  </td>
                  <td>
                    <StatePill state={row.shown === "Published" ? "published" : "draft"}>
                      {row.shown}
                    </StatePill>
                  </td>
                  <td>{row.lastChange}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
