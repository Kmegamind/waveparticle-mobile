import { connection } from "next/server";
import { Suspense } from "react";
import { readContentRole } from "@/lib/admin/roles";
import { appTextAdminRows, appTextChanges, type AppTextVersionRow } from "@/lib/app-text/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, PageHead } from "../admin-ui";
import { AppTextEditor } from "./app-text-editor";
import { PublishChanges } from "./publish-changes";
import "./app-text.css";

// ADM-07 App text (#288): every key the app reads, with its screen, its published text and any
// newer draft. The layout already checked the role; the rows come through the signed-in user's own
// client, whose policy shows drafts to content editors only. #313: the prototype's table (Screen,
// Key, Text, State). #445: one line per key with its text edited in place, and "Publish changes"
// in the header row for an admin.

const TITLE = "App text";
const LEDE = (
  <>
    Words the app shows in its own voice, not a Companion&apos;s. Edit a text to save a draft, then
    publish it. Phones show a published text within a minute. If the database cannot answer, the app
    shows the default written in the code, so a screen is never blank.
  </>
);

export default function AdminAppText() {
  return (
    <>
      <Breadcrumb items={[{ label: "Content" }]} />
      <Suspense fallback={<PageHead lede={LEDE} title={TITLE} />}>
        <AppTextList />
      </Suspense>
    </>
  );
}

async function AppTextList() {
  await connection();
  const client = await createSupabaseServerClient();
  const [{ data, error }, role] = await Promise.all([
    client
      .from("app_text")
      .select("key, version, body, published, published_at, created_at")
      .order("version", { ascending: false }),
    readContentRole(client),
  ]);
  const rows = appTextAdminRows(error || !Array.isArray(data) ? [] : (data as AppTextVersionRow[]));
  return (
    <>
      <PageHead
        actions={role === "admin" ? <PublishChanges changes={appTextChanges(rows)} /> : null}
        lede={LEDE}
        title={TITLE}
      />
      {error ? (
        <p className="admin-notice" role="alert">
          The app text could not be read. Each key shows its default; try again later.
        </p>
      ) : null}
      <div className="admin-panel">
        <table aria-label="App text" className="admin-table">
          <thead>
            <tr>
              <th scope="col">Screen</th>
              <th scope="col">Key</th>
              <th scope="col">Text</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <AppTextEditor key={row.key} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
