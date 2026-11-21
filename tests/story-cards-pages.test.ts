import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #293 AC3, AC5: the ADM-06 Stories pages exist in the admin, and the phone keeps its card source.

const root = path.join(import.meta.dirname, "..");
const source = path.join(root, "src");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [full] : [];
  });
}

/** Where the stored cards may be read: the admin pages and their view code only. */
const ADMIN_ONLY = [path.join("app", "admin"), path.join("lib", "story-cards")];

describe("ADM-06 Stories (#293)", () => {
  it("test_293_ac3_the_admin_menu_lists_stories_as_adm_06", () => {
    const shell = read("src/app/admin/admin-shell.tsx");
    expect(shell).toContain('{ href: "/admin/stories", id: "ADM-06", label: "Stories" }');
  });

  // Reworded for PUBLISH-FIRST (2026-11-21, #46): cards are published first and read afterwards.
  it("test_46_both_pages_say_cards_are_published_first_and_read_afterwards", () => {
    for (const file of ["src/app/admin/stories/page.tsx", "src/app/admin/stories/[id]/page.tsx"]) {
      expect(read(file), file).toContain("<PublishFirstNotice />");
    }
    const notice = read("src/app/admin/stories/publish-first-notice.tsx");
    expect(notice).toContain("Published first, read afterwards.");
    expect(notice).toContain("passed the automatic checks before it was published");
    expect(notice).toContain("has not been read by a person yet");
    expect(notice).not.toMatch(/Unreviewed drafts/);
  });

  it("test_293_ac3_pages_read_through_the_signed_in_users_own_client", () => {
    const reader = read("src/lib/story-cards/reader.ts");
    expect(reader).toMatch(/from\("story_cards"\)/);
    expect(reader).toMatch(/from\("story_parts"\)/);
    expect(reader).toMatch(/from\("stories"\)/);
    for (const file of ["src/app/admin/stories/page.tsx", "src/app/admin/stories/[id]/page.tsx"]) {
      expect(read(file), file).toContain("createSupabaseServerClient");
      expect(read(file), file).not.toMatch(/service[_-]?role/i);
    }
  });

  // #304 replaces #293's read-only rule: the story page edits cards through server actions, which
  // write only through the database functions (no direct insert or update on a table).
  it("test_304_writes_go_only_through_the_role_checked_server_actions", () => {
    const files = filesUnder(path.join(source, "app", "admin", "stories"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(
        /\.insert\(|\.update\(|\.upsert\(|\.delete\(|service[_-]?role/i,
      );
    }
    const actions = read("src/app/admin/stories/actions.ts");
    expect(actions.startsWith('"use server";')).toBe(true);
    expect(actions).toContain("getCurrentUser(client)");
    expect(actions).toContain("readContentRole(client)");
    expect(actions).toContain("writeStoryCard(");
    expect(actions).toContain("storedCardProblems(client, key, version)");
  });

  it("test_304_ac8_the_phone_read_never_asks_for_drafts", () => {
    const repository = read("src/lib/content/repository.ts");
    expect(repository).toMatch(/rpc\("get_story_cards"/);
    expect(repository).not.toMatch(/from\("story_cards"\)/);
  });

  it("test_293_ac5_the_phone_screens_keep_their_current_card_source", () => {
    const offending: string[] = [];
    for (const file of filesUnder(source)) {
      const relative = path.relative(source, file);
      if (ADMIN_ONLY.some((allowed) => relative.startsWith(allowed))) continue;
      const text = readFileSync(file, "utf8");
      if (/\bstory_cards\b|\bstory_parts\b|story-decks|story-cards\//.test(text))
        offending.push(relative);
    }
    expect(offending).toEqual([]);
  });
});
