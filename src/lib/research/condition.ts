import { logEvent } from "@/lib/logging/server-log";

// The internal research flag of US-MAP-11 (#114, decision M4, docs/decisions/0031). Server code
// only: public.research_condition() answers for the signed-in account (auth.uid()) through the
// user's own client. There is no setting for it anywhere in the interface.

export type ResearchCondition = "no_story";

type RpcClient = {
  rpc(
    fn: string,
  ): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

/**
 * PostgREST and Postgres codes for a function that does not exist: the migration has not run, it
 * was dropped, or the schema cache is stale (all answer PGRST202).
 */
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

/**
 * `RESEARCH_STUDY_ACTIVE` (server only): `1` once a study runs, set before the first participant is
 * assigned. Then a missing function is a failed read (fail closed); otherwise it reads as no flag.
 */
export function studyIsActive(env: Record<string, string | undefined> = process.env): boolean {
  return env.RESEARCH_STUDY_ACTIVE?.trim() === "1";
}

let warnedMissing = false;

/** Test hook: the once-per-process warning is given again. */
export function resetResearchWarning(): void {
  warnedMissing = false;
}

/**
 * The signed-in account's study condition, or null. A failed read throws, so a participant never
 * falls back to the Story. A missing function throws too while a study is active
 * (`RESEARCH_STUDY_ACTIVE=1`, logged as an error); before that it reads as null, with one warning
 * per server process.
 */
export async function readResearchCondition(
  client: unknown,
  env: Record<string, string | undefined> = process.env,
): Promise<ResearchCondition | null> {
  const { data, error } = await (client as RpcClient).rpc("research_condition");
  if (error) {
    const missing = Boolean(error.code && MISSING_FUNCTION.has(error.code));
    if (missing && !studyIsActive(env)) {
      if (!warnedMissing) {
        warnedMissing = true;
        logEvent("research", { event: "research_function_missing", reason: "study_inactive" });
      }
      return null;
    }
    logEvent(
      "research",
      { event: "research_read_failed", reason: missing ? "function_missing" : "read_error" },
      { level: "error" },
    );
    throw new Error("The research condition could not be read.");
  }
  return data === "no_story" ? "no_story" : null;
}

/** True when the Story is off for this account (the study condition). */
export async function storyIsOff(
  client: unknown,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  return (await readResearchCondition(client, env)) === "no_story";
}
