"use server";

import { revalidatePath } from "next/cache";
import { readContentRole } from "@/lib/admin/roles";
import type { FeatureWriteResult } from "@/lib/ai-features/edit";
import type { RegistryFeature } from "@/lib/ai-features/registry";
import { setExampleFromRun, type RunExampleWrite } from "@/lib/ai-runs/example";
import type { RunLogRow } from "@/lib/ai-runs/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { readFeature } from "../ai-features/load";

// #477 (FR-AILAB-6, AI-EXAMPLE-CONFIRM): "Set as candidate example" and "Confirm" of the Run
// panel. The account and its role are checked here before anything is written, and again by
// public.set_ai_feature_example; the text is the run's output, read from the run log by id.

/** Sets a run's output as the feature's example, candidate or confirmed. Any role. */
export async function setRunExampleAction(write: RunExampleWrite): Promise<FeatureWriteResult> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  const result = await setExampleFromRun(write, {
    userId: user?.id ?? null,
    role,
    readFeature: async (slug) =>
      (await readFeature(client, slug)) as RegistryFeature | null | undefined,
    readRun: async (id) => {
      try {
        const { data, error } = await client
          .from("ai_runs")
          .select("id,feature_slug,status,output")
          .eq("id", id)
          .limit(1);
        if (error || !Array.isArray(data)) return null;
        return (
          (data[0] as Pick<RunLogRow, "id" | "feature_slug" | "status" | "output">) ?? undefined
        );
      } catch {
        return null;
      }
    },
    rpc: async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    },
  });
  if (result.ok) revalidatePath("/admin/ai-features", "layout");
  return result;
}
