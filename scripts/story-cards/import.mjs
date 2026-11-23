// Turns a Companion's pre-written story cards (src/content/<companion>/story-decks.json; for
// Oppenheimer the prototype of 2026-11-12) into SQL for `public.story_parts` and
// `public.story_cards` (#293). It prints SQL and connects to nothing: paste it into the Supabase
// SQL editor, or pipe it to psql.
//
//   node scripts/story-cards/import.mjs > story-cards-import.sql            (Oppenheimer)
//   node scripts/story-cards/import.mjs moriarty > story-cards-import.sql   (any Companion, #302)
//   node scripts/story-cards/import.mjs | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
//
// Card keys use the Companion's key code from src/content/companions.json (NAMING, #302).
//
// Each card is loaded as version 1, published, only when its key has no rows yet; each part title
// only when that part has none. Running it twice, or after a later version exists, changes
// nothing. The deck `story1` is not a real story and is skipped. The stories must already be in
// `public.stories` (#284).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const contentDirectory = fileURLToPath(new URL("../../src/content/", import.meta.url));
const companionsFile = path.join(contentDirectory, "companions.json");
const deckFile = (companionId) => path.join(contentDirectory, companionId, "story-decks.json");
const storiesFileOf = (companionId) => path.join(contentDirectory, companionId, "stories.json");

/** The Companion whose cards are imported when no id is given (the cards that exist today). */
const DEFAULT_COMPANION = "oppenheimer";

/** The Companion's key code in card keys (NAMING: `opp`, `mor`), from companions.json. */
export function readCompanionKeyCode(companionId = DEFAULT_COMPANION, file = companionsFile) {
  const companion = JSON.parse(readFileSync(file, "utf8")).find((row) => row.id === companionId);
  if (!companion) throw new Error(`no Companion ${companionId} in companions.json`);
  if (typeof companion.keyCode !== "string" || !/^[a-z]{2,8}$/.test(companion.keyCode)) {
    throw new Error(`${companionId}: keyCode must be 2 to 8 lower-case letters (NAMING)`);
  }
  return companion.keyCode;
}

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** @returns {Record<string, { id: string, background: string, parts: object[] }>} */
export function readStoryDecks(file = deckFile(DEFAULT_COMPANION)) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** The real story ids, in story order (stories.json, the seed of `public.stories`). */
export function readStoryIds(file = storiesFileOf(DEFAULT_COMPANION)) {
  return JSON.parse(readFileSync(file, "utf8"))
    .sort((left, right) => left.sequence - right.sequence)
    .map((story) => story.id);
}

/** crd.<code>.<story>.bg, or crd.<code>.<story>.p<part>.c<slot> for a part card. */
export function cardKey(storyId, part, slot, keyCode = readCompanionKeyCode()) {
  const story = `crd.${keyCode}.${storyId}`;
  return part === undefined ? `${story}.bg` : `${story}.p${part}.c${slot}`;
}

/**
 * The rows for the two tables, in story order. Deck stories not in `storyIds` are skipped when
 * they are the prototype's `story1`, and refused otherwise; a real story without a deck is refused.
 * @param {Record<string, any>} decks
 * @param {string[]} [storyIds]
 * @param {string} [keyCode] the Companion's key code (default Oppenheimer's)
 */
export function storyCardRows(decks, storyIds = readStoryIds(), keyCode = readCompanionKeyCode()) {
  for (const id of Object.keys(decks)) {
    if (id !== "story1" && !storyIds.includes(id)) throw new Error(`deck ${id} is not a story`);
  }
  const parts = [];
  const cards = [];
  for (const storyId of storyIds) {
    const deck = decks[storyId];
    if (!deck) throw new Error(`story ${storyId} has no deck`);
    if (!SAFE_ID.test(storyId)) throw new Error(`unsafe story id: ${storyId}`);
    cards.push({
      key: cardKey(storyId, undefined, undefined, keyCode),
      story_id: storyId,
      kind: "background",
      part: null,
      slice: null,
      position: 1,
      body: deck.background,
    });
    const seen = new Set();
    for (const part of deck.parts) {
      if (!Number.isInteger(part.n) || part.n < 1 || part.n > 5) {
        throw new Error(`story ${storyId}: part ${part.n} is not 1 to 5`);
      }
      // A repeated part would share keys with the first one and its cards would be skipped.
      if (seen.has(part.n)) throw new Error(`${storyId}: part ${part.n} appears twice`);
      seen.add(part.n);
      if (typeof part.title !== "string" || part.title.trim() === "") {
        throw new Error(`${storyId}: part ${part.n} has no title`);
      }
      parts.push({ story_id: storyId, part: part.n, title: part.title });
      part.cards.forEach((card, index) => {
        if (!/^s[1-9][0-9]*$/.test(card.at)) {
          throw new Error(`story ${storyId}: card slice ${card.at} is not s1, s2 ...`);
        }
        cards.push({
          key: cardKey(storyId, part.n, index + 1, keyCode),
          story_id: storyId,
          kind: "part",
          part: part.n,
          slice: card.at,
          position: index + 1,
          body: card.text,
        });
      });
    }
  }
  return { parts, cards };
}

/**
 * A standard SQL string: single quotes, each quote doubled. With standard_conforming_strings on,
 * backslashes are literal, so no value can end the string early. NUL cannot be stored and is
 * refused.
 */
export function quote(text) {
  if (typeof text !== "string") throw new Error("a text is missing");
  if (text.includes("\0")) throw new Error("a text contains a NUL character");
  return `'${text.replaceAll("'", "''")}'`;
}

const literal = (value) =>
  value === null ? "null" : typeof value === "number" ? String(value) : quote(value);

/**
 * @param {{ parts: object[], cards: object[] }} rows
 * @param {string} [companionId]
 */
export function storyCardsImportSql(rows, companionId = DEFAULT_COMPANION) {
  const lines = [
    `-- Story cards from src/content/${companionId}/story-decks.json (scripts/story-cards/import.mjs, #293).`,
    "begin;",
    "set local standard_conforming_strings = on;",
  ];
  for (const part of rows.parts) {
    lines.push(
      `insert into public.story_parts (story_id, part, title) values (${quote(part.story_id)}, ${part.part}, ${quote(part.title)})\n` +
        "  on conflict (story_id, part) do nothing;",
    );
  }
  for (const card of rows.cards) {
    const values = [card.key, card.story_id, card.kind, card.part, card.slice, card.position]
      .map(literal)
      .join(", ");
    lines.push(
      "insert into public.story_cards (key, story_id, kind, part, slice, position, body, version, published, published_at)\n" +
        `  select ${values}, ${quote(card.body)}, 1, true, now()\n` +
        `  where not exists (select 1 from public.story_cards where key = ${quote(card.key)});`,
    );
  }
  lines.push("commit;", "");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const companionId = process.argv[2] ?? DEFAULT_COMPANION;
  if (!/^[a-z][a-z0-9-]*$/.test(companionId)) {
    console.error("Usage: node scripts/story-cards/import.mjs [companion-id]");
    process.exit(1);
  }
  const rows = storyCardRows(
    readStoryDecks(deckFile(companionId)),
    readStoryIds(storiesFileOf(companionId)),
    readCompanionKeyCode(companionId),
  );
  process.stdout.write(storyCardsImportSql(rows, companionId));
}
