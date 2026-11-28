"use server";

import { getStoryContent } from "@/lib/content/repository";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { modelIsConfigured } from "@/lib/prototype/focus-cards";
import { normalisePauseRequest, normaliseRestRequest } from "@/lib/prototype/line-requests";
import {
  afterTheLastRound,
  pauseMessageFor,
  restReplyFor,
  restReplyInRound,
  roundsFromHistory,
  type PauseResponse,
  type RestReplyResponse,
} from "@/lib/prototype/rest-lines";
import type { RestMessage } from "@/lib/prototype/session";
import { serverSafetyCheck } from "@/lib/safety/server";

// TODO(cost cap): the goal-dialogue PR adds an httpOnly-cookie cap on real model calls per browser
// per day. It is not on main yet; when it lands, apply it to both calls below.

function gateway() {
  return modelIsConfigured() ? createServerModelGateway() : null;
}

/** The story content, or null when it cannot be read (the line then fails, #284). */
const storyContent = () => getStoryContent().catch(() => null);

/** His first message on /try/rest. Nothing about the request is logged. */
export async function loadPauseMessage(request: {
  storyId?: string;
  pauseNumber: number;
  stepTitle: string;
  lastCard?: string;
  recentCategories?: string[];
  usedProps?: string[];
  earlierStories?: string[];
  earlierLines?: string[];
}): Promise<PauseResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  return pauseMessageFor(await storyContent(), normalisePauseRequest(request), gateway());
}

/** His reply to one message on /try/rest. The safety gate runs again here, before any model call. */
export async function loadRestReply(request: {
  storyId?: string;
  message: string;
  history: RestMessage[];
  replyIndex: number;
  stepIndex?: number;
  stepCount?: number;
  pauseKey?: string;
}): Promise<RestReplyResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  const normal = normaliseRestRequest(request);
  const safety = serverSafetyCheck();
  // REST-ROUND-10 (#518): the test path has no account, so the round comes from the history in
  // the browser's store.
  return restReplyInRound(
    roundsFromHistory(normal.history),
    (round) => restReplyFor(storyContent, { ...normal, round }, gateway(), safety),
    () => afterTheLastRound(normal.message, safety),
  );
}
