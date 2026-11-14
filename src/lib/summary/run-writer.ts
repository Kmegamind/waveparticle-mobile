import type { ProgressStore, SessionLine, SessionStep } from "@/lib/progress/account-progress";

/**
 * Writes one finished run (#258) and nothing else: no account-wide upsert. The session row is
 * inserted first; its primary key is the browser's run id, so a second tab or a reload that races
 * the first one finds it ("exists") instead of writing a second set of lines. Steps and the closing
 * line have fixed ids and are written with "ignore duplicates", so a retry after a write that
 * failed halfway completes the run without changing what was already saved.
 */
export type NewRunSession = {
  id: string;
  userId: string;
  goalId: string;
  storyId: string;
  closingLine: string;
  stepCount: number;
  completedAt: string;
};

export type RunWriter = {
  insertSession(session: NewRunSession): Promise<"inserted" | "exists">;
  insertSteps(sessionId: string, steps: SessionStep[]): Promise<void>;
  insertClosingLine(sessionId: string, line: SessionLine): Promise<void>;
  markGoalDone(goalId: string): Promise<void>;
};

export const RUN_COMPANION_ID = "oppenheimer";

type Result = { error: { code?: string; message: string } | null };
type RunClient = {
  from(table: string): {
    insert(rows: Record<string, unknown>): PromiseLike<Result>;
    upsert(
      rows: Record<string, unknown>[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<Result>;
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<Result>;
    };
  };
};

const UNIQUE_VIOLATION = "23505";
const IGNORE = { onConflict: "id", ignoreDuplicates: true };

function check(result: Result) {
  if (result.error) throw new Error(result.error.message);
}

/** The writer used by /end, through the user's own Supabase client (row-level security). */
export function createSupabaseRunWriter(client: unknown): RunWriter {
  const database = client as RunClient;
  return {
    async insertSession(session) {
      const result = await database.from("sessions").insert({
        id: session.id,
        user_id: session.userId,
        goal_id: session.goalId,
        step_count: Math.max(session.stepCount, 1),
        state: "completed",
        seed: session.id,
        companion_id: RUN_COMPANION_ID,
        story_id: session.storyId,
        background_card: null,
        background_card_source: null,
        merged_key_moments: [],
        closing_line: session.closingLine,
        completed_at: session.completedAt,
      });
      if (result.error?.code === UNIQUE_VIOLATION) return "exists";
      check(result);
      return "inserted";
    },
    async insertSteps(sessionId, steps) {
      if (steps.length === 0) return;
      check(
        await database.from("session_steps").upsert(
          steps.map((step) => ({
            id: step.id,
            session_id: sessionId,
            step_id: step.stepId,
            position: step.position,
            opened_at: step.openedAt,
            done_at: step.doneAt,
          })),
          IGNORE,
        ),
      );
    },
    async insertClosingLine(sessionId, line) {
      check(
        await database.from("session_lines").upsert(
          [
            {
              id: line.id,
              session_id: sessionId,
              session_step_id: line.sessionStepId,
              seq: line.seq,
              kind: line.kind,
              card_id: line.cardId,
              source: line.source,
              text: line.text,
              pause_number: line.pauseNumber,
              shown_at: line.shownAt,
            },
          ],
          IGNORE,
        ),
      );
    },
    async markGoalDone(goalId) {
      check(await database.from("goals").update({ status: "done" }).eq("id", goalId));
    },
  };
}

/** The same rules over the in-memory progress store, for tests. Inserting a session is atomic. */
export function createMemoryRunWriter(store: ProgressStore, userId: string): RunWriter {
  const claimed = new Set<string>();
  async function change(apply: (progress: Awaited<ReturnType<ProgressStore["read"]>>) => void) {
    const progress = await store.read(userId, userId);
    apply(progress);
    await store.write(userId, progress);
  }
  return {
    async insertSession(session) {
      // Checked before any await, like the database's primary key.
      if (claimed.has(session.id)) return "exists";
      claimed.add(session.id);
      const progress = await store.read(userId, userId);
      if (progress.sessions.some((item) => item.id === session.id)) return "exists";
      progress.sessions.push({
        id: session.id,
        goalId: session.goalId,
        companionId: RUN_COMPANION_ID,
        storyId: session.storyId,
        state: "completed",
        backgroundCard: null,
        backgroundCardSource: null,
        mergedKeyMoments: [],
        closingLine: session.closingLine,
        steps: [],
        lines: [],
      });
      await store.write(userId, progress);
      return "inserted";
    },
    insertSteps: (sessionId, steps) =>
      change((progress) => {
        const session = progress.sessions.find((item) => item.id === sessionId);
        if (!session) throw new Error("No such session.");
        for (const step of steps) {
          if (!session.steps.some((item) => item.id === step.id)) session.steps.push(step);
        }
      }),
    insertClosingLine: (sessionId, line) =>
      change((progress) => {
        const session = progress.sessions.find((item) => item.id === sessionId);
        if (!session) throw new Error("No such session.");
        if (!session.lines.some((item) => item.id === line.id)) session.lines.push(line);
      }),
    markGoalDone: (goalId) =>
      change((progress) => {
        const goal = progress.goals.find((item) => item.id === goalId);
        if (goal) goal.status = "done";
      }),
  };
}
