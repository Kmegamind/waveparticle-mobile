import type { AccountRestRounds } from "./account-lines";

/**
 * The round count of a Pause on the account (REST-ROUND-10, #518), through the user's own client:
 * `public.rest_round` reads it and `public.record_rest_round` writes it
 * (supabase/migrations/20261210000000_rest_rounds.sql). Both refuse a session of another account.
 * A failed read or write throws; the caller then answers uncounted and logs it (REST-ROUND-10).
 */
type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function supabaseRestRounds(client: RpcClient): AccountRestRounds {
  return (sessionId, pauseKey) => {
    const target = { target_session: sessionId, target_pause: pauseKey };
    return {
      answered: async () => {
        const { data, error } = await client.rpc("rest_round", target);
        if (error || typeof data !== "number" || !Number.isInteger(data)) {
          throw new Error("rest round read failed");
        }
        return data;
      },
      record: async (round) => {
        const { data, error } = await client.rpc("record_rest_round", {
          ...target,
          shown_round: round,
        });
        // The count after the write: lower than this round means it was not recorded.
        if (error || typeof data !== "number" || data < round) {
          throw new Error("rest round write failed");
        }
      },
    };
  };
}
