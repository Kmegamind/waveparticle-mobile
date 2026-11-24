// The internal research flag of US-MAP-11 (#114, decision M4, docs/decisions/0031). Server code
// only: public.research_condition() answers for the signed-in account (auth.uid()) through the
// user's own client. There is no setting for it anywhere in the interface.

export type ResearchCondition = "no_story";

type RpcClient = {
  rpc(
    fn: string,
  ): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

/** PostgREST and Postgres codes for a function that does not exist (the migration has not run). */
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

/**
 * The signed-in account's study condition, or null. A failed read throws, so a participant never
 * falls back to the Story; only a missing function (nobody can be flagged yet) reads as null.
 */
export async function readResearchCondition(client: unknown): Promise<ResearchCondition | null> {
  const { data, error } = await (client as RpcClient).rpc("research_condition");
  if (error) {
    if (error.code && MISSING_FUNCTION.has(error.code)) return null;
    throw new Error("The research condition could not be read.");
  }
  return data === "no_story" ? "no_story" : null;
}

/** True when the Story is off for this account (the study condition). */
export async function storyIsOff(client: unknown): Promise<boolean> {
  return (await readResearchCondition(client)) === "no_story";
}
