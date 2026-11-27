import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { readCompanionsData } from "@/lib/content-fields/reader";
import { storyList } from "@/lib/story-cards/admin";
import { leaksForStory } from "@/lib/story-cards/checks";
import { lifePath } from "@/lib/story-cards/life-path";
import {
  companionOfPage,
  readStageZeros,
  readStoryCardsData,
  sceneCheckFor,
} from "@/lib/story-cards/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PublishFirstNotice } from "./publish-first-notice";
import { Breadcrumb, KeyChip, PageHead, StatePill } from "@/app/admin/admin-ui";

// ADM-06 Stories (#293, #304), drawn as the prototype's Life path table (#443): a Companion's
// stories (Oppenheimer's, or ?companion=<id> since #502) grouped by Life Path period, each with its number, title, key, Life path description and
// the state of that description, plus its part and card counts and how many cards fail a check.
// The layout already checked the role; the rows come through the signed-in user's own client,
// whose policies show the cards and the field versions to content editors only.
export default function AdminStories({ searchParams }: PageProps<"/admin/stories">) {
  return (
    <Suspense fallback={null}>
      <LifePathPage searchParams={searchParams} />
    </Suspense>
  );
}

async function LifePathPage({
  searchParams,
}: {
  searchParams: PageProps<"/admin/stories">["searchParams"];
}) {
  await connection();
  const companionId = companionOfPage((await searchParams).companion);
  const client = await createSupabaseServerClient();
  const [data, zeros, fields] = await Promise.all([
    readStoryCardsData(client, undefined, companionId),
    readStageZeros(),
    readCompanionsData(client, companionId),
  ]);
  const code = data.companion?.key_code;
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
    code,
  );
  const companion = fields.companions.find((row) => row.id === companionId);
  // #502: a Companion whose cards were imported as drafts, none of them published yet.
  const drafts =
    data.cards.length > 0 && data.cards.every((card) => !card.published && !card.published_at);
  const periods = companion
    ? lifePath(companion.key_code, fields.stories, data.ok ? rows : [], fields.fields)
    : [];
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Companions", href: "/admin/companions" },
          {
            label: companion?.name ?? "Companion",
            href: `/admin/companions/${companionId}`,
          },
        ]}
      />
      <PageHead
        title="Stories"
        lede={
          <>
            {companion?.short_name ?? data.companion?.short_name ?? "His"}&apos;s stories in story
            order, by Life Path period. Periods are named, never dated. Open a story to edit its
            cards and part titles. Description state is the state of the Life path description only
            (Published, a draft not published yet, or Not written), not of the story&apos;s cards;
            the description and the period names are edited on the Companion&apos;s page.
          </>
        }
      />
      <PublishFirstNotice drafts={drafts} />
      {data.ok ? null : (
        <p className="admin-notice" role="alert">
          The stories or their cards could not be read. Try again later.
        </p>
      )}
      {fields.ok && companion ? null : (
        <p className="admin-notice" role="alert">
          The Life Path periods and descriptions could not be read. Try again later.
        </p>
      )}
      <div className="admin-panel admin-scroll">
        <table aria-label="Stories" className="admin-table admin-life-path">
          <thead>
            <tr>
              <th className="admin-num" scope="col">
                #
              </th>
              <th scope="col">Story</th>
              <th scope="col">Life path description</th>
              <th scope="col">Description state</th>
            </tr>
          </thead>
          {periods.map((period) => (
            <tbody aria-label={`Period ${period.number}: ${period.name}`} key={period.number}>
              <tr className="admin-period-row">
                <td colSpan={4}>
                  {period.name} <KeyChip>{period.key}</KeyChip>
                </td>
              </tr>
              {period.stories.map((story) => (
                <tr aria-label={story.title} key={story.id}>
                  <td className="admin-num">{story.sequence}</td>
                  <td>
                    <Link className="admin-cell-name" href={`/admin/stories/${story.id}`}>
                      {story.title}
                    </Link>
                    <br />
                    <KeyChip>{story.key}</KeyChip>
                    {story.counts ? (
                      <>
                        <br />
                        <span className="admin-cell-note">
                          <span data-testid="parts">{story.counts.parts}</span> ·{" "}
                          <span data-testid="cards">{story.counts.cards}</span>
                          {story.counts.failing ? ` · ${story.counts.failing}` : null}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {story.description.text ?? (
                      <span className="admin-cell-note admin-path-note">
                        {story.description.note}
                      </span>
                    )}
                  </td>
                  <td>
                    <StatePill state={story.state.pill}>{story.state.label}</StatePill>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}
