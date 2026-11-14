"use server";

import { createServerModelGateway } from "@/lib/model-gateway/server";
import { accountReturnLine, accountStepCards } from "@/lib/progress/account-lines";
import { applyFocusSnapshot, type FocusSnapshot } from "@/lib/progress/focus-session";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { isPrototypeEnabled } from "@/lib/prototype/config";
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
  if (!isPrototypeEnabled()) return null;
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  return user ? { user, client } : null;
}

function gateway() {
  return modelIsConfigured() ? createServerModelGateway() : null;
}

export async function loadAccountStepCards(request: unknown): Promise<StepCardsResponse> {
  if (!(await signedInUser())) return { status: "failed" };
  return accountStepCards(request, gateway());
}

export async function loadAccountReturnLine(request: unknown): Promise<LineResponse> {
  if (!(await signedInUser())) return { status: "failed" };
  return accountReturnLine(request, gateway());
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
