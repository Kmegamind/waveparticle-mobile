import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { getStoryContent } from "@/lib/content/repository";
import type { StoryInputs } from "@/lib/content/types";
import { storyFields } from "@/lib/content-fields/pages";
import { readCompanionsData } from "@/lib/content-fields/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FieldEditor } from "../../../field-editor";
import { Breadcrumb } from "@/app/admin/admin-ui";
import "./companion-story.css";

export const instant = false;

const ID = /^[a-z0-9][a-z0-9-]*$/;

async function readInputs(storyId: string): Promise<StoryInputs | null> {
  try {
    const content = await getStoryContent();
    return content.stories.find((story) => story.id === storyId)?.inputs ?? null;
  } catch {
    return null;
  }
}

const textList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

// One story's fields (#309): title, period, goal sentence, "Who I am", opening and Life Path
// description, each a draft until an admin publishes. The model-only inputs are shown read-only;
// editing them comes later. The cards of the story are on ADM-06 (#304).
export default async function AdminStoryFields({
  params,
}: PageProps<"/admin/companions/[id]/stories/[story]">) {
  await connection();
  const { id, story: storyId } = await params;
  if (!ID.test(id) || !ID.test(storyId)) notFound();
  const client = await createSupabaseServerClient();
  const [data, role, inputs] = await Promise.all([
    readCompanionsData(client, id),
    readContentRole(client),
    readInputs(storyId),
  ]);
  const companion = data.companions.find((row) => row.id === id);
  const story = data.stories.find((row) => row.id === storyId);
  if (data.ok && (!companion || !story)) notFound();
  const fields =
    companion && story ? storyFields(companion.key_code, story, data.stories, data.fields) : null;
  const stage = inputs?.stageZero ?? {};
  const people = Object.entries(
    (stage.people ?? {}) as Record<string, { role?: unknown; line?: unknown }>,
  );
  const laterWords = textList((stage.scene as { laterWords?: unknown } | undefined)?.laterWords);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Companions", href: "/admin/companions" },
          { label: companion?.name ?? "Companion", href: `/admin/companions/${id}` },
          { label: story?.title ?? "Story" },
        ]}
      />
      <h1>{story?.title ?? "Story"}</h1>
      {companion && story ? (
        <p className="admin-text-key">
          {companion.key_code}.{story.id} · story {story.sequence} ·{" "}
          <Link href={`/admin/stories/${story.id}`}>Cards ›</Link>
        </p>
      ) : null}
      <p className="admin-lede">
        Saving a field makes a new draft; the app and the phones keep the published text. A text
        with a year, a date or an age is refused. A story can move only to the period of the story
        just before or after it. An admin publishes.
      </p>
      {!data.ok || !fields || !role ? (
        <p className="admin-notice" role="alert">
          This story could not be read. Try again later.
        </p>
      ) : (
        <div className="admin-text-list">
          <section aria-labelledby="fields-heading" className="admin-text">
            <h2 className="admin-story-part" id="fields-heading">
              Story fields
            </h2>
            {fields.map((entry) => (
              <FieldEditor
                choices={entry.choices}
                field={entry.view}
                key={entry.view.key}
                label={entry.label}
                limit={entry.limit}
                role={role}
              />
            ))}
          </section>
          <section aria-labelledby="inputs-heading" className="admin-text">
            <h2 className="admin-story-part" id="inputs-heading">
              Model inputs (read-only)
            </h2>
            {inputs === null ? (
              <p className="admin-notice" role="alert">
                The model inputs could not be read. Try again later.
              </p>
            ) : (
              <dl className="admin-history-facts">
                <dt>Facts</dt>
                <dd>
                  <ol>
                    {inputs.facts.map((fact) => (
                      <li key={fact.id}>{fact.text}</li>
                    ))}
                  </ol>
                </dd>
                <dt>People</dt>
                <dd>
                  <ul>
                    {people.map(([name, person]) => (
                      <li key={name}>
                        {name}
                        {typeof person?.line === "string" ? `: ${person.line}` : ""}
                      </li>
                    ))}
                  </ul>
                </dd>
                <dt>Forbidden words</dt>
                <dd>{inputs.forbiddenTerms.join(" · ") || "None"}</dd>
                <dt>Later words</dt>
                <dd>{laterWords.join(" · ") || "None"}</dd>
                <dt>Key moments</dt>
                <dd>
                  <ol>
                    {inputs.keySlices.map((slice) => (
                      <li key={slice.id}>
                        {slice.keyLine} {slice.confirmed ? "(confirmed)" : "(not confirmed yet)"}
                      </li>
                    ))}
                  </ol>
                </dd>
              </dl>
            )}
            <p className="admin-history-note">Editing the model inputs comes later.</p>
          </section>
        </div>
      )}
    </>
  );
}
