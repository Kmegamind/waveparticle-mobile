import { describe, expect, it } from "vitest";
import { APP_TEXT_DEFAULTS } from "@/lib/app-text/catalog";
import {
  APP_TEXT_CACHE_MS,
  createAppTextRepository,
  readPublishedAppText,
  type AppTextLog,
  type AppTextRow,
} from "@/lib/app-text/repository";

// #288 AC3: the server reads the published text of each key, keeps it at most 60 seconds, and
// shows the code default when the database cannot answer or a key has no published row.

function setup(readRows: () => Promise<AppTextRow[]>) {
  let clock = 1_000;
  let reads = 0;
  const logs: AppTextLog[] = [];
  const repository = createAppTextRepository({
    readRows: () => {
      reads += 1;
      return readRows();
    },
    now: () => clock,
    log: (event) => logs.push(event),
  });
  return {
    repository,
    logs,
    reads: () => reads,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("app text reader (#288)", () => {
  it("test_288_ac3_returns_the_published_text", async () => {
    const { repository } = setup(async () => [{ key: "ui.F3.fail.body", body: "Gone for now." }]);
    const texts = await repository.getAppTexts();
    expect(texts["ui.F3.fail.body"]).toBe("Gone for now.");
  });

  it("test_288_ac3_key_without_a_published_row_shows_the_default", async () => {
    const { repository } = setup(async () => [{ key: "ui.F3.fail.body", body: "Gone for now." }]);
    const texts = await repository.getAppTexts();
    expect(texts["ui.S1.back"]).toBe(APP_TEXT_DEFAULTS["ui.S1.back"]);
    expect(Object.keys(texts).sort()).toEqual(Object.keys(APP_TEXT_DEFAULTS).sort());
  });

  it("test_288_ac3_failed_read_shows_every_default_and_is_not_cached", async () => {
    let fail = true;
    const { repository, logs, reads } = setup(async () => {
      if (fail) throw new Error("database down");
      return [{ key: "ui.S1.back", body: "Back" }];
    });
    expect(await repository.getAppTexts()).toEqual(APP_TEXT_DEFAULTS);
    expect(logs).toEqual([{ event: "app_text_read_failed" }]);
    fail = false;
    expect((await repository.getAppTexts())["ui.S1.back"]).toBe("Back");
    expect(reads()).toBe(2);
  });

  it("test_288_ac3_keeps_texts_at_most_60_seconds", async () => {
    let body = "First";
    const { repository, reads, advance } = setup(async () => [{ key: "ui.S1.back", body }]);
    expect(APP_TEXT_CACHE_MS).toBe(60_000);
    expect((await repository.getAppTexts())["ui.S1.back"]).toBe("First");
    body = "Second";
    advance(59_999);
    expect((await repository.getAppTexts())["ui.S1.back"]).toBe("First");
    advance(1);
    expect((await repository.getAppTexts())["ui.S1.back"]).toBe("Second");
    expect(reads()).toBe(2);
  });

  it("test_288_ac3_calls_that_arrive_together_share_one_read", async () => {
    const { repository, reads } = setup(async () => []);
    await Promise.all([repository.getAppTexts(), repository.getAppTexts()]);
    expect(reads()).toBe(1);
  });

  it("test_288_ac3_clear_drops_the_cache_and_ignores_a_read_in_flight", async () => {
    let body = "Old";
    let release: () => void = () => undefined;
    let hold = false;
    const { repository } = setup(async () => {
      const answer = [{ key: "ui.S1.back", body }];
      if (hold) await new Promise<void>((resolve) => (release = resolve));
      return answer;
    });
    expect((await repository.getAppTexts())["ui.S1.back"]).toBe("Old");

    // A read that started before a publish must not refill the cache with the old text.
    repository.clear();
    hold = true;
    const inFlight = repository.getAppTexts();
    await Promise.resolve();
    repository.clear();
    hold = false;
    body = "New";
    release();
    expect((await inFlight)["ui.S1.back"]).toBe("Old");
    expect((await repository.getAppTexts())["ui.S1.back"]).toBe("New");
  });

  it("test_288_ac3_ignores_unknown_keys_and_blank_bodies", async () => {
    const { repository } = setup(async () => [
      { key: "ui.S1.gone", body: "Unknown" },
      { key: "ui.S1.back", body: "   " },
      { key: "ui.S1.title", body: 42 as unknown as string },
    ]);
    expect(await repository.getAppTexts()).toEqual(APP_TEXT_DEFAULTS);
  });

  it("test_288_ac3_reads_published_rows_with_the_public_key_and_no_session", async () => {
    const seen: { url: string; authorization: string | null }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      seen.push({ url: String(input), authorization: headers.get("authorization") });
      return new Response(JSON.stringify([{ key: "ui.S1.back", body: "Back" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const rows = await readPublishedAppText({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3198",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      },
      fetchImpl,
    });
    expect(rows).toEqual([{ key: "ui.S1.back", body: "Back" }]);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain("/rest/v1/app_text?");
    expect(seen[0].url).toContain("published=eq.true");
    // The public key only: no user session is sent.
    expect(seen[0].authorization).toBe("Bearer anon");
  });

  it("test_288_ac3_a_database_error_is_a_failed_read", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "down" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    await expect(
      readPublishedAppText({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3198",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        },
        fetchImpl,
      }),
    ).rejects.toThrow(/app_text/);
  });
});
