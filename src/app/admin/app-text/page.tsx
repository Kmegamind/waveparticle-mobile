import { connection } from "next/server";
import { Suspense } from "react";
import { appTextAdminRows, type AppTextVersionRow } from "@/lib/app-text/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppTextEditor } from "./app-text-editor";

// ADM-07 App text (#288): every key the app reads, with its screen, its published text and any
// newer draft. The layout already checked the role; the rows come through the signed-in user's own
// client, whose policy shows drafts to content editors only.
export default function AdminAppText() {
  return (
    <>
      <h1>App text</h1>
      <p className="admin-lede">
        Words the app shows in its own voice, not a Companion&apos;s. Edit a text to save a draft,
        then publish it. Phones show a published text within a minute. If the database cannot
        answer, the app shows the default written in the code, so a screen is never blank.
      </p>
      <Suspense fallback={null}>
        <AppTextList />
      </Suspense>
    </>
  );
}

async function AppTextList() {
  await connection();
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("app_text")
    .select("key, version, body, published, published_at, created_at")
    .order("version", { ascending: false });
  const rows = appTextAdminRows(error || !Array.isArray(data) ? [] : (data as AppTextVersionRow[]));
  return (
    <>
      {error ? (
        <p className="admin-notice" role="alert">
          The app text could not be read. Each key shows its default; try again later.
        </p>
      ) : null}
      <ul className="admin-text-list">
        {rows.map((row) => (
          <li key={row.key}>
            <AppTextEditor row={row} />
          </li>
        ))}
      </ul>
    </>
  );
}
