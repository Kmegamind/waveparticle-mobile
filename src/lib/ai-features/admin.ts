import { versionsOf, type PromptVersionRow } from "@/lib/prompts/admin";

// #439 (part of #430): what the AI features index and the read-only feature pages show. Server
// code only. The rows come through the signed-in user's own client: public.ai_features and
// public.ai_feature_test_runs (content editors read them, 20261130000000_ai_features.sql), and the
// prompt text of section (e) live from public.prompts through public.list_prompt_versions, the same
// call as ADM-08 Prompts (readPromptVersions). No prompt text is copied into the feature tables.

/** One item of (a), (b) or (c): its text, its source (file and line, or null), and whether it is a draft. */
export type AiFeatureItem = { text: string; source: string | null; draft: boolean };

export type AiFeatureStatus = "not_started" | "exploring" | "passed" | "frozen";

/** One row of public.ai_features, as the page reads it. */
export type AiFeatureRow = {
  slug: string;
  position: number;
  title: string;
  prompt_keys: string[];
  purpose: AiFeatureItem[];
  pass_questions: AiFeatureItem[];
  approach: AiFeatureItem[];
  status: AiFeatureStatus;
  created_at?: string;
  /** The last save of (a) to (c) in the admin, and who made it (#453). */
  sections_updated_at?: string | null;
  sections_updated_by?: string | null;
  /** #473: pipeline, gate or runtime (20261202000000_ai_registry.sql). */
  category?: "pipeline" | "gate" | "runtime";
};

/** One row of public.ai_feature_test_runs. */
export type AiFeatureTestRunRow = {
  id: number;
  feature_slug: string;
  prompt_key: string;
  kind: "fake_model" | "real";
  run_at: string;
  prompt_version: number | null;
  pass_count: number;
  fail_count: number;
  target_count: number;
  summary: string;
  report_path: string;
  imported_at: string;
};

/** The status words of AI-PAGE-STATUS (the story pipeline's four). */
export const AI_FEATURE_STATUS_LABEL: Record<AiFeatureStatus, string> = {
  not_started: "Not started",
  exploring: "Exploring",
  passed: "Passed",
  frozen: "Frozen",
};

export const AI_FEATURE_STATUSES = Object.keys(AI_FEATURE_STATUS_LABEL) as AiFeatureStatus[];

type Answer = { data: unknown; error: unknown };
/** Reads one table, ordered by one column ascending, through the user's own client. */
export type TableRead = (table: string, order: string) => Promise<Answer>;

/** The features in page order, or null when they could not be read. */
export async function readAiFeatures(read: TableRead): Promise<AiFeatureRow[] | null> {
  try {
    const { data, error } = await read("ai_features", "position");
    if (error || !Array.isArray(data)) return null;
    return data as AiFeatureRow[];
  } catch {
    return null;
  }
}

/** The imported test runs (all, or one feature's), or null when they could not be read. */
export async function readTestRuns(
  read: () => Promise<Answer>,
): Promise<AiFeatureTestRunRow[] | null> {
  try {
    const { data, error } = await read();
    if (error || !Array.isArray(data)) return null;
    return data as AiFeatureTestRunRow[];
  } catch {
    return null;
  }
}

/** "Pause message (stuck_story + pause_predicament)" → "Pause message". */
export function featureName(title: string): string {
  // The last bracket group holds the prompt keys; it never holds a "(" itself (#475).
  return title.replace(/\s*\([^()]*\)\s*$/, "") || title;
}

/** A run time as "2026-11-25 20:15" in UTC. */
export function formatRunTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 16).replace("T", " ");
}

/** "3 of 4 targets pass, 1 fail". */
export function runResult(
  run: Pick<AiFeatureTestRunRow, "pass_count" | "fail_count" | "target_count">,
) {
  const text = `${run.pass_count} of ${run.target_count} targets pass`;
  return run.fail_count > 0 ? `${text}, ${run.fail_count} fail` : text;
}

export type TestRunGroup = {
  key: string;
  time: string;
  dateTime: string;
  fake: boolean;
  /** "stuck_story v3", or the key alone when the run did not record the version. */
  prompts: string[];
  result: string;
  summary: string;
};

/** One row per run (time and kind), newest first: the rows of each prompt key of a run together. */
export function testRunGroups(runs: AiFeatureTestRunRow[]): TestRunGroup[] {
  const groups = new Map<string, { first: AiFeatureTestRunRow; prompts: Map<string, string> }>();
  const sorted = [...runs].sort(
    (left, right) => Date.parse(right.run_at) - Date.parse(left.run_at),
  );
  for (const run of sorted) {
    const key = `${run.kind} ${run.run_at}`;
    const group = groups.get(key) ?? { first: run, prompts: new Map<string, string>() };
    if (!group.prompts.has(run.prompt_key)) {
      group.prompts.set(
        run.prompt_key,
        run.prompt_version === null ? run.prompt_key : `${run.prompt_key} v${run.prompt_version}`,
      );
    }
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, { first, prompts }]) => ({
    key,
    time: formatRunTime(first.run_at),
    dateTime: first.run_at,
    fake: first.kind !== "real",
    prompts: [...prompts.values()],
    result: runResult(first),
    summary: first.summary,
  }));
}

export type FeaturePrompt = {
  key: string;
  published: { version: number; body: string } | null;
  draft: { version: number; body: string } | null;
};

/**
 * Section (e): each prompt key's published text and its newest draft, as ADM-08 reads them. #474:
 * any key, so the Pipeline and Quality gate keys of the registry show their texts too.
 */
export function featurePrompts(keys: string[], versions: PromptVersionRow[]): FeaturePrompt[] {
  return keys.map((key) => {
    const { active, draft } = versionsOf(key, versions);
    return {
      key,
      published: active ? { version: active.version, body: active.body } : null,
      draft: draft ? { version: draft.version, body: draft.body } : null,
    };
  });
}

export type IndexRow = {
  slug: string;
  title: string;
  /** The first purpose item, or null: "Not written yet". */
  purpose: string | null;
  status: AiFeatureStatus;
  /** The published version of each prompt key, "none" when a key has none. */
  versions: string[];
  draftExists: boolean;
  lastRun: { time: string; fake: boolean } | null;
};

/** One row of the AI features index. */
export function indexRow(
  feature: AiFeatureRow,
  versions: PromptVersionRow[],
  runs: AiFeatureTestRunRow[],
): IndexRow {
  const prompts = featurePrompts(feature.prompt_keys, versions);
  const [last] = testRunGroups(runs.filter((run) => run.feature_slug === feature.slug));
  return {
    slug: feature.slug,
    title: feature.title,
    purpose: feature.purpose[0]?.text ?? null,
    status: feature.status,
    versions: prompts.map((prompt) => (prompt.published ? `v${prompt.published.version}` : "none")),
    draftExists: prompts.some((prompt) => prompt.draft !== null),
    lastRun: last ? { time: last.time, fake: last.fake } : null,
  };
}
