import type { ProgressStore, SessionLine } from "@/lib/progress/account-progress";

/**
 * Writes his two lines onto one completed session (#258) and nothing else: no account-wide upsert.
 * The closing line is claimed with a conditional update (only while the session has none), so a
 * second tab or a reload that races the first finds it taken instead of writing other lines. The
 * carried line has a fixed id and is written with "ignore duplicates".
 */
export type RunWriter = {
  claimClosingLine(sessionId: string, closingLine: string): Promise<"claimed" | "taken">;
  insertClosingLine(sessionId: string, line: SessionLine): Promise<void>;
};

export const RUN_COMPANION_ID = "oppenheimer";

type Result = { data: unknown[] | null; error: { message: string } | null };
type Filter = {
  eq(column: string, value: string): Filter;
  is(column: string, value: null): Filter;
  select(columns: string): PromiseLike<Result>;
};
type RunClient = {
  from(table: string): {
    update(values: Record<string, unknown>): Filter;
    upsert(
      rows: Record<string, unknown>[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<Result>;
  };
};

function check(result: Result) {
  if (result.error) throw new Error(result.error.message);
}

/** The writer used by /end, through the user's own Supabase client (row-level security). */
export function createSupabaseRunWriter(client: unknown): RunWriter {
  const database = client as RunClient;
  return {
    async claimClosingLine(sessionId, closingLine) {
      const result = await database
        .from("sessions")
        .update({ closing_line: closingLine })
        .eq("id", sessionId)
        .eq("state", "completed")
        .is("closing_line", null)
        .select("id");
      check(result);
      return (result.data?.length ?? 0) > 0 ? "claimed" : "taken";
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
          { onConflict: "id", ignoreDuplicates: true },
        ),
      );
    },
  };
}

/** The same rules over the in-memory progress store, for tests. Claiming is atomic. */
export function createMemoryRunWriter(store: ProgressStore, userId: string): RunWriter {
  const claimed = new Set<string>();
  return {
    async claimClosingLine(sessionId, closingLine) {
      // Checked before any await, like the database's conditional update.
      if (claimed.has(sessionId)) return "taken";
      claimed.add(sessionId);
      const progress = await store.read(userId, userId);
      const session = progress.sessions.find((item) => item.id === sessionId);
      if (!session || session.state !== "completed" || session.closingLine) return "taken";
      session.closingLine = closingLine;
      await store.write(userId, progress);
      return "claimed";
    },
    async insertClosingLine(sessionId, line) {
      const progress = await store.read(userId, userId);
      const session = progress.sessions.find((item) => item.id === sessionId);
      if (!session) throw new Error("No such session.");
      if (session.lines.some((item) => item.id === line.id)) return;
      session.lines.push(line);
      await store.write(userId, progress);
    },
  };
}
