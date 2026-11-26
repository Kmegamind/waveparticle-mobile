#!/usr/bin/env node
// #483: prints the inventory of the admin visual gate (e2e/admin-visual*.spec.ts): every compared
// or skipped property of every component, the exceptions with their reasons, the word-break-normal
// components and the prototype and live pages, one sorted line each. Playwright only lists the
// tests (no app, no browser). Use it to check that a reshuffle of the gate keeps every comparison:
//
//   node scripts/admin-visual-inventory.mjs > before.txt
//   ... move rows between files ...
//   node scripts/admin-visual-inventory.mjs > after.txt && diff before.txt after.txt
//
// With --counts it prints the totals only.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const folder = mkdtempSync(path.join(tmpdir(), "admin-visual-inventory-"));
const file = path.join(folder, "inventory.tsv");
try {
  const run = spawnSync("npx", ["playwright", "test", "--project=desktop", "--list"], {
    env: { ...process.env, ADMIN_VISUAL_INVENTORY: file },
    encoding: "utf8",
  });
  if (run.status !== 0) {
    process.stderr.write(run.stdout + run.stderr);
    process.exit(run.status ?? 1);
  }
  const lines = [...new Set(readFileSync(file, "utf8").split("\n").filter(Boolean))].sort();
  if (process.argv.includes("--counts")) {
    const count = (test) => lines.filter(test).length;
    const compare = (line) => line.startsWith("compare\t");
    const counts = {
      components: new Set(lines.filter(compare).map((line) => line.split("\t")[1])).size,
      comparisons: count((line) => compare(line) && line.endsWith("\tcompared")),
      skippedByAnException: count((line) => compare(line) && line.endsWith("\tskipped")),
      exceptions: count((line) => line.startsWith("exception\t")),
      wordBreakNormal: count((line) => line.startsWith("word-break-normal\t")),
      prototypePages: count((line) => line.startsWith("prototype page\t")),
      livePages: count((line) => line.startsWith("live page\t")),
    };
    process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);
  } else {
    process.stdout.write(lines.map((line) => `${line}\n`).join(""));
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}
