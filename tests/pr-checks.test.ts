import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  addedMigrationNames,
  checkEnvNamesDocumented,
  checkHumanSteps,
  checkMigrationNames,
  checkNewMigrationsAreLatest,
  envExampleNames,
  envNamesInCode,
  humanStepsSection,
  newEnvNames,
} from "../scripts/pr-checks.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixtureBody = readFileSync(path.join(root, "tests/fixtures/pr-body-human-steps.md"), "utf8");
const template = readFileSync(path.join(root, ".github/pull_request_template.md"), "utf8");
const body = (steps: string) =>
  `Closes #1\n\n## What changed\nX.\n\n## Human steps\n${steps}\n\n## How to test\n- [ ] y\n`;

describe("#189 AC1: the Human steps section", () => {
  it("finds the section up to the next heading and drops HTML comments", () => {
    expect(humanStepsSection(body("<!-- help -->\nNone"))).toBe("None");
    expect(humanStepsSection("Closes #1\n\n## What changed\nX")).toBeNull();
    expect(humanStepsSection("## Human steps\r\n1. [dev] A.\r\n## Next")).toBe("1. [dev] A.");
  });

  it("fails when the section is missing, with a sentence that says what to add", () => {
    const [error] = checkHumanSteps({ body: "Closes #1\n\n## What changed\nX." });
    expect(error).toMatch(/no "## Human steps" section/);
    expect(error).toMatch(/"None"/);
  });

  it("fails when the section is empty or holds only the template comment", () => {
    expect(checkHumanSteps({ body: body("") })[0]).toMatch(/is empty/);
    expect(checkHumanSteps({ body: body("<!-- write here -->") })[0]).toMatch(/is empty/);
  });

  it("fails on the unfilled pull request template", () => {
    expect(humanStepsSection(template)).toBe("");
    expect(checkHumanSteps({ body: template })[0]).toMatch(/is empty/);
  });

  it('passes with "None"', () => {
    expect(checkHumanSteps({ body: body("None") })).toEqual([]);
    expect(checkHumanSteps({ body: body("none.") })).toEqual([]);
  });

  it("passes with numbered steps that each name an environment", () => {
    expect(
      checkHumanSteps({
        body: body(
          "1. [dev] Run the import in the SQL editor.\n2. [prod] Redeploy Production in Vercel.\n3. [dev, prod] Add the redirect URL in Supabase.\n4. [repo] Make the check required in GitHub.",
        ),
      }),
    ).toEqual([]);
  });

  it("fails on text that is neither None nor numbered steps", () => {
    expect(checkHumanSteps({ body: body("Apply the migration please") })[0]).toMatch(
      /no numbered steps/,
    );
  });

  it("fails on a step without an environment tag or with an unknown one", () => {
    const errors = checkHumanSteps({ body: body("1. Apply it.\n2. [staging] B.") });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/does not say where it applies: "1\. Apply it\."/);
  });

  it("passes on the fixture pull request body with its migration and variable", () => {
    expect(
      checkHumanSteps({
        body: fixtureBody,
        addedMigrations: ["20261201000000_example_table.sql"],
        newEnvNames: ["EXAMPLE_WEBHOOK_URL"],
      }),
    ).toEqual([]);
  });
});

describe("#189 AC2: a new migration is listed as Apply to dev, then prod", () => {
  const migration = "20261201000000_example_table.sql";

  it("picks the migration files out of the added paths", () => {
    expect(
      addedMigrationNames([
        "supabase/migrations/" + migration,
        "src/a.ts",
        "supabase/migrations/x/y.sql",
      ]),
    ).toEqual([migration]);
  });

  it('fails when the section says "None"', () => {
    const [error] = checkHumanSteps({ body: body("None"), addedMigrations: [migration] });
    expect(error).toContain(migration);
    expect(error).toContain("Apply to dev, then prod");
  });

  it("fails when no step names the file with the phrase", () => {
    expect(
      checkHumanSteps({
        body: body(`1. [dev, prod] Run ${migration} in the SQL editor.`),
        addedMigrations: [migration],
      })[0],
    ).toMatch(/no human step names it with "Apply to dev, then prod"/);
    expect(
      checkHumanSteps({
        body: body("1. [dev, prod] Apply to dev, then prod: the new file."),
        addedMigrations: [migration],
      }),
    ).toHaveLength(1);
  });

  it("passes when a step names the file with the phrase", () => {
    expect(
      checkHumanSteps({
        body: body(`1. [dev, prod] Apply to dev, then prod: ${migration}.`),
        addedMigrations: [migration],
      }),
    ).toEqual([]);
  });
});

describe("#189 AC2: migration file names are unique and in timestamp order", () => {
  it("accepts every migration file in the repository", () => {
    const names = readdirSync(path.join(root, "supabase/migrations")).filter((n) =>
      n.endsWith(".sql"),
    );
    expect(names.length).toBeGreaterThan(0);
    expect(checkMigrationNames(names)).toEqual([]);
  });

  it("rejects a bad pattern, an impossible date and a shared timestamp", () => {
    const errors = checkMigrationNames([
      "20261106000000_a.sql",
      "20261106000000_b.sql",
      "2026110600_short.sql",
      "20261132000000_bad_day.sql",
      "20261201000000_Upper.sql",
    ]);
    expect(errors).toHaveLength(4);
    expect(errors.join("\n")).toMatch(/share the timestamp 20261106000000/);
    expect(errors.join("\n")).toMatch(/not a real date and time/);
    expect(errors.join("\n")).toMatch(/"2026110600_short\.sql" does not match/);
  });

  it("rejects a new migration that is not later than the newest one on the base branch", () => {
    const base = ["20261106000000_a.sql", "20261128000000_hotlines.sql"];
    expect(checkNewMigrationsAreLatest(base, ["20261129000000_next.sql"])).toEqual([]);
    const [error] = checkNewMigrationsAreLatest(base, ["20261127000000_late.sql"]);
    expect(error).toMatch(/not later than 20261128000000_hotlines\.sql/);
    expect(checkNewMigrationsAreLatest([], ["20261127000000_x.sql"])).toEqual([]);
  });
});

describe("#189 AC4: a new environment variable is named everywhere", () => {
  it("reads variable names from code and from .env.example, never values", () => {
    expect([
      ...envNamesInCode(
        'a = process.env.FOO_BAR; b = process.env["BAZ"]; c = process.env.lower; d = env.QUX',
      ),
    ]).toEqual(["FOO_BAR", "BAZ", "QUX"]);
    expect([
      ...envExampleNames("# c\nFOO=\nexport BAR=secret-looking\n  BAZ = x\nnot a line"),
    ]).toEqual(["FOO", "BAR", "BAZ"]);
  });

  it("finds names the change adds to src or to .env.example, not ones the base already read", () => {
    const srcDiff = [
      "+++ b/src/x.ts",
      "+const a = process.env.NEW_ONE;",
      "+const b = process.env.OLD_ONE;",
      "-const c = process.env.GONE;",
    ].join("\n");
    expect(
      newEnvNames({
        srcDiff,
        baseCodeNames: new Set(["OLD_ONE"]),
        baseExample: "OLD_ONE=\n",
        headExample: "OLD_ONE=\nNEW_ONE=\nFROM_EXAMPLE=\n",
      }),
    ).toEqual(["FROM_EXAMPLE", "NEW_ONE"]);
  });

  it("requires the name in .env.example and in docs/deploy.md", () => {
    const errors = checkEnvNamesDocumented(["NEW_ONE"], {
      headExample: "OTHER=\n",
      deployDoc: "nothing",
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/not in \.env\.example/);
    expect(errors[1]).toMatch(/not in docs\/deploy\.md/);
    expect(
      checkEnvNamesDocumented(["NEW_ONE"], {
        headExample: "NEW_ONE=\n",
        deployDoc: "| `NEW_ONE` | Production |",
      }),
    ).toEqual([]);
  });

  it("requires a human step that names the variable and its Vercel scopes", () => {
    expect(checkHumanSteps({ body: body("None"), newEnvNames: ["NEW_ONE"] })[0]).toMatch(
      /adds the environment variable NEW_ONE/,
    );
    expect(
      checkHumanSteps({
        body: body("1. [prod] Redeploy Production in Vercel."),
        newEnvNames: ["NEW_ONE"],
      })[0],
    ).toMatch(/no human step names it/);
    expect(
      checkHumanSteps({
        body: body("1. [prod] Add NEW_ONE in Vercel settings."),
        newEnvNames: ["NEW_ONE"],
      })[0],
    ).toMatch(/does not name its Vercel scopes/);
    expect(
      checkHumanSteps({
        body: body("1. [prod] Add NEW_ONE in Vercel, scope Production."),
        newEnvNames: ["NEW_ONE"],
      }),
    ).toEqual([]);
  });
});

describe("#189 review I1: placeholder steps fail", () => {
  it.each([
    ["1. [dev] x", /fewer than 4 words/],
    ["1. [repo] TBD", /placeholder/],
    ["1. [repo] TODO", /placeholder/],
    ["1. [dev] TODO: write the real steps later", /placeholder/],
    ["1. [prod] ...", /placeholder/],
    ["1. [dev, prod] N/A for this change really", /placeholder/],
    ["1. [repo] None", /"None" cannot be a step in a list/],
    ["1. [dev, prod] What to do. Where to do it.", /is the example/],
    [
      "1. [dev, prod] Apply to dev, then prod: 20261201000000_my_change.sql (docs/HUMAN_STEPS.md, Apply migrations).",
      /is the example/,
    ],
    [
      "2. [prod] Add MY_SETTING in Vercel, scopes Production and Preview, server only (no NEXT_PUBLIC_ prefix), then redeploy.",
      /is the example/,
    ],
    ["1. [dev] Do it now", /fewer than 4 words/],
  ])("rejects %j", (step, reason) => {
    const errors = checkHumanSteps({ body: body(step) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/is not a real step/);
    expect(errors[0]).toMatch(reason);
  });

  it("rejects the example the error message itself suggests", () => {
    const [missing] = checkHumanSteps({ body: "Closes #1" });
    const example = missing.match(/for example "([^"]+)"/)![1];
    expect(checkHumanSteps({ body: body(example) })[0]).toMatch(/is the example/);
  });

  it("accepts a short real step of four words", () => {
    expect(checkHumanSteps({ body: body("1. [prod] Redeploy Production in Vercel.") })).toEqual([]);
  });
});

describe("#189 review I2: a section the reader cannot see does not count", () => {
  it("ignores a Human steps heading inside an HTML comment", () => {
    const hidden =
      "Closes #1\n\n<!--\n## Human steps\n1. [repo] Paste the text into AGENTS.md now.\n-->\n";
    expect(humanStepsSection(hidden)).toBeNull();
    expect(checkHumanSteps({ body: hidden })[0]).toMatch(/no "## Human steps" section/);
  });

  it("ignores a Human steps heading inside a code fence", () => {
    const fenced = "Closes #1\n\n```md\n## Human steps\nNone\n```\n";
    expect(humanStepsSection(fenced)).toBeNull();
    expect(checkHumanSteps({ body: fenced })[0]).toMatch(/no "## Human steps" section/);
  });

  it("ignores steps written only inside a comment under the heading", () => {
    expect(
      checkHumanSteps({
        body: body("<!--\n1. [dev] Apply the migration in the SQL editor.\n-->"),
      })[0],
    ).toMatch(/is empty/);
  });
});

describe("#189 review M4: a migration step is tagged [dev, prod]", () => {
  const migration = "20261201000000_example_table.sql";
  it.each(["[repo]", "[dev]", "[prod]"])("rejects a migration step tagged %s", (tag) => {
    const [error] = checkHumanSteps({
      body: body(`1. ${tag} Apply to dev, then prod: ${migration}.`),
      addedMigrations: [migration],
    });
    expect(error).toMatch(/must be tagged \[dev, prod\]/);
  });
});

describe("#189 the check-pr command in a scratch git repository", () => {
  function repo() {
    const dir = mkdtempSync(path.join(tmpdir(), "check-pr-"));
    const run = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
    const write = (file: string, text: string) => {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    };
    run("init", "-q", "-b", "main");
    run("config", "user.email", "test@example.com");
    run("config", "user.name", "Test");
    write("supabase/migrations/20261106000000_first.sql", "create table public.a (id int);\n");
    write("src/a.ts", "export const a = process.env.OLD_ONE;\n");
    write("docs/deploy.md", "# Deploy\n");
    write(".env.example", "OLD_ONE=\n");
    run("add", ".");
    run("commit", "-q", "-m", "base");
    run("checkout", "-q", "-b", "feature");
    return { dir, run, write };
  }
  const checkPr = (dir: string, prBody: string) =>
    spawnSync(process.execPath, [path.join(root, "scripts/check-pr.mjs")], {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        BASE_REF: "main",
        BODY: prBody,
      } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });

  it("passes a pull request that adds nothing a human must do, with None", () => {
    const { dir, run, write } = repo();
    write("src/b.ts", "export const b = 1;\n");
    run("add", ".");
    run("commit", "-q", "-m", "b");
    const result = checkPr(dir, body("None"));
    expect(result.stdout).toMatch(/^OK: /);
    expect(result.status).toBe(0);
  });

  it("fails a pull request that adds a migration and a variable but says None, naming both", () => {
    const { dir, run, write } = repo();
    write(
      "supabase/migrations/20261201000000_example_table.sql",
      "create table public.b (id int);\n",
    );
    write("src/b.ts", "export const b = process.env.EXAMPLE_WEBHOOK_URL;\n");
    run("add", ".");
    run("commit", "-q", "-m", "b");
    const result = checkPr(dir, body("None"));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("20261201000000_example_table.sql");
    expect(result.stdout).toMatch(
      /EXAMPLE_WEBHOOK_URL is read in src\/ but is not in \.env\.example/,
    );
    expect(result.stdout).toMatch(/EXAMPLE_WEBHOOK_URL is not in docs\/deploy\.md/);
  });

  it("passes the same pull request once the fixture body and the docs name both", () => {
    const { dir, run, write } = repo();
    write(
      "supabase/migrations/20261201000000_example_table.sql",
      "create table public.b (id int);\n",
    );
    write("src/b.ts", "export const b = process.env.EXAMPLE_WEBHOOK_URL;\n");
    write(".env.example", "OLD_ONE=\nEXAMPLE_WEBHOOK_URL=\n");
    write("docs/deploy.md", "# Deploy\n| `EXAMPLE_WEBHOOK_URL` | Production, Preview | no |\n");
    run("add", ".");
    run("commit", "-q", "-m", "b");
    const result = checkPr(dir, fixtureBody);
    expect(result.stdout).toMatch(/^OK: .*1 new migration\(s\), 1 new environment variable\(s\)/);
    expect(result.status).toBe(0);
  });

  it("counts a renamed migration as a new one (review M5)", () => {
    const { dir, run } = repo();
    run(
      "mv",
      "supabase/migrations/20261106000000_first.sql",
      "supabase/migrations/20261201000000_first.sql",
    );
    run("commit", "-q", "-m", "rename");
    const result = checkPr(dir, body("None"));
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/adds the migration 20261201000000_first\.sql/);
  });

  it("says in one sentence when the change cannot be compared with the base", () => {
    const { dir } = repo();
    const result = spawnSync(process.execPath, [path.join(root, "scripts/check-pr.mjs")], {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        BASE_REF: "no-such-branch",
        BODY: body("None"),
      } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(
      /^FAIL: This pull request's change could not be compared with no-such-branch\. If it has merge conflicts, merge origin\/main/,
    );
  });

  it("fails a migration that sorts before the newest one on the base branch", () => {
    const { dir, run, write } = repo();
    write("supabase/migrations/20261101000000_early.sql", "select 1;\n");
    run("add", ".");
    run("commit", "-q", "-m", "b");
    const result = checkPr(
      dir,
      body("1. [dev, prod] Apply to dev, then prod: 20261101000000_early.sql."),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/is not later than 20261106000000_first\.sql/);
  });
});
