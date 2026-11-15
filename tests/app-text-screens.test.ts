import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CrisisPage } from "@/app/safety/crisis-page";
import { APP_TEXT_DEFAULTS, type AppTextKey, type AppTexts } from "@/lib/app-text/catalog";
import { AppTextProvider } from "@/lib/app-text/provider";

// #288 AC3, AC4: the first batch of screens reads its words through keys, with the code default
// when no published text was passed in.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/** Which component shows which keys. ui.R-OFF.body is not shown yet (the offline state is #21). */
const SCREENS: Record<string, AppTextKey[]> = {
  "src/app/_session/focus-body.tsx": [
    "ui.F3.fail.body",
    "ui.F3.fail.retry",
    "ui.F-RET.fail.body",
    "ui.F-RET.fail.retry",
  ],
  "src/app/_session/rest-body.tsx": ["ui.R1.fail.body", "ui.R1.fail.retry"],
  "src/app/end/end-screen.tsx": ["ui.END.fail.body", "ui.END.fail.retry"],
  "src/app/safety/crisis-page.tsx": ["ui.S1.title", "ui.S1.support", "ui.S1.back"],
  "src/app/protected-home.tsx": ["ui.HOME-0.greeting"],
};

const crisis = (texts?: AppTexts) => {
  const page = createElement(CrisisPage, { onBack: () => undefined });
  return renderToStaticMarkup(
    texts ? createElement(AppTextProvider, { texts, children: page }) : page,
  );
};

describe("screens read app text through keys (#288)", () => {
  it.each(Object.entries(SCREENS))("test_288_ac4_%s_reads_its_words_through_keys", (file, keys) => {
    const source = read(file);
    for (const key of keys) {
      expect(source, key).toContain(`useAppText("${key}")`);
      // The words now live in src/content/app-text.json only.
      if (APP_TEXT_DEFAULTS[key] !== "Retry") {
        expect(source, key).not.toContain(APP_TEXT_DEFAULTS[key]);
      }
    }
    expect(source).not.toMatch(/>\s*Retry\s*</);
  });

  it("test_288_ac3_without_a_provider_the_screen_shows_the_default", () => {
    const html = crisis();
    expect(html).toContain(APP_TEXT_DEFAULTS["ui.S1.title"]);
    expect(html).toContain(APP_TEXT_DEFAULTS["ui.S1.support"]);
    expect(html).toContain(APP_TEXT_DEFAULTS["ui.S1.back"]);
  });

  it("test_288_ac3_provider_text_replaces_the_default", () => {
    const html = crisis({ ...APP_TEXT_DEFAULTS, "ui.S1.back": "Return to my Goal" });
    expect(html).toContain("Return to my Goal");
    expect(html).not.toContain(APP_TEXT_DEFAULTS["ui.S1.back"]);
    expect(html).toContain(APP_TEXT_DEFAULTS["ui.S1.title"]);
  });

  it.each([
    "src/app/page.tsx",
    "src/app/focus/page.tsx",
    "src/app/rest/page.tsx",
    "src/app/end/page.tsx",
    "src/app/goal/page.tsx",
  ])("test_288_ac3_%s_passes_the_published_texts", (file) => {
    // /safety (the standalone Step demo) and /try stay static and show the defaults: /safety must
    // work before its scripts load (e2e/crisis-page.spec.ts). S1 in the rest page and the goal
    // dialogue gets the published text from those pages.
    const source = read(file);
    expect(source).toContain("await getAppTexts()");
    expect(source).toMatch(/<AppTextProvider texts=\{/);
    expect(source).toContain("await connection()");
  });
});
