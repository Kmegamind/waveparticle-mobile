import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");

function readMigrations() {
  return readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(path.join(migrationsDirectory, name), "utf8"))
    .join("\n");
}

function policyBlock(sql: string, table: string, operation: string) {
  const block = sql
    .split(/(?=create policy)/i)
    .find((candidate) => new RegExp(`on public\\.${table} for ${operation}`, "i").test(candidate));
  expect(block).toBeDefined();
  return block ?? "";
}

describe("first user-data schema migration", () => {
  it("creates the account, goal, step, and session tables", () => {
    const sql = readMigrations();

    expect(sql).toMatch(/create table public\.profiles/i);
    expect(sql).toMatch(/create table public\.goals/i);
    expect(sql).toMatch(/create table public\.steps/i);
    expect(sql).toMatch(/create table public\.sessions/i);
  });

  it("stores user-written Goal and Step text on account-owned rows", () => {
    const sql = readMigrations();

    expect(sql).toMatch(/title text not null/i);
    expect(sql).toMatch(/description text/i);
    expect(sql).toMatch(/user_id uuid not null references auth\.users/i);
  });

  it("enables RLS and account policies for every user-data table", () => {
    const sql = readMigrations();

    for (const table of ["profiles", "goals", "steps", "sessions"]) {
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      );
      expect(sql).toMatch(new RegExp(`create policy[\\s\\S]*on public\\.${table}`, "i"));
      for (const operation of ["select", "insert", "update", "delete"]) {
        expect(policyBlock(sql, table, operation)).toMatch(/auth\.uid\(\)/i);
      }
    }
  });

  it("cascades account deletion through every direct user relationship", () => {
    const sql = readMigrations();

    expect(sql).toMatch(
      /profiles[\s\S]*references auth\.users\s*\(\s*id\s*\)\s*on delete cascade/i,
    );
    expect(sql).toMatch(/goals[\s\S]*references auth\.users\s*\(\s*id\s*\)\s*on delete cascade/i);
    expect(sql).toMatch(
      /sessions[\s\S]*references auth\.users\s*\(\s*id\s*\)\s*on delete cascade/i,
    );
    expect(sql).toMatch(/steps[\s\S]*references public\.goals\s*\(\s*id\s*\)\s*on delete cascade/i);
  });
});
