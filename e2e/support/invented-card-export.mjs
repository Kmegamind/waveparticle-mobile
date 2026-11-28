// #516: an INVENTED card export in the shape of the owner's story-pipeline folder
// (`characters/<id>/export/app/companion.json` and `app/parts_and_cards.json`), written to the
// system's temporary directory, outside the repository. Shared by the unit tests, the database test
// and the e2e stand-in. Every text here is short and invented, never a text of the owner's files.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../..", import.meta.url));

/** The invented text of a new card, so a test can tell it from a placeholder. */
export const newCardText = (storyId, part, position) =>
  part === null
    ? `Invented new background of ${storyId}.`
    : `Invented new card ${position} of part ${part} in ${storyId}.`;

/** The invented title of a new part. */
export const newPartTitle = (part) => `Invented new aim ${part}`;

/** #526: the invented spoiler word of a slice of the new stage 0 (one slice per part). */
export const newLeakWord = (storyId, part) => `Inventaleak${part}${storyId.replace(/-/g, "")}`;

/**
 * #526: an invented new stage 0 file (app/stage0/<story>.stage0.json) for a story of `parts`
 * parts: one slice per part (sK = part K, as the story pipeline writes it), one step per part
 * covering its slice, and a scene. Its display texts are invented too; the import never reads them.
 */
export function newStageZero(storyId, parts) {
  return {
    who: `Invented export who line of ${storyId}.`,
    story: { title: `Invented title of ${storyId}`, goalShort: "Invented export goal sentence." },
    whereNow: { s1: "Invented export place." },
    slices: Array.from({ length: parts }, (_, at) => ({
      id: `s${at + 1}`,
      priority: 1,
      facts: [`Invented new fact of part ${at + 1}.`],
      leaks: [newLeakWord(storyId, at + 1)],
    })),
    steps: Array.from({ length: parts }, (_, at) => ({
      n: at + 1,
      title: newPartTitle(at + 1),
      covers: [`s${at + 1}`],
    })),
    scene: {
      present: ["Oppenheimer"],
      allowedWords: ["Invented"],
      pauseProp: "invented lamp",
      laterWords: [],
      props: ["invented lamp"],
    },
  };
}

/**
 * Writes an invented export folder and returns its path.
 * @param {{ companionId?: string, stories: { id: string, cards: number[] }[],
 *   stageZero?: boolean, change?: (files: Record<string, any>) => void }} options
 *   `cards` holds the number of cards of each part: [3, 4, 2] is a story with three parts.
 *   `stageZero` also writes each story's new stage 0 file (#526); without it the export is
 *   cards only, as #516's.
 */
export function writeInventedCardExport({
  companionId = "oppenheimer",
  stories,
  stageZero = false,
  change,
}) {
  const own = JSON.parse(readFileSync(path.join(repo, "src/content/companions.json"), "utf8")).find(
    (row) => row.id === companionId,
  );
  if (!own) throw new Error(`no Companion ${companionId}`);
  const code = own.keyCode;
  const files = {
    // As the owner's export: the short fields, but its own line and tags (they are not imported).
    "app/companion.json": { ...own, line: "Invented export line.", tags: "Invented, tags" },
    "app/parts_and_cards.json": {
      key_code: code,
      stories: stories.map(({ id, cards }) => ({
        id,
        title: `Invented title of ${id}`,
        goal: "Invented goal.",
        parts: cards.map((_, at) => ({ part: at + 1, title: newPartTitle(at + 1) })),
        merged_titles: [],
        cards: [
          {
            key: `crd.${code}.${id}.bg`,
            kind: "background",
            part: null,
            slice: null,
            position: 1,
            body: newCardText(id, null, 1),
          },
          ...cards.flatMap((count, at) =>
            Array.from({ length: count }, (_, index) => ({
              key: `crd.${code}.${id}.p${at + 1}.c${index + 1}`,
              kind: "part",
              part: at + 1,
              slice: `s${at + 1}`,
              position: index + 1,
              body: newCardText(id, at + 1, index + 1),
            })),
          ),
        ],
      })),
    },
  };
  if (stageZero) {
    for (const { id, cards } of stories) {
      files[`app/stage0/${id}.stage0.json`] = newStageZero(id, cards.length);
    }
  }
  change?.(files);
  const base = mkdtempSync(path.join(tmpdir(), "wp-invented-cards-"));
  for (const [file, value] of Object.entries(files)) {
    if (value === undefined) continue;
    mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
    writeFileSync(path.join(base, file), JSON.stringify(value, null, 2));
  }
  return base;
}
