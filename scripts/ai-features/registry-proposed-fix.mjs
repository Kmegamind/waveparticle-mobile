// The data fix of #491 (AI-PROPOSED-SEED-TEXT, owner answer of 2026-11-26): the registry shows the
// published prompt versions, not the proposed ones in prompt-table-source/proposed4/. The seed of
// #473 stored the room-to-improve text of R-02 to R-05 as the owner wrote it, which names the
// proposed versions. This script reads the owner's registry-seed.json when it runs (the file stays
// in the planning folder and its text is never committed, AI-SAMPLES-LOCAL) and prints SQL that
// replaces each such stored text with the text registry-seed.mjs now produces
// (withoutProposedVersions). It connects to nothing and never calls a model.
//
//   node scripts/ai-features/registry-proposed-fix.mjs <registry-seed.json> --dry-run  # then ROLLBACK
//   node scripts/ai-features/registry-proposed-fix.mjs <registry-seed.json>            # the SQL to apply
//   node scripts/ai-features/registry-proposed-fix.mjs <registry-seed.json> --check    # read-only SELECT
//   node scripts/ai-features/registry-proposed-fix.mjs <registry-seed.json> --undo     # the undo SQL
//
// Each update changes a field only while it still holds the seed's old text, so a text edited in
// the admin since the seed is left as it is; the undo puts the exact old text back only where the
// field still holds the fixed text. Running the fix twice changes nothing the second time.

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { quote } from "./seed.mjs";
import {
  parseRegistrySeed,
  registrySlug,
  TEXT_FIELDS,
  withoutProposedVersions,
} from "./registry-seed.mjs";

/**
 * @typedef {{ feature_id: string, slug: string, column: string, old_text: string,
 *   new_text: string }} ProposedFix
 */

/**
 * The stored fields that name a proposed prompt version: for each seed row and text field whose
 * text withoutProposedVersions changes, the old text (as the #473 seed stored it) and the new one.
 * @param {unknown} seed
 * @returns {ProposedFix[]}
 */
export function proposedFixes(seed) {
  parseRegistrySeed(seed); // the same checks as the seed itself
  const rows = /** @type {{ rows: Record<string, unknown>[] }} */ (seed).rows;
  /** @type {ProposedFix[]} */
  const fixes = [];
  for (const raw of rows) {
    const id = /** @type {string} */ (raw.id);
    const slug = registrySlug(id, String(raw.name).trim());
    for (const [from, column] of Object.entries(TEXT_FIELDS)) {
      const oldText = String(raw[from] ?? "").trim();
      const newText = withoutProposedVersions(oldText);
      if (newText !== oldText) {
        fixes.push({ feature_id: id, slug, column, old_text: oldText, new_text: newText });
      }
    }
  }
  return fixes;
}

/** The fixes from a seed file. */
export function readProposedFixes(file) {
  return proposedFixes(JSON.parse(readFileSync(file, "utf8")));
}

const where = (fix, text) =>
  `where slug = '${fix.slug}' and feature_id = '${fix.feature_id}' and ${fix.column} = ${quote(text)};`;

/**
 * The SQL that applies the fix. With dryRun it lists the result and ends in ROLLBACK.
 * @param {ProposedFix[]} fixes
 * @param {{ dryRun?: boolean }} [options]
 */
export function proposedFixSql(fixes, { dryRun = false } = {}) {
  const lines = [
    "-- #491: the registry shows the published prompt versions (AI-PROPOSED-SEED-TEXT).",
    "-- scripts/ai-features/registry-proposed-fix.mjs; each field changes only while it holds the seed's old text.",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    ...fixes.map((fix) => `--   ${fix.feature_id} ${fix.slug}: ${fix.column}`),
    "begin;",
  ];
  for (const fix of fixes) {
    lines.push(
      `update public.ai_features set ${fix.column} = ${quote(fix.new_text)}`,
      where(fix, fix.old_text),
    );
  }
  if (dryRun) {
    lines.push(...resultSelect(fixes), "rollback;", "");
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

/** One line per fix: fixed, old text, missing, or edited since (never prints the texts). */
function resultSelect(fixes) {
  const expected = fixes
    .map(
      (fix) =>
        `  ('${fix.feature_id}', '${fix.slug}', '${fix.column}', ${quote(fix.old_text)}, ${quote(fix.new_text)})`,
    )
    .join(",\n");
  const cases = Object.values(TEXT_FIELDS)
    .map((column) => `when '${column}' then f.${column}`)
    .join(" ");
  return [
    "with expected (feature_id, slug, field, old_text, new_text) as (values",
    expected,
    "), stored as (",
    `  select e.*, case e.field ${cases} end as now_text`,
    "  from expected e left join public.ai_features f on f.slug = e.slug and f.feature_id = e.feature_id",
    ")",
    "select feature_id, slug, field,",
    "  case",
    "    when now_text is null then 'missing'",
    "    when now_text = new_text then 'fixed'",
    "    when now_text = old_text then 'old text (names a proposed version)'",
    "    else 'edited since the seed (left as it is)'",
    "  end as result",
    "from stored order by feature_id, field;",
  ];
}

/**
 * A read-only SELECT: after the fix every line says fixed (or edited since the seed).
 * @param {ProposedFix[]} fixes
 */
export function proposedCheckSql(fixes) {
  return [
    "-- Read only (#491): after the fix every line says 'fixed' or 'edited since the seed'.",
    ...resultSelect(fixes),
    "",
  ].join("\n");
}

/**
 * The undo: puts the exact old text back where the field still holds the fixed text.
 * @param {ProposedFix[]} fixes
 */
export function proposedUndoSql(fixes) {
  const lines = [
    "-- Undo of the #491 fix (scripts/ai-features/registry-proposed-fix.mjs).",
    "begin;",
  ];
  for (const fix of fixes) {
    lines.push(
      `update public.ai_features set ${fix.column} = ${quote(fix.old_text)}`,
      where(fix, fix.new_text),
    );
  }
  lines.push("commit;", "");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const flags = args.filter((arg) => arg.startsWith("--"));
  const files = args.filter((arg) => !arg.startsWith("--"));
  const unknown = flags.filter((flag) => !["--dry-run", "--check", "--undo"].includes(flag));
  if (unknown.length > 0 || flags.length > 1 || files.length !== 1) {
    console.error(
      "Usage: node scripts/ai-features/registry-proposed-fix.mjs <registry-seed.json> [--dry-run | --check | --undo]",
    );
    process.exit(2);
  }
  const fixes = readProposedFixes(files[0]);
  const flag = flags[0];
  process.stdout.write(
    flag === "--check"
      ? proposedCheckSql(fixes)
      : flag === "--undo"
        ? proposedUndoSql(fixes)
        : proposedFixSql(fixes, { dryRun: flag === "--dry-run" }),
  );
}
