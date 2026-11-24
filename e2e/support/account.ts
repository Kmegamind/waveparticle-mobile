import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import { e2ePorts } from "./ports";

// Signs a test into the test-only Supabase stub (e2e/support/stub-supabase.mjs) with its own
// account and data (#73). Each call makes a new token and user, so parallel tests never meet.

export const STUB_SUPABASE = `http://127.0.0.1:${e2ePorts.supabase}`;
/** `@supabase/ssr` names the cookie after the first label of the project host (127.0.0.1). */
const COOKIE = "sb-127-auth-token";

export type StubTables = {
  profiles?: Record<string, unknown>[];
  session_lines?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  steps?: Record<string, unknown>[];
  sessions?: Record<string, unknown>[];
  session_steps?: Record<string, unknown>[];
};

export type StubAccount = { token: string; userId: string };

function base64Url(text: string) {
  return Buffer.from(text, "utf8").toString("base64url");
}

/** Seeds the stub with this account's rows and sets the session cookie for the app. */
export async function signIn(
  context: BrowserContext,
  baseURL: string,
  tables: (userId: string) => StubTables = () => ({}),
  options: {
    missingFunctions?: string[];
    contentRole?: "admin" | "writer";
    /** #114: the research flag's study condition for this account. */
    researchCondition?: "no_story";
  } = {},
): Promise<StubAccount> {
  const token = `stub-${randomUUID()}`;
  const userId = randomUUID();
  const seeded = await fetch(`${STUB_SUPABASE}/__seed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      user: { id: userId, email: `${userId}@example.invalid` },
      tables: tables(userId),
      missingFunctions: options.missingFunctions ?? [],
      contentRole: options.contentRole ?? null,
      researchCondition: options.researchCondition ?? null,
    }),
  });
  if (!seeded.ok) throw new Error(`stub seed failed: ${seeded.status}`);
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: token,
    refresh_token: "stub-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: `${userId}@example.invalid`,
    },
  };
  await context.addCookies([
    {
      name: COOKIE,
      value: `base64-${base64Url(JSON.stringify(session))}`,
      url: baseURL,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
  return { token, userId };
}

/** The stub's tables for this account, after the app's writes. */
export async function stubTables(
  account: StubAccount,
): Promise<Required<StubTables> & { auth_users: unknown[] }> {
  const response = await fetch(
    `${STUB_SUPABASE}/__tables?token=${encodeURIComponent(account.token)}`,
  );
  return (await response.json()) as Required<StubTables> & { auth_users: unknown[] };
}

export function baseUrlOf(page: Page): string {
  return new URL(page.url() === "about:blank" ? `http://127.0.0.1:${e2ePorts.app}` : page.url())
    .origin;
}
