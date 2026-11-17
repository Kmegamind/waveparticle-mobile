"use server";

import { getStoryContent, readStoryCardsFromSupabase } from "@/lib/content/repository";
import type { CardVersions } from "@/lib/content/story-deck";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { accountReturnLine } from "@/lib/progress/account-lines";
import { applyFocusSnapshot, type FocusSnapshot } from "@/lib/progress/focus-session";
import { premadeStepCards } from "@/lib/progress/premade-cards";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { modelIsConfigured, type StepCardsResponse } from "@/lib/prototype/focus-cards";
import type { LineResponse } from "@/lib/prototype/rest-lines";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * Server actions of the signed-in focus and rest pages (#257). Every one needs a signed-in user;
 * database access goes through the user's own client (row-level security). No goal, Step or line
 * text is logged. Without a configured model every line fails: there is no test data here.
 */

async function signedInUser() {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  return user ? { user, client } : null;
}

function gateway() {
  return modelIsConfigured() ? createServerModelGateway() : null;
}

/** The story content, or null when it cannot be read (the line then fails, #284). */
const storyContent = () => getStoryContent().catch(() => null);

/**
 * A Step's pre-made cards (#300): the story's published cards, spread across the session's Steps
 * and pinned to the versions the session first read. No model call. The session is read and
 * pinned through the user's own client; the cards with the server's reader key.
 */
export async function loadAccountStepCards(request: unknown): Promise<StepCardsResponse> {
  const signedIn = await signedInUser();
  if (!signedIn) return { status: "failed" };
  const { user, client } = signedIn;
  return premadeStepCards(request, {
    readSession: async (sessionId) => {
      const { data, error } = await client
        .from("sessions")
        .select("story_id, step_count, card_versions")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) return null;
      return {
        storyId: String(data.story_id),
        stepCount: Number(data.step_count),
        cardVersions: (data.card_versions as CardVersions | null) ?? null,
      };
    },
    pinVersions: async (sessionId, versions) => {
      await client
        .from("sessions")
        .update({ card_versions: versions })
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .is("card_versions", null);
    },
    readDeck: (storyId, versions) => readStoryCardsFromSupabase({ storyId, versions }),
  });
}

export async function loadAccountReturnLine(request: unknown): Promise<LineResponse> {
  if (!(await signedInUser())) return { status: "failed" };
  return accountReturnLine(await storyContent(), request, gateway());
}

/**
 * Records the session's progress on the account: opened and done Steps, the session and Goal
 * state, and every newly shown line, written once. Returns false when nothing could be saved.
 */
export async function recordFocusProgress(snapshot: FocusSnapshot): Promise<boolean> {
  const signedIn = await signedInUser();
  if (!signedIn) return false;
  const { user, client } = signedIn;
  try {
    const store = createSupabaseProgressStore(client);
    const progress = await store.read(user.id, user.id);
    const result = applyFocusSnapshot(progress, snapshot, {
      now: new Date().toISOString(),
      newId: () => crypto.randomUUID(),
      userId: user.id,
    });
    if (!result) return false;
    await store.write(user.id, {
      userId: user.id,
      goals: [result.goal],
      sessions: [result.session],
    });
    return true;
  } catch {
    return false;
  }
}
