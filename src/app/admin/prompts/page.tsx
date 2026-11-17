import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { promptList, readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ADM-08 Prompts (#308, docs/decisions/0024): the gateway's 7 prompts with their active version and
// its settings, and any newer draft. The layout already checked the role; the rows come through the
// signed-in user's own client from public.list_prompt_versions(), which answers editors only.
export default function AdminPrompts() {
  return (
    <>
      <h1>Prompts</h1>
      <p className="admin-lede">
        The prompts the app sends to the AI model, one per feature. Open a prompt to read it and
        save a new draft of its text and settings. An admin publishes a draft; phones use a
        published prompt within a minute.
      </p>
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
      <ul aria-label="Prompts" className="admin-text-list">
        {rows.map((row) => (
          <li key={row.key}>
            <article aria-label={row.key} className="admin-text">
              <header className="admin-text-head">
                <h2 className="admin-text-key">
                  <Link href={`/admin/prompts/${row.key}`}>{row.key}</Link>
                </h2>
                <p className="admin-text-screen">{row.purpose}</p>
              </header>
              <dl className="admin-history-facts">
                <dt>Active</dt>
                <dd>
                  {row.active ? (
                    <span className="admin-page-id">v{row.active.version}</span>
                  ) : (
                    "No active version. Every call that uses this prompt fails."
                  )}
                </dd>
                {row.draftVersion !== null ? (
                  <>
                    <dt>Draft</dt>
                    <dd>
                      <span className="admin-page-id">v{row.draftVersion}</span> not published yet
                    </dd>
                  </>
                ) : null}
              </dl>
              {row.active && row.active.settings.length > 0 ? (
                <ul aria-label={`Settings of ${row.key}`} className="admin-prompt-settings">
                  {row.active.settings.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
