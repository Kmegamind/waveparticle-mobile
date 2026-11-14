import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LineKind,
  LineSource,
  ProgressGoal,
  ProgressSession,
  ProgressStep,
  ProgressStore,
  SessionLine,
  SessionState,
  SessionStep,
} from "./account-progress";

type Row = Record<string, unknown>;

type Query = PromiseLike<{ data: Row[] | null; error: { message: string } | null }> & {
  select(columns: string): Query;
  eq(column: string, value: string): Query;
  in(column: string, values: string[]): Query;
  insert(values: Row | Row[]): Query;
  upsert(values: Row | Row[]): Query;
  delete(): Query;
};

type ProgressClient = {
  from(table: string): Query;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

async function execute(query: Query) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

function goalFromRow(row: Row): ProgressGoal {
  return {
    id: text(row.id),
    title: text(row.title),
    text: text(row.text),
    status: text(row.status) as ProgressGoal["status"],
    ...(typeof row.created_at === "string" ? { createdAt: row.created_at } : {}),
    steps: [],
  };
}

function stepFromRow(row: Row): ProgressStep & { goalId: string } {
  return {
    id: text(row.id),
    goalId: text(row.goal_id),
    position: Number(row.position),
    title: text(row.title),
    description: nullableText(row.description),
    minutes: Number(row.minutes),
  };
}

function sessionFromRow(row: Row): ProgressSession {
  return {
    id: text(row.id),
    goalId: text(row.goal_id),
    companionId: text(row.companion_id),
    storyId: text(row.story_id),
    state: text(row.state) as SessionState,
    backgroundCard: nullableText(row.background_card),
    backgroundCardSource: nullableText(row.background_card_source) as LineSource | null,
    mergedKeyMoments: Array.isArray(row.merged_key_moments)
      ? row.merged_key_moments.filter((item): item is number => typeof item === "number")
      : [],
    closingLine: nullableText(row.closing_line),
    steps: [],
    lines: [],
  };
}

function sessionStepFromRow(row: Row): SessionStep & { sessionId: string } {
  return {
    id: text(row.id),
    sessionId: text(row.session_id),
    stepId: text(row.step_id),
    position: Number(row.position),
    openedAt: nullableText(row.opened_at),
    doneAt: nullableText(row.done_at),
  };
}

function lineFromRow(row: Row): SessionLine & { sessionId: string } {
  return {
    id: text(row.id),
    sessionId: text(row.session_id),
    sessionStepId: nullableText(row.session_step_id),
    seq: Number(row.seq),
    kind: text(row.kind) as LineKind,
    cardId: nullableText(row.card_id),
    source: text(row.source) as LineSource,
    text: text(row.text),
    pauseNumber: typeof row.pause_number === "number" ? row.pause_number : null,
    shownAt: text(row.shown_at),
  };
}

export function createSupabaseProgressStore(
  client: SupabaseClient | ProgressClient,
): ProgressStore {
  const database = client as ProgressClient;

  return {
    async read(actorId, ownerId) {
      if (actorId !== ownerId) throw new Error("Cannot read another account.");

      const goalRows = await execute(database.from("goals").select("*").eq("user_id", ownerId));
      const goals = goalRows.filter((row) => row.user_id === ownerId).map(goalFromRow);
      const goalIds = goals.map((goal) => goal.id);
      const stepRows =
        goalIds.length === 0
          ? []
          : await execute(database.from("steps").select("*").in("goal_id", goalIds));
      for (const step of stepRows.map(stepFromRow)) {
        goals.find((goal) => goal.id === step.goalId)?.steps.push(step);
      }

      const sessionRows = await execute(
        database.from("sessions").select("*").eq("user_id", ownerId),
      );
      const sessions = sessionRows.filter((row) => row.user_id === ownerId).map(sessionFromRow);
      const sessionIds = sessions.map((session) => session.id);
      if (sessionIds.length > 0) {
        const sessionSteps = (
          await execute(database.from("session_steps").select("*").in("session_id", sessionIds))
        ).map(sessionStepFromRow);
        const lines = (
          await execute(database.from("session_lines").select("*").in("session_id", sessionIds))
        ).map(lineFromRow);
        for (const step of sessionSteps) {
          const { sessionId, ...rest } = step;
          sessions.find((session) => session.id === sessionId)?.steps.push(rest);
        }
        for (const line of lines) {
          const { sessionId, ...rest } = line;
          sessions.find((session) => session.id === sessionId)?.lines.push(rest);
        }
      }

      return { userId: ownerId, goals, sessions };
    },
    async write(actorId, progress) {
      if (actorId !== progress.userId) throw new Error("Cannot write another account.");

      if (progress.goals.length > 0) {
        await execute(
          database.from("goals").upsert(
            progress.goals.map((goal) => ({
              id: goal.id,
              user_id: progress.userId,
              title: goal.title,
              text: goal.text,
              status: goal.status,
            })),
          ),
        );
        const steps = progress.goals.flatMap((goal) =>
          goal.steps.map((step) => ({
            id: step.id,
            goal_id: goal.id,
            position: step.position,
            title: step.title,
            description: step.description,
            minutes: step.minutes,
          })),
        );
        if (steps.length > 0) await execute(database.from("steps").upsert(steps));
      }

      if (progress.sessions.length > 0) {
        await execute(
          database.from("sessions").upsert(
            progress.sessions.map((session) => ({
              id: session.id,
              user_id: progress.userId,
              goal_id: session.goalId,
              step_count: Math.max(session.steps.length, 1),
              state: session.state,
              seed: session.id,
              companion_id: session.companionId,
              story_id: session.storyId,
              background_card: session.backgroundCard,
              background_card_source: session.backgroundCardSource,
              merged_key_moments: session.mergedKeyMoments,
              closing_line: session.closingLine,
            })),
          ),
        );
        const sessionSteps = progress.sessions.flatMap((session) =>
          session.steps.map((step) => ({
            id: step.id,
            session_id: session.id,
            step_id: step.stepId,
            position: step.position,
            opened_at: step.openedAt,
            done_at: step.doneAt,
          })),
        );
        if (sessionSteps.length > 0) {
          await execute(database.from("session_steps").upsert(sessionSteps));
        }

        const existingLines = (
          await execute(
            database
              .from("session_lines")
              .select("*")
              .in(
                "session_id",
                progress.sessions.map((session) => session.id),
              ),
          )
        ).map(lineFromRow);
        const existingById = new Map(existingLines.map((line) => [line.id, line]));
        const inserts = [];
        for (const session of progress.sessions) {
          for (const line of session.lines) {
            const stored = existingById.get(line.id);
            if (stored) {
              const same =
                stored.text === line.text &&
                stored.kind === line.kind &&
                stored.source === line.source &&
                stored.cardId === line.cardId &&
                stored.pauseNumber === line.pauseNumber &&
                stored.sessionStepId === line.sessionStepId &&
                stored.seq === line.seq &&
                stored.shownAt === line.shownAt;
              if (!same) throw new Error("A shown line cannot be changed.");
              continue;
            }
            inserts.push({
              id: line.id,
              session_id: session.id,
              session_step_id: line.sessionStepId,
              seq: line.seq,
              kind: line.kind,
              card_id: line.cardId,
              source: line.source,
              text: line.text,
              pause_number: line.pauseNumber,
              shown_at: line.shownAt,
            });
          }
        }
        if (inserts.length > 0) await execute(database.from("session_lines").insert(inserts));
      }
    },
    async remove(actorId, ownerId) {
      if (actorId !== ownerId) throw new Error("Cannot delete another account.");
      await execute(database.from("sessions").delete().eq("user_id", ownerId));
      await execute(database.from("goals").delete().eq("user_id", ownerId));
    },
  };
}
