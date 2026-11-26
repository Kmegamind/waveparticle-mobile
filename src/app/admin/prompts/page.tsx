import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { promptList, readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead, StatePill } from "@/app/admin/admin-ui";
import "./prompts.css";

// ADM-08 Prompts (#308, docs/decisions/0025): the gateway's prompts with their active version and
// its settings, and any newer draft. The layout already checked the role; the rows come through the
// signed-in user's own client from public.list_prompt_versions(), which answers editors only.
// #446: the prototype has no list screen, so the list is drawn with its table components: one
// table in a panel, the key as an id chip, versions as chips with a state pill.
export default function AdminPrompts() {
  return (
    <>
      <Breadcrumb items={[{ label: "AI rules" }]} />
      <PageHead
        lede="The prompts the app sends to the AI model, one per feature. Open a prompt to read it and save a new draft of its text and settings. An admin publishes a draft; phones use a published prompt within a minute."
        title="Prompts"
      />
      <Suspense fallback={null}>
        <PromptTable />
      </Suspense>
    </>
  );
}

async function PromptTable() {
  await connection();
  const client = await createSupabaseServerClient();
  const versions = await readPromptVersions(async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  });
  const rows = promptList(versions ?? []);
  return (
    <>
      {versions === null ? (
        <p className="admin-notice" role="alert">
          The prompts could not be read. Try again later.
        </p>
      ) : null}
      <div className="admin-panel">
        <table aria-label="Prompts" className="admin-table admin-prompt-list">
          <thead>
            <tr>
              <th scope="col">Prompt</th>
              <th scope="col">What it is for</th>
              <th scope="col">Active</th>
              <th scope="col">Draft</th>
              <th scope="col">Settings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <Link className="admin-prompt-link" href={`/admin/prompts/${row.key}`}>
                    <KeyChip>{row.key}</KeyChip>
                  </Link>
                </td>
                <td>{row.purpose}</td>
                <td>
                  {row.active ? (
                    <>
                      <KeyChip>v{row.active.version}</KeyChip>{" "}
                      <StatePill state="published">Active</StatePill>
                    </>
                  ) : (
                    "No active version. Every call that uses this prompt fails."
                  )}
                </td>
                <td>
                  {row.draftVersion !== null ? (
                    <>
                      <KeyChip>v{row.draftVersion}</KeyChip>{" "}
                      <StatePill state="draft">Draft</StatePill>
                    </>
                  ) : (
                    <span className="admin-cell-note">None</span>
                  )}
                </td>
                <td>
                  {row.active && row.active.settings.length > 0 ? (
                    <ul aria-label={`Settings of ${row.key}`} className="admin-prompt-settings">
                      {row.active.settings.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
