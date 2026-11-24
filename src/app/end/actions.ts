"use server";

import { getStoryContent } from "@/lib/content/repository";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { modelIsConfigured } from "@/lib/prototype/focus-cards";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { finishAccountRun, type FinishOutcome } from "@/lib/summary/finish-run";
import { createSupabaseRunWriter } from "@/lib/summary/run-writer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { storyIsOff } from "@/lib/research/condition";

/**
 * END (#258): his live closing line and carried line for the signed-in account's completed
 * session, stored once on that session. A public endpoint: `finishAccountRun` checks the input.
 * Nothing about the Goal, the Steps or the lines is logged. Without a model it fails (no test data).
 */
export async function finishRunAction(input: unknown): Promise<FinishOutcome> {
  try {
    const client = await createSupabaseServerClient();
    const user = await getCurrentUser(client);
    // #114 (review N2): a flagged account gets no closing line and no model call, whatever its
    // session says; a failed read of the flag refuses too.
    if (user && (await storyIsOff(client).catch(() => true))) return { status: "failed" };
    return await finishAccountRun(input, {
      userId: user?.id ?? null,
      store: createSupabaseProgressStore(client),
      writer: createSupabaseRunWriter(client),
      gateway: modelIsConfigured() ? createServerModelGateway() : null,
      loadContent: getStoryContent,
      nowIso: new Date().toISOString(),
    });
  } catch {
    return { status: "failed" };
  }
}
