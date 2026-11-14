"use server";

import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { modelIsConfigured } from "@/lib/prototype/focus-cards";
import {
  pauseMessageFor,
  restReplyFor,
  type LineResponse,
  type RestReplyResponse,
} from "@/lib/prototype/rest-lines";
import type { RestMessage } from "@/lib/prototype/session";

// TODO(cost cap): the goal-dialogue PR adds an httpOnly-cookie cap on real model calls per browser
// per day. It is not on main yet; when it lands, apply it to both calls below.

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function gateway() {
  return modelIsConfigured() ? createServerModelGateway() : null;
}

/** His first message on /try/rest. Nothing about the request is logged. */
export async function loadPauseMessage(request: {
  storyId?: string;
  pauseNumber: number;
  stepTitle: string;
  lastCard?: string;
}): Promise<LineResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  const pauseNumber =
    Number.isInteger(request?.pauseNumber) && request.pauseNumber >= 1 ? request.pauseNumber : 1;
  return pauseMessageFor(
    {
      storyId: typeof request?.storyId === "string" ? request.storyId : undefined,
      pauseNumber,
      stepTitle: text(request?.stepTitle, 200),
      lastCard: text(request?.lastCard, 1_000) || undefined,
    },
    gateway(),
  );
}

/** His reply to one message on /try/rest. The safety gate runs again here, before any model call. */
export async function loadRestReply(request: {
  storyId?: string;
  message: string;
  history: RestMessage[];
  replyIndex: number;
}): Promise<RestReplyResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  const history = Array.isArray(request?.history)
    ? request.history
        .filter((item) => item && (item.from === "him" || item.from === "you"))
        .map((item) => ({ from: item.from, text: text(item.text, 2_000) }))
    : [];
  const replyIndex =
    Number.isInteger(request?.replyIndex) && request.replyIndex >= 0 ? request.replyIndex : 0;
  return restReplyFor(
    {
      storyId: typeof request?.storyId === "string" ? request.storyId : undefined,
      message: text(request?.message, 10_000),
      history,
      replyIndex,
    },
    gateway(),
  );
}
