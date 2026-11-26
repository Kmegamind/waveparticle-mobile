import { STUB_SUPABASE } from "./account";

/**
 * #448: test only. That stub account reads (and, with "copy", writes) its own copy of the seed
 * hotline list instead of the shared one other tests write. "seeded" is read only: the account's
 * writes are refused, so the visual gate measures the seed entry whatever other tests save.
 */
export async function useOwnHotlines(token: string, own: "seeded" | "copy"): Promise<void> {
  const answer = await fetch(`${STUB_SUPABASE}/__hotlines`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, own }),
  });
  if (!answer.ok) throw new Error(`stub own hotlines failed: ${answer.status}`);
}

/** The rows that account reads from the stub (an editor reads every version). */
export async function hotlineRows(token: string): Promise<Record<string, unknown>[]> {
  const answer = await fetch(`${STUB_SUPABASE}/rest/v1/hotlines?select=*`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!answer.ok) throw new Error(`stub hotlines read failed: ${answer.status}`);
  return (await answer.json()) as Record<string, unknown>[];
}
