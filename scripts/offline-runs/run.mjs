// Offline runs with the real prompts (#42, US-AI-12). Turns the flags into OFFLINE_RUN_* settings
// and starts the runner (scripts/offline-runs/runner.offline.ts) through vitest, which resolves the
// app's TypeScript. See docs/architecture/offline-runs.md.
//
//   node scripts/offline-runs/run.mjs --stub                          # no model, no network
//   node --env-file=.env scripts/offline-runs/run.mjs --real --confirm [--suite all] \
//     [--max-calls 2600] [--max-cost 5] [--concurrency 4] [--out offline-runs/<name>] \
//     [--input-price <usd per M>] [--output-price <usd per M>]
//   node scripts/offline-runs/run.mjs --score offline-runs/<name>      # after filling the sheets
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

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

/** @param {string[]} args */
export function settingsFromArgs(args) {
  /** @type {Record<string, string>} */
  const settings = { OFFLINE_RUN_MODE: "stub" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--stub") settings.OFFLINE_RUN_MODE = "stub";
    else if (arg === "--real") settings.OFFLINE_RUN_MODE = "real";
    else if (arg === "--confirm") settings.OFFLINE_RUN_CONFIRM = "1";
    else if (Object.hasOwn(FLAGS, arg)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      settings[FLAGS[/** @type {keyof typeof FLAGS} */ (arg)]] = value;
      index += 1;
    } else throw new Error(`Unknown flag: ${arg}`);
  }
  return settings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  let settings;
  try {
    settings = settingsFromArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  const root = path.join(import.meta.dirname, "..", "..");
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "--config",
      path.join(root, "scripts", "offline-runs", "vitest.config.mts"),
    ],
    { cwd: root, stdio: "inherit", env: { ...process.env, ...settings } },
  );
  process.exit(result.status ?? 1);
}
