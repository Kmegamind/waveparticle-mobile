"use server";

import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { finishRun, type FinishOutcome } from "@/lib/summary/finish-run";
import { createSupabaseRunWriter } from "@/lib/summary/run-writer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * END (#258): saves the finished run on the signed-in account with his live closing line. A public
 * endpoint: `finishRun` checks the input. No Goal or Step text is logged or sent to the model.
 */
export async function finishRunAction(input: unknown): Promise<FinishOutcome> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  try {
    const client = await createSupabaseServerClient();
    const user = await getCurrentUser(client);
    return await finishRun(input, {
      userId: user?.id ?? null,
      store: createSupabaseProgressStore(client),
      writer: createSupabaseRunWriter(client),
      gateway: createServerModelGateway(),
      nowIso: new Date().toISOString(),
    });
  } catch {
    return { status: "failed" };
  }
}
