import type { ContentRole } from "@/lib/admin/roles";
import { buildLabCall, isLabCallKey } from "@/lib/model-gateway/gateway";
import type { PromptVersionRow } from "@/lib/prompts/admin";
import type { PromptRow } from "@/lib/prompts/repository";
import { renderPrompt, type PromptValue } from "@/lib/prompts/template";
import { runCost, type CostNote, type PriceTable } from "./cost";
import type { LabModel } from "./model";

// #476 (FR-AILAB-1 to FR-AILAB-3; AI-RUN-PERMISSION, AI-RUN-LIVE, AI-LAB-STUB): one Run of the
// prompt lab. Server code only; every outside part is a dependency, so the tests pass a fake
// (stub) model and an in-memory run log. Admin and writer may run; anyone else is refused before
// anything is read or sent. The lab sends only a prompt and a sample, never user text. There is no
// spending cap: every run that reached the model is recorded, an error included.

/** The longest pasted prompt (as the prompt editor, PROMPT_BODY_MAX_LENGTH). */
export const PASTED_MAX_LENGTH = 20_000;
/** One lab call's waiting time. Pipeline prompts write long answers. */
export const LAB_TIME_LIMIT_MS = 120_000;
/** The answer's token ceiling unless the version's settings give `max_tokens`. */
export const LAB_MAX_TOKENS = 4096;

export type RunPrompt =
  | { source: "published" }
  | { source: "draft"; version: number }
  | { source: "pasted"; text: string };

export type RunRequest = {
  /** The registry feature (public.ai_features.slug). */
  feature: string;
  /** One of the feature's prompt keys. */
  promptKey: string;
  prompt: RunPrompt;
  /** A sample id (the sample library comes in #479); null runs the prompt as written. */
  sample: string | null;
  /** The model name; only the configured model (MODEL_NAME) for now. */
  model: string;
};

/**
 * A sample as the library (#479) will give it: values for a pipeline prompt's `{{variables}}`, and
 * for a runtime feature the gateway call's input, from which the gateway builds the prompt and its
 * checks. Invented text only in tests (AI-SAMPLES-LOCAL).
 */
export type LabSample = {
  id: string;
  values: Record<string, PromptValue>;
  calls?: Record<string, unknown>;
};

export type RunFeature = { slug: string; category: string; prompt_keys: string[] };

/** The row record_ai_run stores (who and when are set by the database). */
export type RunRecord = {
  feature_slug: string;
  prompt_key: string;
  prompt_source: "published" | "draft" | "pasted";
  prompt_version: number | null;
  pasted_text: string | null;
  sample_id: string | null;
  model: string;
  input: string;
  output: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  stub: boolean;
  status: "ok" | "error";
  error_reason: string | null;
  /** The steps of a multi-step run (FR-AILAB-8); empty for a one-call run. */
  steps: RunStepRecord[];
};

export type RunStepRecord = {
  position: number;
  label: string;
  prompt_key: string | null;
  prompt_version: number | null;
  input: string;
  output: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  status: "ok" | "error";
  error_reason: string | null;
};

export type RunDeps = {
  userId: string | null;
  role: ContentRole | null;
  /** The feature; undefined when there is none, null when it cannot be read. */
  readFeature: (slug: string) => Promise<RunFeature | null | undefined>;
  readPromptVersions: () => Promise<PromptVersionRow[] | null>;
  readSample: (id: string) => Promise<LabSample | null | undefined>;
  /** Null when the server has no model configured. */
  model: LabModel | null;
  prices: PriceTable;
  /** Records a run and gives its id (null when it failed); null when there is no run log. */
  record: ((run: RunRecord) => Promise<string | null>) | null;
  timeLimitMs?: number;
};

export type RunChecks =
  { applied: true; passed: boolean; failedRules: string[] } | { applied: false; note: string };

export type RunError =
  | "not-allowed"
  | "invalid"
  | "unknown-feature"
  | "unknown-prompt"
  | "unknown-sample"
  | "unknown-model"
  | "no-model"
  | "no-run-log"
  | "prompt-problem"
  | "failed";

export type RunResult =
  | {
      ok: true;
      runId: string | null;
      recorded: boolean;
      output: string;
      checks: RunChecks;
      inputTokens: number | null;
      outputTokens: number | null;
      cost: number | null;
      costNote: CostNote | null;
      stub: boolean;
      model: string;
      promptVersion: number | null;
    }
  | {
      ok: false;
      error: "model-error";
      reason: "request" | "timeout";
      runId: string | null;
      recorded: boolean;
      stub: boolean;
      model: string;
    }
  | { ok: false; error: RunError; problems?: string[] };

const SLUG = /^[a-z][a-z0-9_]*$/;

function validRequest(value: unknown): value is RunRequest {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.feature !== "string" || !SLUG.test(r.feature)) return false;
  if (typeof r.promptKey !== "string" || !SLUG.test(r.promptKey)) return false;
  if (typeof r.model !== "string" || r.model.trim() === "" || r.model.length > 200) return false;
  if (
    r.sample !== null &&
    (typeof r.sample !== "string" || r.sample.length < 1 || r.sample.length > 200)
  ) {
    return false;
  }
  const prompt = r.prompt as Record<string, unknown> | null;
  if (typeof prompt !== "object" || prompt === null) return false;
  if (prompt.source === "published") return true;
  if (prompt.source === "draft") {
    return (
      typeof prompt.version === "number" && Number.isInteger(prompt.version) && prompt.version >= 1
    );
  }
  if (prompt.source === "pasted") {
    return (
      typeof prompt.text === "string" &&
      prompt.text.trim() !== "" &&
      prompt.text.length <= PASTED_MAX_LENGTH
    );
  }
  return false;
}

function maxTokens(params: Record<string, unknown>): number {
  const value = params.max_tokens;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : LAB_MAX_TOKENS;
}

class LabTimeout extends Error {}

async function callWithin(model: LabModel, prompt: string, tokens: number, timeLimitMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Rejected first, so the race ends as a timeout even when the abort rejects the call.
      reject(new LabTimeout());
      controller.abort();
    }, timeLimitMs);
  });
  try {
    return await Promise.race([
      model.call({ prompt, signal: controller.signal, maxTokens: tokens }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Runs one prompt of a registry feature through the configured model and records the run. */
export async function runPrompt(request: RunRequest, deps: RunDeps): Promise<RunResult> {
  // AI-RUN-PERMISSION: admin and writer only, checked before anything else.
  if (!deps.userId || (deps.role !== "admin" && deps.role !== "writer")) {
    return { ok: false, error: "not-allowed" };
  }
  if (!validRequest(request)) return { ok: false, error: "invalid" };
  if (!deps.model) return { ok: false, error: "no-model" };
  if (request.model !== deps.model.name) return { ok: false, error: "unknown-model" };
  if (!deps.record) return { ok: false, error: "no-run-log" };

  const feature = await deps.readFeature(request.feature);
  if (feature === null) return { ok: false, error: "failed" };
  if (feature === undefined) return { ok: false, error: "unknown-feature" };
  if (!feature.prompt_keys.includes(request.promptKey)) {
    return { ok: false, error: "unknown-prompt" };
  }

  const rows = await deps.readPromptVersions();
  if (rows === null) return { ok: false, error: "failed" };
  const keyRows = rows.filter((row) => row.key === request.promptKey);
  const active = keyRows.find((row) => row.active) ?? null;
  let source: RunRecord["prompt_source"];
  let version: number | null;
  let body: string;
  let params: Record<string, unknown>;
  let pasted: string | null = null;
  if (request.prompt.source === "pasted") {
    source = "pasted";
    version = null;
    pasted = request.prompt.text.trim();
    body = pasted;
    params = active?.params ?? {};
  } else {
    const wanted = request.prompt.source === "draft" ? request.prompt.version : null;
    const row = wanted === null ? active : keyRows.find((item) => item.version === wanted);
    if (!row) return { ok: false, error: "unknown-prompt" };
    source = row.active ? "published" : "draft";
    version = row.version;
    body = row.body;
    params = row.params ?? {};
  }

  let sample: LabSample | null = null;
  if (request.sample !== null) {
    const found = await deps.readSample(request.sample);
    if (found === null) return { ok: false, error: "failed" };
    if (found === undefined) return { ok: false, error: "unknown-sample" };
    sample = found;
  }

  // The prompt as sent, and the checks that apply (the gateway's own, for a runtime feature).
  let input = body;
  let check: ((raw: string) => { passed: boolean; failedRules: string[] }) | null = null;
  let note: string;
  const runtime = feature.category === "runtime" && isLabCallKey(request.promptKey);
  const callInput = sample?.calls?.[request.promptKey];
  if (runtime && callInput !== undefined) {
    const row = { key: request.promptKey, version: version ?? 0, body, params } as PromptRow;
    const built = buildLabCall(
      request.promptKey as Parameters<typeof buildLabCall>[0],
      row,
      callInput,
    );
    if (!built.ok) return { ok: false, error: "prompt-problem", problems: built.problems };
    input = built.prompt;
    check = built.check;
    note = "";
  } else {
    if (sample) {
      try {
        input = renderPrompt(body, sample.values);
      } catch {
        return {
          ok: false,
          error: "prompt-problem",
          problems: ["The sample has no value for a {{variable}} of the prompt."],
        };
      }
    }
    note = runtime ? "The checks need a sample." : `No checks for a ${feature.category} feature.`;
  }

  const model = deps.model;
  const base = {
    feature_slug: feature.slug,
    prompt_key: request.promptKey,
    prompt_source: source,
    prompt_version: version,
    pasted_text: pasted,
    sample_id: sample?.id ?? null,
    model: model.name,
    input,
    stub: model.stub,
    steps: [],
  };

  let answer: Awaited<ReturnType<LabModel["call"]>>;
  try {
    answer = await callWithin(
      model,
      input,
      maxTokens(params),
      deps.timeLimitMs ?? LAB_TIME_LIMIT_MS,
    );
  } catch (error) {
    // Only a fixed reason is kept: never the provider's message, which could quote a setting.
    const reason = error instanceof LabTimeout ? "timeout" : "request";
    const runId = await deps.record({
      ...base,
      output: null,
      input_tokens: null,
      output_tokens: null,
      cost: null,
      status: "error",
      error_reason: reason,
    });
    return {
      ok: false,
      error: "model-error",
      reason,
      runId,
      recorded: runId !== null,
      stub: model.stub,
      model: model.name,
    };
  }

  const { cost, note: costNote } = runCost(model.name, answer, deps.prices);
  const runId = await deps.record({
    ...base,
    output: answer.text,
    input_tokens: answer.inputTokens,
    output_tokens: answer.outputTokens,
    cost,
    status: "ok",
    error_reason: null,
  });
  return {
    ok: true,
    runId,
    recorded: runId !== null,
    output: answer.text,
    checks: check ? { applied: true, ...check(answer.text) } : { applied: false, note },
    inputTokens: answer.inputTokens,
    outputTokens: answer.outputTokens,
    cost,
    costNote,
    stub: model.stub,
    model: model.name,
    promptVersion: version,
  };
}
