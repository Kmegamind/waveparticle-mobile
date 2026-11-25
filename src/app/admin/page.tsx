import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  BOARD_STAGES,
  DOT_LEGEND,
  statusBoard,
  type DotState,
} from "@/lib/story-cards/status-board";
import { readCompanionsData } from "@/lib/content-fields/reader";
import { promptList, readPromptVersions } from "@/lib/prompts/admin";
import { storyList } from "@/lib/story-cards/admin";
import { leaksForStory } from "@/lib/story-cards/checks";
import { readStageZeros, readStoryCardsData, sceneCheckFor } from "@/lib/story-cards/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead } from "@/app/admin/admin-ui";

// ADM-01 Status board (#287, #440): the admin's first page, laid out as the prototype's Status
// board: four count tiles, one panel per Companion and the story-by-story table with its stage
// dots and legend. Every number comes from the admin's own data (src/lib/admin/status-board.ts);
// stages with no data source today are not drawn. The layout already checked the role; the rows
// come through the signed-in user's own client.

/** The Companion whose stories have cards (the Stories page reads his). */
const CARD_COMPANION_ID = "oppenheimer";

export default function AdminOverview() {
  return (
    <>
      <Breadcrumb items={[{ label: "Overview" }]} />
      <PageHead
        title="Status board"
        lede="Where every Companion and story stands, from his cards to what users see. Open a story to edit its cards."
      />
      <Suspense fallback={null}>
        <Board />
      </Suspense>
    </>
  );
}

const DOT_CLASS: Record<DotState, string> = {
  done: "admin-dot admin-dot-done",
  passed: "admin-dot admin-dot-passed",
  failed: "admin-dot admin-dot-failed",
  none: "admin-dot admin-dot-none",
};

const DOT_WORDS: Record<DotState, string> = Object.fromEntries(
  DOT_LEGEND.map((item) => [item.state, item.label]),
) as Record<DotState, string>;

async function Board() {
  await connection();
  const client = await createSupabaseServerClient();
  const [content, cardData, zeros, prompts] = await Promise.all([
    readCompanionsData(client),
    readStoryCardsData(client),
    readStageZeros(),
    readPromptVersions(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    }),
  ]);
  const storyRows = cardData.ok
    ? storyList(
        cardData.stories,
        cardData.parts,
        cardData.cards,
        (storyId) =>
          leaksForStory(
            cardData.cards.filter((card) => card.story_id === storyId),
            zeros?.get(storyId) ?? null,
          ),
        (storyId) => sceneCheckFor(zeros, storyId),
      )
    : null;
  const board = statusBoard({
    companions: content.companions,
    stories: content.stories,
    fields: content.ok ? content.fields : null,
    cardCompanionId: CARD_COMPANION_ID,
    storyRows,
    cards: cardData.cards,
    promptDrafts:
      prompts === null
        ? null
        : promptList(prompts).filter((row) => row.draftVersion !== null).length,
  });

  return (
    <>
      {content.ok ? null : (
        <p className="admin-notice" role="alert">
          The Companions could not be read. Try again later.
        </p>
      )}
      {cardData.ok ? null : (
        <p className="admin-notice" role="alert">
          The stories or their cards could not be read, so their counts show &quot;—&quot;. Try
          again later.
        </p>
      )}
      {prompts === null ? (
        <p className="admin-notice" role="alert">
          The prompts could not be read, so the drafts show &quot;—&quot;. Try again later.
        </p>
      ) : null}

      <section aria-label="Counts" className="admin-tiles">
        {board.tiles.map((tile) => (
          <div className="admin-tile" key={tile.label}>
            <b className="admin-tile-number">{tile.value ?? "—"}</b>
            <span className="admin-tile-label">{tile.label}</span>
          </div>
        ))}
      </section>

      <section aria-label="Companions" className="admin-grid3">
        {board.panels.map((panel) => (
          <div aria-label={panel.name} className="admin-panel" key={panel.id} role="group">
            <h2>
              {panel.name} <KeyChip>{panel.code}</KeyChip>
            </h2>
            <p className="admin-note">{panel.note}</p>
          </div>
        ))}
      </section>

      {board.boardName ? (
        <section aria-labelledby="admin-board-title" className="admin-panel">
          <h2 id="admin-board-title">{board.boardName}, story by story</h2>
          <div className="admin-board">
            <table aria-labelledby="admin-board-title" className="admin-table">
              <thead>
                <tr>
                  <th className="admin-num" scope="col">
                    #
                  </th>
                  <th scope="col">Story</th>
                  {BOARD_STAGES.map((stage) => (
                    <th className="admin-stage" key={stage} scope="col">
                      {stage}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.rows.map((row) => (
                  <tr aria-label={row.title} key={row.id}>
                    <td className="admin-num">{row.sequence}</td>
                    <td>
                      <Link href={`/admin/stories/${row.id}`}>{row.title}</Link>
                      <br />
                      <KeyChip>{row.key}</KeyChip>
                    </td>
                    {row.dots.map((dot) => (
                      <td className="admin-stage" key={dot.stage}>
                        <span
                          aria-label={`${dot.stage}: ${DOT_WORDS[dot.state]}, ${dot.words}`}
                          className={DOT_CLASS[dot.state]}
                          role="img"
                          title={dot.words}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-legend">
            {DOT_LEGEND.map((item) => (
              <span key={item.state}>
                <i aria-hidden="true" className={DOT_CLASS[item.state]} />
                {item.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
