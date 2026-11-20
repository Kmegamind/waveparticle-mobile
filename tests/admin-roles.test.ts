import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { adminAnswer, isAdminPath, readContentRole } from "@/lib/admin/roles";

// #287: the admin and writer roles, the server-side role check and the admin shell.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261116000000_content_roles.sql";
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const sql = () => readFileSync(path.join(migrations, MIGRATION), "utf8");
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => sql().replace(/--.*$/gm, "");
const fn = (name: string) => {
  const start = code().indexOf(`create function public.${name}()`);
  expect(start).toBeGreaterThanOrEqual(0);
  return code().slice(start, code().indexOf("$$;", start));
};

describe("content roles migration (#287)", () => {
  it("test_287_runs_after_the_prompts_migration", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const prompts = names.indexOf("20261115000000_prompts.sql");
    expect(prompts).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(prompts);
  });

  it("test_287_ac1_a_later_policy_can_call_the_functions_for_every_api_role", () => {
    // A policy without "to authenticated" also runs for anon requests; Postgres checks the execute
    // right when it plans the query, so anon must be able to call them (they answer null or false).
    expect(code()).not.toMatch(/from public, anon;/);
  });

  it("test_287_ac1_creates_the_roles_table_with_admin_and_writer", () => {
    expect(code()).toMatch(/create table public\.content_roles \(/);
    expect(code()).toMatch(
      /user_id uuid primary key references auth\.users \(id\) on delete cascade/,
    );
    expect(code()).toMatch(/role text not null check \(role in \('admin', 'writer'\)\)/);
  });

  it("test_287_ac1_row_level_security_is_on_and_the_api_cannot_reach_the_table", () => {
    expect(code()).toMatch(/alter table public\.content_roles enable row level security;/);
    expect(code()).not.toMatch(/create policy/i);
    expect(code()).toMatch(/revoke all on public\.content_roles from anon, authenticated;/);
  });

  it("test_287_ac1_content_role_is_a_security_definer_function_with_a_fixed_search_path", () => {
    const body = fn("content_role");
    expect(body).toMatch(/returns text/);
    expect(body).toMatch(/stable/);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toMatch(/from public\.content_roles/);
    expect(body).toMatch(/user_id = auth\.uid\(\)/);
    expect(code()).toContain("revoke all on function public.content_role() from public;");
    expect(code()).toContain(
      "grant execute on function public.content_role() to anon, authenticated;",
    );
  });

  it("test_287_ac1_is_content_editor_answers_from_content_role", () => {
    const body = fn("is_content_editor");
    expect(body).toMatch(/returns boolean/);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toMatch(/public\.content_role\(\) is not null/);
    expect(code()).toContain("revoke all on function public.is_content_editor() from public;");
    expect(code()).toContain(
      "grant execute on function public.is_content_editor() to anon, authenticated;",
    );
  });

  it("test_287_ac4_no_service_role_key_is_mentioned", () => {
    expect(sql()).not.toMatch(/service_role|service-role/);
  });
});

describe("server role check (#287)", () => {
  type Rpc = (name: string) => Promise<{ data: unknown; error: unknown }>;
  const clientWith = (rpc: Rpc) => ({ rpc }) as unknown as SupabaseClient;

  it("test_287_ac2_only_admin_and_paths_under_it_are_admin_paths", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/app-text")).toBe(true);
    expect(isAdminPath("/admin/anything/deeper")).toBe(true);
    for (const other of ["/", "/administer", "/admin-notes", "/me", "/auth/sign-in"]) {
      expect(isAdminPath(other)).toBe(false);
    }
  });

  it("test_287_ac4_reads_the_role_through_the_users_own_client", async () => {
    const calls: string[] = [];
    const client = clientWith(async (name) => {
      calls.push(name);
      return { data: "writer", error: null };
    });
    expect(await readContentRole(client)).toBe("writer");
    expect(calls).toEqual(["content_role"]);
    expect(await readContentRole(clientWith(async () => ({ data: "admin", error: null })))).toBe(
      "admin",
    );
  });

  it("test_287_ac4_a_failed_role_read_counts_as_no_role", async () => {
    const answers: Rpc[] = [
      async () => ({ data: null, error: null }),
      async () => ({ data: null, error: { code: "PGRST202", message: "function not found" } }),
      async () => ({ data: "owner", error: null }),
      async () => {
        throw new Error("network");
      },
    ];
    for (const rpc of answers) expect(await readContentRole(clientWith(rpc))).toBeNull();
  });

  it("test_287_ac2_no_user_or_no_role_gets_not_found", () => {
    expect(adminAnswer("/admin", false, null)).toBe("not-found");
    expect(adminAnswer("/admin/app-text", true, null)).toBe("not-found");
  });

  it("test_287_ac3_a_role_passes_and_other_paths_are_untouched", () => {
    expect(adminAnswer("/admin", true, "writer")).toBe("pass");
    expect(adminAnswer("/admin/publish-history", true, "admin")).toBe("pass");
    expect(adminAnswer("/me", false, null)).toBe("pass");
  });

  it("test_287_ac4_the_check_is_server_code_only", () => {
    expect(read("src/lib/admin/roles.ts")).not.toMatch(/["']use client["']/);
    const session = read("src/lib/supabase/session.ts");
    expect(session).toContain("readContentRole");
    expect(session).toContain("adminAnswer");
    // The admin layout checks again on the server.
    expect(read("src/app/admin/layout.tsx")).toMatch(/readContentRole[\s\S]*notFound\(\)/);
  });
});

describe("admin shell (#287)", () => {
  const adminCss = () => {
    const css = read("src/app/globals.css");
    return css.slice(css.indexOf("/* The content admin (issue 287)"));
  };

  it("test_287_ac5_admin_styles_use_tokens_only", () => {
    const css = adminCss();
    expect(css.length).toBeGreaterThan(100);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(css).not.toMatch(/font-family:\s*(?!\s|var\()/);
    // Lengths come from tokens; literal: 1 px and 2 px lines, the DESIGN.md title letter spacing
    // (-0.02em, -0.025em) and the wide-screen breakpoint (a media query cannot read a token).
    for (const length of css.match(/\b\d+(\.\d+)?(px|rem|em|ch)\b/g) ?? []) {
      expect(["1px", "2px", "0.02em", "0.025em", "56.25rem"]).toContain(length);
    }
  });

  it("test_287_ac3_the_menu_follows_the_prototype", () => {
    const shell = read("src/app/admin/admin-shell.tsx");
    for (const text of [
      'aria-label="Admin pages"',
      "WaveParticle",
      "Content admin",
      '"Content"',
      '"Review and logs"',
      '"ADM-07"',
      '"App text"',
      '"ADM-12"',
      '"Publish history"',
      "SignOutButton",
    ]) {
      expect(shell).toContain(text);
    }
  });
});

describe("admin docs (#287)", () => {
  it("test_287_ac6_deploy_says_how_to_give_a_role_with_one_sql_command", () => {
    const deploy = read("docs/deploy.md");
    expect(deploy).toMatch(/## Admin roles/);
    expect(deploy).toMatch(
      /insert into public\.content_roles \(user_id, role\)\s+select id, 'writer' from auth\.users where email = '[^']+'\s+on conflict \(user_id\) do update set role = excluded\.role;/,
    );
    expect(deploy).toMatch(/delete from public\.content_roles/);
  });

  it("test_287_ac6_architecture_lists_the_admin_area", () => {
    const architecture = read("docs/architecture/admin-area.md");
    expect(architecture).toMatch(/^# Admin area\n/);
    expect(architecture).toContain("Path: `src/app/admin/`");
    expect(architecture).toContain("content_roles");
    expect(architecture).toContain("content_role()");
  });

  it("test_287_records_the_roles_decision", () => {
    const decision = read("docs/decisions/0016-content-roles-checked-on-the-server.md");
    expect(decision).toMatch(/Issue: #287/);
    expect(decision).toContain("is_content_editor()");
  });
});
