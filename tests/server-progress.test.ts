import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
const firstMigration = "20261106000000_create_user_data_schema.sql";
const progressMigration = "20261106120000_save_server_progress.sql";

function migrationNames() {
  return readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function readMigration(name: string) {
  return readFileSync(path.join(migrationsDirectory, name), "utf8");
}

describe("US-ACC-2 server progress migration", () => {
  it("adds one later migration and does not edit the first user-data migration", () => {
    const names = migrationNames();

    expect(names.indexOf(progressMigration)).toBeGreaterThan(names.indexOf(firstMigration));
    expect(readMigration(firstMigration)).not.toMatch(
      /session_steps|session_lines|companion_id|background_card/,
    );
    expect(names.filter((name) => name.includes("save_server_progress"))).toEqual([
      progressMigration,
    ]);
  });

  it("backfills sessions before the new story columns become required", () => {
    const sql = readMigration(progressMigration);
    const updateAt = sql.toLowerCase().indexOf("update public.sessions");
    const companionRequired = sql.toLowerCase().indexOf("alter column companion_id set not null");
    const storyRequired = sql.toLowerCase().indexOf("alter column story_id set not null");

    expect(sql).toMatch(/add column companion_id text/i);
    expect(sql).toMatch(/add column story_id text/i);
    expect(sql).toMatch(/companion_id = 'unassigned'/i);
    expect(sql).toMatch(/story_id = 'unassigned'/i);
    expect(updateAt).toBeGreaterThan(-1);
    expect(companionRequired).toBeGreaterThan(updateAt);
    expect(storyRequired).toBeGreaterThan(updateAt);
    expect(sql).not.toMatch(/companion_id text[\s\S]{0,40}references/i);
    expect(sql).not.toMatch(/story_id text[\s\S]{0,40}references/i);
    expect(sql).toMatch(/background_card text/i);
    expect(sql).toMatch(/background_card_source text/i);
    expect(sql).toMatch(/background_card_source in \('authored', 'generated'\)/i);
    expect(sql).toMatch(/merged_key_moments jsonb/i);
    expect(sql).toMatch(/closing_line text/i);
    expect(sql).toMatch(
      /create unique index[\s\S]*on public\.sessions \(goal_id\)[\s\S]*where state = 'open'/i,
    );
  });

  it("creates session steps and cascades them from the session and the step", () => {
    const sql = readMigration(progressMigration);

    expect(sql).toMatch(/create table public\.session_steps/i);
    expect(sql).toMatch(
      /session_id uuid not null references public\.sessions \(id\) on delete cascade/i,
    );
    expect(sql).toMatch(/step_id uuid not null references public\.steps \(id\) on delete cascade/i);
    expect(sql).toMatch(/position integer not null/i);
    expect(sql).toMatch(/opened_at timestamptz/i);
    expect(sql).toMatch(/done_at timestamptz/i);
    expect(sql).not.toMatch(/done_at timestamptz not null/i);
    expect(sql).toMatch(/unique \(session_id, position\)/i);
    expect(sql).toMatch(/alter table public\.session_steps enable row level security/i);
    expect(sql).toMatch(
      /on public\.session_steps for select[\s\S]*sessions\.user_id = auth\.uid\(\)/i,
    );
    expect(sql).toMatch(
      /on public\.session_steps for insert[\s\S]*sessions\.user_id = auth\.uid\(\)/i,
    );
    expect(sql).toMatch(
      /on public\.session_steps for update[\s\S]*sessions\.user_id = auth\.uid\(\)/i,
    );
    expect(sql).toMatch(
      /on public\.session_steps for delete[\s\S]*sessions\.user_id = auth\.uid\(\)/i,
    );
  });

  it("stores shown lines with insert and select policies only", () => {
    const sql = readMigration(progressMigration);

    expect(sql).toMatch(/create table public\.session_lines/i);
    expect(sql).toMatch(
      /session_step_id uuid references public\.session_steps \(id\) on delete cascade/i,
    );
    expect(sql).toMatch(/seq integer not null/i);
    expect(sql).toMatch(
      /kind in \('background', 'story_card', 'pause_message', 'return_popup', 'closing'\)/i,
    );
    expect(sql).toMatch(/card_id text/i);
    expect(sql).not.toMatch(/card_id text not null/i);
    expect(sql).toMatch(/source in \('authored', 'generated'\)/i);
    expect(sql).toMatch(/text text not null/i);
    expect(sql).toMatch(/pause_number integer/i);
    expect(sql).toMatch(/kind = 'pause_message'/i);
    expect(sql).toMatch(/shown_at timestamptz not null/i);
    expect(sql).toMatch(/alter table public\.session_lines enable row level security/i);
    expect(sql).toMatch(
      /on public\.session_lines for select[\s\S]*sessions\.user_id = auth\.uid\(\)/i,
    );
    expect(sql).toMatch(
      /on public\.session_lines for insert[\s\S]*sessions\.user_id = auth\.uid\(\)/i,
    );
    expect(sql).not.toMatch(/on public\.session_lines for update/i);
    expect(sql).not.toMatch(/on public\.session_lines for delete/i);
    expect(sql).not.toMatch(
      /create table public\.(plans|story_progress|pauses|return_events|cards_seen)/i,
    );
  });
});
