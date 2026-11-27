"use server";

import { readContentRole } from "@/lib/admin/roles";
import {
  saveComparison,
  type ComparisonResult,
  type ComparisonWrite,
} from "@/lib/ai-runs/comparison";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// #478 (FR-AILAB-5): "Save result" of the comparison lab. The account and its role are checked
// here before anything is written, and again by public.save_ai_comparison, which also checks the
// two runs and copies the pass questions from the feature row.

/** Saves the yes or no answers of both sides with the two runs. Admin or writer. */
export async function saveComparisonAction(write: ComparisonWrite): Promise<ComparisonResult> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  return saveComparison(write, {
    userId: user?.id ?? null,
    role,
    rpc: async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    },
  });
}
