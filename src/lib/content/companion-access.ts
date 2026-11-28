import { DEFAULT_COMPANION_ID } from "./companions";
import type { Companion, StoryContent } from "./types";

/**
 * Who may play which Companion (#521). A Companion is public when his `enterHref` is set: every
 * signed-in account may enter him. A Companion with stories but no `enterHref` is a preview: only
 * an admin or a writer (a content role, docs/decisions/0016) may enter him, so the owner can walk
 * his whole flow on the live site before he is opened to users. Making him public is one change,
 * his `enter_href`.
 *
 * The rule is applied to the story content itself: every page and server action that plays a
 * story gets the content through `contentForViewer`, and the stories of a Companion the viewer may
 * not play are not in it. A story that is not in the content cannot be opened, carded, paused,
 * rested on, returned to or finished (the line fails, the page shows no Plan), and no model call
 * is made for it. Pure and client-safe; the role is read on the server (`readContentRole`).
 */

export type ViewerRole = "admin" | "writer" | null;

/** Shown on a Companion's pages while he is not public (only admins and writers see them). */
export const PREVIEW_NOTE = "Preview. He is not public yet: only admins and writers can enter him.";

/** True for an account that may preview a Companion before he is public. */
export function canPreview(role: ViewerRole): boolean {
  return role === "admin" || role === "writer";
}

/** A Companion every signed-in account may enter: his `enterHref` is set. */
export function isPublicCompanion(companion: Pick<Companion, "enterHref">): boolean {
  return typeof companion.enterHref === "string" && companion.enterHref.trim().length > 0;
}

/**
 * The story content as this viewer may play it. An admin or writer gets every story; anyone else
 * (a user, or no account) only the stories of public Companions. The Companions themselves stay
 * listed for everyone (the Companions list shows them with Enter off).
 */
export function contentForViewer(content: StoryContent, role: ViewerRole): StoryContent {
  if (canPreview(role)) return content;
  const open = new Set(content.companions.filter(isPublicCompanion).map((item) => item.id));
  return {
    companions: content.companions,
    stories: content.stories.filter((story) => open.has(story.companionId)),
  };
}

/** The page of a Companion's Life Path. */
export function companionHref(id: string): string {
  return `/companions/${encodeURIComponent(id)}`;
}

/**
 * The goal dialogue for a new Goal with this Companion. The default Companion keeps the plain
 * `/goal` he always had.
 */
export function goalHrefFor(companionId: string): string {
  return companionId === DEFAULT_COMPANION_ID
    ? "/goal"
    : `/goal?companion=${encodeURIComponent(companionId)}`;
}

/** True when the content holds at least one story of this Companion. */
export function hasStories(content: StoryContent, companionId: string): boolean {
  return content.stories.some((story) => story.companionId === companionId);
}

/**
 * The Companion of `?companion=<id>` when this content (already scoped to the viewer) has stories
 * of his; null otherwise, so a page refuses rather than switching to another Companion. A missing
 * value is the default Companion.
 */
export function playableCompanion(
  content: StoryContent,
  value: string | string[] | undefined,
): Companion | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = raw === undefined || raw === "" ? DEFAULT_COMPANION_ID : raw;
  const companion = content.companions.find((item) => item.id === id) ?? null;
  return companion && hasStories(content, companion.id) ? companion : null;
}

export type ListedCompanion = Companion & {
  /** True when only an admin or writer sees Enter on: he is not public yet. */
  preview: boolean;
};

/**
 * The Companions list for one viewer (#268, #521). A public Companion keeps his own `enterHref`.
 * For an admin or writer, a Companion with stories but no `enterHref` gets Enter to his Life Path,
 * marked as a preview. Everyone else sees him as before, with Enter off. `content` is the full
 * story content; only Companions and story counts are read.
 */
export function companionsForViewer(content: StoryContent, role: ViewerRole): ListedCompanion[] {
  return content.companions.map((companion) => {
    if (isPublicCompanion(companion)) return { ...companion, preview: false };
    if (canPreview(role) && hasStories(content, companion.id)) {
      return { ...companion, enterHref: companionHref(companion.id), preview: true };
    }
    return { ...companion, enterHref: null, preview: false };
  });
}
