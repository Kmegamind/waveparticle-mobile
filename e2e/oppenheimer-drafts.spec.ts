import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn, stubTables } from "./support/account";

// As e2e/support/invented-card-export.mjs and stub-drafts.mjs (Playwright loads specs as CommonJS,
// so those ES modules, which read import.meta, cannot be imported here).
const newCardText = (storyId: string, part: number | null, position: number) =>
  part === null
    ? `Invented new background of ${storyId}.`
    : `Invented new card ${position} of part ${part} in ${storyId}.`;
const KEPT_STORY = "tolman-lecture";
const KEPT_CARDS = [2, 6, 3, 1, 2];

// #516: Oppenheimer's regenerated cards imported as drafts next to his published placeholder cards
// (scripts/content/import-drafts.mjs --keep-published), and stories with 3, 4 or 5 parts on the
// phone. Every new card here is INVENTED (e2e/support/invented-card-export.mjs); the stand-in adds
// the drafts for one account only, and serves an invented deck for one story only while a test
// runs. The real SQL runs end to end in tests/story-switch-database.test.ts.

test.describe.configure({ mode: "serial" });

const root = path.join(__dirname, "..");
const decks = JSON.parse(
  readFileSync(path.join(root, "src", "content", "oppenheimer", "story-decks.json"), "utf8"),
) as Record<string, { background: string; parts: { cards: { text: string }[] }[] }>;
const stories = JSON.parse(
  readFileSync(path.join(root, "src", "content", "oppenheimer", "stories.json"), "utf8"),
) as { id: string; title: string }[];

const GOAL = "dddddddd-dddd-4ddd-8ddd-dddddddd5160";
const SESSION = "dddddddd-dddd-4ddd-8ddd-dddddddd5161";
const STEPS = ["dddddddd-dddd-4ddd-8ddd-dddddddd5162", "dddddddd-dddd-4ddd-8ddd-dddddddd5163"];

/** An account (any role) with a Goal of two Steps and its open session on `story`. */
function withOpenSession(
  context: BrowserContext,
  page: Page,
  story: string,
  contentRole?: "admin",
) {
  const now = new Date().toISOString();
  return signIn(
    context,
    baseUrlOf(page),
    (userId) => ({
      goals: [
        {
          id: GOAL,
          user_id: userId,
          title: "Write the report",
          text: "Write the report",
          status: "in_progress",
          kind: "one_time",
          created_at: now,
          updated_at: now,
        },
      ],
      steps: STEPS.map((id, position) => ({
        id,
        goal_id: GOAL,
        position,
        title: position === 0 ? "Outline" : "Draft",
        description: null,
        minutes: 15,
      })),
      sessions: [
        {
          id: SESSION,
          goal_id: GOAL,
          user_id: userId,
          state: "open",
          companion_id: "oppenheimer",
          story_id: story,
          seed: "s",
          step_count: STEPS.length,
          started_at: now,
          last_active_at: now,
          completed_at: null,
        },
      ],
      session_steps: STEPS.map((stepId, position) => ({
        id: `dddddddd-dddd-4ddd-8ddd-dddddddd517${position}`,
        session_id: SESSION,
        step_id: stepId,
        position,
        opened_at: null,
        done_at: null,
      })),
    }),
    contentRole ? { contentRole } : {},
  );
}

async function post(route: string, body: unknown) {
  const answer = await fetch(`${STUB_SUPABASE}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`stub ${route} failed: ${answer.status}`);
}

/**
 * Waits for the focus page's first card. e2e/premade-cards.spec.ts switches the stand-in's card
 * reads off for a moment (one switch for every file), so a read that fails then shows Retry,
 * which is pressed as a user would.
 */
async function firstCard(page: Page, text: string) {
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(async () => {
    const retry = focus.getByRole("button", { name: "Retry" });
    if (await retry.isVisible()) await retry.click();
    await expect(focus.getByTestId("story-card")).toContainText(text, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  return focus;
}

test.describe("#516 the new cards are drafts next to the published placeholders", () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  test("test_516_ac2_the_admin_story_shows_the_placeholders_and_the_new_drafts_apart", async ({
    page,
    context,
  }) => {
    const account = await withOpenSession(context, page, KEPT_STORY, "admin");
    await post("/__drafts", { token: account.token, load: "oppenheimer" });
    await page.goto(`/admin/stories/${KEPT_STORY}`);
    await expect(page.getByRole("heading", { level: 1, name: "Story cards" })).toBeVisible();

    // A key in both sets: the placeholder is published, the new text is its newer draft.
    const shared = page.getByRole("article", { name: `crd.opp.${KEPT_STORY}.p1.c1` });
    await expect(shared.getByTestId("card-meta")).toContainText("Published");
    await expect(shared.getByTestId("card-text")).toContainText(
      decks[KEPT_STORY].parts[0].cards[0].text,
    );
    const draft = shared.getByRole("region", { name: "Draft v2" });
    await expect(draft).toContainText("Newer draft");
    await expect(draft).toContainText(newCardText(KEPT_STORY, 1, 1));

    // A new key (a sixth card of part 2, a fifth part): a draft only.
    const added = page.getByRole("article", { name: `crd.opp.${KEPT_STORY}.p2.c6` });
    await expect(added.getByTestId("card-meta")).toContainText("Draft");
    await expect(added.getByTestId("card-meta")).not.toContainText("Published");
    await expect(added.getByTestId("card-text")).toContainText(newCardText(KEPT_STORY, 2, 6));
    await expect(page.getByRole("heading", { level: 2, name: "Part 5" })).toBeVisible();
    const fifth = page.getByRole("article", { name: `crd.opp.${KEPT_STORY}.p5.c1` });
    await expect(fifth.getByTestId("card-meta")).toContainText("Draft");

    // An old key the new set does not have: still published, with no draft.
    const placeholderParts = decks[KEPT_STORY].parts;
    const lastOld = `crd.opp.${KEPT_STORY}.p4.c${placeholderParts[3].cards.length}`;
    expect(KEPT_CARDS[3]).toBeLessThan(placeholderParts[3].cards.length);
    const old = page.getByRole("article", { name: lastOld });
    await expect(old.getByTestId("card-meta")).toContainText("Published");
    await expect(old.getByRole("region", { name: /^Draft v/ })).toHaveCount(0);

    // AC3: the phone of the same account still shows the published placeholder card.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/focus?goal=${GOAL}`);
    const focus = await firstCard(page, decks[KEPT_STORY].background);
    await expect(focus.getByText(newCardText(KEPT_STORY, null, 1))).toHaveCount(0);
  });
});

// AC5: one story, served by the stand-in with an invented deck of 3, 4 or 5 parts.
const DECK_STORY = "griggs-in-princeton";
const DECK_TITLE = stories.find((story) => story.id === DECK_STORY)!.title;

for (const cards of [
  [3, 4, 3],
  [2, 3, 2, 3],
  [2, 2, 3, 2, 2],
]) {
  test(`test_516_ac5_a_story_with_${cards.length}_parts_works_in_a_session_on_the_life_path_and_the_plan_page`, async ({
    page,
    context,
  }) => {
    await post("/__story_cards", { deck: { story: DECK_STORY, cards } });
    try {
      const account = await withOpenSession(context, page, DECK_STORY);
      // The session: Step 1 opens with the new deck's background card, and the session pins a
      // version of every card of every part.
      await page.goto(`/focus?goal=${GOAL}`);
      const focus = await firstCard(page, newCardText(DECK_STORY, null, 1));
      await expect(focus.getByText(`Step 1 of ${STEPS.length}`, { exact: true })).toBeVisible();
      const keys = [
        `crd.opp.${DECK_STORY}.bg`,
        ...cards.flatMap((count, at) =>
          Array.from({ length: count }, (_, i) => `crd.opp.${DECK_STORY}.p${at + 1}.c${i + 1}`),
        ),
      ].sort();
      await expect
        .poll(async () => {
          const tables = await stubTables(account);
          const session = (tables.sessions as { id: string; card_versions?: object }[]).find(
            (row) => row.id === SESSION,
          );
          return Object.keys(session?.card_versions ?? {}).sort();
        })
        .toEqual(keys);

      // The Life Path lists the story; the plan page opens. Neither reads parts or merged titles.
      await page.goto("/companions/oppenheimer");
      await expect(page.getByText(DECK_TITLE).first()).toBeVisible();
      await page.goto("/goal");
      await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
    } finally {
      await post("/__story_cards", { restore: DECK_STORY });
    }
  });
}
