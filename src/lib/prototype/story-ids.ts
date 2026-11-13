/**
 * Client-safe helpers for the chosen story on the test path (#254). No story data lives here.
 * A missing or unknown story id means chapter 8, the story the test path played before #254.
 */
export const DEFAULT_STORY_ID = "site-search";

/** The chosen story's profile, or chapter 8's when the id is missing or unknown. */
export function pickStory<T extends { id: string }>(stories: T[], storyId: string | undefined): T {
  return (
    stories.find((story) => story.id === storyId) ??
    stories.find((story) => story.id === DEFAULT_STORY_ID) ??
    stories[0]
  );
}
