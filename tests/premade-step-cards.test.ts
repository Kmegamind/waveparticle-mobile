import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CardVersions, StoryDeck } from "@/lib/content/story-deck";
import { premadeStepCards, type PremadeDeps } from "@/lib/progress/premade-cards";
import { setStepCards, syncSession } from "@/lib/prototype/session";

// #300 AC1, AC3, AC4: the signed-in focus page's cards come from the published pre-made cards,
// pinned to the versions the session first read. No model is called.

const SESSION = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const card = (key: string, version = 1, text = `text ${key}`) => ({ key, version, text });
const deck = (edit = false): StoryDeck => ({
  background: card("crd.opp.x.bg"),
  parts: [
    [card("crd.opp.x.p1.c1", edit ? 2 : 1, edit ? "EDITED" : "first"), card("crd.opp.x.p1.c2")],
    [card("crd.opp.x.p2.c1"), card("crd.opp.x.p2.c2")],
  ],
});
const pinned: CardVersions = {
  "crd.opp.x.bg": 1,
  "crd.opp.x.p1.c1": 1,
  "crd.opp.x.p1.c2": 1,
  "crd.opp.x.p2.c1": 1,
  "crd.opp.x.p2.c2": 1,
};

/** A session store and a card table with published versions, as the database would answer. */
function world(options: { versions?: CardVersions | null; stepCount?: number } = {}) {
  let versions = options.versions ?? null;
  let published = deck();
  const readDeck = vi.fn(
    async (_story: string, asked: CardVersions | null): Promise<StoryDeck | null> => {
      if (!asked) return published;
      // Pinned: exactly those versions, the edited text only for version 2.
      return asked["crd.opp.x.p1.c1"] === 2 ? deck(true) : deck();
    },
  );
  const deps: PremadeDeps = {
    readSession: vi.fn(async (id: string) =>
      id === SESSION
        ? { storyId: "x", stepCount: options.stepCount ?? 2, cardVersions: versions }
        : null,
    ),
    pinVersions: vi.fn(async (_id: string, next: CardVersions) => {
      versions ??= next;
    }),
    readDeck,
  };
  return {
    deps,
    readDeck,
    publishEdit: () => {
      published = deck(true);
    },
    versions: () => versions,
  };
}

describe("pre-made cards on the signed-in focus page (#300)", () => {
  it("test_300_ac3_the_first_step_opens_with_the_background_card_and_its_spread_cards", async () => {
    const { deps } = world();
    expect(await premadeStepCards({ sessionId: SESSION, index: 0 }, deps)).toEqual({
      status: "ok",
      isTestData: false,
      cards: {
        opening: "text crd.opp.x.bg",
        story: ["first", "text crd.opp.x.p1.c2"],
        premade: true,
      },
    });
    expect(await premadeStepCards({ sessionId: SESSION, index: 1 }, deps)).toEqual({
      status: "ok",
      isTestData: false,
      cards: { opening: "text crd.opp.x.p2.c1", story: ["text crd.opp.x.p2.c2"], premade: true },
    });
  });

  it("test_300_ac2_the_focus_page_keeps_every_pre_made_card_of_a_step", () => {
    // T7's 1 to 5 limit still cuts live cards on /try; pre-made cards are never dropped.
    const plan = { goal: null, steps: [{ title: "One", description: "", minutes: 10 }] };
    const story = Array.from({ length: 8 }, (_, i) => `card ${i + 1}`);
    const session = setStepCards(
      syncSession(null, plan, 1),
      0,
      { opening: "BG", story, premade: true },
      0,
    );
    expect(session.steps[0].cards?.story).toEqual(story);
    const live = setStepCards(syncSession(null, plan, 1), 0, { opening: "BG", story }, 0);
    expect(live.steps[0].cards?.story).toHaveLength(2);
  });

  it("test_300_ac4_the_first_read_records_the_published_versions_on_the_session", async () => {
    const w = world();
    await premadeStepCards({ sessionId: SESSION, index: 0 }, w.deps);
    expect(w.deps.pinVersions).toHaveBeenCalledWith(SESSION, pinned);
    expect(w.versions()).toEqual(pinned);
  });

  it("test_300_ac4_an_edit_published_during_the_session_does_not_change_it", async () => {
    const w = world();
    await premadeStepCards({ sessionId: SESSION, index: 0 }, w.deps);
    w.publishEdit();
    const again = await premadeStepCards({ sessionId: SESSION, index: 0 }, w.deps);
    expect(again).toMatchObject({ status: "ok", cards: { story: ["first", expect.any(String)] } });
    expect(w.readDeck).toHaveBeenLastCalledWith("x", pinned);
    expect(w.deps.pinVersions).toHaveBeenCalledTimes(1);
  });

  it("test_300_ac4_a_session_pinned_by_another_request_uses_those_versions", async () => {
    // Another request pinned version 2 first; this request read the published deck before that.
    const other = { ...pinned, "crd.opp.x.p1.c1": 2 };
    const w = world();
    w.deps.pinVersions = vi.fn(async () => undefined);
    let reads = 0;
    w.deps.readSession = vi.fn(async () => ({
      storyId: "x",
      stepCount: 2,
      cardVersions: reads++ === 0 ? null : other,
    }));
    const result = await premadeStepCards({ sessionId: SESSION, index: 0 }, w.deps);
    expect(result).toMatchObject({
      status: "ok",
      cards: { story: ["EDITED", expect.any(String)] },
    });
  });

  it("test_300_ac3_no_published_cards_or_a_failed_read_fails", async () => {
    const empty = world();
    empty.readDeck.mockResolvedValue(null);
    expect(await premadeStepCards({ sessionId: SESSION, index: 0 }, empty.deps)).toEqual({
      status: "failed",
    });
    expect(empty.deps.pinVersions).not.toHaveBeenCalled();

    const down = world();
    down.readDeck.mockRejectedValue(new Error("database down"));
    expect(await premadeStepCards({ sessionId: SESSION, index: 0 }, down.deps)).toEqual({
      status: "failed",
    });
  });

  it("test_300_ac4_a_pinned_version_missing_from_the_table_fails_rather_than_mixing", async () => {
    const w = world({ versions: pinned });
    w.readDeck.mockResolvedValue({ ...deck(), parts: [deck().parts[0]] });
    expect(await premadeStepCards({ sessionId: SESSION, index: 0 }, w.deps)).toEqual({
      status: "failed",
    });
  });

  it("test_300_another_accounts_session_or_a_bad_request_fails", async () => {
    const { deps } = world();
    for (const raw of [
      { sessionId: "4f0a7c2e-8d1b-4c3a-9e2f-000000000000", index: 0 },
      { sessionId: "not-a-uuid", index: 0 },
      { sessionId: SESSION, index: -1 },
      { sessionId: SESSION, index: 2 },
      { sessionId: SESSION, index: 0.5 },
      null,
    ]) {
      expect(await premadeStepCards(raw, deps), JSON.stringify(raw)).toEqual({ status: "failed" });
    }
  });

  it("test_300_ac3_the_story_comes_from_the_session_not_the_request", async () => {
    const { deps, readDeck } = world();
    await premadeStepCards({ sessionId: SESSION, index: 0, storyId: "trinity" }, deps);
    expect(readDeck).toHaveBeenCalledWith("x", null);
  });

  it("test_300_ac3_no_model_is_called_for_the_signed_in_cards", () => {
    const root = path.join(import.meta.dirname, "..");
    const actions = readFileSync(path.join(root, "src/app/focus/actions.ts"), "utf8");
    const start = actions.indexOf("export async function loadAccountStepCards");
    const body = actions.slice(start, actions.indexOf("\n}\n", start));
    expect(body).toContain("premadeStepCards");
    expect(body).not.toMatch(/gateway|writeStepCards|cardsForStep/);
    expect(readFileSync(path.join(root, "src/lib/progress/premade-cards.ts"), "utf8")).not.toMatch(
      /model-gateway|writeStepCards/,
    );
  });
});
