import type { ContentRole } from "@/lib/admin/roles";
import type { RunRequest } from "./run";

// #478 (FR-AILAB-4, FR-AILAB-5; AI-LAB-SAMPLES, AI-REGISTRY-FIELDS, AI-LAB-STUB): the comparison
// lab (/admin/ai-lab, drawing #reg-lab, AIR-4). One sample through two sides, each a prompt
// version or a model; each side is one ordinary Run of the Run route (POST /admin/ai-runs/run,
// #476), so each is checked, recorded and priced as any Run. Blind shows the two answers in a
// random order without their names until every pass question of both sides is answered. The yes
// or no answers are saved with both runs through public.save_ai_comparison
// (20261206000000_ai_comparisons.sql). The browser uses the pure parts; saveComparison is server
// code behind the lab's server action.

/** One prompt key of the feature as the lab page gives it: its versions and their {{variables}}. */
export type LabPrompt = {
  key: string;
  published: { version: number; variables: string[] } | null;
  draft: { version: number; variables: string[] } | null;
  /**
   * #517: every stored version of the key (public.prompts), active or not, newest first, so a side
   * can run any of them. Only the number and the {{variables}} reach the browser.
   */
  stored?: { version: number; active: boolean; variables: string[] }[];
  /** #517: the call inputs a runtime key needs beside a sample (src/lib/ai-runs/call-inputs.ts). */
  callInputs?: string[];
};

/** A model the lab offers: only its name and whether it is the stub, never its key. */
export type LabModelName = { name: string; stub: boolean };

/**
 * "published", "draft", "version:<n>" (each on the first model; #517: any stored version) or
 * "model:<name>" (the published version on it).
 */
export type SideChoice = string;

export type SideOption = { value: SideChoice; label: string };

const MODEL_PREFIX = "model:";
const VERSION_PREFIX = "version:";

/** The stored version a "version:<n>" choice names, or null. */
function storedOf(prompt: LabPrompt, choice: SideChoice) {
  if (!choice.startsWith(VERSION_PREFIX)) return null;
  const wanted = choice.slice(VERSION_PREFIX.length);
  if (!/^[1-9][0-9]*$/.test(wanted)) return null;
  return (prompt.stored ?? []).find((item) => item.version === Number(wanted)) ?? null;
}

/** What one side may be: the key's versions, then each configured model. */
export function sideOptions(prompt: LabPrompt, models: LabModelName[]): SideOption[] {
  const options: SideOption[] = [];
  if (prompt.published) {
    options.push({ value: "published", label: `Published version (v${prompt.published.version})` });
  }
  if (prompt.draft) {
    options.push({ value: "draft", label: `Draft version (v${prompt.draft.version})` });
  }
  // #517: every other stored version (an earlier one, or a draft below the published version).
  const listed = [prompt.published?.version, prompt.draft?.version];
  for (const item of [...(prompt.stored ?? [])].sort((l, r) => r.version - l.version)) {
    if (listed.includes(item.version)) continue;
    options.push({
      value: `${VERSION_PREFIX}${item.version}`,
      label: `Stored version (v${item.version})`,
    });
  }
  const runs = prompt.published ? "published version" : "draft version";
  for (const model of models) {
    options.push({
      value: `${MODEL_PREFIX}${model.name}`,
      label: model.stub ? `Stub model: ${model.name} (${runs})` : `${model.name} (${runs})`,
    });
  }
  return options;
}

/** Side A the published version; side B the draft, else a second model, else the same as A. */
export function defaultSides(
  prompt: LabPrompt,
  models: LabModelName[],
): { a: SideChoice; b: SideChoice } {
  const a = prompt.published ? "published" : prompt.draft ? "draft" : "";
  const b =
    prompt.published && prompt.draft
      ? "draft"
      : models.length > 1
        ? `${MODEL_PREFIX}${models[1].name}`
        : a;
  return { a, b };
}

/** The Run route's request for one side, or null when the choice is not offered any more. */
export function sideRequest({
  feature,
  prompt,
  choice,
  sample,
  models,
  inputs,
}: {
  feature: string;
  prompt: LabPrompt;
  choice: SideChoice;
  sample: string | null;
  models: LabModelName[];
  /** #517: the call inputs beside the sample, the same for both sides. */
  inputs?: Record<string, string>;
}): RunRequest | null {
  const first = models[0];
  if (!first) return null;
  let model = first.name;
  let source: "published" | "draft";
  const stored = storedOf(prompt, choice);
  if (choice.startsWith(VERSION_PREFIX)) {
    if (!stored) return null;
    // The Run route runs any stored version by its number (source "draft" in the request).
    return {
      feature,
      promptKey: prompt.key,
      prompt: { source: "draft", version: stored.version },
      sample,
      model,
      ...(inputs ? { inputs } : {}),
    };
  }
  if (choice.startsWith(MODEL_PREFIX)) {
    const named = models.find((item) => `${MODEL_PREFIX}${item.name}` === choice);
    if (!named) return null;
    model = named.name;
    source = prompt.published ? "published" : "draft";
  } else if (choice === "published" || choice === "draft") {
    source = choice;
  } else {
    return null;
  }
  if (source === "published" && !prompt.published) return null;
  if (source === "draft" && !prompt.draft) return null;
  return {
    feature,
    promptKey: prompt.key,
    prompt:
      source === "draft"
        ? { source: "draft", version: prompt.draft!.version }
        : { source: "published" },
    sample,
    model,
    ...(inputs ? { inputs } : {}),
  };
}

/** The {{variables}} of the version a side runs. */
export function sideVariables(prompt: LabPrompt, choice: SideChoice): string[] {
  if (choice.startsWith(VERSION_PREFIX)) return storedOf(prompt, choice)?.variables ?? [];
  const draft = choice === "draft" || (choice.startsWith(MODEL_PREFIX) && !prompt.published);
  return (draft ? prompt.draft?.variables : prompt.published?.variables) ?? [];
}

/**
 * Which side shows on the left and which on the right. Blind: a coin decides, so the left panel
 * is not always side A; not blind: A on the left.
 */
export function sideOrder(
  blind: boolean,
  coin: () => number = Math.random,
): ["a", "b"] | ["b", "a"] {
  return blind && coin() >= 0.5 ? ["b", "a"] : ["a", "b"];
}

/** Yes, no, or not answered yet. */
export type PassAnswer = boolean | null;

/** Every one of `count` questions answered yes or no (at least one question). */
export function answersComplete(answers: PassAnswer[], count: number): boolean {
  return (
    count > 0 && answers.length === count && answers.every((item) => typeof item === "boolean")
  );
}

/** Blind and not every pass question of both sides answered yet: the names stay hidden. */
export function hiddenNow(blind: boolean, answersA: PassAnswer[], answersB: PassAnswer[]): boolean {
  if (!blind) return false;
  return !(
    answersComplete(answersA, answersA.length) && answersComplete(answersB, answersB.length)
  );
}

/** A side of the lab: "a" or "b", whichever panel shows it. */
export type LabSide = "a" | "b";

/**
 * #478 fix round 1: the part of the lab's state that decides what is saved. Answers are kept by
 * side ("a", "b"), never by panel position, so Blind's shuffle cannot swap them. `peeked` is true
 * when Blind was unticked before every question was answered.
 */
export type AnswerState = {
  blind: boolean;
  peeked: boolean;
  order: [LabSide, LabSide];
  a: { runId: string | null; answers: PassAnswer[] };
  b: { runId: string | null; answers: PassAnswer[] };
};

/**
 * A blind comparison whose names are shown (every question of both sides answered, Blind kept
 * on): its answers can no longer change, so a row saved with blind = true holds only answers
 * given while the sides were hidden.
 */
export function answersLocked(state: AnswerState): boolean {
  const count = state.a.answers.length;
  return (
    state.blind &&
    !state.peeked &&
    answersComplete(state.a.answers, count) &&
    answersComplete(state.b.answers, count)
  );
}

/** One answer of one side; unchanged (the same object) when the answers are locked. */
export function setAnswer<T extends AnswerState>(
  state: T,
  side: LabSide,
  index: number,
  value: boolean,
): T {
  if (answersLocked(state)) return state;
  const answers = state[side].answers.map((item, i) => (i === index ? value : item));
  return { ...state, [side]: { ...state[side], answers } };
}

/**
 * A side's new reply (after Run both or Retry): that side gets the run id and fresh answers; the
 * other side keeps the answers given meanwhile.
 */
export function withSideReply<T extends AnswerState>(
  state: T,
  side: LabSide,
  runId: string | null,
): T {
  return {
    ...state,
    [side]: { ...state[side], runId, answers: state[side].answers.map(() => null) },
  };
}

/** What Save result sends: side A's answers with run A, side B's with run B; null until ready. */
export function comparisonWrite(state: AnswerState): ComparisonWrite | null {
  const { a, b } = state;
  const count = a.answers.length;
  if (!a.runId || !b.runId) return null;
  if (!answersComplete(a.answers, count) || !answersComplete(b.answers, count)) return null;
  return {
    runA: a.runId,
    runB: b.runId,
    blind: state.blind && !state.peeked,
    answersA: a.answers as boolean[],
    answersB: b.answers as boolean[],
  };
}

/**
 * The model line of a side's answer: "shown" when the names are shown; while hidden, "stub" when
 * both sides are the stub (the marker tells nothing apart), else "hidden" (one neutral line), so
 * the marker cannot say which side is which.
 */
export function hiddenModelLabel(
  hidden: boolean,
  stubA: boolean,
  stubB: boolean,
): "shown" | "stub" | "hidden" {
  if (!hidden) return "shown";
  return stubA && stubB ? "stub" : "hidden";
}

/** What the lab saves: the two runs, whether the sides were hidden, and the answers of each. */
export type ComparisonWrite = {
  runA: string;
  runB: string;
  blind: boolean;
  answersA: boolean[];
  answersB: boolean[];
};

export type ComparisonError =
  "not-allowed" | "invalid" | "unknown-run" | "already-saved" | "failed";

export type ComparisonResult = { ok: true; id: string } | { ok: false; error: ComparisonError };

export const LAB_SAVE_PROBLEMS: Record<ComparisonError, string> = {
  "not-allowed": "Your account cannot save a comparison.",
  invalid:
    "The answers could not be saved: both runs must be yours, have an answer, and every pass question needs yes or no.",
  "unknown-run": "One of the two runs is not in the run log. Run both again.",
  "already-saved": "These runs already have saved answers. Run both again for a new comparison.",
  failed: "Could not save the answers. Please try again.",
};

type Answer = { data: unknown; error: unknown };

export type ComparisonDeps = {
  userId: string | null;
  role: ContentRole | null;
  rpc: (name: string, args: Record<string, unknown>) => Promise<Answer>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const yesNo = (list: unknown): list is boolean[] =>
  Array.isArray(list) &&
  list.length > 0 &&
  list.length <= 50 &&
  list.every((item) => typeof item === "boolean");

function validWrite(write: ComparisonWrite): boolean {
  return (
    typeof write === "object" &&
    write !== null &&
    typeof write.runA === "string" &&
    typeof write.runB === "string" &&
    UUID.test(write.runA) &&
    UUID.test(write.runB) &&
    write.runA.toLowerCase() !== write.runB.toLowerCase() &&
    typeof write.blind === "boolean" &&
    yesNo(write.answersA) &&
    yesNo(write.answersB) &&
    write.answersA.length === write.answersB.length
  );
}

const CODES: Record<string, ComparisonError> = {
  "42501": "not-allowed",
  P0002: "unknown-run",
  "23505": "already-saved",
  "22023": "invalid",
};

/**
 * Saves the pass answers with the two runs. Admin and writer only, checked here and again by the
 * database, which also checks that both runs are the account's own, ended ok, of one feature and
 * one sample, and that there is one answer for each of the feature's pass questions.
 */
export async function saveComparison(
  write: ComparisonWrite,
  deps: ComparisonDeps,
): Promise<ComparisonResult> {
  if (!deps.userId || (deps.role !== "admin" && deps.role !== "writer")) {
    return { ok: false, error: "not-allowed" };
  }
  if (!validWrite(write)) return { ok: false, error: "invalid" };
  try {
    const { data, error } = await deps.rpc("save_ai_comparison", {
      comparison: {
        run_a: write.runA,
        run_b: write.runB,
        blind: write.blind,
        answers_a: write.answersA,
        answers_b: write.answersB,
      },
    });
    if (error) {
      const code = (error as { code?: unknown }).code;
      return { ok: false, error: CODES[typeof code === "string" ? code : ""] ?? "failed" };
    }
    if (typeof data !== "string") return { ok: false, error: "failed" };
    return { ok: true, id: data };
  } catch {
    return { ok: false, error: "failed" };
  }
}
