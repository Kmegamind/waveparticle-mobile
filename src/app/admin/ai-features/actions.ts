"use server";

import { revalidatePath } from "next/cache";
import { readContentRole } from "@/lib/admin/roles";
import type { AiFeatureItem } from "@/lib/ai-features/admin";
import {
  changeFeatureStatus,
  lastSave,
  saveFeatureSections,
  type EditedItem,
  type FeatureDeps,
  type FeatureWriteResult,
  type SectionName,
} from "@/lib/ai-features/edit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { readFeature, readPeople } from "./load";

// #453 (part of #430 T6; AI-PAGE-EDIT, AI-PAGE-STATUS): the Save buttons of the AI feature
// editors. Each action checks the signed-in account and its role on the server before anything is
// written (an admin or writer saves (a) to (c); only an admin changes the status), and the
// database functions check the role again. No key with full database rights.

async function deps(): Promise<FeatureDeps> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  return {
    userId: user?.id ?? null,
    role,
    readFeature: (slug) => readFeature(client, slug),
    rpc: async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    },
  };
}

export type SavedSections = {
  sections: Record<SectionName, AiFeatureItem[]>;
  loadedAt: string | null;
  lastSave: { time: string; dateTime: string; person: string } | null;
};

/** Saves the sections one editor shows; answers the feature as saved, for the editor to show. */
export async function saveSectionsAction(
  slug: string,
  loadedAt: string | null,
  sections: Partial<Record<SectionName, EditedItem[]>>,
): Promise<FeatureWriteResult & { saved?: SavedSections }> {
  const d = await deps();
  const result = await saveFeatureSections({ slug, loadedAt, sections }, d);
  if (!result.ok) return result;
  revalidatePath("/admin/ai-features", "layout");
  const client = await createSupabaseServerClient();
  const [feature, people] = await Promise.all([d.readFeature(slug), readPeople(client, slug)]);
  if (!feature) return result;
  return {
    ok: true,
    saved: {
      sections: {
        purpose: feature.purpose,
        pass_questions: feature.pass_questions,
        approach: feature.approach,
      },
      loadedAt: feature.sections_updated_at ?? null,
      lastSave: lastSave(feature, people),
    },
  };
}

/** Changes the status with an optional note. Admin only. */
export async function changeStatusAction(
  slug: string,
  status: string,
  note: string,
): Promise<FeatureWriteResult> {
  const result = await changeFeatureStatus({ slug, status, note }, await deps());
  if (result.ok) revalidatePath("/admin/ai-features", "layout");
  return result;
}
