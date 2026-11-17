"use server";

import { revalidatePath } from "next/cache";
import { rollBackHistoryItem, type RollBackResult } from "@/lib/publish-history/admin";
import { rollBackAppTextAction } from "../app-text/actions";
import { rollBackStoryCardAction } from "../stories/actions";

// The Roll back button of ADM-12 Publish history (#289, #304). It runs the existing roll back path
// of the row's kind, which checks the signed-in account and its role on the server (story cards:
// admin only); the database checks the role again and writes its own history row. No key with
// full database rights.

/** Publishes the row's version again. */
export async function rollBackFromHistoryAction(
  kind: string,
  key: string,
  version: number,
): Promise<RollBackResult> {
  const result = await rollBackHistoryItem(
    { kind, key, version },
    {
      app_text: (itemKey, itemVersion) => rollBackAppTextAction(itemKey, itemVersion),
      story_card: (itemKey, itemVersion) => rollBackStoryCardAction(itemKey, itemVersion),
    },
  );
  if (result.ok) revalidatePath("/admin/publish-history");
  return result;
}
