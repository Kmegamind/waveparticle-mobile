#!/usr/bin/env node
// Keeps the index of each split documentation folder up to date.
// Each folder has one small file per item and a README.md with the lines
// between <!-- index:start --> and <!-- index:end -->. Only those lines are
// rewritten, so two branches that each add a file edit different files.
//
// Two branches that add files sorting into the same gap still insert at the
// same spot of the index. .gitattributes sets merge=union for the index files,
// so git keeps both lines; --check then fails on a duplicate or out-of-order
// line (a union merge may leave the new lines in the wrong order) and the fix
// is to run this script again. GitHub's web merge ignores merge drivers, so a
// conflict shown on GitHub is fixed by merging main locally.
//
//   node scripts/docs-index.mjs [root]          rewrite the indexes
//   node scripts/docs-index.mjs --check [root]  exit 1 when an index is stale,
//                                               has duplicate lines or is out of order
//
// The link check (brokenLinks) covers the folders in LINK_FOLDERS and the files
// in LINK_FILES, every docs/*.md file (linkFiles), plus the docs paths named in the source files in DOC_PATH_FILES
// (brokenDocPaths). It only checks that the file a relative [text](path) link or
// a docs/....md path points to exists. Anchors (#heading) and reference-style
// links ([text][ref]) are NOT checked.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INDEXED_FOLDERS = ["docs/api", "docs/architecture"];
export const START = "<!-- index:start -->";
export const END = "<!-- index:end -->";
const MAX_SENTENCE = 200;

export const LINK_FOLDERS = ["docs/api", "docs/architecture"];
export const LINK_FILES = ["README.md", ".github/pull_request_template.md"];
const LINK_TOP_LEVEL_DOCS = "docs";
export const DOC_PATH_FILES = ["src/app/try/focus/page.tsx"];
// Links known to be broken on main. Keep empty; add an entry only with a comment saying why.
export const LINK_ALLOWLIST = [];

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

// The files the link check reads one by one: LINK_FILES and the top-level docs/*.md.
export function linkFiles(root) {
  const top = readdirSync(path.join(root, LINK_TOP_LEVEL_DOCS))
    .filter((n) => n.endsWith(".md"))
    .sort()
    .map((n) => `${LINK_TOP_LEVEL_DOCS}/${n}`);
  return [...LINK_FILES, ...top].filter((f) => existsSync(path.join(root, f)));
}

// Relative markdown links ([text](target)) that point to a file that does not exist.
export function brokenLinks(root, folders, files = []) {
  const broken = [];
  const all = [
    ...folders.flatMap((folder) => markdownFiles(path.join(root, folder))),
    ...files.map((f) => path.join(root, f)),
  ];
  {
    for (const file of all) {
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

// docs/....md paths written in source files (for example in a code comment) that do not exist.
export function brokenDocPaths(root, files) {
  const broken = [];
  for (const f of files) {
    const text = readFileSync(path.join(root, f), "utf8");
    for (const m of text.matchAll(/\bdocs\/[\w./-]+?\.md\b/g)) {
      if (!existsSync(path.join(root, m[0]))) broken.push({ file: f, link: m[0] });
    }
  }
  return broken;
}

// Problems in the index lines of one folder: a duplicate line or lines out of order.
export function indexProblems(root, folder) {
  const text = readFileSync(path.join(root, folder, "README.md"), "utf8");
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a === -1 || b === -1 || b < a) return [`${folder}/README.md is missing the index markers`];
  const lines = text
    .slice(a + START.length, b)
    .split("\n")
    .filter((l) => l.trim() !== "");
  const problems = [];
  const seen = new Set();
  const names = [];
  for (const line of lines) {
    if (seen.has(line)) problems.push(`${folder}/README.md: duplicate index line: ${line}`);
    seen.add(line);
    const m = line.match(/^- \[[^\]]*\]\(([^)]+)\)/);
    if (m) names.push(m[1]);
  }
  for (let i = 1; i < names.length; i++) {
    if (names[i - 1] > names[i]) {
      problems.push(
        `${folder}/README.md: index lines out of order: ${names[i - 1]} before ${names[i]}`,
      );
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const rootArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const root = rootArg ? path.resolve(rootArg) : here;
  const check = process.argv.includes("--check");
  // With an explicit root (used by tests) a folder that does not exist there is skipped.
  const folders = INDEXED_FOLDERS.filter((f) => !rootArg || existsSync(path.join(root, f)));
  let bad = 0;
  for (const folder of folders) {
    const { changed } = syncIndex(root, folder, { write: !check });
    if (changed) {
      bad += 1;
      console.log(`${check ? "stale" : "updated"}: ${folder}/README.md`);
    }
    if (check) {
      for (const problem of indexProblems(root, folder)) {
        bad += 1;
        console.log(problem);
      }
    }
  }
  if (check && bad) {
    console.log(
      "Run `npm run docs:index` (or `node scripts/docs-index.mjs`) and commit the result.",
    );
  }
  process.exit(check && bad ? 1 : 0);
}
