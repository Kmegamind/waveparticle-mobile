import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAUNCHER_GONE, runOffline, type RunInputs } from "@/lib/offline-runs/run";
import type { GoalLinesInput, RestMessagesInput } from "@/lib/offline-runs/suites";
import type { TargetsFile } from "@/lib/offline-runs/report";
import { writeStopFile } from "../scripts/offline-runs/stop-file.mjs";
import { STUB_ENV, stubFetch } from "../scripts/offline-runs/stub-fetch.mjs";
import { seedContent } from "./support/seed-content";
import { seedRows } from "./support/seed-prompts";

// #420 review of #422 (P1, P2, P4): a stop works with the plain stub (no delay, so no timer gets a
// turn), the launcher's pipe catches a launcher that a pid check still sees, and SIGHUP and SIGTERM
// to the launcher really stop the runner. Stub only: no test reaches a network or a model.

const root = path.join(import.meta.dirname, "..");
const data = (name: string) =>
  JSON.parse(readFileSync(path.join(root, "scripts", "offline-runs", "data", name), "utf8"));
const prices = { inputPerMillion: 0.75, outputPerMillion: 3.75, source: "test" };

const inputs = (): RunInputs => ({
  pause: { runsPerStory: 4, pausesPerRun: 5, arms: ["on"], stories: ["site-search"] },
  rest: {
    ...(data("rest-messages.json") as RestMessagesInput),
    positions: [{ stepIndex: 0, stepCount: 4 }],
  },
  split: { ...(data("goal-lines.json") as GoalLinesInput), runsPerLine: 1 },
  targets: data("targets.json") as TargetsFile,
});

function plainRun(options: Partial<Parameters<typeof runOffline>[0]>) {
  return runOffline({
    mode: "stub",
    suites: ["split", "rest", "pause"],
    env: STUB_ENV,
    // The plain stub: it answers on microtasks only, with no timer and no delay.
    fetchImpl: stubFetch() as typeof fetch,
    content: seedContent(),
    promptRows: seedRows(),
    inputs: inputs(),
    maxCalls: 3_100,
    maxCostUsd: 5,
    prices,
    concurrency: 2,
    outDir: mkdtempSync(path.join(tmpdir(), "wp-offline-")),
    ...options,
  });
}

/** Waits until `results.jsonl` in `outDir` has more than `lines` lines. */
async function recordsOver(outDir: string, lines: number, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const text = readFileSync(path.join(outDir, "results.jsonl"), "utf8");
      if (text.split("\n").length > lines) return;
    } catch {
      // Not there yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("the run wrote no records in time");
}

const exited = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.on("exit", () => resolve());
  });

async function reportOf(outDir: string, timeoutMs = 60_000): Promise<string> {
  const file = path.join(outDir, "report.md");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (existsSync(file)) return readFileSync(file, "utf8");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("no report");
}

/**
 * The launcher's temporary files left in `folder`: its stop file and the stop file's `.tmp` from
 * the rename.
 */
const leftovers = (folder: string, pid: number | undefined) =>
  readdirSync(folder).filter((name) => name.startsWith(`wp-offline-run-stop-${pid}-`));

/**
 * Says, for a failing check, which file was left, what it holds ("launcher gone" is the runner's
 * pipe watch, "stop" the launcher) and when it was written against report.md and the end of the
 * runner, so a CI log shows the order (#428).
 */
function leftoverReport(folder: string, pid: number | undefined, outDir: string, endedAt: number) {
  const report = statSync(path.join(outDir, "report.md")).mtimeMs;
  const lines = leftovers(folder, pid).map((name) => {
    const file = path.join(folder, name);
    const written = statSync(file).mtimeMs;
    const text = JSON.stringify(readFileSync(file, "utf8"));
    const when = (gap: number, what: string) =>
      `${Math.abs(Math.round(gap))} ms ${gap < 0 ? "before" : "after"} ${what}`;
    return `${name} holds ${text}, written ${when(written - report, "report.md")} and ${when(written - endedAt, "the runner ended")}`;
  });
  return `left in ${folder}:\n${lines.join("\n")}`;
}

/**
 * The launcher's environment, with its own temp folder (#428). Without TMPDIR the launcher's
 * tmpdir() is /tmp, not this process's tmpdir() (on macOS a per-user folder), so a leftover was
 * looked for in the wrong folder.
 */
function stubRunEnv() {
  const temp = mkdtempSync(path.join(tmpdir(), "wp-launcher-tmp-"));
  return { temp, env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" as const, TMPDIR: temp } };
}

/**
 * Resolves when the launcher's stdout is closed by every process that holds it: the launcher and
 * the runner it started, which inherits it. So the runner has ended and its cleanup is done.
 */
const closed = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    child.stdout?.resume();
    if (child.stdout?.closed) resolve();
    else child.stdout?.on("close", () => resolve());
  });

describe("P1: a stop works with the plain stub", () => {
  it("test_420_p1_a_stop_file_stops_a_plain_stub_run_at_the_next_request", async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "wp-offline-"));
    const stopFile = path.join(outDir, "stop");
    let seen = 0;
    const results = await plainRun({
      outDir,
      stopFile,
      afterRecord: () => {
        seen += 1;
        if (seen === 5) writeFileSync(stopFile, "stop");
      },
    });
    expect(results.budget.stopped).toBe("interrupted");
    expect(results.meta.incomplete).toContain("the run was interrupted");
    // A full small run has 69 splits, 60 replies and 20 pauses; it stopped right after record 5.
    const records = results.split.length + results.rest.length + results.pause.length;
    expect(records).toBeLessThanOrEqual(5 + 2);
  });

  it("test_420_q1_an_empty_stop_file_is_checked_again_not_read_as_a_stop", async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "wp-offline-"));
    const stopFile = path.join(outDir, "stop");
    let seen = 0;
    const results = await plainRun({
      outDir,
      stopFile,
      concurrency: 1,
      afterRecord: () => {
        seen += 1;
        // As if the runner looked in the middle of a plain write: the file exists but is empty.
        if (seen === 3) writeFileSync(stopFile, "");
        if (seen === 8) writeStopFile(stopFile, LAUNCHER_GONE);
      },
    });
    const records = results.split.length + results.rest.length + results.pause.length;
    expect(records).toBe(8);
    expect(results.meta.incomplete).toContain("the launcher went away");
  });

  it("test_420_q1_the_stop_file_is_written_whole_by_a_rename", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "wp-stop-"));
    const file = path.join(folder, "stop");
    writeStopFile(file, "stop");
    expect(readFileSync(file, "utf8")).toBe("stop");
    expect(readdirSync(folder)).toEqual(["stop"]);
  });

  it("test_420_p1_a_gone_launcher_stops_a_plain_stub_run_before_its_first_request", async () => {
    const gone = spawnSync(process.execPath, ["-e", ""]).pid;
    const results = await plainRun({ parentPid: gone });
    expect(results.budget.calls).toBe(0);
    expect(results.meta.incomplete).toContain("the launcher went away");
  });
});

describe("P2 and P4: the real launcher and runner, stub mode", () => {
  it(
    "test_420_p2_the_closed_launcher_pipe_stops_the_runner_while_the_pid_still_answers",
    { timeout: 120_000 },
    async () => {
      // The runner started as run.mjs starts it, but the "launcher" pid is this live test process,
      // as for a zombie launcher: only the pipe on file descriptor 3 can tell it is gone.
      const outDir = mkdtempSync(path.join(tmpdir(), "wp-offline-"));
      const stopFile = path.join(outDir, "stop");
      const runner = spawn(
        process.execPath,
        [
          path.join(root, "node_modules", "vitest", "vitest.mjs"),
          "run",
          "--config",
          path.join(root, "scripts", "offline-runs", "vitest.config.mts"),
        ],
        {
          cwd: root,
          stdio: ["ignore", "ignore", "ignore", "pipe"],
          env: {
            PATH: process.env.PATH ?? "",
            NODE_ENV: "test",
            OFFLINE_RUN_MODE: "stub",
            OFFLINE_RUN_SUITE: "pause",
            OFFLINE_RUN_CONCURRENCY: "1",
            OFFLINE_RUN_OUT: outDir,
            OFFLINE_RUN_STOP_FILE: stopFile,
            OFFLINE_RUN_PARENT_PID: String(process.pid),
            OFFLINE_RUN_LAUNCHER_FD: "3",
          },
        },
      );
      await recordsOver(outDir, 20);
      (runner.stdio[3] as NodeJS.WritableStream & { destroy: () => void }).destroy();
      await exited(runner);
      const report = await reportOf(outDir);
      expect(report).toContain("INCOMPLETE: the launcher went away");
      expect(existsSync(stopFile)).toBe(false);
      const records = readFileSync(path.join(outDir, "results.jsonl"), "utf8").trim().split("\n");
      expect(records.length).toBeLessThan(800);
    },
  );

  for (const signal of ["SIGHUP", "SIGTERM"] as const) {
    it(
      `test_420_p4_${signal.toLowerCase()}_to_the_launcher_writes_the_stop_and_the_runner_stops`,
      { timeout: 120_000 },
      async () => {
        const outDir = mkdtempSync(path.join(tmpdir(), "wp-offline-"));
        const { temp, env } = stubRunEnv();
        const launcher = spawn(
          process.execPath,
          [
            path.join(root, "scripts", "offline-runs", "run.mjs"),
            "--stub",
            "--suite",
            "pause",
            "--concurrency",
            "1",
            "--out",
            outDir,
          ],
          { cwd: root, stdio: "ignore", env },
        );
        await recordsOver(outDir, 20);
        launcher.kill(signal);
        await exited(launcher);
        // The handler was installed: the launcher lived on to wait for the runner (exit 130).
        expect(launcher.exitCode).toBe(130);
        const report = await reportOf(outDir);
        expect(report).toContain("INCOMPLETE: the run was interrupted");
        const left = leftovers(temp, launcher.pid);
        expect(
          left,
          left.length ? leftoverReport(temp, launcher.pid, outDir, Date.now()) : undefined,
        ).toEqual([]);
        const records = readFileSync(path.join(outDir, "results.jsonl"), "utf8").trim().split("\n");
        expect(records.length).toBeLessThan(800);
      },
    );
  }

  it(
    "test_420_p2_a_killed_launcher_stops_the_runner_and_leaves_no_file",
    { timeout: 120_000 },
    async () => {
      const outDir = mkdtempSync(path.join(tmpdir(), "wp-offline-"));
      const { temp, env } = stubRunEnv();
      const launcher = spawn(
        process.execPath,
        [
          path.join(root, "scripts", "offline-runs", "run.mjs"),
          "--stub",
          "--suite",
          "pause",
          "--concurrency",
          "1",
          "--out",
          outDir,
        ],
        // stdout is a pipe so the test can tell when the runner, which inherits it, has ended.
        { cwd: root, stdio: ["ignore", "pipe", "ignore"], env },
      );
      const runnerGone = closed(launcher);
      await recordsOver(outDir, 20);
      launcher.kill("SIGKILL");
      await exited(launcher);
      const report = await reportOf(outDir);
      expect(report).toContain("INCOMPLETE: the launcher went away");
      // The killed launcher removes nothing; the runner's own cleanup must, by the time it ends.
      await runnerGone;
      const endedAt = Date.now();
      const left = leftovers(temp, launcher.pid);
      expect(
        left,
        left.length ? leftoverReport(temp, launcher.pid, outDir, endedAt) : undefined,
      ).toEqual([]);
    },
  );
});
