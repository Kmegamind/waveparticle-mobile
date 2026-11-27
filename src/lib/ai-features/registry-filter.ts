// #474 (FR-AIREG-1): the registry table's filters, search and ID sort, and the words it shows. No
// import of server code: the table's filters run in the browser (src/app/admin/ai-features/
// registry-table.tsx). The rows themselves are made on the server (registry.ts).

export type RegistryCategory = "pipeline" | "gate" | "runtime";
export type ExampleState = "none" | "candidate" | "confirmed";
export type RegistryStatus = "not_started" | "exploring" | "passed" | "frozen";

/** The category words of the seed and the PRD (Pipeline, Quality gate, Runtime). */
export const CATEGORY_LABEL: Record<RegistryCategory, string> = {
  pipeline: "Pipeline",
  gate: "Quality gate",
  runtime: "Runtime",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as RegistryCategory[];

/** The example states of AI-EXAMPLE-CONFIRM, as the drawing's pills. */
export const EXAMPLE_STATE_LABEL: Record<ExampleState, string> = {
  none: "None",
  candidate: "Candidate",
  confirmed: "Confirmed",
};

export const EXAMPLE_STATES = Object.keys(EXAMPLE_STATE_LABEL) as ExampleState[];

/** FR-AIREG-4: what an empty field shows. */
export const NOT_WRITTEN_YET = "Not written yet";

const LETTERS = ["P", "G", "R"];

/**
 * The ID order of the seed: P (Pipeline), G (Quality gate), R (Runtime), each by number. An id the
 * registry does not know goes last, in text order.
 */
export function compareFeatureIds(left: string, right: string): number {
  const rank = (id: string) => {
    const letter = LETTERS.indexOf(id.charAt(0));
    return letter === -1 ? LETTERS.length : letter;
  };
  const byLetter = rank(left) - rank(right);
  if (byLetter !== 0) return byLetter;
  return left.localeCompare(right, "en", { numeric: true });
}

/** A Feature ID such as "R-03" (the URL may name a row by it instead of its slug). */
export const isFeatureId = (value: string) => /^[PGR]-\d{2}$/.test(value);

/** The prompt column: each key with its published version and its newest draft, if any. */
export type RegistryPrompt = { key: string; published: number | null; draft: number | null };

export type RegistryRow = {
  slug: string;
  featureId: string;
  name: string;
  category: RegistryCategory;
  where: string;
  requirement: string;
  prompts: RegistryPrompt[];
  status: RegistryStatus;
  exampleState: ExampleState;
  /** Every word the row shows, in lower case, for the search box. */
  search: string;
};

export type RegistryFilter = {
  /** "" for every category. */
  category: RegistryCategory | "";
  /** "" for every status. */
  status: RegistryStatus | "";
  /** Words to find in the ID, the name or any text of the row. */
  query: string;
  /** Sort by ID from the last to the first. */
  descending: boolean;
};

export const NO_FILTER: RegistryFilter = { category: "", status: "", query: "", descending: false };

/** FR-AIREG-1: the rows of one category and one status that hold the words, sorted by ID. */
export function filterRegistry(rows: RegistryRow[], filter: RegistryFilter): RegistryRow[] {
  const query = filter.query.trim().toLowerCase();
  const found = rows.filter(
    (row) =>
      (!filter.category || row.category === filter.category) &&
      (!filter.status || row.status === filter.status) &&
      (!query || row.search.includes(query)),
  );
  const sorted = [...found].sort((left, right) =>
    compareFeatureIds(left.featureId, right.featureId),
  );
  return filter.descending ? sorted.reverse() : sorted;
}

/** A prompt text in parts: `{{variables}}` apart, to be highlighted (FR-AIREG-2). */
export type PromptPart = { text: string; variable: boolean };

const VARIABLE = /(\{\{\s*[\w.]+\s*\}\})/;

export function promptParts(text: string): PromptPart[] {
  return text
    .split(VARIABLE)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, variable: VARIABLE.test(part) }));
}
