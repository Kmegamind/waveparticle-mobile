// The "Human steps" pull request check (#189), run by the CI job pr-human-steps.
// Reads the pull request body from BODY and compares HEAD with BASE_REF (default origin/main).
// Prints one plain sentence per problem and exits 1, or prints OK and exits 0.
// Never prints a value of a setting: .env.example is read for its names only.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  addedMigrationNames,
  checkEnvNamesDocumented,
  checkHumanSteps,
  checkMigrationNames,
  checkNewMigrationsAreLatest,
  envNamesInCode,
  newEnvNames,
} from "./pr-checks.mjs";

const base = process.env.BASE_REF || "origin/main";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });
const gitOrEmpty = (...args) => {
  try {
    return git(...args);
  } catch {
    return "";
  }
};
const lines = (text) => text.split("\n").filter(Boolean);
const readOrEmpty = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");

const addedPaths = lines(git("diff", "--name-only", "--diff-filter=A", `${base}...HEAD`));
const addedMigrations = addedMigrationNames(addedPaths);
const headMigrations = existsSync("supabase/migrations")
  ? readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"))
  : [];
const baseMigrations = lines(
  gitOrEmpty("ls-tree", "--name-only", `${base}`, "supabase/migrations/"),
)
  .map((p) => p.replace(/^supabase\/migrations\//, ""))
  .filter((name) => name.endsWith(".sql"));

const srcDiff = git("diff", "-U0", `${base}...HEAD`, "--", "src");
const baseCodeNames = envNamesInCode(gitOrEmpty("grep", "-hF", "env", base, "--", "src"));
const baseExample = gitOrEmpty("show", `${base}:.env.example`);
const headExample = readOrEmpty(".env.example");
const envNames = newEnvNames({ srcDiff, baseCodeNames, baseExample, headExample });

const errors = [
  ...checkMigrationNames(headMigrations),
  ...checkNewMigrationsAreLatest(baseMigrations, addedMigrations),
  ...checkHumanSteps({ body: process.env.BODY ?? "", addedMigrations, newEnvNames: envNames }),
  ...checkEnvNamesDocumented(envNames, { headExample, deployDoc: readOrEmpty("docs/deploy.md") }),
];

const prefix = process.env.GITHUB_ACTIONS ? "::error::" : "FAIL: ";
for (const error of errors) console.log(`${prefix}${error}`);
if (errors.length === 0) {
  console.log(
    `OK: Human steps section is filled in (${addedMigrations.length} new migration(s), ${envNames.length} new environment variable(s)).`,
  );
}
process.exit(errors.length === 0 ? 0 : 1);
