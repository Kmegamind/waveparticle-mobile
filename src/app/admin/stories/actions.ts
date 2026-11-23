"use server";

import { revalidatePath } from "next/cache";
import { readContentRole } from "@/lib/admin/roles";
import { storedCardProblems } from "@/lib/story-cards/reader";
import { rollBackWarnings } from "@/lib/story-cards/roll-back-warning";
import {
  writeStoryCard,
  type StoryCardWrite,
  type StoryCardWriteResult,
} from "@/lib/story-cards/write";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// The buttons of ADM-06 Stories (#304). Each action checks the signed-in account and its role on
// the server before anything is written: an admin or writer saves drafts and part titles, only an
// admin publishes or rolls back, and Publish re-runs the card checks on the stored draft. The
// database functions check the role again. No key with full database rights.

export type SaveDraftResult = StoryCardWriteResult & { draftProblems?: string[] };

async function run(write: StoryCardWrite): Promise<SaveDraftResult> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  const checkCard = (key: string, version: number) => storedCardProblems(client, key, version);
  const result = await writeStoryCard(write, {
    userId: user?.id ?? null,
    role,
    rpc: async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    },
    checkCard,
  });
  if (!result.ok) return result;
  revalidatePath("/admin/stories", "layout");
  if (write.kind !== "save") {
    if (write.kind !== "title") revalidatePath("/admin/publish-history");
    return result;
  }
  // The saved draft's problems, so the editor can say at once whether it can be published.
  const problems = result.version ? await checkCard(write.key, result.version) : null;
  return problems ? { ...result, draftProblems: problems } : result;
}

/** Saves the text as a new draft version of the card. */
export async function saveStoryCardDraftAction(key: string, body: string) {
  return run({ kind: "save", key, body });
}

/** Makes a passing draft the published version. Admin only. */
export async function publishStoryCardAction(key: string, version: number) {
  return run({ kind: "publish", key, version });
}

/** Publishes a version that was published before again. Admin only. */
export async function rollBackStoryCardAction(key: string, version: number) {
  return run({ kind: "roll_back", key, version });
}

/**
 * The problems of a version a roll back would make live, as Publish checks them (#377). Read only:
 * the two roll back buttons show them and ask the admin to confirm. The roll back itself is never
 * refused for them (decision 0023, 0028).
 */
export async function storyCardRollBackWarningsAction(key: string, version: number) {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  return rollBackWarnings(
    { key, version },
    {
      userId: user?.id ?? null,
      role,
      checkCard: (cardKey, cardVersion) => storedCardProblems(client, cardKey, cardVersion),
    },
  );
}

/** Renames a part of a story. */
export async function saveStoryPartTitleAction(storyId: string, part: number, title: string) {
  return run({ kind: "title", storyId, part, title });
}
