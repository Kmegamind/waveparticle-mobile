import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// #482: docs/DECISIONS.md uses git's union merge, so two branches that each add a row to the same
// table merge on the command line without a conflict. Limits are in docs/testing.md.

const root = fileURLToPath(new URL("..", import.meta.url));

// Cells of a Markdown table row, split on pipes that are not escaped (GitHub splits a cell on
// an unescaped pipe even inside a code span).
function cells(row: string): string[] {
  const inner = row
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "");
  return inner.split(/(?<!\\)\|/);
}

const SEPARATOR = /^\|(\s*:?-+:?\s*\|)+\s*$/;

// Every table (a run of lines starting with "|") has a header, a separator with the same number
// of columns, and rows with that number of columns. Returns one message per problem.
export function tableProblems(markdown: string): string[] {
  const problems: string[] = [];
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trimStart().startsWith("|")) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < lines.length && lines[i].trimStart().startsWith("|")) i += 1;
    const table = lines.slice(start, i);
    const width = cells(table[0]).length;
    if (table.length < 2 || !SEPARATOR.test(table[1].trim())) {
      problems.push(`line ${start + 2}: table has no separator row after its header`);
      continue;
    }
    table.forEach((row, n) => {
      if (n === 1) {
        if (cells(row).length !== width) problems.push(`line ${start + 2}: separator width`);
        return;
      }
      if (/^(<{7}|={7}|>{7})/.test(row)) problems.push(`line ${start + n + 1}: conflict marker`);
      const count = cells(row).length;
      if (count !== width) {
        problems.push(`line ${start + n + 1}: ${count} columns, header has ${width}`);
      }
    });
  }
  return problems;
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, stdio: "pipe", encoding: "utf8" },
  );

const BASE = [
  "# Decision log",
  "",
  "## 1. Decided",
  "",
  "| Id | Date | Decision | Consequences |",
  "|---|---|---|---|",
  "| S1 | 2026-11-04 | First decision. | First consequence. |",
  "| S2 | 2026-11-05 | Second decision. | Second consequence. |",
  "",
  "## 2. Open",
  "",
].join("\n");

const ROW_A = "| A1 | 2026-11-26 | Added on branch a. | Kept after the merge. |";
const ROW_B = "| B1 | 2026-11-26 | Added on branch b. | Also kept after the merge. |";

describe("docs/DECISIONS.md union merge (#482)", () => {
  it("test_482_gitattributes_uses_union_merge_for_decisions", () => {
    const attrs = readFileSync(path.join(root, ".gitattributes"), "utf8");
    expect(attrs).toMatch(/^docs\/DECISIONS\.md\s+merge=union$/m);
    // The lines that were already there are kept.
    expect(attrs).toMatch(/^docs\/api\/README\.md\s+merge=union$/m);
    expect(attrs).toMatch(/^docs\/architecture\/README\.md\s+merge=union$/m);
  });

  it("test_482_two_branches_adding_a_row_at_the_same_place_merge_cleanly", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "decisions-union-"));
    mkdirSync(path.join(dir, "docs"));
    const file = path.join(dir, "docs/DECISIONS.md");
    writeFileSync(
      path.join(dir, ".gitattributes"),
      readFileSync(path.join(root, ".gitattributes")),
    );
    writeFileSync(file, BASE);
    expect(tableProblems(BASE)).toEqual([]);
    git(dir, "init", "-q", "-b", "main");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "base");

    // Both branches add one row after S2, the last row of the table.
    const lastRow = "| S2 | 2026-11-05 | Second decision. | Second consequence. |";
    const addRow = (branch: string, row: string) => {
      git(dir, "checkout", "-q", "-b", branch, "main");
      writeFileSync(file, BASE.replace(lastRow, `${lastRow}\n${row}`));
      git(dir, "commit", "-q", "-am", `add ${branch}`);
    };
    addRow("a", ROW_A);
    addRow("b", ROW_B);

    git(dir, "checkout", "-q", "a");
    // Without the union driver this merge conflicts; git exits non-zero and the test fails here.
    git(dir, "merge", "-q", "--no-edit", "b");

    const merged = readFileSync(file, "utf8");
    expect(merged).toContain(ROW_A);
    expect(merged).toContain(ROW_B);
    expect(merged).not.toMatch(/^(<{7}|={7}|>{7})/m);
    expect(tableProblems(merged)).toEqual([]);
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("test_482_table_check_catches_a_broken_table", () => {
    expect(tableProblems("| A | B |\n| x | y |\n")).toHaveLength(1);
    expect(tableProblems("| A | B |\n|---|---|\n| x |\n")).toEqual([
      "line 3: 1 columns, header has 2",
    ]);
    expect(tableProblems("| A | B |\n|---|---|\n| `a|b` | y |\n")).toHaveLength(1);
    expect(tableProblems("| A | B |\n|---|---|\n| a\\|b | y |\n")).toEqual([]);
  });

  it("test_482_real_decisions_file_tables_are_valid", () => {
    const decisions = readFileSync(path.join(root, "docs/DECISIONS.md"), "utf8");
    expect(tableProblems(decisions)).toEqual([]);
  });
});
