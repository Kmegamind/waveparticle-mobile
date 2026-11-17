"use server";

import { revalidatePath } from "next/cache";
import { readContentRole } from "@/lib/admin/roles";
import { clearStoryContentCache } from "@/lib/content/repository";
import { contentFieldProblems, storedFieldBody } from "@/lib/content-fields/reader";
import {
  writeContentField,
  type ContentFieldWrite,
  type ContentFieldWriteResult,
} from "@/lib/content-fields/write";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// The buttons of the Companion and story field pages (#309, ADM-03 to ADM-05). Each action checks
// the signed-in account and its role on the server before anything is written: an admin or writer
// saves drafts, only an admin publishes or rolls back, and every text is checked (a year, date or
// age is refused) on save and again before publish. The database functions check the role and the
// period rules again. No key with full database rights.

async function run(write: ContentFieldWrite): Promise<ContentFieldWriteResult> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  const result = await writeContentField(write, {
    userId: user?.id ?? null,
    role,
    rpc: async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    },
    problemsOf: (key, body) => contentFieldProblems(client, key, body),
    storedBody: (key, version) => storedFieldBody(client, key, version),
  });
  if (!result.ok) return result;
  revalidatePath("/admin/companions", "layout");
  if (write.kind !== "save") {
    // This server shows the published text at once; other servers within a minute (#284).
    clearStoryContentCache();
    revalidatePath("/admin/publish-history");
  }
  return result;
}

/** Saves the text as a new draft version of the field. */
export async function saveContentFieldAction(key: string, body: string) {
  return run({ kind: "save", key, body });
}

/** Makes a version the published one. Admin only. */
export async function publishContentFieldAction(key: string, version: number) {
  return run({ kind: "publish", key, version });
}

/** Publishes a version that was published before again. Admin only. */
export async function rollBackContentFieldAction(key: string, version: number) {
  return run({ kind: "roll_back", key, version });
}
