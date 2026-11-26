import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiFeatureRow } from "@/lib/ai-features/admin";
import { readFeaturePeople, type People, type StatusHistoryRow } from "@/lib/ai-features/edit";

// #453: what the feature page and its editors read about one feature, through the signed-in
// user's own client: its row, its status history and who made each change (by email, through
// public.list_ai_feature_people, 20261201000000).

/** The feature as stored now; undefined when there is none, null when it cannot be read. */
export async function readFeature(
  client: SupabaseClient,
  slug: string,
): Promise<AiFeatureRow | null | undefined> {
  try {
    const { data, error } = await client.from("ai_features").select("*").eq("slug", slug);
    if (error || !Array.isArray(data)) return null;
    return (data[0] as AiFeatureRow | undefined) ?? undefined;
  } catch {
    return null;
  }
}

/** The feature's status changes, or null when they cannot be read. */
export async function readStatusHistory(
  client: SupabaseClient,
  slug: string,
): Promise<StatusHistoryRow[] | null> {
  try {
    const { data, error } = await client
      .from("ai_feature_status_history")
      .select("*")
      .eq("feature_slug", slug)
      .order("changed_at", { ascending: false });
    if (error || !Array.isArray(data)) return null;
    return data as StatusHistoryRow[];
  } catch {
    return null;
  }
}

/** Account id → email for the people of one feature, or null when it cannot be read. */
export function readPeople(client: SupabaseClient, slug: string): Promise<People> {
  return readFeaturePeople(async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  }, slug);
}
