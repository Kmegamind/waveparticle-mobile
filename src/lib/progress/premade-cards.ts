import { deckVersions, type CardVersions, type StoryDeck } from "@/lib/content/story-deck";
import type { StepCardsResponse } from "@/lib/prototype/focus-cards";
import { spreadCards } from "@/lib/story/start";

// The signed-in focus page's cards (#300, SHARED-STORY, CARDS-PER-PART, CARDS-SPREAD,
// FAIL-PREMADE): the story's published pre-made cards, spread across the session's Steps. The first
// read records each card's version on the session; every later read asks for exactly those
// versions, so an edit published during the session does not change it. No model is called.
// Server only: the cards are read with the server's reader key, the session with the user's own
// client (row level security), so another account's session is simply not found.

export type PremadeSession = {
  storyId: string;
  stepCount: number;
  cardVersions: CardVersions | null;
};

export type PremadeDeps = {
  readSession: (sessionId: string) => Promise<PremadeSession | null>;
  /** Records the versions only when the session has none yet. */
  pinVersions: (sessionId: string, versions: CardVersions) => Promise<void>;
  /** Published cards when `versions` is null, otherwise exactly those versions. */
  readDeck: (storyId: string, versions: CardVersions | null) => Promise<StoryDeck | null>;
  /**
   * #521: true when this account may play the story (its Companion is public, or the account is
   * an admin or writer). A story it may not play gets no card and its deck is never read, even
   * for a session row the account wrote itself.
   */
  mayPlay: (storyId: string) => Promise<boolean>;
  /** A server log line naming the event only: never card text, ids or the error. */
  log?: (event: { event: "story_cards_read_failed" }) => void;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the focus page may send: its session and the Step. Everything else is ignored. */
function requestOf(raw: unknown): { sessionId: string; index: number } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { sessionId, index } = raw as Record<string, unknown>;
  if (typeof sessionId !== "string" || !UUID.test(sessionId)) return null;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return null;
  return { sessionId, index };
}

const sameVersions = (left: CardVersions, right: CardVersions) => {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
};

/** The deck at exactly the recorded versions, or null when any of them is missing. */
async function pinnedDeck(
  deps: PremadeDeps,
  storyId: string,
  versions: CardVersions,
): Promise<StoryDeck | null> {
  const deck = await deps.readDeck(storyId, versions);
  return deck && sameVersions(deckVersions(deck), versions) ? deck : null;
}

export async function premadeStepCards(
  raw: unknown,
  deps: PremadeDeps,
): Promise<StepCardsResponse> {
  try {
    const request = requestOf(raw);
    if (!request) return { status: "failed" };
    const session = await deps.readSession(request.sessionId);
    if (!session || request.index >= session.stepCount) return { status: "failed" };
    if (!(await deps.mayPlay(session.storyId))) return { status: "failed" };

    let deck: StoryDeck | null;
    if (session.cardVersions) {
      deck = await pinnedDeck(deps, session.storyId, session.cardVersions);
    } else {
      const published = await deps.readDeck(session.storyId, null);
      if (!published) return { status: "failed" };
      const versions = deckVersions(published);
      await deps.pinVersions(request.sessionId, versions);
      // Another request may have recorded its versions first: the session keeps those.
      const recorded = (await deps.readSession(request.sessionId))?.cardVersions;
      if (!recorded) return { status: "failed" };
      deck = sameVersions(recorded, versions)
        ? published
        : await pinnedDeck(deps, session.storyId, recorded);
    }
    if (!deck) return { status: "failed" };

    const step = spreadCards(deck, session.stepCount)[request.index];
    return {
      status: "ok",
      isTestData: false,
      cards: {
        opening: step.opening.text,
        story: step.story.map((card) => card.text),
        premade: true,
      },
    };
  } catch {
    deps.log?.({ event: "story_cards_read_failed" });
    return { status: "failed" };
  }
}
