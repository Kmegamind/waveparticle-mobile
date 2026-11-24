import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// #189 re-review N1: the pattern the owner adds to deploy_patterns in .claude/guardrails.json.
// The hook (.claude/hooks/guardrails.py) applies it with Python's re.search, so it is checked in
// Python as well as in JavaScript.
const root = fileURLToPath(new URL("..", import.meta.url));
const steps = readFileSync(path.join(root, "docs/HUMAN_STEPS.md"), "utf8");
const pattern = steps.match(/<!-- hook-pattern -->\n`([^`]+)`/)![1];

const caught = [
  "supabase link --project-ref abc",
  "supabase db push",
  "supabase db push --dry-run",
  "supabase  db   push",
  "npx supabase db push",
  "npx supabase@latest db push",
  "bunx supabase@2.40.1 db push --linked",
  "supabase migration repair --status applied 20261106000000",
  "supabase migration up --linked",
  "supabase db reset --linked",
  "cd x && supabase link --project-ref abc",
  // Global flags, with or without a value, before the subcommand (re-review N6).
  "supabase --debug db push",
  "supabase --workdir . link",
  "supabase --experimental db reset",
  "supabase --workdir=/x --debug migration repair --status applied 20261106000000",
  "npx supabase@latest --debug db push",
  "supabase -o json link --project-ref abc",
];
const allowed = [
  "supabase migration list",
  "supabase login",
  "supabase projects list",
  "brew install supabase/tap/supabase",
  "echo supabase linked",
  "cat supabase/.temp/project-ref",
  "node scripts/content/import.mjs",
  "supabase --debug db pull",
  "supabase --workdir . migration list",
  "supabase --debug login",
  "supabase --profile x projects list",
  "supabase db diff",
  "supabase migration new my_change",
];

const python = (text: string) =>
  execFileSync(
    "python3",
    ["-I", "-c", "import re,sys; print(bool(re.search(sys.argv[1], sys.argv[2])))", pattern, text],
    {
      encoding: "utf8",
    },
  ).trim() === "True";

describe("#189 the hook pattern for remote Supabase commands", () => {
  it("is written once in docs/HUMAN_STEPS.md", () => {
    expect(pattern).toBe(
      "\\bsupabase(@\\S+)?(\\s+--?\\S+(\\s+(?!-)[^\\s-]\\S*)?)*\\s+(link|db\\s+(push|reset)|migration\\s+(repair|up))\\b",
    );
  });

  it.each(caught)("catches %j", (command) => {
    expect(new RegExp(pattern).test(command)).toBe(true);
    expect(python(command)).toBe(true);
  });

  it.each(allowed)("lets %j through", (command) => {
    expect(new RegExp(pattern).test(command)).toBe(false);
    expect(python(command)).toBe(false);
  });
});
