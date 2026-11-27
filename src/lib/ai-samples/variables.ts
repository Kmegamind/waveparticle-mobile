import { placeholderNames, type PromptValue } from "@/lib/prompts/template";
import { librarySamples, type ExcerptRow, type LibrarySample, type SampleRow } from "./library";

// #477 (AI-LAB-SAMPLES; docs/decisions/0037): how a sample of the library (#479) fills a prompt's
// {{variables}} in the prompt lab's Run. One fixed table, the same for every prompt: each sample
// field fills the variable names listed here. The names are the ones the owner's pipeline prompts
// use (story-pipeline/prompt-table-source/en: persona, story_source, background, world_record,
// plan, mode, character_name) and the runtime prompts' {{name}} and {{facts}}, plus the drawing's
// {{source_excerpt}}. A field the sample leaves empty fills its variables with nothing, so the
// template drops each line that has only those variables (src/lib/prompts/template.ts). A
// {{variable}} that is not in this table is not filled from a sample at all: the Run stops before
// the model is called and names it (sampleProblem). No module here reads the database or the
// environment, so the Run panel in the browser uses the same table.

/** Each sample field and the {{variables}} it fills. */
export const SAMPLE_VARIABLES = [
  { field: "Companion", variables: ["name", "character_name"] },
  { field: "Mode", variables: ["mode"] },
  { field: "Persona", variables: ["persona"] },
  { field: "Source excerpt", variables: ["source_excerpt", "story_source"] },
  { field: "Source named", variables: ["source_label"] },
  { field: "Background", variables: ["background"] },
  { field: "Facts", variables: ["facts"] },
  { field: "World record", variables: ["world_record"] },
  { field: "Standing task", variables: ["standing_task"] },
  { field: "Finished plan", variables: ["plan"] },
  { field: "Finished plan's goal", variables: ["goal"] },
] as const;

/** Every variable name a sample fills, in the table's order. */
export const SAMPLE_VARIABLE_NAMES: readonly string[] = SAMPLE_VARIABLES.flatMap(
  (row) => row.variables,
);

const text = (value: string | null | undefined): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

/** The facts, one per line, each starting with "- ". */
export function factsText(facts: string[]): string | null {
  const lines = facts.map((fact) => fact.trim()).filter((fact) => fact !== "");
  return lines.length === 0 ? null : lines.map((fact) => `- ${fact}`).join("\n");
}

/** The finished plan as text: "Goal: ..." then "1. Title: note" per aim. */
export function planText(plan: LibrarySample["plan"]): string | null {
  if (!plan) return null;
  const lines: string[] = [];
  if (plan.goal.trim()) lines.push(`Goal: ${plan.goal.trim()}`);
  plan.aims.forEach((aim, index) => {
    const title = aim.title.trim();
    const note = aim.note.trim();
    if (!title && !note) return;
    lines.push(`${index + 1}. ${title}${title && note ? ": " : ""}${note}`);
  });
  return lines.length === 0 ? null : lines.join("\n");
}

/** The values a sample gives the template: every name of SAMPLE_VARIABLE_NAMES, null when empty. */
export function sampleValues(sample: LibrarySample): Record<string, PromptValue> {
  const companion = text(sample.companion);
  const excerpt = text(sample.excerpt);
  return {
    name: companion,
    character_name: companion,
    mode: sample.mode,
    persona: text(sample.persona),
    source_excerpt: excerpt,
    story_source: excerpt,
    source_label: excerpt === null ? null : text(sample.source),
    background: text(sample.background),
    facts: factsText(sample.facts),
    world_record: text(sample.worldRecord),
    standing_task: text(sample.standingTask),
    plan: planText(sample.plan),
    goal: text(sample.plan?.goal),
  };
}

/**
 * The prompt's {{variables}} that no sample fills (not in SAMPLE_VARIABLES), each once, in order of
 * first use. With a sample, the Run is refused while this is not empty.
 */
export function unfilledVariables(names: readonly string[]): string[] {
  return [...new Set(names)].filter((name) => !SAMPLE_VARIABLE_NAMES.includes(name));
}

/** The {{variables}} of a prompt text, each once, in order (for the Run panel in the browser). */
export function promptVariables(text: string): string[] {
  return placeholderNames(text);
}

/** The problem the Run answers for those variables, naming each one. */
export function sampleProblem(missing: string[]): string {
  const list = missing.map((name) => `{{${name}}}`).join(", ");
  return `A sample has no value for ${list}. Choose "No sample" to send the prompt as written.`;
}

type Answer = { data: unknown; error: unknown };
/** Reads the rows of `table` whose `column` equals `value`. */
export type RowRead = (
  table: "ai_samples" | "ai_source_excerpts",
  column: string,
  value: string,
) => Promise<Answer>;

/**
 * One sample by id with its excerpt, as the Run route needs it: the sample, undefined when there is
 * none (or the account may not read it), null when it cannot be read.
 */
export async function readLabSample(
  read: RowRead,
  id: string,
): Promise<{ id: string; values: Record<string, PromptValue> } | null | undefined> {
  try {
    const samples = await read("ai_samples", "id", id);
    if (samples.error || !Array.isArray(samples.data)) return null;
    const row = samples.data[0] as SampleRow | undefined;
    if (!row) return undefined;
    let excerpts: ExcerptRow[] = [];
    if (row.source_excerpt_id) {
      const found = await read("ai_source_excerpts", "id", row.source_excerpt_id);
      if (found.error || !Array.isArray(found.data)) return null;
      excerpts = found.data as ExcerptRow[];
    }
    const [sample] = librarySamples([row], excerpts);
    return { id: sample.id, values: sampleValues(sample) };
  } catch {
    return null;
  }
}
