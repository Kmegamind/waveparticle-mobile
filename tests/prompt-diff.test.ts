import { describe, expect, it } from "vitest";
import { lineDiff, settingsText } from "@/lib/prompts/diff";

// #308 AC4: a plain line diff of a draft against the active version.

describe("lineDiff (#308 AC4)", () => {
  it("test_308_ac4_diff_marks_added_and_removed_lines", () => {
    expect(lineDiff("a\nb\nc", "a\nx\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "x" },
      { kind: "same", text: "c" },
    ]);
  });

  it("test_308_ac4_diff_of_equal_texts_is_all_same", () => {
    expect(lineDiff("a\nb", "a\nb").every((line) => line.kind === "same")).toBe(true);
  });

  it("test_308_ac4_diff_handles_an_empty_side", () => {
    expect(lineDiff("", "a")).toEqual([
      { kind: "removed", text: "" },
      { kind: "added", text: "a" },
    ]);
    expect(lineDiff("a\nb", "b")).toEqual([
      { kind: "removed", text: "a" },
      { kind: "same", text: "b" },
    ]);
  });

  it("test_308_ac4_settings_diff_ignores_key_order", () => {
    expect(settingsText({ b: 1, a: { d: 1, c: 2 } })).toBe(
      settingsText({ a: { c: 2, d: 1 }, b: 1 }),
    );
    expect(settingsText({ b: 1, a: [2, 1] })).toBe('{\n  "a": [\n    2,\n    1\n  ],\n  "b": 1\n}');
  });
});
