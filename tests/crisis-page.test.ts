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
    // #262 (#233): the prototype's label; FLOW S1 calls it "Back to my Goal" too.
    expect(html).toContain("Back to my Goal");
    expect(html).not.toContain("Back to my Step");
    // #118: with no country known (the server HTML has no phone copy) S1 is S1-0: the directory
    // and the labelled US line, never an unlabelled US entry and no tel: link.
    expect(html).toContain('data-s1="none"');
    expect(html).toContain('href="https://findahelpline.com"');
    expect(html).not.toMatch(/tel:/i);
    // #262 (#233): one white card, a lead sentence, and one dashed box for the legal placeholder.
    expect(html).toContain('class="crisis-card"');
    expect(html).toContain(
      "If you are thinking about hurting yourself or someone else, please reach out to people who can help right now.",
    );
    expect(html).toMatch(
      /<div class="crisis-placeholder"[^>]*>[\s\S]*legal-body[\s\S]*<\/div>\s*<section[^>]*id="region-resource"[\s\S]*<\/section>\s*<div class="crisis-actions">/,
    );
    expect(html).not.toMatch(/newsreader|georgia|serif|tape|companion|oppenheimer/i);
    expect(html).not.toContain(crisisText);
  });
});
