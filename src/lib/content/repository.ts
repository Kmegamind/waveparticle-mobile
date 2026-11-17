import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { parseStoryContent } from "./parse";
import { parseStoryDeck, type CardVersions, type StoryDeck } from "./story-deck";
import type { StoryContent } from "./types";

/**
 * The one way the app reads story content (#284): `getStoryContent()` returns the Companions and
 * their stories from Supabase (`docs/decisions/0019`). Server only: the reader key never reaches
 * the browser. Everything is read in one call and kept for at most a minute, so an edit in the
 * table editor shows within a minute without a deploy.
 *
 * There is no copy in code. A failed read throws `StoryContentUnavailable`: a page then fails as
 * when the account cannot be read, and a server action answers "failed" (FAIL-SCREEN).
 */

export class StoryContentUnavailable extends Error {
  constructor() {
    super("story content could not be read");
    this.name = "StoryContentUnavailable";
  }
}

/** A server log line. It names the event only: never content, user text or the key. */
export type ContentLog = { event: "story_content_read_failed" };

/** How long the content is kept before it is read again. */
export const CONTENT_CACHE_MS = 60_000;

/** How long one read may take before it is given up. */
export const CONTENT_READ_TIMEOUT_MS = 5_000;

export function createContentRepository(options: {
  readDocument: () => Promise<unknown>;
  cacheMs?: number;
  now?: () => number;
  log?: (event: ContentLog) => void;
}): { getStoryContent: () => Promise<StoryContent>; clear: () => void } {
  const cacheMs = options.cacheMs ?? CONTENT_CACHE_MS;
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  let cache: { content: StoryContent; readAt: number } | null = null;
  let reading: Promise<StoryContent> | null = null;

  return {
    async getStoryContent() {
      if (cache && now() - cache.readAt < cacheMs) return cache.content;
      // Calls that arrive together share one read; a failed read is not kept.
      reading ??= options
        .readDocument()
        .then((document) => {
          const content = parseStoryContent(document);
          cache = { content, readAt: now() };
          return content;
        })
        .catch(() => {
          log({ event: "story_content_read_failed" });
          throw new StoryContentUnavailable();
        })
        .finally(() => {
          reading = null;
        });
      return reading;
    },
    clear() {
      cache = null;
    },
  };
}

/**
 * Reads the story content through `get_story_content`, a security-definer function that answers
 * only to the server's reader key (supabase/migrations/20261119000000_story_content.sql). It uses
 * the public key and no user session; the model inputs table itself is closed to the API.
 */
export async function readStoryContentFromSupabase(
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<unknown> {
  const env = options.env ?? process.env;
  const key = env.CONTENT_READ_KEY?.trim();
  if (!key) throw new Error("CONTENT_READ_KEY is not set");
  const { url, anonKey } = readSupabaseEnv(env);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: options.fetchImpl ? { fetch: options.fetchImpl } : undefined,
  });
  const { data, error } = await client
    .rpc("get_story_content", { reader_key: key })
    .abortSignal(AbortSignal.timeout(options.timeoutMs ?? CONTENT_READ_TIMEOUT_MS));
  if (error) throw new Error("get_story_content failed");
  // The function answers a wrong or unregistered key with null and no error.
  if (data === null || data === undefined)
    throw new Error("no story content: check CONTENT_READ_KEY");
  return data;
}

/**
 * Reads one story's pre-made cards through `get_story_cards` (#300), with the same reader key as
 * the story content: the published cards when `versions` is null, otherwise exactly the versions a
 * session recorded. The card tables stay closed to the browser. Not cached: a session reads its
 * cards once per Step. Null when the story has no published background and part cards; throws when
 * the read fails.
 */
export async function readStoryCardsFromSupabase(options: {
  storyId: string;
  versions: CardVersions | null;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<StoryDeck | null> {
  const env = options.env ?? process.env;
  const key = env.CONTENT_READ_KEY?.trim();
  if (!key) throw new Error("CONTENT_READ_KEY is not set");
  const { url, anonKey } = readSupabaseEnv(env);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: options.fetchImpl ? { fetch: options.fetchImpl } : undefined,
  });
  const { data, error } = await client
    .rpc("get_story_cards", { reader_key: key, story: options.storyId, versions: options.versions })
    .abortSignal(AbortSignal.timeout(options.timeoutMs ?? CONTENT_READ_TIMEOUT_MS));
  if (error) throw new Error("get_story_cards failed");
  if (data === null || data === undefined)
    throw new Error("no story cards: check CONTENT_READ_KEY");
  return parseStoryDeck(data);
}

function logToServer(event: ContentLog) {
  console.warn(JSON.stringify({ source: "story-content", ...event }));
}

const serverRepository = createContentRepository({
  readDocument: () => readStoryContentFromSupabase(),
  log: logToServer,
});

/** The Companions and their stories. Server only; throws `StoryContentUnavailable`. */
export const getStoryContent = serverRepository.getStoryContent;
