import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/me/delete-account/actions", () => ({
  deleteAccountAction: async () => ({ status: "failed" }),
}));

const { deleteAccount, signInNotice, DELETED_NOTICE } =
  await import("@/lib/account/delete-account");
const { DeleteAccountScreen } = await import("@/app/me/delete-account/delete-account-screen");

// #103 AC2 AC3 and #8 AC3: "Delete my data" removes the account and everything in it.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const MIGRATION = "supabase/migrations/20261114120000_delete_my_account.sql";
const TABLES = ["session_lines", "session_steps", "sessions", "steps", "goals", "profiles"];

describe("#103 AC2 the database removes the caller's rows and sign-in user", () => {
  const sql = read(MIGRATION).toLowerCase();

  it("defines delete_my_account() as security definer with an empty search path", () => {
    expect(sql).toContain("create or replace function public.delete_my_account()");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
  });

  it("deletes the caller's rows from all six tables, then the auth user", () => {
    const auth = sql.indexOf("delete from auth.users where id = uid");
    expect(auth).toBeGreaterThan(0);
    for (const table of TABLES) {
      const at = sql.indexOf(`delete from public.${table}`);
      expect(at, table).toBeGreaterThan(0);
      expect(at, `${table} before auth.users`).toBeLessThan(auth);
    }
    expect(sql).toContain("uid uuid := auth.uid()");
    expect(sql).toMatch(/if uid is null then\s+raise exception/);
  });

  it("only signed-in users may call it", () => {
    expect(sql).toContain("revoke all on function public.delete_my_account() from public, anon");
    expect(sql).toContain("grant execute on function public.delete_my_account() to authenticated");
  });
});

describe("#103 AC2 AC3 deleteAccount", () => {
  it("refuses a signed-out caller and never calls the database", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const signOut = vi.fn(async () => undefined);
    await expect(deleteAccount({ userId: null, rpc, signOut })).resolves.toEqual({
      status: "signed-out",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps the user signed in when the database refuses", async () => {
    const signOut = vi.fn(async () => undefined);
    const outcome = await deleteAccount({
      userId: "u",
      rpc: async () => ({ error: { message: "function does not exist" } }),
      signOut,
    });
    expect(outcome).toEqual({ status: "failed" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out after the account is deleted", async () => {
    const calls: string[] = [];
    const outcome = await deleteAccount({
      userId: "u",
      rpc: async () => {
        calls.push("rpc");
        return { error: null };
      },
      signOut: async () => {
        calls.push("signOut");
      },
    });
    expect(outcome).toEqual({ status: "deleted" });
    expect(calls).toEqual(["rpc", "signOut"]);
  });

  it("counts the account as deleted even if signing out then fails", async () => {
    const outcome = await deleteAccount({
      userId: "u",
      rpc: async () => ({ error: null }),
      signOut: async () => {
        throw new Error("network");
      },
    });
    expect(outcome).toEqual({ status: "deleted" });
  });
});

describe("#103 AC3 the deletion is confirmed in plain words", () => {
  it("sign-in shows the confirmation after a deletion", () => {
    expect(DELETED_NOTICE).toBe("Your account and your data are deleted.");
    expect(signInNotice({ deleted: "1" })).toBe(DELETED_NOTICE);
    expect(signInNotice({ error: "confirmation_failed" })).toBe("This link is invalid or expired.");
    expect(signInNotice({})).toBeUndefined();
    expect(read("src/app/auth/sign-in/page.tsx")).toContain("signInNotice(");
  });
});

describe("#103 AC2 ACCOUNT-DELETE asks on its own screen", () => {
  const html = renderToStaticMarkup(createElement(DeleteAccountScreen));

  it("shows the prototype card with Keep my account first", () => {
    expect(html).toContain("Delete your account");
    // Review: the sign-in and hosting services keep their own records, so not "everything".
    expect(html).toContain("This deletes your account and the data in it");
    expect(html).not.toContain("everything in it");
    expect(html).toMatch(/href="\/me\/data"[^>]*>Keep my account</);
    expect(html).toMatch(/<button[^>]*>Delete account</);
    expect(html.indexOf("Keep my account")).toBeLessThan(html.indexOf("Delete account<"));
  });

  it("the page needs a signed-in user and hides the tab bar", () => {
    const page = read("src/app/me/delete-account/page.tsx");
    expect(page).toContain('redirect("/auth/sign-in")');
    expect(page).toContain("app-screen");
    // The back link's name matches what it shows (WCAG 2.5.3).
    expect(page).toContain('aria-label="Back to Data"');
    expect(page).toMatch(/className="focus-label">Data</);
    expect(html).toMatch(/<h1[^>]*>Delete your account</);
  });
});
