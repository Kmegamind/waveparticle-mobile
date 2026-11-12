import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CrisisPage } from "@/app/safety/crisis-page";
import { backToStep, gateFreeText, submitStepDraft } from "@/lib/safety/crisis";

const crisisText = "I want to kill myself";

describe("crisis page", () => {
  it("opens the system-voice page for a crisis message and drops the text", () => {
    const result = gateFreeText(crisisText);

    expect(result).toEqual({ action: "crisis-page", modelRequest: null });
    expect(JSON.stringify(result)).not.toContain("kill myself");
    expect(submitStepDraft(crisisText)).toEqual({ screen: "crisis", draft: "" });
  });

  it("does not call a model when the message is a crisis", () => {
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (...args: unknown[]) => {
      calls.push(args);
      throw new Error("crisis text must not be sent");
    }) as typeof fetch;

    try {
      const result = gateFreeText(crisisText);
      expect(result).toEqual({ action: "crisis-page", modelRequest: null });
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("leaves ordinary and low-mood messages on the step", () => {
    expect(submitStepDraft("This deadline is killing me")).toEqual({
      screen: "step",
      draft: "This deadline is killing me",
    });
    expect(submitStepDraft("I feel worthless and cannot cope")).toEqual({
      screen: "step",
      draft: "I feel worthless and cannot cope",
    });
  });

  it("returns to the step with an empty field", () => {
    expect(backToStep()).toEqual({ screen: "step", draft: "" });
  });

  it("shows the required line, marked placeholders, and the two controls", () => {
    const html = renderToStaticMarkup(createElement(CrisisPage, { onBack: () => undefined }));

    expect(html).toContain("This is outside the story.");
    expect(html).toContain('class="crisis-page"');
    expect(html).toContain('data-placeholder="legal-body"');
    expect(html).toContain("PLACEHOLDER: legal body text is not available yet.");
    expect(html).toContain("Get support now");
    expect(html).toContain('href="#region-resource"');
    expect(html).toContain("Back to my Step");
    expect(html).toContain('data-placeholder="region-resource"');
    expect(html).toContain(
      "PLACEHOLDER: no regional support resource is listed in docs/DECISIONS.md or docs/CONTENT_MODEL.md.",
    );
    expect(html).not.toMatch(/tel:/i);
    expect(html).not.toMatch(/newsreader|georgia|serif|tape|companion|oppenheimer/i);
    expect(html).not.toContain(crisisText);
  });
});
