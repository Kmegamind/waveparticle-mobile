import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { storyDetail, type StoryCardView } from "@/lib/story-cards/admin";
import { readStoryCardsData } from "@/lib/story-cards/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnreviewedNotice } from "../unreviewed-notice";

export const instant = false;

const STORY_ID = /^[a-z0-9][a-z0-9-]*$/;

// ADM-06, one story (#293): its background card, then its cards grouped by part with the part title
// and each card's key, slice, version and length check. Read-only. An unknown story shows the
// normal not-found page; the admin layout has already started streaming, so the status stays 200.
export default async function AdminStory({ params }: PageProps<"/admin/stories/[id]">) {
  await connection();
  const { id } = await params;
  if (!STORY_ID.test(id)) notFound();
  const client = await createSupabaseServerClient();
  const data = await readStoryCardsData(client, id);
  const story = data.stories.find((row) => row.id === id);
  if (data.ok && !story) notFound();
  const detail = story ? storyDetail(story, data.parts, data.cards) : null;

  return (
    <>
      <p className="admin-back">
        <Link href="/admin/stories">‹ Stories</Link>
      </p>
      <h1>{detail?.title ?? "Story"}</h1>
      {detail ? <p className="admin-text-key">{detail.key}</p> : null}
      <UnreviewedNotice />
      {!data.ok || !detail ? (
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
              <CardItem card={detail.background} />
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
              <ol className="admin-card-list">
                {part.cards.map((entry) => (
                  <li key={entry.key}>
                    <CardItem card={entry} />
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

function CardItem({ card }: { card: StoryCardView }) {
  const failing = card.problems.length > 0;
  return (
    <article aria-label={card.key} className="admin-card">
      <p className="admin-card-body">{card.body}</p>
      <dl className="admin-history-facts">
        <dt>Key</dt>
        <dd className="admin-text-key">{card.key}</dd>
        {card.slice ? (
          <>
            <dt>Slice</dt>
            <dd>{card.slice}</dd>
          </>
        ) : null}
        <dt>Version</dt>
        <dd>
          v{card.version}, {card.published ? "published" : "draft"}
        </dd>
        <dt>Length</dt>
        <dd>
          {card.words} words · {failing ? "Fails CARD-LENGTH" : "Passes CARD-LENGTH"}
        </dd>
      </dl>
      {failing ? (
        <ul aria-label="Length problems" className="admin-card-problems">
          {card.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
