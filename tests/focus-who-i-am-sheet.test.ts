import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WhoIAmSheet } from "@/app/_session/who-i-am-sheet";
import {
  completeStep,
  doneLines,
  firstSentence,
  setStepCards,
  syncSession,
  undoDone,
  type FocusSession,
} from "@/lib/prototype/session";

// US-FOC-17 (#72): the "Who I am" sheet from his portrait (PORTRAIT-SHEET, prototype v4 F1-C),
// with one line per finished Step (DONE-LINE).

const MIN = 60_000;

const plan = {
  goal: { text: "Write the report", minutes: 30 },
  steps: [
    { title: "Outline", description: "", minutes: 10 },
    { title: "Draft", description: "", minutes: 10 },
    { title: "Check", description: "", minutes: 10 },
  ],
};

/** Step 1 started at 0 with a background card and two story cards (at 5 and 10 minutes). */
function started(): FocusSession {
  const fresh = syncSession(null, plan, 1);
  const withNext = setStepCards(
    fresh,
    1,
    { opening: "I take the next file. It is thin.", story: ["The lamp flickers. I wait."] },
    0,
  );
  return setStepCards(
    withNext,
    0,
    {
      opening: "I sit at the desk. The room is cold.",
      story: ["I open the first box. Nothing in it is labelled.", "I find the map! It is old."],
    },
    0,
  );
}

describe("DONE-LINE the first sentence of a card", () => {
  it("test_done_line_takes_the_first_sentence", () => {
    expect(firstSentence("I sit at the desk. The room is cold.")).toBe("I sit at the desk.");
    expect(firstSentence("I find the map! It is old.")).toBe("I find the map!");
    expect(firstSentence("Is it here? I look again.")).toBe("Is it here?");
  });

  it("test_done_line_keeps_a_card_of_one_sentence_whole", () => {
    expect(firstSentence("  I close the drawer.  ")).toBe("I close the drawer.");
    expect(firstSentence("I close the drawer")).toBe("I close the drawer");
  });

  it("test_done_line_does_not_cut_at_an_initial_or_a_title", () => {
    expect(firstSentence("J. Robert signs the form. Then he waits.")).toBe(
      "J. Robert signs the form.",
    );
    expect(firstSentence("Dr. Lawrence calls at noon. I answer.")).toBe(
      "Dr. Lawrence calls at noon.",
    );
  });
});

describe("#72 AC1 one line for each Step I have finished, never a Step ahead", () => {
  it("test_us_foc_17_ac1_no_line_before_the_first_done", () => {
    expect(doneLines(started(), 3 * MIN)).toEqual([]);
  });

  it("test_us_foc_17_ac1_a_finished_step_shows_the_first_sentence_of_its_last_shown_card", () => {
    // Done at 6 minutes: the background card and the first story card were shown.
    const done = completeStep(started(), 6 * MIN);
    expect(doneLines(done, 6 * MIN)).toEqual(["I open the first box."]);
  });

  it("test_us_foc_17_ac1_only_the_background_card_shown_gives_its_first_sentence", () => {
    const done = completeStep(started(), 1 * MIN);
    expect(doneLines(done, 1 * MIN)).toEqual(["I sit at the desk."]);
  });

  it("test_us_foc_17_ac1_never_a_row_for_the_current_step_or_a_step_ahead", () => {
    const done = completeStep(started(), 6 * MIN);
    // Step 2's cards are loaded and its clock runs, but Step 2 is not finished.
    expect(doneLines(done, 30 * MIN)).toHaveLength(1);
  });

  it("test_us_foc_17_ac1_an_undone_step_loses_its_line", () => {
    const done = completeStep(started(), 6 * MIN);
    // Undo is offered for 8 seconds after Done.
    const undone = undoDone(done, 6 * MIN + 1_000);
    expect(undone.current).toBe(0);
    expect(doneLines(undone, 6 * MIN + 1_000)).toEqual([]);
  });

  it("test_us_foc_17_ac1_a_finished_step_with_no_card_shown_has_no_line", () => {
    const fresh = syncSession(null, plan, 1);
    expect(doneLines(completeStep(fresh, 1 * MIN), 1 * MIN)).toEqual([]);
  });
});

const who = "I'm a physicist from Berkeley, asked to run a laboratory.";

function sheet(lines: string[]) {
  return renderToStaticMarkup(
    createElement(WhoIAmSheet, {
      open: true,
      onClose: () => {},
      who,
      lines,
      returnTo: { current: null },
    }),
  );
}

describe("#72 AC1 and AC3 the sheet as in prototype v4 F1-C", () => {
  it("test_us_foc_17_ac1_the_sheet_is_a_dialog_titled_where_i_am_now", () => {
    const html = sheet([]);
    expect(html).toMatch(/<dialog[^>]*aria-labelledby="who-i-am-title"/);
    expect(html).toMatch(/id="who-i-am-title"[^>]*>Where I am now</);
  });

  it("test_us_foc_17_ac1_shows_who_i_am_in_his_voice_and_what_i_have_done", () => {
    const html = sheet(["I open the first box."]);
    expect(html).toContain(">Who I am<");
    expect(html).toContain("I&#x27;m a physicist from Berkeley, asked to run a laboratory.");
    expect(html).toContain(">What I have done<");
    expect(html).toMatch(/<ul[^>]*><li>I open the first box\.<\/li><\/ul>/);
  });

  it("test_us_foc_17_ac1_says_nothing_yet_before_the_first_finished_step", () => {
    const html = sheet([]);
    expect(html).toContain("Nothing yet tonight.");
    expect(html).not.toContain("<li>");
  });

  it("test_us_foc_17_ac2_has_a_close_button", () => {
    expect(sheet([])).toMatch(/<button[^>]*class="button-gray[^"]*"[^>]*>Close<\/button>/);
  });

  it("test_us_foc_17_ac3_no_name_label_no_quote_and_no_what_i_plan", () => {
    const html = sheet(["I open the first box."]);
    expect(html).not.toMatch(/Oppenheimer/);
    expect(html).not.toMatch(/What I plan/i);
    expect(html).not.toMatch(/<q[ >]|<blockquote|&quot;|“|”/);
  });
});

describe("#72 AC1 his portrait on the focus page opens the sheet", () => {
  it("test_us_foc_17_ac1_the_portrait_is_a_button_that_opens_a_dialog", () => {
    const body = readFileSync("src/app/_session/focus-body.tsx", "utf8");
    expect(body).toMatch(
      /<button[\s\S]{0,600}aria-haspopup="dialog"[\s\S]{0,600}COMPANION\.portrait/,
    );
    expect(body).toMatch(/<WhoIAmSheet/);
  });

  it("test_us_foc_17_ac1_both_focus_pages_pass_the_story_who_i_am", () => {
    expect(readFileSync("src/app/try/focus/focus-screen.tsx", "utf8")).toMatch(/who: story\.who/);
    expect(readFileSync("src/app/focus/account-focus.tsx", "utf8")).toMatch(/who,?\n/);
  });
});
