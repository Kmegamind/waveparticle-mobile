import { describe, expect, it } from "vitest";
import { renderPrompt } from "@/lib/prompts/template";

describe("prompt templates (#282)", () => {
  it("test_282_fills_every_placeholder", () => {
    expect(
      renderPrompt("Goal: {{goal}}\nTotal minutes: {{total}}", { goal: "Read", total: 25 }),
    ).toBe("Goal: Read\nTotal minutes: 25");
  });

  it("test_282_drops_a_line_whose_placeholders_are_all_missing", () => {
    expect(renderPrompt("A\nStep {{n}} of {{count}}.\nB", { n: null, count: undefined })).toBe(
      "A\nB",
    );
  });

  it("test_282_keeps_a_line_with_an_empty_string", () => {
    expect(renderPrompt("Facts: {{facts}}", { facts: "" })).toBe("Facts: ");
  });

  it("test_282_user_text_with_braces_is_never_read_as_a_placeholder", () => {
    expect(
      renderPrompt("The person wrote: {{message}}\nFacts: {{facts}}", {
        message: "fix {{facts}} now",
        facts: "F",
      }),
    ).toBe("The person wrote: fix {{facts}} now\nFacts: F");
  });

  it("test_282_a_value_may_hold_several_lines", () => {
    expect(renderPrompt("A\n{{situation}}\nB", { situation: "one\ntwo" })).toBe("A\none\ntwo\nB");
  });

  it("test_282_an_unknown_placeholder_is_an_error_not_a_silent_gap", () => {
    expect(() => renderPrompt("Goal: {{goal}} {{typo}}", { goal: "x" })).toThrow(
      /unknown placeholder: typo/,
    );
  });

  it("test_282_json_shapes_in_the_text_are_not_placeholders", () => {
    const shape = 'Shape: {"title":"...","steps":[{"title":"...","minutes":1}]}';
    expect(renderPrompt(shape, {})).toBe(shape);
  });
});
