"use server";

import { getStoryContent } from "@/lib/content/repository";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { accountPauseMessage, accountRestReply } from "@/lib/progress/account-lines";
import { modelIsConfigured } from "@/lib/prototype/focus-cards";
import type { LineResponse, RestReplyResponse } from "@/lib/prototype/rest-lines";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// Server actions of the signed-in rest page (#257). No test data: without the model they fail.

async function isSignedIn() {
  return (await getCurrentUser(await createSupabaseServerClient())) !== null;
}

function gateway() {
  return modelIsConfigured() ? createServerModelGateway() : null;
}

/** The story content, or null when it cannot be read (the line then fails, #284). */
const storyContent = () => getStoryContent().catch(() => null);

/** His first message for this Pause. Nothing about the request is logged. */
export async function loadAccountPauseMessage(request: unknown): Promise<LineResponse> {
  if (!(await isSignedIn())) return { status: "failed" };
  return accountPauseMessage(await storyContent(), request, gateway());
}

/** His reply on the rest page. The safety gate runs first, before any model call. */
export async function loadAccountRestReply(request: unknown): Promise<RestReplyResponse> {
  if (!(await isSignedIn())) return { status: "failed" };
  return accountRestReply(storyContent, request, gateway());
}
