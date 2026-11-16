import { readFileSync } from "node:fs";
import path from "node:path";
import { parseStoryContent } from "@/lib/content/parse";
import type { OppenheimerStory, StoryContent } from "@/lib/content/types";
import { appDocument, readContentRows } from "../../scripts/content/content-files.mjs";

// The seed story content (src/content, docs/demo) as the app reads it in tests (#284): the same
// document `get_story_content` returns once the import has run, parsed by the app's own parser.

const root = path.join(import.meta.dirname, "..", "..");
let cached: StoryContent | null = null;

export function seedDocument(): ReturnType<typeof appDocument> {
  return appDocument(readContentRows(root));
}

export function seedContent(): StoryContent {
  cached ??= parseStoryContent(seedDocument());
  return cached;
}

/** The seed file's story records (with dates), for tests of the seed data itself. */
export function seedStoryRecords(): OppenheimerStory[] {
  return JSON.parse(
    readFileSync(path.join(root, "src", "content", "oppenheimer", "stories.json"), "utf8"),
  ) as OppenheimerStory[];
}
