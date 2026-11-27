import path from "node:path";
import { describe, expect, it } from "vitest";
import { appDocument, readContentRows } from "../scripts/content/content-files.mjs";
import { parseStoryContent } from "@/lib/content/parse";
import {
  CONTENT_CACHE_MS,
  StoryContentUnavailable,
  createContentRepository,
  readStoryContentFromSupabase,
  type ContentLog,
} from "@/lib/content/repository";

// The one way the app reads story content (#284).

const root = path.join(import.meta.dirname, "..");
const seedDocument = () => appDocument(readContentRows(root));

describe("parseStoryContent (#284)", () => {
  it("test_284_reads_companions_and_stories_with_the_screen_names", () => {
    const content = parseStoryContent(seedDocument());
    expect(content.companions.map((companion) => companion.id)).toEqual([
      "oppenheimer",
      "moriarty",
      "snape",
    ]);
    expect(content.companions[1]).toMatchObject({ shortName: "Moriarty", enterHref: null });
    expect(content.stories).toHaveLength(26);
    const story = content.stories.find((item) => item.id === "site-search");
    expect(story).toMatchObject({
      companionId: "oppenheimer",
      sequence: 8,
      title: "The Canyon and the Mesa",
      period: "The Manhattan Project years",
      goalShort: "I want the laboratory built where my people can live and work.",
    });
    expect(story?.inputs.facts.length).toBeGreaterThan(0);
    expect(story?.inputs.keySlices.every((slice) => slice.confirmed === false)).toBe(true);
  });

  it("test_284_the_snapshot_holds_no_date", () => {
    const text = JSON.stringify(parseStoryContent(seedDocument()));
    expect(text).not.toMatch(/"date":"/);
    expect(text).not.toMatch(/\b1[89]\d\d-\d\d-\d\d\b/);
  });

  it("test_284_refuses_a_document_that_is_not_story_content", () => {
    expect(() => parseStoryContent(null)).toThrow();
    expect(() => parseStoryContent({ companions: [], stories: [] })).toThrow(/no Companions/);
    const broken = seedDocument();
    (broken.stories[0] as { inputs: unknown }).inputs = { facts: "not a list" };
    expect(() => parseStoryContent(broken)).toThrow(/bohr-difficulties/);
  });

  it("test_284_a_story_without_inputs_is_left_out_not_every_page_failed", () => {
    // Review finding: a story row added before its inputs row must not stop Home, Goals and Me.
    const partial = seedDocument();
    (partial.stories[0] as { inputs: unknown }).inputs = null;
    const content = parseStoryContent(partial);
    expect(content.stories.map((story) => story.id)).not.toContain("bohr-difficulties");
    expect(content.stories).toHaveLength(25);
  });
});

describe("createContentRepository (#284)", () => {
  it("test_284_keeps_the_content_for_a_minute_then_reads_again", async () => {
    let reads = 0;
    let clock = 0;
    const repository = createContentRepository({
      readDocument: async () => {
        reads += 1;
        return seedDocument();
      },
      now: () => clock,
    });
    await repository.getStoryContent();
    clock = CONTENT_CACHE_MS - 1;
    await repository.getStoryContent();
    expect(reads).toBe(1);
    clock = CONTENT_CACHE_MS;
    await repository.getStoryContent();
    expect(reads).toBe(2);
  });

  it("test_284_calls_that_arrive_together_share_one_read", async () => {
    let reads = 0;
    const repository = createContentRepository({
      readDocument: async () => {
        reads += 1;
        return seedDocument();
      },
    });
    await Promise.all([repository.getStoryContent(), repository.getStoryContent()]);
    expect(reads).toBe(1);
  });

  it("test_284_a_failed_read_throws_is_logged_and_is_not_kept", async () => {
    const logs: ContentLog[] = [];
    let fail = true;
    const repository = createContentRepository({
      readDocument: async () => {
        if (fail) throw new Error("database down");
        return seedDocument();
      },
      log: (event) => logs.push(event),
    });
    await expect(repository.getStoryContent()).rejects.toBeInstanceOf(StoryContentUnavailable);
    expect(logs).toEqual([{ event: "story_content_read_failed" }]);
    fail = false;
    await expect(repository.getStoryContent()).resolves.toMatchObject({
      stories: expect.any(Array),
    });
  });

  it("test_284_a_document_that_does_not_parse_is_a_failed_read", async () => {
    const repository = createContentRepository({ readDocument: async () => ({ stories: 3 }) });
    await expect(repository.getStoryContent()).rejects.toBeInstanceOf(StoryContentUnavailable);
  });
});

describe("readStoryContentFromSupabase (#284)", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    CONTENT_READ_KEY: "reader-key",
  };

  it("test_284_without_a_reader_key_nothing_is_read", async () => {
    let called = false;
    await expect(
      readStoryContentFromSupabase({
        env: { ...env, CONTENT_READ_KEY: " " },
        fetchImpl: async () => {
          called = true;
          return new Response("{}");
        },
      }),
    ).rejects.toThrow(/CONTENT_READ_KEY/);
    expect(called).toBe(false);
  });

  it("test_284_reads_through_the_keyed_function_with_the_public_key_and_no_session", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const document = await readStoryContentFromSupabase({
      env,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify(seedDocument()), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/get_story_content");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ reader_key: "reader-key" });
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("apikey")).toBe("public-key");
    expect(headers.get("authorization")).toBe("Bearer public-key");
    expect(parseStoryContent(document).stories).toHaveLength(26);
  });

  it("test_284_a_wrong_key_answer_null_is_a_failed_read", async () => {
    await expect(
      readStoryContentFromSupabase({
        env,
        fetchImpl: async () =>
          new Response("null", { status: 200, headers: { "content-type": "application/json" } }),
      }),
    ).rejects.toThrow(/CONTENT_READ_KEY/);
  });
});
