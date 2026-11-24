// Pure checks behind the "Human steps" pull request check (#189). Each function returns a list of
// plain sentences; an empty list means the check passed. The CLI is scripts/check-pr.mjs.
// Nothing here reads files, runs git or prints a value of a setting.

export const APPLY_PHRASE = "Apply to dev, then prod";
const STEP_TAGS = ["dev", "prod", "repo"];
const MIGRATION_NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;
const MIGRATION_DIR = "supabase/migrations/";

const EXAMPLE_STEP = "1. [dev, prod] What to do. Where to do it.";

/**
 * The text under the "## Human steps" heading, up to the next heading of level 1 or 2, with HTML
 * comments removed and trimmed. `null` when the heading is missing.
 */
export function humanStepsSection(body) {
  const lines = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const start = lines.findIndex((line) => /^##\s+human steps\s*$/i.test(line.trim()));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line));
  const text = (end === -1 ? rest : rest.slice(0, end)).join("\n");
  return text.replace(/<!--[\s\S]*?(-->|$)/g, "").trim();
}

/** The numbered steps of a section: one entry per line that starts with "1." or "1)". */
export function humanStepLines(section) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s/.test(line));
}

function stepTags(line) {
  const match = line.match(/^\d+[.)]\s+\[([^\]]*)\]/);
  if (!match) return null;
  return match[1]
    .split(/,|\bthen\b|\band\b/i)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

const isNone = (section) => /^none\.?$/i.test(section.trim());

/**
 * Checks the "Human steps" section of a pull request body.
 * - `addedMigrations`: file names (no folder) of migrations this pull request adds.
 * - `newEnvNames`: environment variable names this pull request adds.
 */
export function checkHumanSteps({ body, addedMigrations = [], newEnvNames = [] }) {
  const section = humanStepsSection(body);
  if (section === null) {
    return [
      `The pull request body has no "## Human steps" section. Add it (see .github/pull_request_template.md) and write "None" or one numbered step per line, for example "${EXAMPLE_STEP}".`,
    ];
  }
  if (section === "") {
    return [
      `The "## Human steps" section is empty. Write "None" if a human has nothing to do after the merge, or one numbered step per line, for example "${EXAMPLE_STEP}".`,
    ];
  }

  const errors = [];
  const steps = humanStepLines(section);
  if (isNone(section)) {
    for (const name of addedMigrations) {
      errors.push(
        `The "## Human steps" section says "None", but this pull request adds the migration ${name}. Replace "None" with a step such as "1. [dev, prod] ${APPLY_PHRASE}: ${name} (docs/HUMAN_STEPS.md, Apply migrations)."`,
      );
    }
    for (const name of newEnvNames) {
      errors.push(
        `The "## Human steps" section says "None", but this pull request adds the environment variable ${name}. Replace "None" with a step that names ${name} and its Vercel scopes (Production, Preview).`,
      );
    }
    return errors;
  }

  if (steps.length === 0) {
    return [
      `The "## Human steps" section has no numbered steps. Write "None", or one numbered step per line, for example "${EXAMPLE_STEP}".`,
    ];
  }

  for (const line of steps) {
    const tags = stepTags(line);
    const bad = tags?.filter((tag) => !STEP_TAGS.includes(tag)) ?? [];
    if (!tags || tags.length === 0 || bad.length > 0) {
      errors.push(
        `This human step does not say where it applies: "${line.slice(0, 80)}". Start it with [dev], [prod], [dev, prod] or [repo] (GitHub or the repository, no environment), for example "${EXAMPLE_STEP}".`,
      );
    }
  }

  for (const name of addedMigrations) {
    const listed = steps.some(
      (line) => line.includes(name) && line.toLowerCase().includes(APPLY_PHRASE.toLowerCase()),
    );
    if (!listed) {
      errors.push(
        `This pull request adds the migration ${name}, but no human step names it with "${APPLY_PHRASE}". Add a step such as "1. [dev, prod] ${APPLY_PHRASE}: ${name} (docs/HUMAN_STEPS.md, Apply migrations)."`,
      );
    }
  }

  for (const name of newEnvNames) {
    const line = steps.find((step) => new RegExp(`\\b${name}\\b`).test(step));
    if (!line) {
      errors.push(
        `This pull request adds the environment variable ${name}, but no human step names it. Add a step that names ${name}, its Vercel scopes (Production, Preview) and whether it is public (docs/HUMAN_STEPS.md, Add or change an environment variable).`,
      );
    } else if (!/\b(production|preview)\b/i.test(line)) {
      errors.push(
        `The human step for ${name} does not name its Vercel scopes. Say "Production", "Preview" or both in that step.`,
      );
    }
  }
  return errors;
}

/** The migration file names (no folder) among a list of added paths. */
export function addedMigrationNames(addedPaths) {
  return addedPaths
    .filter((p) => p.startsWith(MIGRATION_DIR) && p.endsWith(".sql"))
    .map((p) => p.slice(MIGRATION_DIR.length))
    .filter((name) => !name.includes("/"));
}

function isRealTimestamp(stamp) {
  const [y, mo, d, h, mi, s] = [0, 4, 6, 8, 10, 12].map((i, n) =>
    Number(stamp.slice(i, n === 0 ? 4 : i + 2)),
  );
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    date.getUTCHours() === h &&
    date.getUTCMinutes() === mi &&
    date.getUTCSeconds() === s
  );
}

/**
 * Every migration file name is `<14-digit timestamp>_<lower_case_name>.sql`, the timestamp is a
 * real date and time, and no two files share a timestamp. With that, the order of the names is
 * the order of the timestamps, which is the order the Supabase CLI applies them in.
 */
export function checkMigrationNames(names) {
  const errors = [];
  const seen = new Map();
  for (const name of names) {
    const match = name.match(MIGRATION_NAME);
    if (!match) {
      errors.push(
        `The migration file name "${name}" does not match <YYYYMMDDHHMMSS>_<lower_case_name>.sql. Rename it, for example 20261201000000_my_change.sql.`,
      );
      continue;
    }
    const stamp = match[1];
    if (!isRealTimestamp(stamp)) {
      errors.push(
        `The migration file name "${name}" starts with ${stamp}, which is not a real date and time (YYYYMMDDHHMMSS). Rename it.`,
      );
    }
    if (seen.has(stamp)) {
      errors.push(
        `The migration files "${seen.get(stamp)}" and "${name}" share the timestamp ${stamp}. Give the newer one a later timestamp.`,
      );
    } else {
      seen.set(stamp, name);
    }
  }
  return errors;
}

/**
 * Each migration this pull request adds must sort after every migration already on the base
 * branch, or a database that already ran the newer ones would skip it.
 */
export function checkNewMigrationsAreLatest(baseNames, addedNames) {
  const latest = [...baseNames].sort().at(-1);
  if (!latest) return [];
  return addedNames
    .filter((name) => name <= latest)
    .map(
      (name) =>
        `The new migration ${name} is not later than ${latest}, the newest migration on the base branch. Rename it with a later timestamp (another pull request probably added a migration first).`,
    );
}

/**
 * Environment variable names read as process.env.NAME, env.NAME or env["NAME"] (with or without
 * "process.") in some code. A name read through a constant (env[SOME_NAME]) is not seen: for
 * those, the .env.example part of the check and the pull request template rule apply.
 */
export function envNamesInCode(text) {
  const names = new Set();
  for (const m of String(text).matchAll(
    /\b(?:process\.)?env(?:\.([A-Z][A-Z0-9_]*)|\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\])/g,
  )) {
    names.add(m[1] ?? m[2]);
  }
  return names;
}

/** The added lines of a unified diff (without the "+" and without the "+++" file headers). */
export function addedDiffLines(diff) {
  return String(diff)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

/** The variable names (NAME=...) in a .env.example text. Values are never returned. */
export function envExampleNames(text) {
  const names = new Set();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) names.add(m[1]);
  }
  return names;
}

/**
 * The environment variables a pull request adds: names read in the changed code that the base
 * branch's code never read, and names added to .env.example.
 */
export function newEnvNames({ srcDiff, baseCodeNames, baseExample, headExample }) {
  const fromCode = [...envNamesInCode(addedDiffLines(srcDiff).join("\n"))].filter(
    (name) => !baseCodeNames.has(name),
  );
  const before = envExampleNames(baseExample);
  const fromExample = [...envExampleNames(headExample)].filter((name) => !before.has(name));
  return [...new Set([...fromCode, ...fromExample])].sort();
}

/**
 * Each new environment variable must be named in .env.example and in docs/deploy.md
 * (the Human steps part is checked by checkHumanSteps).
 */
export function checkEnvNamesDocumented(names, { headExample, deployDoc }) {
  const example = envExampleNames(headExample);
  const errors = [];
  for (const name of names) {
    if (!example.has(name)) {
      errors.push(
        `The environment variable ${name} is read in src/ but is not in .env.example. Add the line "${name}=" (no real value) to .env.example.`,
      );
    }
    if (!new RegExp(`\\b${name}\\b`).test(deployDoc)) {
      errors.push(
        `The environment variable ${name} is not in docs/deploy.md. Add it to the table "Environment variables" with its Vercel scopes and whether it may carry the NEXT_PUBLIC_ prefix.`,
      );
    }
  }
  return errors;
}
