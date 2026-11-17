import { describe, expect, it } from "vitest";
import {
  PROMPT_PURPOSE,
  promptDetail,
  promptList,
  type PromptVersionRow,
} from "@/lib/prompts/admin";
import { PROMPT_KEYS } from "@/lib/prompts/repository";
import { seedRows } from "./support/seed-prompts";

// #308 AC1, AC2, AC4, AC7: what ADM-08 Prompts lists and shows.

const version = (overrides: Partial<PromptVersionRow>): PromptVersionRow => {
  const seed = seedRows().find((row) => row.key === (overrides.key ?? "rest_reply"))!;
  return {
    key: seed.key,
    version: 1,
    active: true,
    body: seed.body,
    params: structuredClone(seed.params),
    note: "",
    created_at: "2026-11-14T00:00:00Z",
    activated_at: overrides.active === false ? null : "2026-11-14T00:00:00Z",
    ...overrides,
  };
};

const allActive = () => PROMPT_KEYS.map((key) => version({ key }));

describe("ADM-08 list (#308 AC1)", () => {
  it("test_308_ac1_list_has_seven_keys_with_active_version_and_settings", () => {
    const rows = allActive().filter((row) => row.key !== "closing_line");
    rows.push(version({ version: 2, active: false, body: "new" }));
    const list = promptList(rows);
    expect(list.map((row) => row.key)).toEqual([...PROMPT_KEYS]);
    const rest = list.find((row) => row.key === "rest_reply")!;
    expect(rest.purpose).toBe(PROMPT_PURPOSE.rest_reply);
    expect(rest.active?.version).toBe(1);
    expect(rest.active?.settings).toContain("checks.max_words: 80");
    expect(rest.draftVersion).toBe(2);
    const closing = list.find((row) => row.key === "closing_line")!;
    expect(closing.active).toBeNull();
    expect(list.find((row) => row.key === "plan_split")!.draftVersion).toBeNull();
  });

  it("test_308_ac1_settings_lines_flatten_nested_settings", () => {
    const stuck = promptList(allActive()).find((row) => row.key === "stuck_story")!;
    expect(stuck.active?.settings).toContain("harder_from_pause: 3");
    expect(stuck.active?.settings.some((line) => line.startsWith("text.situation_harder: "))).toBe(
      true,
    );
  });
});

describe("ADM-08 detail (#308 AC2, AC4, AC7)", () => {
  it("test_308_ac2_detail_shows_the_active_version", () => {
    const detail = promptDetail("rest_reply", allActive())!;
    expect(detail.active?.version).toBe(1);
    expect(detail.active?.body).toContain("{{userMessage}}");
    expect(detail.draft).toBeNull();
    expect(detail.versions).toEqual([
      { version: 1, state: "active", note: "", createdAt: "2026-11-14T00:00:00Z" },
    ]);
  });

  it("test_308_ac3_detail_draft_is_newest_never_activated_above_active", () => {
    const rows = [
      version({ version: 1, active: false, activated_at: "2026-11-14T00:00:00Z" }),
      version({ version: 2, active: true, activated_at: "2026-11-15T00:00:00Z" }),
      // Active before and rolled back past: an earlier version, not a draft.
      version({ version: 3, active: false, activated_at: "2026-11-16T00:00:00Z" }),
      version({ version: 4, active: false, body: "Line one\nLine two" }),
      version({ version: 5, active: false, body: "Newest" }),
    ];
    const detail = promptDetail("rest_reply", rows)!;
    expect(detail.draft?.version).toBe(5);
    expect(detail.versions.map((entry) => [entry.version, entry.state])).toEqual([
      [5, "draft"],
      [4, "draft"],
      [3, "earlier"],
      [2, "active"],
      [1, "earlier"],
    ]);
  });

  it("test_308_ac4_detail_diffs_the_draft_against_the_active_version", () => {
    const active = version({});
    const changed = active.body.replace("{{facts}}", "{{facts}} today");
    const params = structuredClone(active.params) as { checks: Record<string, number> };
    params.checks.max_words = 60;
    const detail = promptDetail("rest_reply", [
      active,
      version({ version: 2, active: false, body: changed, params }),
    ])!;
    expect(detail.draft?.bodyDiff.filter((line) => line.kind !== "same")).toEqual([
      { kind: "removed", text: "Facts already known: {{facts}}" },
      { kind: "added", text: "Facts already known: {{facts}} today" },
    ]);
    expect(detail.draft?.settingsDiff.filter((line) => line.kind !== "same")).toEqual([
      { kind: "removed", text: '    "max_words": 80,' },
      { kind: "added", text: '    "max_words": 60,' },
    ]);
  });

  it("test_308_a_key_with_no_active_version_shows_its_newest_version_as_the_draft", () => {
    const detail = promptDetail("rest_reply", [version({ active: false })])!;
    expect(detail.active).toBeNull();
    expect(detail.draft?.version).toBe(1);
    expect(detail.draft?.bodyDiff.every((line) => line.kind === "added")).toBe(true);
  });

  it("test_308_ac7_detail_lists_draft_problems", () => {
    const active = version({});
    const detail = promptDetail("rest_reply", [
      active,
      version({ version: 2, active: false, body: active.body.replace("{{facts}}", "{{fatcs}}") }),
    ])!;
    expect(detail.draft?.problems).toContain("Unknown {{fatcs}} in the prompt.");
  });

  it("test_308_detail_unknown_key_is_null", () => {
    expect(promptDetail("nope", allActive())).toBeNull();
  });
});
