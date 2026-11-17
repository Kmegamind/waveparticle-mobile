"use server";

import { revalidatePath } from "next/cache";
import { readContentRole } from "@/lib/admin/roles";
import { promptRowProblems } from "@/lib/model-gateway";
import {
  readPromptVersions,
  writePrompt,
  type PromptWrite,
  type PromptWriteResult,
} from "@/lib/prompts/admin";
import type { PromptKey } from "@/lib/prompts/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// The buttons of ADM-08 Prompts (#308). Each action checks the signed-in account and its role on
// the server before anything is written: an admin or writer saves drafts, only an admin publishes
// or rolls back, and both re-run the gateway's row check on the stored version. The database
// functions check the role again. No key with full database rights.

export type SavePromptResult = PromptWriteResult & { draftProblems?: string[] };

async function run(write: PromptWrite): Promise<SavePromptResult> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  };
  const result = await writePrompt(write, {
    userId: user?.id ?? null,
    role,
    rpc,
    readVersions: () => readPromptVersions(rpc),
  });
  if (!result.ok) return result;
  revalidatePath("/admin/prompts", "layout");
  if (write.kind !== "save") {
    revalidatePath("/admin/publish-history");
    return result;
  }
  // The saved draft's problems, so the editor can say at once whether it can be published.
  const saved = (await readPromptVersions(rpc))?.find(
    (row) => row.key === write.key && row.version === result.version,
  );
  return saved
    ? {
        ...result,
        draftProblems: promptRowProblems({
          key: saved.key as PromptKey,
          version: saved.version,
          body: saved.body,
          params: saved.params,
        }),
      }
    : result;
}

/** Saves the text, settings and note as a new draft version of the prompt. */
export async function savePromptDraftAction(
  key: string,
  body: string,
  settings: string,
  note: string,
) {
  return run({ kind: "save", key, body, settings, note });
}

/** Makes a draft the gateway can use the active version. Admin only. */
export async function publishPromptAction(key: string, version: number) {
  return run({ kind: "publish", key, version });
}

/** Makes a version that was active before the active one again. Admin only. */
export async function rollBackPromptAction(key: string, version: number) {
  return run({ kind: "roll_back", key, version });
}
