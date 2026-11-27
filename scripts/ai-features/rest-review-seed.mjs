// The registry row of call two of the rest chat (#517, REST-TWO-CALLS): R-08, slug and prompt key
// rest_reply_review, category runtime. It prints SQL and connects to nothing; the owner pastes it
// into the Supabase SQL editor (a Human step). It never touches public.prompts: the prompt versions
// are stored by the owner's own prompt SQL, inactive until the owner activates one.
//
//   node scripts/ai-features/rest-review-seed.mjs             # the SQL to apply
//   node scripts/ai-features/rest-review-seed.mjs --dry-run   # the same, then ROLLBACK
//   node scripts/ai-features/rest-review-seed.mjs --check     # a read-only SELECT
//   node scripts/ai-features/rest-review-seed.mjs --undo      # the undo SQL
//
// The Supabase SQL editor shows only the last statement's result, so each output ends with the
// listing it is checked by: the dry run with the row it would add (after its rollback), the check
// with the R-08 row.
//
// Run it after supabase/migrations/20261202000000_ai_registry.sql. The row is inserted only when
// its slug has no row yet, with status "exploring" (AI-PAGE-STATUS), the next free position and
// empty registry fields ("Not written yet"); it stops before any change when R-08 belongs to
// another row. Running it twice changes nothing the second time.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { quote } from "./seed.mjs";

export const REVIEW_FEATURE = {
  featureId: "R-08",
  slug: "rest_reply_review",
  title: "Rest reply review (rest_reply_review)",
  promptKeys: ["rest_reply_review"],
  category: "runtime",
  status: "exploring",
  /** One purpose line from the owner's decision, marked as a draft for the owner to edit. */
  purpose: [
    {
      text: "Call two of the rest chat: a second look at call one's reply from the person's side, which keeps it or replaces it with a better one.",
      source: "GitHub issue #517 (REST-TWO-CALLS, 2026-11-27)",
      draft: true,
    },
  ],
};

const items = (list) => `${quote(JSON.stringify(list))}::jsonb`;

/** The guard: R-08 may belong to no other slug. */
const guard = [
  "do $guard$",
  "begin",
  `  if exists (select 1 from public.ai_features where feature_id = '${REVIEW_FEATURE.featureId}' and slug <> '${REVIEW_FEATURE.slug}') then`,
  `    raise exception '${REVIEW_FEATURE.featureId} already belongs to another registry row; nothing was changed.';`,
  "  end if;",
  "end;",
  "$guard$;",
];

const insert = [
  "insert into public.ai_features (slug, position, title, prompt_keys, purpose, pass_questions, approach, status, feature_id, category)",
  `select '${REVIEW_FEATURE.slug}', coalesce(max(position), 0) + 1, ${quote(REVIEW_FEATURE.title)}, array['${REVIEW_FEATURE.promptKeys.join("', '")}'], ${items(REVIEW_FEATURE.purpose)}, '[]'::jsonb, '[]'::jsonb, '${REVIEW_FEATURE.status}', '${REVIEW_FEATURE.featureId}', '${REVIEW_FEATURE.category}'`,
  "from public.ai_features",
  "on conflict (slug) do nothing;",
];

const select = [
  "select slug, feature_id, category, prompt_keys, status, position",
  `from public.ai_features where slug = '${REVIEW_FEATURE.slug}' or feature_id = '${REVIEW_FEATURE.featureId}';`,
];

/**
 * The dry run's last statement, after its rollback: the row the seed would add (or "skipped" when
 * the slug already has a row), so the SQL editor shows it.
 */
const preview = [
  "select",
  `  '${REVIEW_FEATURE.slug}' as slug, '${REVIEW_FEATURE.featureId}' as feature_id, '${REVIEW_FEATURE.category}' as category,`,
  `  array['${REVIEW_FEATURE.promptKeys.join("', '")}'] as prompt_keys, '${REVIEW_FEATURE.status}' as status,`,
  "  (select coalesce(max(position), 0) + 1 from public.ai_features) as position,",
  `  case when exists (select 1 from public.ai_features where slug = '${REVIEW_FEATURE.slug}')`,
  "    then 'skipped: the row is already there' else 'would add' end as dry_run;",
];

/**
 * The insert. With dryRun the insert runs inside a transaction that ends in ROLLBACK (so the
 * guard and every constraint are tried and nothing is kept), then the last statement lists the row
 * it would add.
 */
export function reviewSeedSql({ dryRun = false } = {}) {
  return [
    `-- ${REVIEW_FEATURE.featureId} ${REVIEW_FEATURE.title}: the registry row of rest_reply_review (#517).`,
    ...(dryRun
      ? ["-- DRY RUN: the insert ends in ROLLBACK; nothing is kept. The last result lists the row."]
      : []),
    "begin;",
    ...guard,
    ...insert,
    ...(dryRun ? ["rollback;", ...preview] : ["commit;"]),
    "",
  ].join("\n");
}

/** Read only: the row, and the stored versions of its prompt (never their text). */
export function reviewCheckSql() {
  return [
    "-- Check of the R-08 registry row (#517). Read only. The last result is the R-08 row.",
    "select key, version, active, activated_at from public.prompts",
    `where key = '${REVIEW_FEATURE.slug}' order by version;`,
    ...select,
    "",
  ].join("\n");
}

/**
 * The undo: removes the R-08 row (its status, field and example history go with it, by cascade).
 * Prompt lab runs and saved comparisons of it are kept on purpose (no cascade, docs/api/ai-runs.md):
 * when there are any, the undo stops before any change and says so. It never touches the prompt
 * versions in public.prompts.
 */
export function reviewUndoSql() {
  return [
    "-- Undo of scripts/ai-features/rest-review-seed.mjs (#517).",
    "begin;",
    "do $undo$",
    "begin",
    `  if to_regclass('public.ai_runs') is not null and exists (select 1 from public.ai_runs where feature_slug = '${REVIEW_FEATURE.slug}') then`,
    `    raise exception '${REVIEW_FEATURE.slug} has prompt lab runs and is kept. Export and delete its runs first (owner decision; loses spend history).';`,
    "  end if;",
    "end;",
    "$undo$;",
    `delete from public.ai_features where slug = '${REVIEW_FEATURE.slug}' and feature_id = '${REVIEW_FEATURE.featureId}';`,
    "commit;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const flags = process.argv.slice(2);
  const known = ["--dry-run", "--check", "--undo"];
  if (flags.length > 1 || flags.some((flag) => !known.includes(flag))) {
    console.error(
      "Usage: node scripts/ai-features/rest-review-seed.mjs [--dry-run | --check | --undo]",
    );
    process.exit(2);
  }
  const flag = flags[0];
  process.stdout.write(
    flag === "--check"
      ? reviewCheckSql()
      : flag === "--undo"
        ? reviewUndoSql()
        : reviewSeedSql({ dryRun: flag === "--dry-run" }),
  );
}
