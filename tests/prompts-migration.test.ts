import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.join(import.meta.dirname, "..", "supabase", "migrations");
const name = "20261115000000_prompts.sql";
const sql = () => readFileSync(path.join(directory, name), "utf8");
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => sql().replace(/--.*$/gm, "");

describe("prompts migration (#282)", () => {
  it("test_282_is_the_latest_migration", () => {
    const names = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.at(-1)).toBe(name);
  });

  it("test_282_creates_the_table_with_key_version_active_body_and_params", () => {
    expect(code()).toMatch(/create table public\.prompts \(/);
    for (const column of [
      "key text",
      "version integer",
      "active boolean",
      "body text",
      "params jsonb",
    ]) {
      expect(code()).toContain(column);
    }
    expect(code()).toMatch(/primary key \(key, version\)/);
  });

  it("test_282_allows_at_most_one_active_version_per_key", () => {
    expect(code()).toMatch(
      /create unique index prompts_one_active_per_key\s+on public\.prompts \(key\) where active;/,
    );
  });

  it("test_282_row_level_security_is_on_with_no_policy_so_the_api_cannot_read_it", () => {
    expect(code()).toMatch(/alter table public\.prompts enable row level security;/);
    expect(code()).not.toMatch(/create policy/i);
    expect(code()).toMatch(/revoke all on public\.prompts from anon, authenticated;/);
  });

  it("test_282_the_reader_hash_lives_in_a_private_schema_the_api_cannot_reach", () => {
    expect(code()).toMatch(/create schema if not exists private;/);
    expect(code()).toMatch(/create table private\.prompt_reader \(/);
    expect(code()).toMatch(/revoke all on schema private from public, anon, authenticated;/);
  });

  it("test_282_the_server_reads_through_a_token_checked_security_definer_function", () => {
    const fn = code().slice(code().indexOf("create function public.get_active_prompts"));
    expect(fn).toMatch(/security definer/);
    expect(fn).toMatch(/set search_path = ''/);
    expect(fn).toMatch(/sha256\(convert_to\(reader_token, 'UTF8'\)\)/);
    expect(fn).toMatch(/where p\.active/);
    expect(code()).toMatch(
      /revoke all on function public\.get_active_prompts\(text\) from public;/,
    );
    expect(code()).toMatch(
      /grant execute on function public\.get_active_prompts\(text\) to anon, authenticated;/,
    );
  });

  it("test_282_import_and_activate_are_for_the_owner_only", () => {
    for (const fn of ["import_prompt(text, text, jsonb, text)", "activate_prompt(text, integer)"]) {
      expect(code()).toContain(
        `revoke all on function public.${fn} from public, anon, authenticated;`,
      );
    }
  });

  it("test_282_no_service_role_key_is_mentioned", () => {
    expect(sql()).not.toMatch(/service_role|service-role/);
  });
});
