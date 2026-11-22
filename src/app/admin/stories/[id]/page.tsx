import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { storyDetail } from "@/lib/story-cards/admin";
import { leaksForStory } from "@/lib/story-cards/checks";
import { readStageZeros, readStoryCardsData } from "@/lib/story-cards/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PublishFirstNotice } from "../publish-first-notice";
import { CardEditor } from "./card-editor";
import { PartTitleEditor } from "./part-title-editor";
import { Breadcrumb } from "@/app/admin/admin-ui";

export const instant = false;

const STORY_ID = /^[a-z0-9][a-z0-9-]*$/;

// ADM-06, one story (#293, #304): its background card, then its cards grouped by part with the
// part title. An admin or writer edits a card (a new draft) and the part titles; every version is
// checked (length, dates, spoilers by part, banned words) and only the admin role publishes a
// passing draft. An unknown story shows the normal not-found page; the admin layout has already
// started streaming, so the status stays 200.
export default async function AdminStory({ params }: PageProps<"/admin/stories/[id]">) {
  await connection();
  const { id } = await params;
  if (!STORY_ID.test(id)) notFound();
  const client = await createSupabaseServerClient();
  const [data, zeros, role] = await Promise.all([
    readStoryCardsData(client, id),
    readStageZeros(),
    readContentRole(client),
  ]);
  const story = data.stories.find((row) => row.id === id);
  if (data.ok && !story) notFound();
  const leaks = leaksForStory(data.cards, zeros?.get(id) ?? null);
  const detail = story ? storyDetail(story, data.parts, data.cards, leaks) : null;

  return (
    <>
      <Breadcrumb
        items={[{ label: "Stories", href: "/admin/stories" }, { label: detail?.title ?? "Story" }]}
      />
      <h1>{detail?.title ?? "Story"}</h1>
      {detail ? <p className="admin-text-key">{detail.key}</p> : null}
      <PublishFirstNotice />
      <p className="admin-lede">
        Saving a card makes a new draft; phones keep the published version. Every save checks the
        length (a part card: 1 to 3 sentences, at most 45 words; the background card: at most 70
        words), years, dates and ages, words from later parts and banned words. An admin publishes a
        draft that passes every check.
      </p>
      {zeros === null ? (
        <p className="admin-notice" role="alert">
          The story inputs could not be read, so the spoiler check cannot run. Nothing can be
          published until it can.
        </p>
      ) : null}
      {!data.ok || !detail || !role ? (
        <p className="admin-notice" role="alert">
          This story or its cards could not be read. Try again later.
        </p>
      ) : (
        <div className="admin-text-list">
          <section aria-labelledby="background-heading" className="admin-text">
            <h2 className="admin-story-part" id="background-heading">
              Background card
            </h2>
            {detail.background ? (
              <CardEditor card={detail.background} role={role} />
            ) : (
              <p className="admin-lede">No background card yet.</p>
            )}
          </section>
          {detail.parts.map((part) => (
            <section aria-labelledby={`part-${part.part}`} className="admin-text" key={part.part}>
              <h2 className="admin-story-part" id={`part-${part.part}`}>
                Part {part.part}
                {part.title ? `: ${part.title}` : ""}
              </h2>
              {part.title !== null ? (
                <PartTitleEditor part={part.part} storyId={detail.id} title={part.title} />
              ) : null}
              <ol className="admin-card-list">
                {part.cards.map((entry) => (
                  <li key={entry.key}>
                    <CardEditor card={entry} role={role} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {detail.parts.length === 0 ? (
            <p className="admin-lede">This story has no part cards yet.</p>
          ) : null}
        </div>
      )}
    </>
  );
}
