import { createHash } from "node:crypto";
import { companionHref } from "@/lib/content/companion-access";
import { storyFacts, type StoryContent } from "@/lib/content/types";
import type { ClosingLineInput, ModelGateway } from "@/lib/model-gateway";
import type {
  AccountProgress,
  ProgressSession,
  ProgressStore,
} from "@/lib/progress/account-progress";
import {
  generationInputs,
  isStoryId,
  storyById,
  storyIds,
  storyProfile,
} from "@/lib/prototype/story-inputs";
import { startStory } from "@/lib/story/start";
import { isStoryOff } from "@/lib/progress/focus-session";
import type { FinishShown } from "./run";
import type { RunWriter } from "./run-writer";

/**
 * Finishing a signed-in run (issue #258). The run itself is the account's session from the
 * signed-in focus page (#257), completed by its last Done. END adds his live closing line and the
 * line he still carries to that same session, once. No stored or pre-written line is ever
 * returned (NO-BACKUP), and no text the user wrote reaches the model.
 *
 * #521: any Companion. A session counts only when its story is in the content the server passes
 * (scoped to the viewer, `contentForViewer`) and the story belongs to the session's Companion, so
 * a session on a Companion the account may not play has no summary and no closing call.
 */

export type FinishOutcome =
  | { status: "ok"; shown: FinishShown }
  | { status: "signed-out" | "invalid" | "not-finished" | "failed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The action is a public endpoint: only a session id in uuid form is accepted. */
export function sessionIdOf(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const id = (raw as Record<string, unknown>).sessionId;
  return typeof id === "string" && UUID.test(id) ? id : null;
}

/** True when the session's story is in this content and is a story of the session's Companion. */
function playsOwnStory(content: StoryContent, session: ProgressSession): boolean {
  return (
    isStoryId(content, session.storyId) &&
    storyById(content, session.storyId).companionId === session.companionId
  );
}

const ownSession = (progress: AccountProgress, sessionId: string) =>
  progress.sessions.find(
    // #114: a session with the Story turned off has no summary (END is his closing line).
    (session) => session.id === sessionId && !isStoryOff(session),
  ) ?? null;

const byPosition = <T extends { position: number }>(items: T[]) =>
  [...items].sort((left, right) => left.position - right.position);

/** What END shows of one account session: no counts, no verdict (SUMMARY-RECORD). */
export type SummaryView = {
  sessionId: string;
  /** The Goal of the session: Undo on the summary opens its focus page again (#27 AC4). */
  goalId: string;
  storyTitle: string;
  goalTitle: string;
  steps: string[];
  planMinutes: number;
  finished: boolean;
  /** #521: Next opens the Life Path of the session's own Companion. */
  lifePathHref: string;
};

export function summaryOf(
  content: StoryContent,
  progress: AccountProgress,
  sessionId: string,
): SummaryView | null {
  const session = ownSession(progress, sessionId);
  const goal = session && progress.goals.find((item) => item.id === session.goalId);
  if (!session || !goal || !playsOwnStory(content, session)) return null;
  const steps = byPosition(goal.steps);
  return {
    sessionId,
    goalId: goal.id,
    storyTitle: storyProfile(content, session.storyId).title,
    goalTitle: goal.title,
    steps: steps.map((step) => step.title),
    planMinutes: steps.reduce((total, step) => total + step.minutes, 0),
    finished: session.state === "completed",
    lifePathHref: companionHref(session.companionId),
  };
}

/** The closing call's input: the story's own inputs and the facts of this run, no user text. */
export function closingInputFor(
  content: StoryContent,
  storyId: string,
  minutes: number[],
  earlierLines: string[],
): ClosingLineInput {
  const story = storyFacts(storyById(content, storyId));
  const brief = startStory(
    story,
    minutes.map((value) => ({ minutes: value })),
  );
  const factText = (ids: string[]) => {
    const wanted = new Set(ids);
    return story.facts
      .filter((fact) => wanted.has(fact.id))
      .map((fact) => fact.text)
      .join(" ");
  };
  const inputs = generationInputs(content, storyId);
  const allIds = brief.steps.flatMap((step) => step.factIds);
  // A Plan with more Steps than facts leaves the last Steps without facts; the last moment is the
  // last Step that has any.
  const lastIds = [...brief.steps].reverse().find((step) => step.factIds.length > 0)?.factIds ?? [];
  return {
    facts: [inputs.who, `Place: ${inputs.place}.`, inputs.goalShort, factText(allIds)].join(" "),
    lastMoment: factText(lastIds),
    forbidTerms: inputs.forbidTerms,
    earlierLines,
    companionName: inputs.companionName,
  };
}

const completedOf = (progress: AccountProgress, storyId: string, companionId: string) =>
  progress.sessions.filter(
    (session) =>
      session.state === "completed" &&
      session.companionId === companionId &&
      !isStoryOff(session) &&
      session.storyId === storyId,
  );

/** The next story after this one, only for its first completion and only when one exists. */
export function nextStoryAfter(
  content: StoryContent,
  before: AccountProgress,
  storyId: string,
): string | null {
  if (!isStoryId(content, storyId)) return null;
  const companionId = storyById(content, storyId).companionId;
  if (completedOf(before, storyId, companionId).length > 0) return null;
  const STORY_IDS = storyIds(content, companionId);
  const index = STORY_IDS.indexOf(storyId);
  return index >= 0 && index + 1 < STORY_IDS.length ? STORY_IDS[index + 1] : null;
}

const WAIT_FOR_OTHER_TAB_MS = 200;
const WAIT_FOR_OTHER_TAB_TRIES = 10;

/** A fixed id for the carried line of one session, so a retry writes the same row (ignored). */
function closingRowId(sessionId: string): string {
  const hex = createHash("sha256").update(`${sessionId}:closing`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

type Deps = {
  userId: string | null;
  store: ProgressStore;
  writer: RunWriter;
  gateway: ModelGateway | null;
  /** The story content (#284); a failed read fails the finish, never another story. */
  loadContent: () => Promise<StoryContent>;
  nowIso: string;
  wait?: (ms: number) => Promise<void>;
};

function shownOf(
  content: StoryContent,
  session: ProgressSession,
  progress: AccountProgress,
): FinishShown {
  const others = { ...progress, sessions: progress.sessions.filter((item) => item !== session) };
  return {
    closingLine: session.closingLine ?? "",
    // Empty only when the write of the carried line failed; END then shows the closing line alone.
    carryLine: session.lines.find((line) => line.kind === "closing")?.text ?? "",
    next: nextStoryAfter(content, others, session.storyId),
  };
}

/** His one-way lines shown in this session, in Step and card order (the per-run list). */
function shownLines(session: ProgressSession): string[] {
  const order = new Map(session.steps.map((step) => [step.id, step.position]));
  return session.lines
    .filter((line) => line.kind === "background" || line.kind === "story_card")
    .map((line, index) => ({ line, index }))
    .sort(
      (left, right) =>
        (order.get(left.line.sessionStepId ?? "") ?? 0) -
          (order.get(right.line.sessionStepId ?? "") ?? 0) ||
        left.line.seq - right.line.seq ||
        left.index - right.index,
    )
    .map(({ line }) => line.text);
}

export async function finishAccountRun(raw: unknown, deps: Deps): Promise<FinishOutcome> {
  if (!deps.userId) return { status: "signed-out" };
  const userId = deps.userId;
  const sessionId = sessionIdOf(raw);
  if (!sessionId) return { status: "invalid" };
  let content: StoryContent;
  try {
    content = await deps.loadContent();
  } catch {
    return { status: "failed" };
  }
  const progress = await deps.store.read(userId, userId);
  const session = ownSession(progress, sessionId);
  const goal = session && progress.goals.find((item) => item.id === session.goalId);
  if (!session || !goal || session.state !== "completed" || !playsOwnStory(content, session)) {
    return { status: "not-finished" };
  }
  // Never generated again: a reload, a retry or another tab shows the stored lines.
  if (session.closingLine) return { status: "ok", shown: shownOf(content, session, progress) };
  if (!deps.gateway) return { status: "failed" };

  const result = await deps.gateway.writeClosingLine(
    closingInputFor(
      content,
      session.storyId,
      byPosition(goal.steps).map((step) => step.minutes),
      shownLines(session),
    ),
  );
  if (result.source !== "generated") return { status: "failed" };

  try {
    const claim = await deps.writer.claimClosingLine(sessionId, result.closingLine);
    if (claim === "taken") return await waitForOtherTab(content, sessionId, deps);
    await deps.writer.insertClosingLine(sessionId, {
      id: closingRowId(sessionId),
      sessionStepId: null,
      seq: 0,
      kind: "closing",
      cardId: null,
      source: "generated",
      text: result.carryLine,
      pauseNumber: null,
      shownAt: deps.nowIso,
    });
  } catch {
    return { status: "failed" };
  }
  return {
    status: "ok",
    shown: {
      closingLine: result.closingLine,
      carryLine: result.carryLine,
      next: nextStoryAfter(
        content,
        { ...progress, sessions: progress.sessions.filter((item) => item !== session) },
        session.storyId,
      ),
    },
  };
}

/** Another tab stored the lines first: show them once its carried line is written too. */
async function waitForOtherTab(
  content: StoryContent,
  sessionId: string,
  deps: Deps,
): Promise<FinishOutcome> {
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const userId = deps.userId as string;
  let last: FinishOutcome = { status: "failed" };
  for (let attempt = 0; attempt < WAIT_FOR_OTHER_TAB_TRIES; attempt += 1) {
    const progress = await deps.store.read(userId, userId);
    const saved = ownSession(progress, sessionId);
    if (saved?.closingLine) {
      last = { status: "ok", shown: shownOf(content, saved, progress) };
      if (saved.lines.some((line) => line.kind === "closing")) return last;
    }
    await wait(WAIT_FOR_OTHER_TAB_MS);
  }
  return last;
}
