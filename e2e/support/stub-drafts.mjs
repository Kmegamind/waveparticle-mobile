// #502: a Companion's stories imported as drafts, in the Supabase stand-in
// (e2e/support/stub-supabase.mjs). The rows come from the real import script's reader
// (scripts/content/import-drafts.mjs) run on an INVENTED export folder written to the system's
// temporary directory, outside the repository: every text here is short and invented, never a
// text of the owner's files.
//
//   POST /__drafts { token, load: true | false, extraVersions?: n }   that account reads Snape's
//        invented draft stories, part titles, cards (version 1, never published) and draft fields
//        with the seed rows, so other tests never see them; save_story_card_draft works on its
//        cards. extraVersions adds n later draft versions of one card (#514: more rows than one
//        API page; the story tables answer at most 1000 rows per request, as the hosted API).
//   get_story_content returns the invented stories for every reader (phones show only
//        Oppenheimer's stories, and his Companion row has no Enter), as after the real import.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDraftExport } from "../../scripts/content/import-drafts.mjs";

const repo = fileURLToPath(new URL("../..", import.meta.url));

/** The two invented stories of the stand-in. */
export const DRAFT_STORIES = ["inv-locked-door", "inv-cold-room"];

function inventedExport() {
  const own = JSON.parse(readFileSync(path.join(repo, "src/content/companions.json"), "utf8")).find(
    (row) => row.id === "snape",
  );
  const base = mkdtempSync(path.join(tmpdir(), "wp-stub-drafts-"));
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
    writeFileSync(path.join(base, file), JSON.stringify(value));
  };
  write("app/companion.json", { ...own, enterHref: "/companions/snape" });
  write("app/parts_and_cards.json", {
    key_code: own.keyCode,
    stories: DRAFT_STORIES.map((id, index) => ({
      id,
      title: `Invented story ${index + 1}`,
      parts: [1, 2, 3, 4, 5].map((part) => ({
        part,
        title: `Invented aim ${part} of story ${index + 1}`,
      })),
      cards: [
        {
          key: `crd.snp.${id}.bg`,
          kind: "background",
          part: null,
          slice: null,
          position: 1,
          body: `Invented background card of story ${index + 1}.`,
        },
        ...[1, 2, 3, 4, 5].flatMap((part) =>
          [1, 2].map((position) => ({
            key: `crd.snp.${id}.p${part}.c${position}`,
            kind: "part",
            part,
            slice: `s${part}`,
            position,
            body: `Invented card ${position} for aim ${part} of story ${index + 1}.`,
          })),
        ),
      ],
    })),
  });
  write(
    "app/stories.json",
    DRAFT_STORIES.map((id, index) => ({
      id,
      sequence: index + 1,
      title: `Invented story ${index + 1}`,
      date: "",
      goal: "Invented goal.",
      facts: [{ id: `${id}-f1`, taskId: "invented_aim", text: "Invented fact." }],
      forbiddenTerms: [],
      keySlices: [
        {
          id: "invented_aim",
          factIds: [`${id}-f1`],
          keyLine: "I kept an invented promise.",
          confirmed: true,
        },
      ],
      provenance: {},
    })),
  );
  write("snape/periods.json", [{ name: "Invented period", storyIds: DRAFT_STORIES }]);
  for (const [index, id] of DRAFT_STORIES.entries()) {
    write(`app/stage0/${id}.stage0.json`, {
      story: {
        id,
        title: `Invented story ${index + 1}`,
        goalShort: `Invented goal sentence ${index + 1}.`,
      },
      who: `Invented who line ${index + 1}.`,
      whereNow: { s1: `Invented place ${index + 1}.` },
    });
  }
  return base;
}

const rows = readDraftExport(inventedExport());

/**
 * The rows one account reads after loading the drafts, fresh each time. `extraVersions` adds that
 * many later draft versions of the first story's first card (#514: more rows than one API page).
 */
export function draftTables(extraVersions = 0) {
  const first = rows.cards.find((card) => card.kind === "part");
  const extra = Array.from({ length: extraVersions }, (_, at) => ({
    ...first,
    version: at + 2,
    body: `Invented later version ${at + 2}.`,
    published: false,
    published_at: null,
  }));
  return {
    stories: rows.stories.map((story) => ({
      ...story,
      goal_short: "",
      who: "",
      opening: "",
      path: "",
    })),
    story_parts: rows.parts.map((part) => ({ ...part })),
    story_cards: [
      ...rows.cards.map((card) => ({
        ...card,
        version: 1,
        published: false,
        published_at: null,
      })),
      ...extra,
    ],
    content_fields: rows.fields.map((field) => ({
      key: field.key,
      version: 1,
      companion_id: rows.companion.id,
      story_id: field.story_id,
      field: field.field,
      body: field.body,
      published: false,
      published_at: null,
    })),
  };
}

/** The invented stories as get_story_content returns them (screen lines empty until published). */
export function draftStoryContent() {
  return {
    stories: rows.stories.map((story) => ({ ...story, goal_short: "", who: "", opening: "" })),
    storyInputs: rows.inputs.map((input) => ({
      story_id: input.story_id,
      date: input.date,
      goal: input.goal,
      facts: JSON.parse(input.facts),
      forbidden_terms: JSON.parse(input.forbidden_terms),
      key_moments: JSON.parse(input.key_moments),
      provenance: JSON.parse(input.provenance),
      stage_zero: JSON.parse(input.stage_zero),
    })),
  };
}
