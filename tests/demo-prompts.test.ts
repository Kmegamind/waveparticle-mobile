import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bannedAt,
  chatSystem,
  classifyTurn,
  drawGestures,
  factsBefore,
  formatFor,
  storyCardsPrompt,
} from "../scripts/demo-prompts.mjs";

const stage0 = JSON.parse(readFileSync("docs/demo/site-search.stage0.json", "utf8"));
const step2 = stage0.steps[1];

describe("what he may know at each Step", () => {
  it("only offers facts from slices before the entry slice", () => {
    const facts = factsBefore(stage0, "s3").join(" ");
    expect(facts).toMatch(/thin snake/);
    expect(facts).not.toMatch(/too narrow/);
  });
  it("bans words from the entry slice onward", () => {
    const banned = bannedAt(stage0, "s3");
    expect(banned).toContain("fence");
    expect(banned).toContain("this is the place");
    expect(banned).not.toContain("thin snake");
  });
  it("keeps the next slice out of the story-card prompt", () => {
    const text = storyCardsPrompt(stage0, step2);
    expect(text).toMatch(/thin snake/);
    expect(text).not.toMatch(/never do/);
    expect(text).toMatch(/"landing"/);
    expect(storyCardsPrompt(stage0, stage0.steps[0])).not.toMatch(/"landing"/);
  });
});

describe("chat turn handling", () => {
  it("recognises greeting, question, clarify and the user's state", () => {
    expect(classifyTurn("hey").kind).toBe("greeting");
    expect(classifyTurn("what are you doing right now?").kind).toBe("question");
    expect(classifyTurn("wait, who's Dudley?").kind).toBe("clarify");
    expect(classifyTurn("I'm so tired I can't focus").state).toBe("tired");
    expect(classifyTurn("I just want to quit").state).toBe("sad");
  });
  it("follows the format policy and lets the state override the talk row", () => {
    expect(formatFor({ kind: "question", state: "" }, 1).action).toBe(true);
    expect(formatFor({ kind: "clarify", state: "" }, 0).action).toBe(false);
    expect(formatFor({ kind: "chat", state: "tired" }, 0).max).toBe(2);
  });
  it("draws gestures that were not used lately", () => {
    const g = ["a", "b", "c", "d"];
    const out = drawGestures(g, ["a", "b"], 2, () => 0);
    expect(out).toEqual(["c", "d"]);
  });
  it("shows gestures and the action format only when the action is on", () => {
    const base = {
      entrySlice: "s3",
      whyHard: "He is about to argue.",
      mood: "dejected",
      kind: "greeting",
      state: "",
      max: 2,
      gestures: ["blowing on cold hands", "rubbing grit out of one eye"],
      history: [],
      extraNames: [],
      peopleLines: ["Major Dudley is an Army officer."],
      stuck: "",
      resolved: "",
    };
    const on = chatSystem(stage0, { ...base, actionOn: true });
    const off = chatSystem(stage0, { ...base, actionOn: false });
    expect(on).toMatch(/blowing on cold hands/);
    expect(on).toMatch(/action in parentheses/);
    expect(off).not.toMatch(/blowing on cold hands/);
    expect(off).toMatch(/Words only/);
    expect(on).toMatch(/dejected/);
  });
});
