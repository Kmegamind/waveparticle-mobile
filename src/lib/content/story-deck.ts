// A story's pre-made cards as the server reads them (#300): the background card and each part's
// cards, from `get_story_cards` (supabase/migrations/20261121000000_premade_cards.sql). Server only.

/** One card, with the version the session uses. */
export type DeckCard = { key: string; version: number; text: string };

/** The background card, then each part's cards in story order. */
export type StoryDeck = { background: DeckCard; parts: DeckCard[][] };

/** Card key -> version: what a session records the first time it reads its cards. */
export type CardVersions = Record<string, number>;

type Row = {
  key: string;
  version: number;
  kind: "background" | "part";
  part: number | null;
  position: number;
  body: string;
};

function rowOf(value: unknown): Row {
  if (typeof value !== "object" || value === null) throw new Error("a card row is not an object");
  const row = value as Record<string, unknown>;
  const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 1;
  if (typeof row.key !== "string" || !row.key.startsWith("crd.")) throw new Error("bad card key");
  if (!whole(row.version) || !whole(row.position)) throw new Error(`bad card ${row.key}`);
  if (typeof row.body !== "string" || row.body.trim() === "") throw new Error(`blank ${row.key}`);
  if (row.kind === "background") {
    if (row.part !== null) throw new Error(`background card ${row.key} has a part`);
  } else if (row.kind !== "part" || !whole(row.part)) {
    throw new Error(`bad card ${row.key}`);
  }
  return row as unknown as Row;
}

/**
 * The deck in a `get_story_cards` answer, or null when the story has no background card or no
 * part card (FAIL-PREMADE: the focus page then shows the failure screen). Malformed rows throw.
 */
export function parseStoryDeck(document: unknown): StoryDeck | null {
  const cards = (document as { cards?: unknown } | null)?.cards;
  if (!Array.isArray(cards)) throw new Error("no card list");
  const rows = cards.map(rowOf);
  const card = (row: Row): DeckCard => ({ key: row.key, version: row.version, text: row.body });
  const background = rows.find((row) => row.kind === "background");
  const partRows = rows
    .filter((row) => row.kind === "part")
    .sort((left, right) => left.part! - right.part! || left.position - right.position);
  if (!background || partRows.length === 0) return null;
  const parts = new Map<number, DeckCard[]>();
  for (const row of partRows) parts.set(row.part!, [...(parts.get(row.part!) ?? []), card(row)]);
  return { background: card(background), parts: [...parts.values()] };
}

/** Every card's version in the deck. */
export function deckVersions(deck: StoryDeck): CardVersions {
  return Object.fromEntries(
    [deck.background, ...deck.parts.flat()].map((card) => [card.key, card.version]),
  );
}
