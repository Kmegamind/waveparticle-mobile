import { readFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { parseStoryContent } from "@/lib/content/parse";
import type { PromptRow } from "@/lib/prompts/repository";
import { DEFAULT_MAX_CALLS, DEFAULT_MAX_COST_USD } from "@/lib/offline-runs/budget";
import { choosePrices } from "@/lib/offline-runs/prices";
import { rescore, runOffline, SUITES, type RunInputs, type Suite } from "@/lib/offline-runs/run";
import { appDocument, readContentRows } from "../content/content-files.mjs";
import { readPromptDirectory } from "../prompts/prompt-files.mjs";
import { confirmationGiven } from "./confirm.mjs";
import { STUB_ENV, stubFetch } from "./stub-fetch.mjs";

// The offline runs (#42, US-AI-12). Started only by `node scripts/offline-runs/run.mjs`, which
// turns its flags into the OFFLINE_RUN_* settings below. The real model is called only with
// --real and the literal flag --confirm (a one-time token from run.mjs, never a value in the
// environment or .env); anything else uses the stub, with no network.

const root = path.join(import.meta.dirname, "..", "..");
const env = process.env;
const json = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8"));

function numberSetting(name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

it("offline run", async () => {
  if (env.OFFLINE_RUN_SCORE) {
    const dir = path.resolve(root, env.OFFLINE_RUN_SCORE);
    const report = rescore(dir);
    const failed = report.split("\n").filter((line) => line.startsWith("| FAIL")).length;
    console.log(`Report written to ${path.join(dir, "report.md")}: ${failed} failed targets.`);
    return;
  }
  const mode = env.OFFLINE_RUN_MODE === "real" ? "real" : "stub";
  if (mode === "real") {
    if (!confirmationGiven(env)) {
      throw new Error("A real run needs the flag --confirm on the command line of run.mjs.");
    }
    const missing = ["MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME"].filter(
      (name) => !env[name]?.trim(),
    );
    if (missing.length > 0) throw new Error(`Not set: ${missing.join(", ")}`);
  }
  const chosen = (env.OFFLINE_RUN_SUITE ?? "all").split(",").map((item) => item.trim());
  const suites = (chosen.includes("all") ? [...SUITES] : chosen) as Suite[];
  const unknown = suites.filter((suite) => !SUITES.includes(suite));
  if (unknown.length > 0) throw new Error(`Unknown suite: ${unknown.join(", ")}`);

  const modelEnv: Record<string, string | undefined> = mode === "real" ? env : { ...STUB_ENV };
  // The last focus card before a Pause: the first card of each Story's first part (M1).
  const decks = json("src/content/oppenheimer/story-decks.json") as Record<
    string,
    { parts?: { cards?: { text?: string }[] }[] }
  >;
  const lastCards = Object.fromEntries(
    Object.entries(decks).flatMap(([id, deck]) => {
      const text = deck.parts?.[0]?.cards?.[0]?.text;
      return typeof text === "string" ? [[id, text]] : [];
    }),
  );
  const inputs: RunInputs = {
    pause: { ...json("scripts/offline-runs/data/pause-runs.json"), lastCards },
    rest: json("scripts/offline-runs/data/rest-messages.json"),
    split: json("scripts/offline-runs/data/goal-lines.json"),
    targets: json("scripts/offline-runs/data/targets.json"),
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(
    root,
    env.OFFLINE_RUN_OUT ?? path.join("offline-runs", `${stamp}-${mode}`),
  );
  const results = await runOffline({
    mode,
    suites,
    env: modelEnv,
    fetchImpl: mode === "real" ? fetch : stubFetch(),
    content: parseStoryContent(appDocument(readContentRows(root))),
    promptRows: readPromptDirectory(path.join(root, "docs", "ai", "prompts")) as PromptRow[],
    inputs,
    maxCalls: numberSetting("OFFLINE_RUN_MAX_CALLS", DEFAULT_MAX_CALLS),
    maxCostUsd: numberSetting("OFFLINE_RUN_MAX_COST_USD", DEFAULT_MAX_COST_USD),
    prices: choosePrices(
      { ...env, MODEL_NAME: modelEnv.MODEL_NAME },
      json("scripts/live-generation-benchmark.config.json"),
    ),
    concurrency: numberSetting("OFFLINE_RUN_CONCURRENCY", 4),
    outDir,
    stopFile: env.OFFLINE_RUN_STOP_FILE,
  });
  const { budget } = results;
  console.log(
    `Offline run (${mode}) written to ${outDir}: ${budget.calls} calls, $${budget.costUsd.toFixed(4)} estimated${
      results.meta.incomplete ? `, INCOMPLETE: ${results.meta.incomplete}` : ""
    }.`,
  );
});
