import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");

describe("#215 AC4 the chat decisions are recorded", () => {
  it("records both decisions in the decision log", () => {
    const log = read("docs/DECISIONS.md");
    expect(log).toMatch(/\| CHAT-QUESTION-END \|/);
    expect(log).toMatch(/\| CHAT-NO-RUN-LIST \|/);
  });

  it("lists the chat exception to the full-stop rule in the content model", () => {
    const model = read("docs/CONTENT_MODEL.md");
    expect(model).toMatch(/ends with a full stop[^|]*rest chat reply may end on its question/i);
  });
});
