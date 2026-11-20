#!/usr/bin/env node
// Keeps the index of each split documentation folder up to date.
// Each folder has one small file per item and a README.md with the lines
// between <!-- index:start --> and <!-- index:end -->. Only those lines are
// rewritten, so two branches that each add a file never edit the same line.
//
//   node scripts/docs-index.mjs          rewrite the indexes
//   node scripts/docs-index.mjs --check  exit 1 when an index is out of date
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INDEXED_FOLDERS = ["docs/api", "docs/architecture"];
export const START = "<!-- index:start -->";
export const END = "<!-- index:end -->";
const MAX_SENTENCE = 200;

export function firstSentence(text) {
  const line = text.replace(/\s+/g, " ").trim();
  const match = line.match(/^(.*?[.!?])(?:\s|$)/);
  let sentence = match ? match[1] : line;
  if (sentence.length > MAX_SENTENCE) {
    sentence = sentence.slice(0, MAX_SENTENCE).replace(/\s+\S*$/, "") + "…";
  }
  return sentence;
}

export function indexLine(fileName, text) {
  const lines = text.split("\n");
  const heading = lines.find((l) => l.startsWith("# "));
  const title = heading ? heading.slice(2).trim() : fileName.replace(/\.md$/, "");
  const afterHeading = heading ? lines.slice(lines.indexOf(heading) + 1) : lines;
  let first = afterHeading.find((l) => l.trim() !== "") ?? "";
  // The first line often repeats the title as "`path` (#123): ..."; show only what follows.
  const repeated = `\`${title}\``;
  if (first.startsWith(repeated)) {
    first = first.slice(repeated.length).replace(/^\s*(\([^)]*\))?:?\s*/, "");
  }
  const sentence = firstSentence(first);
  return `- [${title}](${fileName})${sentence ? `: ${sentence}` : ""}`;
}

export function buildIndex(root, folder) {
  const dir = path.join(root, folder);
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .sort()
    .map((n) => indexLine(n, readFileSync(path.join(dir, n), "utf8")))
    .join("\n");
}

export function replaceIndex(readme, index) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(`README is missing the ${START} / ${END} markers`);
  }
  return readme.slice(0, a + START.length) + "\n" + (index ? index + "\n" : "") + readme.slice(b);
}

export function syncIndex(root, folder, { write }) {
  const file = path.join(root, folder, "README.md");
  const before = readFileSync(file, "utf8");
  const after = replaceIndex(before, buildIndex(root, folder));
  const changed = before !== after;
  if (changed && write) writeFileSync(file, after);
  return { file, changed };
}

function markdownFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...markdownFiles(full));
    else if (name.endsWith(".md")) found.push(full);
  }
  return found;
}

// Relative markdown links ([text](target)) that point to a file that does not exist.
export function brokenLinks(root, folders) {
  const broken = [];
  for (const folder of folders) {
    for (const file of markdownFiles(path.join(root, folder))) {
      const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
      for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = m[1].split("#")[0];
        if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
        if (!existsSync(path.resolve(path.dirname(file), target))) {
          broken.push({ file: path.relative(root, file), link: m[1].split("#")[0] });
        }
      }
    }
  }
  return broken;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const folder of INDEXED_FOLDERS) {
    const { changed } = syncIndex(root, folder, { write: !check });
    if (changed) {
      stale += 1;
      console.log(`${check ? "stale" : "updated"}: ${folder}/README.md`);
    }
  }
  process.exit(check && stale ? 1 : 0);
}
