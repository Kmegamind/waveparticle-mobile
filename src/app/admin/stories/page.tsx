import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { storyList } from "@/lib/story-cards/admin";
import { readStoryCardsData } from "@/lib/story-cards/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnreviewedNotice } from "./unreviewed-notice";

// ADM-06 Stories (#293): Oppenheimer's stories in story order with their number of parts and cards.
// Read-only. The layout already checked the role; the rows come through the signed-in user's own
// client, whose policies show the cards to content editors only.
export default function AdminStories() {
  return (
    <>
      <h1>Stories</h1>
      <p className="admin-lede">
        Oppenheimer&apos;s stories in story order. Open a story to read its background card and its
        cards, grouped by part. A card longer than CARD-LENGTH allows (a part card: 1 to 3
        sentences, at most 45 words; the background card: at most 70 words) is marked as failing.
      </p>
      <UnreviewedNotice />
      <Suspense fallback={null}>
        <StoryTable />
      </Suspense>
    </>
  );
}

async function StoryTable() {
  await connection();
  const client = await createSupabaseServerClient();
  const data = await readStoryCardsData(client);
  const rows = storyList(data.stories, data.parts, data.cards);
  return (
    <>
      {data.ok ? null : (
        <p className="admin-notice" role="alert">
          The stories or their cards could not be read. Try again later.
        </p>
      )}
      <ol aria-label="Stories" className="admin-text-list admin-story-list">
        {rows.map((row) => (
          <li key={row.id}>
            <article aria-label={row.title} className="admin-text">
              <header className="admin-text-head">
                <h2 className="admin-story-title">
                  <span className="admin-page-id">{row.sequence}</span>{" "}
                  <Link href={`/admin/stories/${row.id}`}>{row.title}</Link>
                </h2>
                <p className="admin-text-key">{row.key}</p>
              </header>
              <dl className="admin-history-facts">
                <dt>Parts</dt>
                <dd data-testid="parts">{row.parts}</dd>
                <dt>Cards</dt>
                <dd data-testid="cards">
                  {row.cards} part {row.cards === 1 ? "card" : "cards"}
                  {row.background ? " and a background card" : ", no background card"}
                </dd>
                {row.failing > 0 ? (
                  <>
                    <dt>Failing</dt>
                    <dd>
                      {row.failing} {row.failing === 1 ? "card is" : "cards are"} over the length
                      limit
                    </dd>
                  </>
                ) : null}
              </dl>
            </article>
          </li>
        ))}
      </ol>
    </>
  );
}
