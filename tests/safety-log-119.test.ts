import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSafetyCheck, SAFETY_CHECK_LANGUAGE, type SafetyEvent } from "@/lib/safety/check";
import type { ClassifierOutcome } from "@/lib/safety/classifier";
import { KEYWORD_LIST_VERSION } from "@/lib/safety/keyword";
import {
  SAFETY_LOG_POLICY_PENDING_LEGAL,
  SAFETY_LOG_READERS,
  SAFETY_LOG_RETENTION_DAYS,
} from "@/lib/safety/log-policy";
import { NEXT_ACTIONS, parseNextAction, s1Screen } from "@/lib/safety/next-action";
import { safetyLogFields, serverSafetyCheckFrom } from "@/lib/safety/server";
import { POST as postNextAction } from "@/app/safety/next-action/route";
import { seedPromptSource } from "./support/seed-prompts";

// US-SAF-6 (#119): what is logged about safety events. AC1 the fields; AC2 never the text, never
// a hash of it. AC3 (retention and readers) waits for the legal review (#121): the proposal is a
// config value here, marked pending.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** The AC1 fields, in this order, on every safety decision line. */
const AC1_FIELDS = [
  "at",
  "position",
  "tier",
  "lang",
  "keywordListVersion",
  "classifierPromptVersion",
  "layer",
  "latencyMs",
];
/** What `logEvent` adds to every line of every feature. */
const FRAME = ["level", "feature", "event", "requestId"];

const fixedNow = () => new Date("2026-11-24T10:00:00.000Z");
const classifierSays = (outcome: ClassifierOutcome) => async (): Promise<ClassifierOutcome> =>
  outcome;

describe("#119 AC1 a safety event holds the agreed fields", () => {
  it("test_119_ac1_a_keyword_crisis_event_has_every_field", async () => {
    const events: SafetyEvent[] = [];
    const check = createSafetyCheck({
      classifier: null,
      onEvent: (event) => events.push(event),
      now: fixedNow,
    });
    await check("I want to end it", { position: "rest_chat" });
    expect(events).toEqual([
      {
        kind: "crisis",
        at: "2026-11-24T10:00:00.000Z",
        position: "rest_chat",
        tier: "crisis",
        lang: "en",
        keywordListVersion: KEYWORD_LIST_VERSION,
        classifierPromptVersion: null,
        layer: "keyword",
        latencyMs: 0,
      },
    ]);
  });

  it("test_119_ac1_a_classifier_crisis_names_the_prompt_version_and_the_layer", async () => {
    const events: SafetyEvent[] = [];
    const check = createSafetyCheck({
      classifier: classifierSays({ ok: true, tier: "crisis", promptVersion: 7, latencyMs: 40 }),
      onEvent: (event) => events.push(event),
    });
    await check("everything is grey", { position: "goal_input" });
    expect(events[0]).toMatchObject({
      kind: "crisis",
      tier: "crisis",
      layer: "classifier",
      position: "goal_input",
      classifierPromptVersion: 7,
      lang: SAFETY_CHECK_LANGUAGE,
    });
    expect(events[0].at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(events[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("test_119_ac1_a_classifier_failure_holds_the_same_fields_and_its_reason", async () => {
    const events: SafetyEvent[] = [];
    const check = createSafetyCheck({
      classifier: classifierSays({ ok: false, reason: "timeout", latencyMs: 1500 }),
      onEvent: (event) => events.push(event),
    });
    await check("I feel worthless", { position: "plan_edit" });
    expect(events[0]).toMatchObject({
      kind: "classifier_failed",
      reason: "timeout",
      tier: "stress",
      layer: "keyword_alone",
      classifierPromptVersion: null,
    });
  });

  it("test_119_ac1_the_log_lines_hold_exactly_the_fields_and_nothing_else", async () => {
    const lines: Record<string, unknown>[] = [];
    const sink = vi.spyOn(console, "warn").mockImplementation((line: string) => {
      lines.push(JSON.parse(line));
    });
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      lines.push(JSON.parse(line));
    });
    const check = serverSafetyCheckFrom({ env: {} });
    await check("I want to end it", { position: "display_name" });
    expect(sink).toHaveBeenCalled();
    const crisis = lines.find((line) => line.event === "safety_crisis") as Record<string, unknown>;
    expect(Object.keys(crisis).sort()).toEqual([...FRAME, ...AC1_FIELDS].sort());
    expect(crisis).toMatchObject({ level: "warn", feature: "safety", position: "display_name" });

    const failed = safetyLogFields({
      kind: "classifier_failed",
      reason: "parse",
      at: "2026-11-24T10:00:00.000Z",
      position: "rest_chat",
      tier: "none",
      lang: "en",
      keywordListVersion: 1,
      classifierPromptVersion: null,
      layer: "keyword_alone",
      latencyMs: 12,
    });
    expect(Object.keys(failed).sort()).toEqual(["event", "reason", ...AC1_FIELDS].sort());
  });

  it("test_119_ac1_the_keyword_list_version_changes_with_the_list", () => {
    // Raise KEYWORD_LIST_VERSION in src/lib/safety/keyword.ts with any change to the list, then add
    // its fingerprint here. A change to the list without a new version fails this test.
    const fingerprints: Record<number, string> = {
      1: "9c8cee4cd0aab5ab824dc5ba45e9266e25cd1d80b01e05ceb0ad8362818e2f57",
    };
    const source = read("src/lib/safety/keyword.ts").replace(/\r\n/g, "\n");
    const list = source.slice(source.indexOf("const crisisPatterns"));
    const fingerprint = createHash("sha256").update(list).digest("hex");
    expect(fingerprints[KEYWORD_LIST_VERSION]).toBe(fingerprint);
  });

  it("test_119_ac1_what_i_did_next_is_one_of_the_s1_actions_on_a_fixed_screen", async () => {
    expect(NEXT_ACTIONS).toEqual([
      "get_support",
      "second_contact",
      "directory",
      "choose_country",
      "back",
      "left",
    ]);
    // The address can hold a Goal or session id: only its first part, from a fixed list, is kept.
    expect(s1Screen("/rest/3f2a-session-id")).toBe("rest");
    expect(s1Screen("/try/goal")).toBe("try");
    expect(s1Screen("/somewhere-else/abc")).toBe("other");

    const lines: Record<string, unknown>[] = [];
    vi.spyOn(console, "warn").mockImplementation((line: string) => {
      lines.push(JSON.parse(line));
    });
    const response = await postNextAction(
      new Request("http://localhost/safety/next-action", {
        method: "POST",
        body: JSON.stringify({ action: "get_support", screen: "rest" }),
      }),
    );
    expect(response.status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0]).sort()).toEqual(
      [...FRAME, "at", "action", "screen", "lang"].sort(),
    );
    expect(lines[0]).toMatchObject({
      feature: "safety",
      event: "safety_next_action",
      action: "get_support",
      screen: "rest",
      lang: "en",
    });
  });

  it("test_119_ac1_the_crisis_page_reports_each_action_once", () => {
    const page = read("src/app/safety/crisis-page.tsx");
    for (const action of ["get_support", "second_contact", "directory", "choose_country", "back"]) {
      expect(page).toContain(`report("${action}")`);
    }
    expect(page).toContain('sendNextAction("left"');
    expect(page).toContain("pagehide");
  });
});

// ---------------------------------------------------------------------------------------------
// AC2: run every safety path with a sentinel string and look for it, or a hash of it, in every
// log line and every request that is not the classifier's own model call.

const SENTINEL = "Zq7-sentinel-mauve-otter-4419";

function hashesOf(text: string): string[] {
  const out: string[] = [];
  for (const algorithm of ["sha256", "sha1", "md5", "sha512"]) {
    for (const encoding of ["hex", "base64", "base64url"] as const) {
      out.push(createHash(algorithm).update(text).digest(encoding));
      out.push(createHash(algorithm).update(text.trim()).digest(encoding));
    }
  }
  return out;
}

type Capture = { logs: string[]; writes: string[]; modelCalls: number };

function harness(answer: string | "fail" | "slow" | "throw", options: { prompt?: boolean } = {}) {
  const captured: Capture = { logs: [], writes: [], modelCalls: 0 };
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    captured.logs.push(String(line));
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    captured.logs.push(String(line));
  });
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    captured.logs.push(String(line));
  });
  vi.spyOn(console, "info").mockImplementation((line: string) => {
    captured.logs.push(String(line));
  });

  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://model.test/v1") {
      captured.modelCalls += 1;
      if (answer === "fail") return new Response("no", { status: 500 });
      if (answer === "throw") throw new Error("network");
      if (answer === "slow") await new Promise((resolve) => setTimeout(resolve, 1_700));
      return Response.json({ choices: [{ message: { content: answer } }] });
    }
    // Every other request is a write somewhere: the day counter (database) or the alarm webhook.
    const body =
      typeof init?.body === "string"
        ? init.body
        : input instanceof Request
          ? await input.clone().text()
          : String(init?.body ?? "");
    captured.writes.push(`${url}\n${JSON.stringify(init?.headers ?? {})}\n${body}`);
    if (url.startsWith("https://db.test/")) {
      return Response.json([{ failures: 1, send_alarm: true }]);
    }
    return new Response(null, { status: 204 });
  });

  const pending: Promise<unknown>[] = [];
  const check = serverSafetyCheckFrom({
    env: {
      MODEL_API_KEY: "k",
      MODEL_API_URL: "https://model.test/v1",
      MODEL_NAME: "chat",
      SAFETY_ALARM_WEBHOOK_URL: "https://hooks.test/alarm",
      NEXT_PUBLIC_SUPABASE_URL: "https://db.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      PROMPTS_READ_TOKEN: "reader",
    },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    prompts: options.prompt === false ? async () => null : seedPromptSource(),
    schedule: (work) => pending.push(work()),
  });
  return { check, captured, settle: () => Promise.all(pending) };
}

function expectNoTrace(captured: Capture, texts: string[]) {
  const haystack = [...captured.logs, ...captured.writes].join("\n");
  for (const text of texts) {
    expect(haystack).not.toContain(text);
    for (const hash of hashesOf(text)) expect(haystack).not.toContain(hash);
  }
  // Nor its length: no log value equals the length of the text.
  for (const line of captured.logs) {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    for (const [name, value] of Object.entries(parsed)) {
      if (name === "latencyMs" || name === "keywordListVersion") continue;
      if (name === "classifierPromptVersion") continue;
      for (const text of texts) expect(value).not.toBe(text.length);
    }
  }
}

describe("#119 AC2 no log or database write ever holds the text or a hash of it", () => {
  const paths: [string, string | "fail" | "slow" | "throw", { prompt?: boolean }, string][] = [
    ["a keyword crisis", '{"tier":"none"}', {}, `${SENTINEL} I want to kill myself`],
    ["a classifier crisis", '{"tier":"crisis"}', {}, SENTINEL],
    ["an unsure answer", '{"tier":"unsure"}', {}, SENTINEL],
    ["a stress answer", '{"tier":"stress"}', {}, SENTINEL],
    ["a none answer", '{"tier":"none"}', {}, SENTINEL],
    ["a keyword low mood", '{"tier":"none"}', {}, `${SENTINEL} I feel hopeless`],
    ["a failed request", "fail", {}, SENTINEL],
    ["a network error", "throw", {}, SENTINEL],
    ["an unreadable answer", `{"tier":"none","note":"${SENTINEL}"}`, {}, SENTINEL],
    ["a missing prompt", '{"tier":"none"}', { prompt: false }, SENTINEL],
  ];

  for (const [name, answer, options, text] of paths) {
    it(`test_119_ac2_${name.replaceAll(" ", "_")}_leaves_no_trace_of_the_text`, async () => {
      const { check, captured, settle } = harness(answer, options);
      const previous = [`${SENTINEL} earlier one`, `${SENTINEL} I want to end it`];
      for (const position of [
        "goal_input",
        "goal_title",
        "goal_rename",
        "plan_split",
        "plan_edit",
        "rest_chat",
        "display_name",
      ] as const) {
        await check(text, { position, previous });
      }
      await settle();
      expectNoTrace(captured, [text, SENTINEL, ...previous]);
    });
  }

  it("test_119_ac2_a_slow_classifier_leaves_no_trace_of_the_text", async () => {
    vi.useFakeTimers();
    try {
      const { check, captured, settle } = harness("slow");
      const pending = check(SENTINEL, { position: "rest_chat" });
      await vi.advanceTimersByTimeAsync(2_000);
      expect(await pending).toMatchObject({ classifierFailed: true });
      await settle();
      expect(captured.logs.join("\n")).toContain('"reason":"timeout"');
      expect(captured.writes.length).toBeGreaterThan(0);
      expectNoTrace(captured, [SENTINEL]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("test_119_ac2_the_failure_paths_do_write_to_the_database_and_the_webhook", async () => {
    // Guards the test above: the writes it searches are really made.
    const { check, captured, settle } = harness("fail");
    await check(SENTINEL, { position: "rest_chat" });
    await settle();
    expect(captured.writes.some((write) => write.startsWith("https://db.test/"))).toBe(true);
    expect(captured.writes.some((write) => write.startsWith("https://hooks.test/"))).toBe(true);
    expect(captured.modelCalls).toBe(1);
  });

  it("test_119_ac2_the_next_action_endpoint_logs_nothing_from_a_bad_body", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((line: string) => {
      lines.push(line);
    });
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      lines.push(line);
    });
    const bodies = [
      JSON.stringify({ action: "back", screen: "rest", note: SENTINEL }),
      JSON.stringify({ action: SENTINEL, screen: "rest" }),
      JSON.stringify({ action: "back", screen: SENTINEL }),
      SENTINEL,
      JSON.stringify({ action: "back", screen: "rest", pad: SENTINEL.repeat(10) }),
    ];
    for (const body of bodies) {
      const response = await postNextAction(
        new Request("http://localhost/safety/next-action", { method: "POST", body }),
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect(lines).toEqual([]);
    expect(parseNextAction(JSON.stringify({ action: "back", screen: "rest" }))).toEqual({
      action: "back",
      screen: "rest",
    });
  });

  it("test_119_ac2_no_safety_code_hashes_anything", () => {
    const files = (dir: string): string[] =>
      readdirSync(path.join(root, dir)).flatMap((name) => {
        const rel = path.join(dir, name);
        return statSync(path.join(root, rel)).isDirectory() ? files(rel) : [rel];
      });
    const safety = [
      ...files("src/lib/safety"),
      ...files("src/app/safety"),
      "src/lib/logging/server-log.ts",
    ];
    for (const file of safety) {
      expect(read(file), file).not.toMatch(/createHash|createHmac|subtle\.digest|\bdigest\(/);
    }
  });
});

describe("#119 AC3 retention and readers (pending the legal review, #121)", () => {
  it("test_119_ac3_the_proposed_retention_is_a_config_value_marked_pending", () => {
    expect(SAFETY_LOG_RETENTION_DAYS).toBe(90);
    expect(SAFETY_LOG_READERS).toBe("vercel-project-members");
    expect(SAFETY_LOG_POLICY_PENDING_LEGAL).toBe(true);
  });

  it("test_119_ac3_deploy_md_documents_the_owner_step", () => {
    const deploy = read("docs/deploy.md");
    expect(deploy).toContain("### Safety log");
    expect(deploy).toContain("SAFETY_LOG_RETENTION_DAYS");
    expect(deploy).toMatch(/pending the legal review/i);
  });
});
