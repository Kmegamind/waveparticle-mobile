import type { ContentRole } from "@/lib/admin/roles";

// The writes behind the buttons of ADM-06 Stories (#304): save a card draft and a part title
// (admin or writer), publish and roll back a card (admin only). Each is refused here before any
// database call when the account, the role or the input is wrong; the database functions check the
// role again. Publish re-runs the card checks on the stored version first: a failing card is never
// published. Roll back restores a version that was live before, so it is not checked. Server only.

export type StoryCardWrite =
  | { kind: "save"; key: string; body: string }
  | { kind: "publish" | "roll_back"; key: string; version: number }
  | { kind: "title"; storyId: string; part: number; title: string };

export type StoryCardWriteError =
  "not-allowed" | "invalid" | "blank" | "too-long" | "checks-failed" | "failed";

export type StoryCardWriteResult =
  { ok: true; version?: number } | { ok: false; error: StoryCardWriteError; problems?: string[] };

/** The longest card text the database takes (20261120000000_story_cards.sql). */
export const STORY_CARD_MAX_LENGTH = 2000;
/** The longest part title the admin saves. */
export const PART_TITLE_MAX_LENGTH = 200;

/** The NAMING key of a card (the story_cards key check). */
export const CARD_KEY = /^crd\.[a-z]+\.[a-z0-9][a-z0-9-]*\.(bg|p[1-5]\.c[1-9][0-9]*)$/;
const STORY_ID = /^[a-z0-9][a-z0-9-]*$/;

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export async function writeStoryCard(
  write: StoryCardWrite,
  deps: {
    userId: string | null;
    role: ContentRole | null;
    rpc: Rpc;
    /** The stored version's check problems, or null when that version cannot be read. */
    checkCard: (key: string, version: number) => Promise<string[] | null>;
  },
): Promise<StoryCardWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };

  if (write.kind === "title") {
    if (typeof write.storyId !== "string" || !STORY_ID.test(write.storyId)) {
      return { ok: false, error: "invalid" };
    }
    if (!Number.isInteger(write.part) || write.part < 1 || write.part > 5) {
      return { ok: false, error: "invalid" };
    }
    if (typeof write.title !== "string" || write.title.trim() === "") {
      return { ok: false, error: "blank" };
    }
    if (write.title.length > PART_TITLE_MAX_LENGTH) return { ok: false, error: "too-long" };
    const { error } = await deps.rpc("save_story_part_title", {
      story: write.storyId,
      part_number: write.part,
      part_title: write.title,
    });
    return error ? { ok: false, error: "failed" } : { ok: true };
  }

  if (typeof write.key !== "string" || !CARD_KEY.test(write.key)) {
    return { ok: false, error: "invalid" };
  }

  if (write.kind === "save") {
    if (typeof write.body !== "string" || write.body.trim() === "") {
      return { ok: false, error: "blank" };
    }
    if (write.body.length > STORY_CARD_MAX_LENGTH) return { ok: false, error: "too-long" };
    const { data, error } = await deps.rpc("save_story_card_draft", {
      card_key: write.key,
      card_body: write.body,
    });
    if (error) return { ok: false, error: "failed" };
    return typeof data === "number" ? { ok: true, version: data } : { ok: true };
  }

  // Publish and roll back: the admin role only (#304 AC5, the same rule as prompts).
  if (deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (!Number.isInteger(write.version) || write.version < 1) return { ok: false, error: "invalid" };
  if (write.kind === "publish") {
    const problems = await deps.checkCard(write.key, write.version);
    if (problems === null) return { ok: false, error: "invalid" };
    if (problems.length > 0) return { ok: false, error: "checks-failed", problems };
  }
  const { error } = await deps.rpc(
    write.kind === "publish" ? "publish_story_card" : "roll_back_story_card",
    { card_key: write.key, card_version: write.version },
  );
  return error ? { ok: false, error: "failed" } : { ok: true };
}
