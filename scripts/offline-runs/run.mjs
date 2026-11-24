// Offline runs with the real prompts (#42, US-AI-12). Turns the flags into OFFLINE_RUN_* settings
// and starts the runner (scripts/offline-runs/runner.offline.ts) through vitest, which resolves the
// app's TypeScript. See docs/architecture/offline-runs.md.
//
//   node scripts/offline-runs/run.mjs --stub                          # no model, no network
//   node --env-file=.env scripts/offline-runs/run.mjs --real --confirm [--suite all] \
//     [--max-calls 3100] [--max-cost 5] [--concurrency 4] [--out offline-runs/<name>] \
//     [--input-price <usd per M>] [--output-price <usd per M>]
//   node scripts/offline-runs/run.mjs --score offline-runs/<name>      # after filling the sheets
//
// Only the literal flag --confirm opens the real model (see confirm.mjs); an OFFLINE_RUN_* value in
// the shell or in .env is dropped before the runner starts.
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { childEnv, issueConfirmation } from "./confirm.mjs";

const FLAGS = {
  "--suite": "OFFLINE_RUN_SUITE",
  "--max-calls": "OFFLINE_RUN_MAX_CALLS",
  "--max-cost": "OFFLINE_RUN_MAX_COST_USD",
  "--concurrency": "OFFLINE_RUN_CONCURRENCY",
  "--out": "OFFLINE_RUN_OUT",
  "--input-price": "OFFLINE_RUN_INPUT_PRICE_PER_M",
  "--output-price": "OFFLINE_RUN_OUTPUT_PRICE_PER_M",
  "--score": "OFFLINE_RUN_SCORE",
};

/**
 * The settings for the runner and whether --confirm was typed. Confirmation is never a setting.
 * @param {string[]} args
 */
export function parseArgs(args) {
  /** @type {Record<string, string>} */
  const settings = { OFFLINE_RUN_MODE: "stub" };
  let confirm = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--stub") settings.OFFLINE_RUN_MODE = "stub";
    else if (arg === "--real") settings.OFFLINE_RUN_MODE = "real";
    else if (arg === "--confirm") confirm = true;
    else if (Object.hasOwn(FLAGS, arg)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      settings[FLAGS[/** @type {keyof typeof FLAGS} */ (arg)]] = value;
      index += 1;
    } else throw new Error(`Unknown flag: ${arg}`);
  }
  return { settings, confirm };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  const confirmation =
    parsed.confirm && parsed.settings.OFFLINE_RUN_MODE === "real" ? issueConfirmation() : null;
  const root = path.join(import.meta.dirname, "..", "..");
  // Ctrl-C asks the runner to stop through this file, so it can finish the units in flight and
  // write the partial report; the runner is in its own process group, so the terminal's Ctrl-C
  // does not kill it first. A second Ctrl-C stops it at once (results.jsonl has what finished).
  const stopFile = path.join(tmpdir(), `wp-offline-run-stop-${process.pid}-${Date.now()}`);
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "--config",
      path.join(root, "scripts", "offline-runs", "vitest.config.mts"),
    ],
    {
      cwd: root,
      stdio: "inherit",
      detached: true,
      env: childEnv(process.env, {
        ...parsed.settings,
        ...(confirmation?.settings ?? {}),
        OFFLINE_RUN_STOP_FILE: stopFile,
      }),
    },
  );
  let asked = false;
  const stop = () => {
    if (!asked) {
      asked = true;
      writeFileSync(stopFile, "stop");
      console.error("Stopping after the units in flight; the partial report follows.");
      return;
    }
    if (child.pid) process.kill(-child.pid, "SIGKILL");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code, signal) => {
    confirmation?.cleanup();
    rmSync(stopFile, { force: true });
    process.exit(asked ? 130 : (code ?? (signal ? 1 : 1)));
  });
}
