// Turns the output folder of one #42 offline run (scripts/offline-runs/run.mjs, by default
// offline-runs/<time>-<mode>) into SQL for `public.ai_feature_test_runs` (#436, AI-PAGE-RUNS). It
// reads the folder's files only, never calls a model, and connects to nothing: paste the SQL into
// the Supabase SQL editor, or pipe it to psql.
//
//   node scripts/ai-features/import-runs.mjs offline-runs/<name> > ai-feature-runs.sql
//   node scripts/ai-features/import-runs.mjs --dry-run offline-runs/<name>   # lists, then ROLLBACK
//
// One row per feature and prompt key of each suite that ran: split → Goal split (plan_split),
// rest → Rest reply (rest_reply), pause → Pause message (stuck_story, pause_predicament). The
// pass and fail counts are the PASS and FAIL rows of the report's summary table for that suite's
// targets (report.md, as written or as scored again with --score). A stub run is stored as
// kind 'fake_model' (the page marks it); only a run whose results.json says mode "real" is 'real'.
// retry_hints is not a feature: its version is not imported. Importing the same run again updates
// its rows (for example after scoring), so running it twice changes nothing.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { quote, readFeatureSeed } from "./seed.mjs";

/** The offline-run suite of each feature slug (src/lib/offline-runs/report.ts, Target.suite). */
export const SUITE_FEATURES = { split: "plan_split", rest: "rest_reply", pause: "pause_message" };

const STATUSES = ["PASS", "FAIL", "PENDING SCORING", "INVALID SCORING", "INCOMPLETE", "NO DATA"];

/**
 * The status of each target in the summary table of report.md, by target id.
 * @param {string} report
 * @returns {Map<string, string>}
 */
export function summaryStatuses(report) {
  const lines = report.split("\n");
  const start = lines.indexOf("## Summary");
  if (start === -1) throw new Error("report.md has no ## Summary section");
  const statuses = new Map();
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    const cells = line.split("|").map((cell) => cell.trim());
    // | Status | Story | Issue | Target | Measure | Target value | Result | Blocks |
    if (cells.length < 6 || !STATUSES.includes(cells[1])) continue;
    const id = cells[4].match(/^`([^`]+)`$/)?.[1];
    if (id) statuses.set(id, cells[1]);
  }
  return statuses;
}

/**
 * Reads one run folder: results.json (only its meta is used), targets.json and report.md.
 * @param {string} folder
 */
export function readRunFolder(folder) {
  const read = (name) => {
    const file = path.join(folder, name);
    if (!existsSync(file))
      throw new Error(`${folder} has no ${name}: is it an offline-run folder?`);
    return readFileSync(file, "utf8");
  };
  const results = JSON.parse(read("results.json"));
  const targets = JSON.parse(read("targets.json"));
  const report = read("report.md");
  return { meta: results.meta, targets: targets.targets, report };
}

/**
 * The rows to insert for one run.
 * @param {{ meta: any, targets: { id: string, suite: string }[], report: string }} run
 * @param {{ reportPath: string, features?: { slug: string, prompt_keys: string[] }[] }} options
 */
export function testRunRows(run, { reportPath, features = readFeatureSeed() }) {
  const { meta } = run;
  if (!meta || (meta.mode !== "stub" && meta.mode !== "real")) {
    throw new Error("results.json has no meta.mode of stub or real");
  }
  if (typeof meta.startedAt !== "string" || Number.isNaN(Date.parse(meta.startedAt))) {
    throw new Error("results.json has no meta.startedAt");
  }
  // Anything but an explicit real run is the fake model.
  const kind = meta.mode === "real" ? "real" : "fake_model";
  const statuses = summaryStatuses(run.report);
  const versions = new Map((meta.prompts ?? []).map((row) => [row.key, row.version]));
  const rows = [];
  for (const suite of meta.suites ?? []) {
    const slug = SUITE_FEATURES[suite];
    if (!slug) throw new Error(`unknown suite: ${suite}`);
    const feature = features.find((row) => row.slug === slug);
    if (!feature) throw new Error(`no AI feature ${slug} in the seed`);
    const targets = run.targets.filter((target) => target.suite === suite);
    const found = targets.map((target) => {
      const status = statuses.get(target.id);
      if (!status) throw new Error(`report.md has no summary row for ${target.id}`);
      return { id: target.id, status };
    });
    const pass = found.filter((row) => row.status === "PASS").length;
    const fail = found.filter((row) => row.status === "FAIL").length;
    const others = found.length - pass - fail;
    const failed = found.filter((row) => row.status === "FAIL").map((row) => row.id);
    const summary = [
      kind === "fake_model" ? "Fake model (stub): says nothing about a real model." : "Real model.",
      meta.incomplete ? `INCOMPLETE: ${meta.incomplete}.` : null,
      `${pass} pass, ${fail} fail, ${others} other (pending scoring or no data) of ${found.length} targets.`,
      failed.length > 0 ? `Failed: ${failed.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    for (const key of feature.prompt_keys) {
      rows.push({
        feature_slug: slug,
        prompt_key: key,
        kind,
        // Normalised, so only a well-formed time reaches the SQL.
        run_at: new Date(meta.startedAt).toISOString(),
        prompt_version: Number.isInteger(versions.get(key)) ? versions.get(key) : null,
        pass_count: pass,
        fail_count: fail,
        target_count: found.length,
        summary,
        report_path: reportPath,
      });
    }
  }
  return rows;
}

/**
 * The SQL. With dryRun the transaction lists the rows as comments, runs the inserts, shows them and
 * ends in ROLLBACK, so pasting it changes nothing.
 * @param {ReturnType<typeof testRunRows>} rows
 * @param {{ dryRun?: boolean }} [options]
 */
export function importSql(rows, { dryRun = false } = {}) {
  const lines = [
    "-- AI feature test runs from an offline-run folder (scripts/ai-features/import-runs.mjs, #436).",
    ...(dryRun
      ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept. It would insert or update:"]
      : []),
    ...rows.map(
      (row) =>
        `--   ${row.feature_slug} ${row.prompt_key} v${row.prompt_version ?? "?"} ${row.kind} ${row.run_at}: ${row.pass_count} pass, ${row.fail_count} fail of ${row.target_count}`,
    ),
    "begin;",
  ];
  for (const row of rows) {
    const version = row.prompt_version === null ? "null" : String(row.prompt_version);
    lines.push(
      "insert into public.ai_feature_test_runs (feature_slug, prompt_key, kind, run_at, prompt_version, pass_count, fail_count, target_count, summary, report_path)",
      `values ('${row.feature_slug}', '${row.prompt_key}', '${row.kind}', '${row.run_at}', ${version}, ${row.pass_count}, ${row.fail_count}, ${row.target_count}, ${quote(row.summary)}, ${quote(row.report_path)})`,
      "on conflict (feature_slug, prompt_key, kind, run_at) do update set prompt_version = excluded.prompt_version, pass_count = excluded.pass_count, fail_count = excluded.fail_count, target_count = excluded.target_count, summary = excluded.summary, report_path = excluded.report_path, imported_at = now();",
    );
  }
  if (dryRun) {
    lines.push(
      "select feature_slug, prompt_key, kind, run_at, prompt_version, pass_count, fail_count, target_count",
      "from public.ai_feature_test_runs order by run_at desc, feature_slug, prompt_key;",
      "rollback;",
      "",
    );
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

/** The report path as stored: relative to the repository when the folder is inside it. */
export function reportPathOf(folder, root = process.cwd()) {
  const absolute = path.resolve(folder, "report.md");
  const relative = path.relative(root, absolute);
  return relative.startsWith("..") || path.isAbsolute(relative) ? absolute : relative;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const folders = args.filter((arg) => arg !== "--dry-run");
  if (folders.length !== 1 || folders[0].startsWith("--")) {
    console.error(
      "Usage: node scripts/ai-features/import-runs.mjs [--dry-run] <offline-run folder>",
    );
    process.exit(2);
  }
  try {
    const rows = testRunRows(readRunFolder(folders[0]), { reportPath: reportPathOf(folders[0]) });
    process.stdout.write(importSql(rows, { dryRun }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
