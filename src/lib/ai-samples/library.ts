// #479 (AI-LAB-SAMPLES, AI-SOURCE-EXCERPTS; docs/api/ai-samples.md): the sample library as the
// Samples page (/admin/ai-samples) reads it, through the signed-in user's own client. Row level
// security lets only content editors (admin or writer) read public.ai_samples and
// public.ai_source_excerpts (20261205000000_ai_samples.sql); any other account reads no row.

export type SamplePlan = {
  goal?: unknown;
  aims?: unknown;
};

/** A row of public.ai_samples. */
export type SampleRow = {
  id: string;
  position: number;
  name: string;
  companion: string | null;
  mode: "historical" | "fictional" | null;
  persona: string;
  source_excerpt_id: string | null;
  background: string;
  facts: unknown;
  world_record: string;
  standing_task: string;
  plan: SamplePlan | null;
};

/** A row of public.ai_source_excerpts. */
export type ExcerptRow = { id: string; source_label: string; body: string };

export type PlanAim = { title: string; note: string };

/** One sample of the library, with its excerpt and the source named. */
export type LibrarySample = {
  id: string;
  name: string;
  companion: string | null;
  persona: string;
  /** The source named on the excerpt row; null when the sample has no excerpt. */
  source: string | null;
  excerpt: string | null;
  /** Words of the source excerpt; null when there is none. */
  words: number | null;
  background: string;
  facts: string[];
  worldRecord: string;
  standingTask: string;
  plan: { goal: string; aims: PlanAim[] } | null;
};

type Read = (
  table: "ai_samples" | "ai_source_excerpts",
  order: string,
) => Promise<{ data: unknown; error: unknown }>;

/** Words in a text: runs of characters between white space. */
export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/u);
  return words[0] === "" ? 0 : words.length;
}

const asText = (value: unknown) => (typeof value === "string" ? value : "");

function planOf(plan: SamplePlan | null): LibrarySample["plan"] {
  if (!plan || typeof plan !== "object") return null;
  const aims = Array.isArray(plan.aims)
    ? plan.aims
        .filter((aim): aim is Record<string, unknown> => !!aim && typeof aim === "object")
        .map((aim) => ({ title: asText(aim.title), note: asText(aim.note) }))
    : [];
  const goal = asText(plan.goal);
  return goal || aims.length > 0 ? { goal, aims } : null;
}

/** The library from its rows, in position order (then id), each sample with its excerpt. */
export function librarySamples(samples: SampleRow[], excerpts: ExcerptRow[]): LibrarySample[] {
  const byId = new Map(excerpts.map((excerpt) => [excerpt.id, excerpt]));
  return [...samples]
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((row) => {
      const excerpt = row.source_excerpt_id ? byId.get(row.source_excerpt_id) : undefined;
      return {
        id: row.id,
        name: row.name,
        companion: row.companion,
        persona: row.persona,
        source: excerpt ? excerpt.source_label : null,
        excerpt: excerpt ? excerpt.body : null,
        words: excerpt ? wordCount(excerpt.body) : null,
        background: row.background,
        facts: Array.isArray(row.facts)
          ? row.facts.filter((fact): fact is string => typeof fact === "string")
          : [],
        worldRecord: row.world_record,
        standingTask: row.standing_task,
        plan: planOf(row.plan),
      };
    });
}

/** The whole library, or null when either table cannot be read. */
export async function readSampleLibrary(read: Read): Promise<LibrarySample[] | null> {
  try {
    const [samples, excerpts] = await Promise.all([
      read("ai_samples", "position"),
      read("ai_source_excerpts", "id"),
    ]);
    if (samples.error || excerpts.error) return null;
    if (!Array.isArray(samples.data) || !Array.isArray(excerpts.data)) return null;
    return librarySamples(samples.data as SampleRow[], excerpts.data as ExcerptRow[]);
  } catch {
    return null;
  }
}

/** The sample the page shows: the one named in ?sample=, otherwise the first. */
export function chosenSample(
  samples: LibrarySample[],
  id: string | string[] | undefined,
): LibrarySample | null {
  const wanted = typeof id === "string" ? id : undefined;
  return samples.find((sample) => sample.id === wanted) ?? samples[0] ?? null;
}
