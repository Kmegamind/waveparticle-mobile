import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("#189 AC1: the template and the CI job", () => {
  it("puts a Human steps section with its rule in the pull request template", () => {
    const template = read(".github/pull_request_template.md");
    expect(template).toMatch(/^## Human steps$/m);
    expect(template).toContain("None");
    expect(template).toContain("Apply to dev, then prod");
    expect(template).toContain("docs/HUMAN_STEPS.md");
    expect(template).toMatch(/NEXT_PUBLIC_/);
    expect(template).toMatch(/Production[\s\S]*Preview/);
  });

  it("runs the check in a pull request job with the same Dependabot exemption as pr-closes-issue", () => {
    const ci = read(".github/workflows/ci.yml");
    const job = ci.slice(ci.indexOf("  pr-human-steps:"));
    expect(job).toContain(
      "if: github.event_name == 'pull_request' && github.event.pull_request.user.login != 'dependabot[bot]'",
    );
    expect(job).toMatch(/fetch-depth: 0/);
    expect(job).toMatch(/BODY: \$\{\{ github\.event\.pull_request\.body \}\}/);
    expect(job).toContain("BASE_REF: HEAD^1");
    expect(job).toMatch(
      /if: \$\{\{ failure\(\) \}\}\n\s+run: echo "::error::The pull request could not be checked out[^"]*merge conflicts/,
    );
    expect(job).toContain("run: npm run check:pr");
    expect(ci).toMatch(/types: \[opened, edited, synchronize, reopened\]/);
  });

  it("names the scripts in package.json", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts["check:pr"]).toBe("node scripts/check-pr.mjs");
    expect(scripts["check:deploy"]).toBe("node scripts/check-deploy.mjs");
  });
});

describe("#189 AC3: documented migration commands", () => {
  const steps = read("docs/HUMAN_STEPS.md");

  it("documents link once, then db push, for dev and for prod", () => {
    const dev = steps.slice(steps.indexOf("### Dev:"), steps.indexOf("### Prod:"));
    const prod = steps.slice(steps.indexOf("### Prod:"), steps.indexOf("## Add or change"));
    for (const part of [dev, prod]) {
      expect(part).toMatch(/supabase link --project-ref <(dev|prod) ref>/);
      expect(part).toContain("supabase db push");
    }
    expect(prod).toMatch(/product owner only/);
    expect(prod).toMatch(
      /Agents never run `supabase link`, `supabase db push`, `supabase db reset` or\s+`supabase migration repair`, for dev or prod/,
    );
    for (const part of [dev, prod]) expect(part).toContain("cat supabase/.temp/project-ref");
  });

  it("links right before every push and checks the link (review I3)", () => {
    const before = steps.slice(steps.indexOf("### Before every push"), steps.indexOf("### Dev:"));
    expect(before).toMatch(/Never rely on the last link/);
    expect(before).toContain("supabase link --project-ref <ref>");
    expect(before).toContain("cat supabase/.temp/project-ref");
    expect(steps).not.toMatch(/link back to dev/);
  });

  it("confirms each migration with SQL before the repair (review I4)", () => {
    const repair = steps.slice(
      steps.indexOf("### One-time setup (per project)"),
      steps.indexOf("### Before every push"),
    );
    for (const catalog of [
      "pg_tables",
      "pg_proc",
      "pg_trigger",
      "pg_policies",
      "supabase_migrations.schema_migrations",
    ]) {
      expect(repair).toContain(catalog);
    }
    expect(repair).toMatch(/A tables-only check such as `npm run check:deploy` is not enough/);
    expect(repair).not.toMatch(/`npm run check:deploy` against that environment/);
  });

  it("covers the migrations applied by hand before the first push", () => {
    expect(steps).toContain(
      "supabase migration repair --status applied 20261106000000 20261106120000",
    );
  });

  it("says who logs in and where the token and password live, never in the repository", () => {
    expect(steps).toMatch(/## Who logs in, and where the tokens live/);
    expect(steps).toMatch(/supabase login[\s\S]*keychain/);
    expect(steps).toMatch(/never written to the repository/);
    expect(steps).toMatch(/Database password[\s\S]*password manager/);
  });

  it("gives the CLI a config file that holds no secret", () => {
    const config = read("supabase/config.toml");
    expect(config).toMatch(/^project_id = "waveparticle-mobile"$/m);
    const settings = config.split("\n").filter((line) => line.trim() && !line.startsWith("#"));
    expect(settings).toEqual(['project_id = "waveparticle-mobile"']);
  });
});

describe("#189 AC4: environment variables in docs/deploy.md", () => {
  const deploy = read("docs/deploy.md");
  const table = deploy.slice(
    deploy.indexOf("## Environment variables"),
    deploy.indexOf("## Database migrations"),
  );
  const rows = table.split("\n").filter((line) => /^\| `[A-Z]/.test(line));

  it("lists each variable with its Vercel scopes and whether it may be public", () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      const [, name, scopes, isPublic] = row.split("|").map((cell) => cell.trim());
      expect(scopes, name).toMatch(/Production|Preview/);
      expect(isPublic, name).toBe(name.startsWith("`NEXT_PUBLIC_") ? "yes" : "no");
    }
  });

  it("names every variable the code reads by a string name", () => {
    for (const name of [
      "MODEL_CALL_LIMIT_ENABLED",
      "GOAL_DIALOGUE_SECRET",
      "CONTENT_READ_KEY",
      "PROMPTS_READ_TOKEN",
      "SAFETY_ALARM_WEBHOOK_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]) {
      expect(table).toContain(`| \`${name}\` |`);
    }
  });
});

describe("#189 AC5: the post-deploy check is documented", () => {
  it("names the command, its settings and --skip-db", () => {
    const steps = read("docs/HUMAN_STEPS.md");
    expect(steps).toMatch(/## Run the post-deploy check/);
    for (const word of [
      "E2E_BASE_URL",
      "SUPABASE_PROJECT_REF",
      "SUPABASE_ACCESS_TOKEN",
      "VERCEL_AUTOMATION_BYPASS_SECRET",
      "x-vercel-protection-bypass",
      "**Deployment Protection** → **Protection Bypass",
      "--skip-db",
    ]) {
      expect(steps).toContain(word);
    }
    expect(read("docs/deploy.md")).toContain("npm run check:deploy");
  });
});

describe("#189 AC6: docs/HUMAN_STEPS.md lists every recurring human task", () => {
  const steps = read("docs/HUMAN_STEPS.md");

  it.each([
    ["## Apply migrations", /SQL Editor/],
    ["## Add or change an environment variable", /Settings\*\* → \*\*Environment Variables/],
    ["## Add a redirect URL in Supabase", /Authentication\*\* → \*\*URL Configuration/],
    ["## Rotate a key", /API Keys/],
    ["## Merge a pull request", /Merge pull request/],
    ["## Redeploy", /Deployments\*\*/],
  ])("has %s with its click path", (heading, clickPath) => {
    const start = steps.indexOf(heading);
    expect(start, heading).toBeGreaterThan(-1);
    const end = steps.indexOf("\n## ", start + 1);
    expect(steps.slice(start, end === -1 ? undefined : end)).toMatch(clickPath);
  });

  it("tells agents not to guess a manual step", () => {
    expect(steps).toMatch(/never guess one/);
    expect(steps).toMatch(/stops and asks a human/);
  });

  describe("#449 Open now after the owner's 2026-11-25 production steps", () => {
    const section = steps.slice(
      steps.indexOf("## Open now (2026-11-25)"),
      steps.indexOf("## Apply migrations"),
    );
    const open = section.slice(0, section.indexOf("### Later, by owner decision"));
    const later = section.slice(
      section.indexOf("### Later, by owner decision"),
      section.indexOf("### Done"),
    );
    const done = section.slice(section.indexOf("### Done"));

    it("has the dated section with open, later and done parts in that order", () => {
      expect(steps).toContain("## Open now (2026-11-25)");
      expect(steps).not.toContain("## Open now (2026-11-24)");
      expect(open.length).toBeGreaterThan(0);
      expect(later.length).toBeGreaterThan(0);
      expect(done.length).toBeGreaterThan(0);
    });

    it("pins the exact lists: one open step, one later step, five done steps", () => {
      const items = (part: string, marker: RegExp) =>
        part.split("\n").filter((line) => marker.test(line));
      const expectExactly = (lines: string[], prefixes: string[]) => {
        expect(lines).toHaveLength(prefixes.length);
        prefixes.forEach((prefix, i) => expect(lines[i].startsWith(prefix), lines[i]).toBe(true));
      };
      expectExactly(items(open, /^\d+\. /), [
        "1. **[dev, prod] Confirm that three migrations ran: `20261126000000_prompt_activated_at.sql`,",
      ]);
      expectExactly(items(later, /^- /), [
        "- **[prod] Fix the published story cards that fail the checks**",
      ]);
      expectExactly(items(done, /^- /), [
        "- 2026-11-25: applied `supabase/migrations/20261128000000_hotlines.sql`",
        "- 2026-11-25: prompt import",
        "- 2026-11-25: applied `supabase/migrations/20261130000000_ai_features.sql`",
        "- 2026-11-25: ran the `ai_features` seed",
        "- Before 2026-11-25 (date not recorded): set `MODEL_CALL_LIMIT_ENABLED` to `0`",
      ]);
    });

    it("no longer lists the steps the owner ran as open", () => {
      expect(open).not.toContain("20261128000000_hotlines.sql");
      expect(open).not.toContain("20261130000000_ai_features.sql");
      expect(open).not.toContain("MODEL_CALL_LIMIT_ENABLED");
      expect(open).not.toMatch(/Publish `plan_split` version 2/);
    });

    it("moves them to done with the date and the owner's check results", () => {
      expect(done).toMatch(
        /2026-11-25: applied `supabase\/migrations\/20261128000000_hotlines\.sql`/,
      );
      expect(done).toMatch(/returned 1, the US entry \(988\)/);
      for (const prompt of [
        "pause_predicament",
        "plan_split",
        "rest_reply",
        "retry_hints",
        "safety_classifier",
        "stuck_story",
      ]) {
        expect(done).toContain(`\`${prompt}\``);
      }
      expect(done).toMatch(/`return_popup`, `step_cards` and `closing_line` were left untouched/);
      expect(done).toMatch(
        /2026-11-25: applied `supabase\/migrations\/20261130000000_ai_features\.sql`/,
      );
      expect(done).toMatch(/`ai_features` seed[\s\S]*7\s+rows/);
      expect(done).toMatch(/MODEL_CALL_LIMIT_ENABLED` to `0` in Vercel, scope\s+Production/);
    });

    it("marks the card fix (#377) Later by owner decision", () => {
      expect(later).toMatch(/#377, #46/);
      expect(later).toMatch(/Later, by owner\s+decision/);
      expect(open).not.toMatch(/#377/);
    });

    it.each([
      ["20261126000000_prompt_activated_at.sql", "prompts_fill_activated_at"],
      ["20261127000000_safety_alarm_days.sql", "private.safety_alarm_days"],
      ["20261129000000_research_conditions.sql", "sessions_keep_story_off_at"],
    ])("keeps %s open with a read-only check query", (file, object) => {
      expect(open).toContain(file);
      expect(open).toContain(object);
    });

    it("uses only read-only SELECT queries in the open steps", () => {
      const queries = [...open.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
      expect(queries).toHaveLength(3);
      for (const query of queries) {
        expect(query.trim()).toMatch(/^select\b/i);
        expect(query).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate|grant)\b/i);
      }
    });
  });
});
