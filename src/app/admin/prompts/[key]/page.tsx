import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { settingsText } from "@/lib/prompts/diff";
import { isPromptKey, promptDetail, readPromptVersions, settingsLines } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PromptEditor } from "./prompt-editor";
import { Breadcrumb, KeyChip, PageHead } from "@/app/admin/admin-ui";

export const instant = false;

// ADM-08, one prompt (#308), in the prototype's layout (#446): the header row with Save draft and
// Publish, then two panels side by side (the active version's text, note and settings; the editor
// with the Versions table), then the newest draft with its diff against the active version and the
// gateway's row check. An unknown key shows the normal not-found page.
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

  const title = (
    <>
      Prompts · <KeyChip>{key}</KeyChip>
    </>
  );
  const lede = (
    <>
      {detail?.purpose}. Saving makes a new draft version; phones keep the active one until an admin
      publishes. A draft with an unknown {"{{name}}"} or a missing setting cannot be published.
      Phones use a published prompt within a minute.
    </>
  );

  return (
    <>
      <Breadcrumb items={[{ label: "Prompts", href: "/admin/prompts" }, { label: key }]} />
      {!detail || !role ? (
        <>
          <PageHead title={title} />
          <p className="admin-notice" role="alert">
            This prompt could not be read. Try again later.
          </p>
        </>
      ) : (
        <PromptEditor
          active={
            <section aria-labelledby="active-heading" className="admin-panel">
              <h2 className="admin-prompt-heading" id="active-heading">
                {detail.active ? (
                  <>
                    Active <KeyChip>v{detail.active.version}</KeyChip>
                  </>
                ) : (
                  "No active version"
                )}
              </h2>
              {detail.active ? (
                <>
                  <pre aria-label="Active prompt" className="admin-prompt-code">
                    {detail.active.body}
                  </pre>
                  {detail.active.note ? (
                    <p className="admin-prompt-note">{detail.active.note}</p>
                  ) : null}
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
          }
          detail={detail}
          lede={lede}
          role={role}
          startBody={detail.draft?.body ?? detail.active?.body ?? ""}
          startNote={detail.draft?.note ?? ""}
          startSettings={settingsText(detail.draft?.params ?? detail.active?.params ?? {})}
          title={title}
        />
      )}
    </>
  );
}
