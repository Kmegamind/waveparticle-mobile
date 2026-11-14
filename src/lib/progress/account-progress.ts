export type LineSource = "authored" | "generated";

export type LineKind = "background" | "story_card" | "pause_message" | "return_popup" | "closing";

export type SessionState = "open" | "on_hold" | "completed" | "restarted";

export type ProgressStep = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  minutes: number;
};

export type ProgressGoal = {
  id: string;
  title: string;
  text: string;
  status: "planned" | "in_progress" | "on_hold" | "done";
  /** When the Goal was created, when the database gives it (#258: the newest matching Goal). */
  createdAt?: string;
  steps: ProgressStep[];
};

export type SessionStep = {
  id: string;
  stepId: string;
  position: number;
  openedAt: string | null;
  doneAt: string | null;
};

export type SessionLine = {
  id: string;
  sessionStepId: string | null;
  seq: number;
  kind: LineKind;
  cardId: string | null;
  source: LineSource;
  text: string;
  pauseNumber: number | null;
  shownAt: string;
};

export type ProgressSession = {
  id: string;
  goalId: string;
  companionId: string;
  storyId: string;
  state: SessionState;
  backgroundCard: string | null;
  backgroundCardSource: LineSource | null;
  mergedKeyMoments: number[];
  closingLine: string | null;
  steps: SessionStep[];
  lines: SessionLine[];
};

export type AccountProgress = {
  userId: string;
  goals: ProgressGoal[];
  sessions: ProgressSession[];
};

export type ScreenState = {
  home: string[];
  goals: { title: string; steps: string[] }[];
  lifePath: { companionId: string; storyId: string }[];
};

export type ProgressStore = {
  read(actorId: string, ownerId: string): Promise<AccountProgress>;
  write(actorId: string, progress: AccountProgress): Promise<void>;
  remove(actorId: string, ownerId: string): Promise<void>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameLine(left: SessionLine, right: SessionLine) {
  return (
    left.sessionStepId === right.sessionStepId &&
    left.seq === right.seq &&
    left.kind === right.kind &&
    left.cardId === right.cardId &&
    left.source === right.source &&
    left.text === right.text &&
    left.pauseNumber === right.pauseNumber &&
    left.shownAt === right.shownAt
  );
}

function assertOwnAccount(actorId: string, ownerId: string, action: "read" | "write" | "delete") {
  if (actorId !== ownerId) {
    throw new Error(`Cannot ${action} another account.`);
  }
}

function assertOneOpenSession(sessions: ProgressSession[]) {
  const openCounts = new Map<string, number>();
  for (const session of sessions) {
    if (session.state !== "open") continue;
    openCounts.set(session.goalId, (openCounts.get(session.goalId) ?? 0) + 1);
  }
  if ([...openCounts.values()].some((count) => count > 1)) {
    throw new Error("A goal can have one open session.");
  }
}

function assertLinesUnchanged(previous: SessionLine[], incoming: SessionLine[]) {
  const stored = new Map(previous.map((line) => [line.id, line]));
  for (const line of incoming) {
    const existing = stored.get(line.id);
    if (existing && !sameLine(existing, line)) {
      throw new Error("A shown line cannot be changed.");
    }
  }
}

export function createMemoryProgressStore(): ProgressStore {
  const accounts = new Map<string, AccountProgress>();

  return {
    async read(actorId, ownerId) {
      assertOwnAccount(actorId, ownerId, "read");
      return clone(accounts.get(ownerId) ?? { userId: ownerId, goals: [], sessions: [] });
    },
    async write(actorId, progress) {
      assertOwnAccount(actorId, progress.userId, "write");
      const stored = accounts.get(progress.userId);
      const retained = stored?.sessions.filter(
        (session) => !progress.sessions.some((incoming) => incoming.id === session.id),
      );
      assertOneOpenSession([...(retained ?? []), ...progress.sessions]);
      assertLinesUnchanged(
        stored?.sessions.flatMap((session) => session.lines) ?? [],
        progress.sessions.flatMap((session) => session.lines),
      );
      const next = clone(progress);
      if (stored) {
        for (const session of next.sessions) {
          const previous = stored.sessions.find((item) => item.id === session.id);
          if (!previous) continue;
          const incomingIds = new Set(session.lines.map((line) => line.id));
          session.lines = [
            ...previous.lines.filter((line) => !incomingIds.has(line.id)),
            ...session.lines,
          ];
        }
      }
      accounts.set(progress.userId, next);
    },
    async remove(actorId, ownerId) {
      assertOwnAccount(actorId, ownerId, "delete");
      accounts.delete(ownerId);
    },
  };
}

export async function saveAccountProgress(
  store: ProgressStore,
  actorId: string,
  progress: AccountProgress,
) {
  assertOwnAccount(actorId, progress.userId, "write");
  assertOneOpenSession(progress.sessions);
  await store.write(actorId, progress);
}

export async function loadAccountProgress(store: ProgressStore, actorId: string, ownerId: string) {
  assertOwnAccount(actorId, ownerId, "read");
  return store.read(actorId, ownerId);
}

export async function deleteAccountProgress(
  store: ProgressStore,
  actorId: string,
  ownerId: string,
) {
  assertOwnAccount(actorId, ownerId, "delete");
  await store.remove(actorId, ownerId);
}

export function undoStepDone(
  progress: AccountProgress,
  sessionId: string,
  sessionStepId: string,
): AccountProgress {
  const next = clone(progress);
  const session = next.sessions.find((item) => item.id === sessionId);
  const step = session?.steps.find((item) => item.id === sessionStepId);
  if (step) step.doneAt = null;
  return next;
}

export function screenState(progress: AccountProgress): ScreenState {
  const lifePath: ScreenState["lifePath"] = [];
  const seen = new Set<string>();
  for (const session of progress.sessions) {
    if (session.state !== "completed") continue;
    const key = `${session.companionId}:${session.storyId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lifePath.push({ companionId: session.companionId, storyId: session.storyId });
  }

  return {
    home: progress.goals.map((goal) => goal.title),
    goals: progress.goals.map((goal) => ({
      title: goal.title,
      steps: [...goal.steps]
        .sort((left, right) => left.position - right.position)
        .map((step) => step.title),
    })),
    lifePath,
  };
}
