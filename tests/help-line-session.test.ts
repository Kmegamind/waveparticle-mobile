import { describe, expect, it, vi } from "vitest";

// #118, review of #406: the refresh of the help line copy tells "no session" from "could not tell"
// (I-R1), and /auth/callback marks a new session so the phone's old copy goes first (M-B).

const exchange = vi.fn(async () => ({ error: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession: exchange } }),
}));

const { checkSession, sessionErrorKind } = await import("@/lib/supabase/session");
const { GET: callback } = await import("@/app/auth/callback/route");
const { consumeHelpLineReset, HELP_LINE_KEY, HELP_LINE_RESET_COOKIE } =
  await import("@/lib/safety/help-lines");

const COOKIE = ["sb-127-auth-token"];
const user = { id: "11111111-1111-4111-8111-111111111111" };
const client = (answer: () => Promise<{ data: { user: unknown }; error: unknown }>) =>
  ({ auth: { getUser: vi.fn(answer) } }) as unknown as Parameters<typeof checkSession>[0];

describe("I-R1 checkSession: signed out only when there is no valid session", () => {
  it("no session cookie at all is signed out, without asking the auth server", async () => {
    const asked = client(async () => ({ data: { user }, error: null }));
    expect(await checkSession(asked, ["other-cookie"])).toEqual({ kind: "none" });
    expect(asked.auth.getUser).not.toHaveBeenCalled();
  });

  it("a user is a user; chunked cookies count as a session cookie", async () => {
    const ok = client(async () => ({ data: { user }, error: null }));
    expect(await checkSession(ok, ["sb-127-auth-token.0"])).toEqual({ kind: "user", user });
  });

  it("a missing, invalid or expired session, or a 401 or 403, is signed out", async () => {
    for (const error of [
      { name: "AuthSessionMissingError", message: "Auth session missing!" },
      { name: "AuthApiError", status: 401, code: "bad_jwt" },
      { name: "AuthApiError", status: 403, code: "session_not_found" },
      { name: "AuthApiError", status: 400, code: "session_expired" },
      { name: "AuthApiError", status: 400, code: "refresh_token_not_found" },
    ]) {
      expect(
        await checkSession(
          client(async () => ({ data: { user: null }, error })),
          COOKIE,
        ),
      ).toEqual({ kind: "none" });
    }
  });

  it("a 5xx, a network failure, a transient refresh failure or a throw is an error, not signed out", async () => {
    for (const error of [
      { name: "AuthApiError", status: 500, code: "unexpected_failure" },
      { name: "AuthApiError", status: 503 },
      { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
      { name: "AuthApiError", status: 429, code: "over_request_rate_limit" },
      { name: "AuthApiError", status: 504, code: "request_timeout" },
    ]) {
      expect(
        await checkSession(
          client(async () => ({ data: { user: null }, error })),
          COOKIE,
        ),
      ).toEqual({ kind: "error" });
    }
    const throws = client(async () => {
      throw new TypeError("network down");
    });
    expect(await checkSession(throws, COOKIE)).toEqual({ kind: "error" });
    expect(sessionErrorKind(undefined)).toEqual({ kind: "error" });
  });
});

describe("M-B /auth/callback marks a new session, and the phone copy goes first", () => {
  it("sets the one-time marker only when a code was exchanged", async () => {
    const withCode = await callback(new Request("http://127.0.0.1/auth/callback?code=abc&next=/"));
    expect(withCode.headers.get("set-cookie")).toContain(`${HELP_LINE_RESET_COOKIE}=1`);
    const without = await callback(new Request("http://127.0.0.1/auth/callback?next=/"));
    expect(without.headers.get("set-cookie") ?? "").not.toContain(HELP_LINE_RESET_COOKIE);
    exchange.mockResolvedValueOnce({ error: { message: "bad code" } });
    const failed = await callback(new Request("http://127.0.0.1/auth/callback?code=bad"));
    expect(failed.headers.get("set-cookie") ?? "").not.toContain(HELP_LINE_RESET_COOKIE);
  });

  it("the marker removes the copy once and clears itself", () => {
    const data = new Map([[HELP_LINE_KEY, '{"userId":"a","country":"FR","entry":null}']]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    const doc = { cookie: `other=1; ${HELP_LINE_RESET_COOKIE}=1` };
    expect(consumeHelpLineReset(storage, doc)).toBe(true);
    expect(data.has(HELP_LINE_KEY)).toBe(false);
    expect(doc.cookie).toContain("Max-Age=0");
    data.set(HELP_LINE_KEY, "kept");
    expect(consumeHelpLineReset(storage, { cookie: "other=1" })).toBe(false);
    expect(data.get(HELP_LINE_KEY)).toBe("kept");
  });
});
