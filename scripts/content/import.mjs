// Turns the story content files into SQL for the `companions`, `stories` and `story_inputs`
// tables (#284). It prints SQL and connects to nothing: paste it into the Supabase SQL editor, or
// pipe it to psql.
//
//   node scripts/content/import.mjs > story-content-import.sql
//   node scripts/content/import.mjs | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
//   node scripts/content/import.mjs --companion moriarty > moriarty-import.sql
//
// Every Companion in src/content/companions.json is written; --companion <id> limits the stories to
// that Companion's (#302). A story whose screen lines are missing stops it before any SQL is
// printed, with the list of what is missing.
//
// Every row is inserted or, when it exists, replaced by the files' version, in one transaction.
// Running it twice changes nothing. It does not delete rows that are no longer in the files.
// The fields the admin edits (#309: a Companion's name and tags; a story's title, period, goal
// sentence, "Who I am" and opening) are written only for a new row: on an existing row the
// published text of the admin stays. Run the export first if the tables were edited otherwise.
// A story whose inputs are marked outsideRepository (a switch-over of #526, a draft import of
// #502) keeps its stored inputs: the import never writes the files' version over them.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readContentRows } from "./content-files.mjs";

const defaultRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * A standard SQL string: single quotes, each quote doubled. Postgres reads backslashes literally
 * (standard_conforming_strings is on by default), so no value can end the string early. A NUL
 * character cannot be stored in Postgres text and is refused.
 */
function quote(text) {
  if (text.includes("\0")) throw new Error("a text contains a NUL character");
  return `'${text.replaceAll("'", "''")}'`;
}

const literal = (value) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (typeof value === "string") return quote(value);
  return `${quote(JSON.stringify(value))}::json`;
};

/** The columns the admin edits and publishes (#309): an existing row keeps them. */
const EDITED_IN_ADMIN = {
  companions: ["name", "tags"],
  stories: ["title", "period", "goal_short", "who", "opening"],
  story_inputs: [],
};

function upsert(table, key, row) {
  const kept = EDITED_IN_ADMIN[table] ?? [];
  const columns = Object.keys(row);
  const values = columns.map((column) =>
    column === key ? `'${row[column]}'` : literal(row[column]),
  );
  const updates = columns
    .filter((column) => column !== key && !kept.includes(column))
    .map((column) => `${column} = excluded.${column}`);
  // #526 (#533 review I2): the inputs of a story kept outside the repository (a story switched over
  // to the owner's regenerated stage 0, or a draft import of #502) are never overwritten by the
  // files: the files hold its placeholder, or nothing.
  const guard =
    table === "story_inputs"
      ? `\n  where coalesce(public.story_inputs.provenance::jsonb ->> 'outsideRepository', '') <> 'true'`
      : "";
  return (
    `insert into public.${table} (${columns.join(", ")}) values (${values.join(", ")})\n` +
    `  on conflict (${key}) do update set ${updates.join(", ")}, updated_at = now()${guard};`
  );
}

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * @param {{ companions: object[], stories: object[], storyInputs: object[] }} rows
 * @returns {string}
 */
export function importSql(rows) {
  const companionIds = new Set(rows.companions.map((row) => row.id));
  for (const row of [...rows.companions, ...rows.stories]) {
    if (!SAFE_ID.test(row.id)) throw new Error(`unsafe id: ${row.id}`);
  }
  // #485: every model call names the Companion, so a blank name is refused here, before any SQL.
  for (const row of rows.companions) {
    if (typeof row.name !== "string" || row.name.trim() === "") {
      throw new Error(`Companion ${row.id}: name is empty`);
    }
  }
  for (const story of rows.stories) {
    if (!companionIds.has(story.companion_id)) {
      throw new Error(`story ${story.id} names an unknown Companion: ${story.companion_id}`);
    }
  }
  const storyIds = new Set(rows.stories.map((row) => row.id));
  for (const inputs of rows.storyInputs) {
    if (!storyIds.has(inputs.story_id))
      throw new Error(`inputs for unknown story ${inputs.story_id}`);
  }
  return [
    "-- Story content from src/content and docs/demo (scripts/content/import.mjs, #284).",
    "begin;",
    "set local standard_conforming_strings = on;",
    // Positions and sequences are checked at commit, so a reordering can be imported.
    "set constraints all deferred;",
    ...rows.companions.map((row) => upsert("companions", "id", row)),
    ...rows.stories.map((row) => upsert("stories", "id", row)),
    ...rows.storyInputs.map((row) => upsert("story_inputs", "story_id", row)),
    "commit;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const flag = args.indexOf("--companion");
  const companion = flag === -1 ? undefined : args[flag + 1];
  if (flag !== -1 && !companion) {
    console.error("Usage: node scripts/content/import.mjs [root] [--companion <id>]");
    process.exit(1);
  }
  const rest = flag === -1 ? args : args.filter((_, index) => index !== flag && index !== flag + 1);
  const root = rest[0] ? path.resolve(rest[0]) : defaultRoot;
  try {
    process.stdout.write(importSql(readContentRows(root, { companion })));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
