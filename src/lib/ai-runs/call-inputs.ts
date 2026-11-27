import { emptyProblems } from "@/lib/ai-samples/variables";
import type { PromptValue } from "@/lib/prompts/template";

// #517 AC4: a runtime prompt in the comparison lab, on a library sample. The gateway builds a
// runtime prompt from the call's input, not from {{variables}}; the library's samples hold the
// Companion and the facts but not the rest of a call's input (the person's message, the draft, the
// Pause number ...). The lab asks for those "call inputs" beside the sample, the same for both
// sides, and the Run route builds the call's input from the two, so the version runs with the
// gateway's own prompt and checks. No module here reads the database or the environment, so the
// lab in the browser uses the same table. The owner types these inputs; they are invented test
// text, never a user's message.

export type CallInputKind = "text" | "count" | "trigger";

export type CallInputField = {
  /** The name of the field in the gateway call's input (src/lib/model-gateway/types.ts). */
  name: string;
  /** What the lab's field is called. */
  label: string;
  kind: CallInputKind;
};

const PERSON_WROTE: CallInputField = {
  name: "userMessage",
  label: "The person wrote",
  kind: "text",
};
const PAUSE_NUMBER: CallInputField = { name: "pauseNumber", label: "Pause number", kind: "count" };

/** The call inputs of each of the six keys the lab compares (#517), beside the sample's. */
export const LAB_CALL_INPUTS: Record<string, CallInputField[]> = {
  rest_reply: [PERSON_WROTE],
  rest_reply_review: [
    PERSON_WROTE,
    { name: "draft", label: "Draft (call one's reply)", kind: "text" },
  ],
  stuck_story: [PAUSE_NUMBER],
  pause_predicament: [
    PAUSE_NUMBER,
    { name: "story", label: "Stuck story (call one)", kind: "text" },
  ],
  return_popup: [
    { name: "trigger", label: "Back from (rest or absence)", kind: "trigger" },
    { name: "awayMinutes", label: "Minutes away", kind: "count" },
  ],
  closing_line: [{ name: "lastMoment", label: "The last moment", kind: "text" }],
};

/** The longest call input the Run route takes. */
export const CALL_INPUT_MAX_LENGTH = 2_000;

/** The call input names of a key; empty for a key the lab builds from {{variables}} only. */
export function callInputNames(key: string): string[] {
  return (Object.hasOwn(LAB_CALL_INPUTS, key) ? LAB_CALL_INPUTS[key] : []).map(
    (field) => field.name,
  );
}

const filled = (value: PromptValue): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

/**
 * The gateway call's input from a sample's values (the Companion and the facts) and the lab's call
 * inputs, or every problem, named: an empty sample field (as the existing empty-variable refusal,
 * docs/decisions/0037) or a call input that is empty or not of its kind.
 */
export function callInputFrom(
  key: string,
  values: Record<string, PromptValue>,
  inputs: Record<string, string>,
): { ok: true; input: Record<string, unknown> } | { ok: false; problems: string[] } {
  const companionName = filled(values.name);
  const facts = filled(values.facts);
  const problems = emptyProblems(
    [companionName === null ? "name" : null, facts === null ? "facts" : null].filter(
      (name): name is string => name !== null,
    ),
  );
  const input: Record<string, unknown> = { companionName, facts };
  for (const field of Object.hasOwn(LAB_CALL_INPUTS, key) ? LAB_CALL_INPUTS[key] : []) {
    const raw = typeof inputs[field.name] === "string" ? inputs[field.name].trim() : "";
    const named = `${field.label} ({{${field.name}}})`;
    if (raw === "") {
      problems.push(`Write the call input ${named}.`);
    } else if (field.kind === "count") {
      const minimum = field.name === "pauseNumber" ? 1 : 0;
      const value = /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
      if (Number.isInteger(value) && value >= minimum) input[field.name] = value;
      else problems.push(`The call input ${named} must be a whole number of at least ${minimum}.`);
    } else if (field.kind === "trigger") {
      if (raw === "rest" || raw === "absence") input[field.name] = raw;
      else problems.push(`The call input ${named} must be rest or absence.`);
    } else {
      input[field.name] = raw;
    }
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, input };
}
