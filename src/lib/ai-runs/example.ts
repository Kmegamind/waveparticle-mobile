import type { FeatureDeps, FeatureWriteResult } from "@/lib/ai-features/edit";
import type { RegistryFeature } from "@/lib/ai-features/registry";
import { setFeatureExample } from "@/lib/ai-features/registry-edit";
import type { RunLogRow } from "./log";

// #477 (FR-AILAB-6, AI-EXAMPLE-CONFIRM): "Set as candidate example" and "Confirm" in the Run
// panel. The text is the run's own output, read again on the server from the run log by the run's
// id, never sent by the browser. The write is #475's setFeatureExample (src/lib/ai-features/
// registry-edit.ts), so every rule of the example editor holds: any role, the 8000 character
// limit, the "changed since" check, and public.set_ai_feature_example keeps who, when and the
// history. "Set as candidate example" stores the output as candidate; "Confirm" stores it as
// confirmed (one action, AI-EXAMPLE-CONFIRM), whether or not it was the candidate first.

export type RunExampleWrite = {
  slug: string;
  runId: string;
  state: "candidate" | "confirmed";
  /** example_set_at as the panel last saw it; a newer change by someone else refuses this one. */
  loadedAt: string | null;
};

export type RunExampleDeps = Omit<FeatureDeps, "readFeature"> & {
  readFeature: (slug: string) => Promise<RegistryFeature | null | undefined>;
  /** The run by id; undefined when there is none, null when it cannot be read. */
  readRun: (
    id: string,
  ) => Promise<Pick<RunLogRow, "id" | "feature_slug" | "status" | "output"> | null | undefined>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sets the run's output as the feature's example; answers the new example_set_at. */
export async function setExampleFromRun(
  write: RunExampleWrite,
  deps: RunExampleDeps,
): Promise<FeatureWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  if (
    typeof write?.runId !== "string" ||
    !UUID.test(write.runId) ||
    (write.state !== "candidate" && write.state !== "confirmed")
  ) {
    return { ok: false, error: "invalid" };
  }
  const run = await deps.readRun(write.runId);
  if (run === null) return { ok: false, error: "failed" };
  if (
    run === undefined ||
    run.feature_slug !== write.slug ||
    run.status !== "ok" ||
    typeof run.output !== "string"
  ) {
    return { ok: false, error: "invalid" };
  }
  const result = await setFeatureExample(
    { slug: write.slug, loadedAt: write.loadedAt, text: run.output, state: write.state },
    deps,
  );
  if (!result.ok) return result;
  const feature = await deps.readFeature(write.slug);
  return { ok: true, savedAt: feature?.example_set_at ?? null };
}
