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
import {
  NEXT_ACTION_MAX_BYTES,
  NEXT_ACTION_REQUEST,
  NEXT_ACTIONS,
  parseNextAction,
  s1Screen,
} from "@/lib/safety/next-action";
import { createSafetyClassifier } from "@/lib/safety/classifier";
import { isPublicPath } from "@/lib/supabase/session";
import { safetyLogFields, serverSafetyCheckFrom } from "@/lib/safety/server";
import { POST as postNextAction } from "@/app/safety/next-action/route";
import { seedPromptSource } from "./support/seed-prompts";
import { saveDisplayName } from "@/lib/me/profile";
import { renameGoal } from "@/lib/goals/goal-edits";
import { splitGoal } from "@/lib/prototype/split-goal";
import { takeTurn } from "@/lib/goal-dialogue/turns";
import { startGoal } from "@/lib/goals/start-goal";
import { restReplyFor } from "@/lib/prototype/rest-lines";

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

/** What a same-site browser request carries (review M2). */
const SAME_SITE = { origin: "http://localhost", "sec-fetch-site": "same-origin" };

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
    // Review M7: the version is the newest entry, and no two versions share a fingerprint, so
    // editing the list means adding a version, not overwriting the stored one. Keep old entries.
    expect(KEYWORD_LIST_VERSION).toBe(Math.max(...Object.keys(fingerprints).map(Number)));
    expect(new Set(Object.values(fingerprints)).size).toBe(Object.keys(fingerprints).length);
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
        headers: SAME_SITE,
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
        new Request("http://localhost/safety/next-action", {
          method: "POST",
          headers: SAME_SITE,
          body,
        }),
      );
      // Past the origin check: refused for the body itself.
      expect([400, 413]).toContain(response.status);
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

// Fix round 1 (review M1): the same sentinel through the functions the server actions call, with
// the real server check (classifier, log, day counter and alarm). A crisis must save nothing; on
// a classifier failure the save goes ahead, and no log line or database or webhook write of the
// check holds the text.
describe("#119 AC2 the callers of the check leave no trace of the text", () => {
  const goalId = "11111111-2222-4333-8444-555555555555";
  const crisisText = `${SENTINEL} everything is grey`;

  function writes(): { calls: string[]; record: (name: string) => () => Promise<never> } {
    const calls: string[] = [];
    return {
      calls,
      record: (name) => async () => {
        calls.push(name);
        throw new Error("no write expected");
      },
    };
  }

  type Caller = [string, (check: Awaited<ReturnType<typeof harness>>["check"]) => Promise<unknown>];

  const callers = (saved: ReturnType<typeof writes>): Caller[] => [
    [
      "saveDisplayName",
      (check) =>
        saveDisplayName(
          { name: crisisText },
          {
            userId: goalId,
            writer: { upsert: saved.record("profiles.upsert") },
            safety: check,
          },
        ),
    ],
    [
      "renameGoal",
      (check) =>
        renameGoal(
          { goalId, title: crisisText },
          {
            userId: goalId,
            writer: {
              rename: saved.record("goals.rename"),
              setKind: saved.record("goals.setKind"),
              newestSessionIn: saved.record("sessions.read"),
            },
            safety: check,
          },
        ),
    ],
    [
      "splitGoal",
      (check) =>
        splitGoal(
          { goal: crisisText, totalMinutes: 30, splitFiner: false },
          {
            env: {},
            today: "2026-11-24",
            readCounter: () => undefined,
            writeCounter: () => saved.calls.push("counter"),
            safety: check,
          },
        ),
    ],
    [
      "takeTurn",
      (check) =>
        takeTurn(
          { kind: "goal", goal: crisisText },
          {
            secret: Buffer.alloc(32, 7),
            now: () => 0,
            newId: () => "dialogue-1",
            split: async () => {
              saved.calls.push("split");
              return { status: "failed" };
            },
            safety: check,
          },
        ),
    ],
    [
      "startGoal",
      (check) =>
        startGoal(
          {
            goalId,
            goalText: crisisText,
            title: "Write the report",
            splitFiner: null,
            steps: [{ title: "Open the file", description: "", minutes: 10 }],
          },
          {
            userId: goalId,
            writer: {
              goalExists: saved.record("goals.exists"),
              insertGoal: saved.record("goals.insert"),
              updateGoal: saved.record("goals.update"),
              replaceSteps: saved.record("steps.replace"),
              deleteGoal: saved.record("goals.delete"),
            },
            safety: check,
          },
        ),
    ],
    [
      "restReplyFor",
      (check) =>
        restReplyFor(
          null as never,
          {
            message: crisisText,
            history: [{ from: "you", text: `${SENTINEL} earlier` }],
            replyIndex: 0,
          },
          null,
          check,
        ),
    ],
  ];

  for (const index of [0, 1, 2, 3, 4, 5]) {
    it(`test_119_m1_caller_${index}_a_classifier_crisis_saves_nothing_and_logs_no_text`, async () => {
      const { check, captured, settle } = harness('{"tier":"crisis"}');
      const saved = writes();
      const [name, run] = callers(saved)[index];
      expect(await run(check), name).toMatchObject({ status: "crisis" });
      await settle();
      expect(saved.calls, name).toEqual([]);
      expect(captured.logs.join("\n")).toContain('"event":"safety_crisis"');
      expectNoTrace(captured, [crisisText, SENTINEL]);
    });
  }

  it("test_119_m1_a_classifier_failure_on_a_save_logs_no_text", async () => {
    const { check, captured, settle } = harness("fail");
    const upserts: unknown[] = [];
    const outcome = await saveDisplayName(
      { name: SENTINEL },
      {
        userId: goalId,
        writer: { upsert: async (...args) => void upserts.push(args) },
        safety: check,
      },
    );
    await settle();
    expect(outcome).toMatchObject({ status: "ok" });
    expect(upserts).toHaveLength(1);
    expect(captured.writes.some((write) => write.startsWith("https://db.test/"))).toBe(true);
    expectNoTrace(captured, [SENTINEL]);
  });
});

describe("#119 fix round 1 (review I1, M2, M3, M4, M6)", () => {
  const post = (init: RequestInit) =>
    postNextAction(new Request("http://localhost/safety/next-action", { method: "POST", ...init }));
  const body = JSON.stringify({ action: "back", screen: "rest" });

  it("test_119_i1_the_next_action_request_sends_no_referrer_and_no_cookie", () => {
    expect(NEXT_ACTION_REQUEST).toMatchObject({
      method: "POST",
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    // sendBeacon cannot drop the referrer or the cookies, so it is not used.
    expect(read("src/lib/safety/next-action.ts")).not.toMatch(/navigator\.sendBeacon\(/);
  });

  it("test_119_i1_every_response_sends_a_referrer_policy", async () => {
    const config = (await import("../next.config")).default;
    const rules = await config.headers!();
    expect(rules).toContainEqual({
      source: "/:path*",
      headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }],
    });
  });

  it("test_119_i1_the_docs_and_notice_say_the_platform_records_request_details", () => {
    const notice = read("src/app/privacy/privacy-notice.tsx");
    expect(notice).toContain("IP address");
    expect(notice).not.toContain("anything made from them");
    for (const file of ["src/lib/safety/next-action.ts", "docs/api/safety-classifier.md"]) {
      expect(read(file), file).toMatch(/IP address/);
      expect(read(file), file).not.toMatch(/\bunlinked\b|no id joins them|never the address/i);
    }
  });

  it("test_119_m2_a_request_from_another_site_or_with_no_origin_is_refused", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((line: string) => void lines.push(line));
    expect((await post({ body })).status).toBe(403);
    expect((await post({ body, headers: { origin: "https://elsewhere.example" } })).status).toBe(
      403,
    );
    expect(
      (
        await post({
          body,
          headers: { origin: "http://localhost", "sec-fetch-site": "cross-site" },
        })
      ).status,
    ).toBe(403);
    expect(lines).toEqual([]);
    expect((await post({ body, headers: SAME_SITE })).status).toBe(204);
    // A browser that sends no Sec-Fetch-Site: the Origin's host must be the request's host.
    expect(
      (await post({ body, headers: { origin: "https://app.example", host: "app.example" } }))
        .status,
    ).toBe(204);
    expect(
      (await post({ body, headers: { origin: "https://evil.example", host: "app.example" } }))
        .status,
    ).toBe(403);
  });

  it("test_119_m3_the_size_limit_holds_without_a_content_length_and_counts_bytes", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((line: string) => void lines.push(line));
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(64).fill(32));
        if (pulled > 1000) controller.close();
      },
    });
    const response = await post({
      headers: SAME_SITE,
      body: endless,
      duplex: "half",
    } as RequestInit);
    expect(response.status).toBe(413);
    expect(pulled).toBeLessThan(10);
    expect((await post({ headers: { ...SAME_SITE, "content-length": "x" }, body })).status).toBe(
      413,
    );
    // 70 three-byte characters: 70 UTF-16 units but 210 bytes.
    const wide = JSON.stringify({ action: "back", screen: "€".repeat(70) });
    expect(wide.length).toBeLessThan(NEXT_ACTION_MAX_BYTES);
    expect((await post({ headers: SAME_SITE, body: wide })).status).toBe(413);
    expect(lines).toEqual([]);
  });

  it("test_119_m4_the_route_is_named_as_a_public_path", () => {
    expect(isPublicPath("/safety/next-action", false)).toBe(true);
    expect(read("src/lib/supabase/session.ts")).toContain('pathname === "/safety/next-action"');
  });

  it("test_119_m6_a_failure_after_the_prompt_was_read_names_its_version", async () => {
    const events: SafetyEvent[] = [];
    const prompt = { key: "safety_classifier", version: 4, body: "{{text}}", params: {} } as never;
    const check = createSafetyCheck({
      classifier: createSafetyClassifier({
        provider: async () => "not json",
        prompts: async () => prompt,
      }),
      onEvent: (event) => events.push(event),
    });
    await check("fine", { position: "rest_chat" });
    expect(events[0]).toMatchObject({
      kind: "classifier_failed",
      reason: "parse",
      classifierPromptVersion: 4,
    });

    const missing = createSafetyCheck({
      classifier: createSafetyClassifier({ provider: async () => "{}", prompts: async () => null }),
      onEvent: (event) => events.push(event),
    });
    await missing("fine", { position: "rest_chat" });
    expect(events[1]).toMatchObject({ reason: "prompt", classifierPromptVersion: null });
  });
});
