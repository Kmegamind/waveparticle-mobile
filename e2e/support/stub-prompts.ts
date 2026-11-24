import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { readPromptDirectory } from "../../scripts/prompts/prompt-files.mjs";
import { e2ePorts } from "./ports";

// The prompts the stub model (stub-model.mjs) has received. Its list is shared by every live test
// running at the same time and never reset, and the live server, not the test, makes the calls,
// so a prompt cannot say which test it came from. A test therefore never reads "the last prompt":
// it takes a mark before its own action and reads only the prompts recorded since then (#377).

const STUB = `http://127.0.0.1:${e2ePorts.stub}`;

/** Every prompt the stub model has received, oldest first. */
export async function stubPrompts(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${STUB}/prompts`)).json()) as string[];
}

/** A mark before the test's own action: the number of prompts recorded so far. */
export async function promptMark(request: APIRequestContext): Promise<number> {
  return (await stubPrompts(request)).length;
}

/** The prompts recorded since `mark`, oldest first. */
export async function promptsSince(request: APIRequestContext, mark: number): Promise<string[]> {
  return (await stubPrompts(request)).slice(mark);
}

// The e2e files load as CommonJS, so the folder comes from __dirname, not import.meta.
const PROMPT_DIRECTORY = path.join(__dirname, "..", "..", "docs", "ai", "prompts");

/**
 * The fixed opening of a seeded prompt: its body up to the first {{placeholder}} (#418). The
 * Supabase stub serves the same seed files (docs/ai/prompts), so a test can tell which prompt a
 * model call used by its key, and a new version of the prompt's wording does not break the test.
 */
export function seedPromptOpening(key: string): string {
  const row = readPromptDirectory(PROMPT_DIRECTORY).find((prompt) => prompt.key === key);
  if (!row) throw new Error(`No seeded prompt ${key}`);
  const opening = row.body.split("{{")[0];
  if (opening.trim().length < 20) throw new Error(`The ${key} prompt opens with a placeholder`);
  return opening;
}
