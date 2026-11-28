"use server";

import { getStoryContentForViewer } from "@/lib/content/repository";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { accountPauseMessage, accountRestReply } from "@/lib/progress/account-lines";
import { modelIsConfigured } from "@/lib/prototype/focus-cards";
import type { PauseResponse, RestReplyResponse } from "@/lib/prototype/rest-lines";
import { serverSafetyCheck } from "@/lib/safety/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { storyIsOff } from "@/lib/research/condition";

// Server actions of the signed-in rest page (#257). No test data: without the model they fail.

/**
 * Signed in and not in the study condition (#114, R1-STUDY: the Companion is off, so no model
 * call is made for a flagged account; a failed read of the flag refuses too).
 */
async function signedInClient() {
  const client = await createSupabaseServerClient();
  if ((await getCurrentUser(client)) === null) return null;
  return (await storyIsOff(client).catch(() => true)) ? null : client;
}

function gateway() {
  return modelIsConfigured() ? createServerModelGateway() : null;
}

/**
 * The story content as this account may play it (#521: a Companion who is not public only for an
 * admin or writer), or null when it cannot be read (the line then fails, #284).
 */
const storyContent = (client: Awaited<ReturnType<typeof createSupabaseServerClient>>) =>
  getStoryContentForViewer(client).catch(() => null);

/** His first message for this Pause. Nothing about the request is logged. */
export async function loadAccountPauseMessage(request: unknown): Promise<PauseResponse> {
  const client = await signedInClient();
  if (!client) return { status: "failed" };
  return accountPauseMessage(await storyContent(client), request, gateway());
}

/** His reply on the rest page. The safety gate runs first, before any model call. */
export async function loadAccountRestReply(request: unknown): Promise<RestReplyResponse> {
  const client = await signedInClient();
  if (!client) return { status: "failed" };
  return accountRestReply(() => storyContent(client), request, gateway(), serverSafetyCheck());
}
