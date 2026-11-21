import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { storyList } from "@/lib/story-cards/admin";
import { leaksForStory } from "@/lib/story-cards/checks";
import { readStageZeros, readStoryCardsData, sceneCheckFor } from "@/lib/story-cards/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UnreviewedNotice } from "./unreviewed-notice";
import { Breadcrumb } from "@/app/admin/admin-ui";

// ADM-06 Stories (#293, #304): Oppenheimer's stories in story order with their number of parts and
// cards, and how many cards fail a check. The layout already checked the role; the rows come
// through the signed-in user's own client, whose policies show the cards to content editors only.
export default function AdminStories() {
  return (
    <>
      <Breadcrumb items={[{ label: "Content" }]} />
      <h1>Stories</h1>
      <p className="admin-lede">
        Oppenheimer&apos;s stories in story order. Open a story to read and edit its background
        card, its cards and its part titles. A card that fails a check (its length, a year, date or
        age, a word from a later part, or a banned word) is counted as failing.
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
  const [data, zeros] = await Promise.all([readStoryCardsData(client), readStageZeros()]);
  const rows = storyList(
    data.stories,
    data.parts,
    data.cards,
    (storyId) =>
      leaksForStory(
        data.cards.filter((card) => card.story_id === storyId),
        zeros?.get(storyId) ?? null,
      ),
    (storyId) => sceneCheckFor(zeros, storyId),
  );
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
                      {row.failing} {row.failing === 1 ? "card fails" : "cards fail"} a check
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
