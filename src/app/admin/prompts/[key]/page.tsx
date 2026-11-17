import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { settingsText } from "@/lib/prompts/diff";
import { isPromptKey, promptDetail, readPromptVersions, settingsLines } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PromptEditor } from "./prompt-editor";

export const instant = false;

// ADM-08, one prompt (#308): its active version's text, settings and note, the editor, the newest
// draft with its diff against the active version and the gateway's row check, and every version.
// An unknown key shows the normal not-found page.
export default async function AdminPrompt({ params }: PageProps<"/admin/prompts/[key]">) {
  await connection();
  const { key } = await params;
  if (!isPromptKey(key)) notFound();
  const client = await createSupabaseServerClient();
  const [versions, role] = await Promise.all([
    readPromptVersions(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    }),
    readContentRole(client),
  ]);
  const detail = versions && role ? promptDetail(key, versions) : null;

  return (
    <>
      <p className="admin-back">
        <Link href="/admin/prompts">‹ Prompts</Link>
      </p>
      <h1 className="admin-text-key">{key}</h1>
      <p className="admin-lede">
        {detail?.purpose}. Saving makes a new draft version; phones keep the active one until an
        admin publishes. A draft with an unknown {"{{name}}"} or a missing setting cannot be
        published. Phones use a published prompt within a minute.
      </p>
      {!detail || !role ? (
        <p className="admin-notice" role="alert">
          This prompt could not be read. Try again later.
        </p>
      ) : (
        <>
          <section aria-labelledby="active-heading" className="admin-text">
            <h2 className="admin-text-key" id="active-heading">
              {detail.active ? `Active v${detail.active.version}` : "No active version"}
            </h2>
            {detail.active ? (
              <>
                {detail.active.note ? (
                  <p className="admin-text-screen">{detail.active.note}</p>
                ) : null}
                <pre aria-label="Active prompt" className="admin-prompt-text">
                  {detail.active.body}
                </pre>
                <ul aria-label="Active settings" className="admin-prompt-settings">
                  {settingsLines(detail.active.params).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="admin-notice" role="alert">
                Every call that uses this prompt fails until a version is published.
              </p>
            )}
          </section>
          <PromptEditor
            detail={detail}
            role={role}
            startBody={detail.draft?.body ?? detail.active?.body ?? ""}
            startNote={detail.draft?.note ?? ""}
            startSettings={settingsText(detail.draft?.params ?? detail.active?.params ?? {})}
          />
        </>
      )}
    </>
  );
}
