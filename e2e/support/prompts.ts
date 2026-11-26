import { STUB_SUPABASE } from "./account";

/**
 * #446: test only. That stub account's list_prompt_versions answers the seeded prompts (version 1
 * of each, no drafts), whatever other tests save meanwhile; its prompt writes are refused. The
 * visual gate uses it so the prompt pages it measures never depend on other tests' drafts.
 */
export async function useSeededPrompts(token: string): Promise<void> {
  const answer = await fetch(`${STUB_SUPABASE}/__prompts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, seededView: true }),
  });
  if (!answer.ok) throw new Error(`stub seeded prompts failed: ${answer.status}`);
}
