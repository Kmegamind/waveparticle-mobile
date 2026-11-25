import { expect, test } from "@playwright/test";
import { signIn, STUB_SUPABASE } from "./support/account";

// #436 (part of #430): the local Supabase stand-in supports the AI feature tables of
// 20261130000000_ai_features.sql, as the later admin pages will call them. No page exists yet
// (no UI in this pull request), so these tests call the stub's REST endpoints directly with each
// role's token. The features are shared by every test, so this file runs in order and resets them.

test.describe.configure({ mode: "serial" });

async function stub(pathname: string, token: string | null, body?: unknown) {
  return fetch(`${STUB_SUPABASE}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type Feature = {
  slug: string;
  title: string;
  status: string;
  prompt_keys: string[];
  purpose: { text: string; source: string | null; draft: boolean }[];
};

test.beforeEach(async () => {
  await stub("/__ai_features", null, { reset: true });
});

test("#436 AC4: an editor reads the 7 seeded features, every status exploring", async ({
  context,
  baseURL,
}) => {
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const answer = await stub("/rest/v1/ai_features?order=position.asc", writer.token);
  expect(answer.status).toBe(200);
  const features = (await answer.json()) as Feature[];
  expect(features.map((row) => row.title)).toEqual([
    "Goal split (plan_split)",
    "Step cards (step_cards)",
    "Pause message (stuck_story + pause_predicament)",
    "Rest reply (rest_reply)",
    "Return pop-up (return_popup)",
    "Closing line (closing_line)",
    "Safety classifier (safety_classifier)",
  ]);
  expect(new Set(features.map((row) => row.status))).toEqual(new Set(["exploring"]));
  expect(features[2].prompt_keys).toEqual(["stuck_story", "pause_predicament"]);
  expect(features[0].purpose[0]).toMatchObject({
    source: "docs/ai/AI_01_goal-split.md:13",
    draft: true,
  });
});

test("#436 AC4: an account without a role reads no rows, and no session is refused", async ({
  context,
  baseURL,
}) => {
  const plain = await signIn(context, baseURL!);
  for (const table of ["ai_features", "ai_feature_status_history", "ai_feature_test_runs"]) {
    const answer = await stub(`/rest/v1/${table}`, plain.token);
    expect(answer.status, table).toBe(200);
    expect(await answer.json(), table).toEqual([]);
    expect((await stub(`/rest/v1/${table}`, null)).status, table).toBe(401);
  }
});

test("#436 AC1: a writer cannot change a status; the status and its history stay", async ({
  context,
  baseURL,
}) => {
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const refused = await stub("/rest/v1/rpc/set_ai_feature_status", writer.token, {
    target_feature: "plan_split",
    new_status: "passed",
    change_note: null,
  });
  expect(refused.status).toBe(403);
  const [feature] = (await (
    await stub("/rest/v1/ai_features?slug=eq.plan_split", writer.token)
  ).json()) as Feature[];
  expect(feature.status).toBe("exploring");
  const history = await stub("/rest/v1/ai_feature_status_history", writer.token);
  expect(await history.json()).toEqual([]);
});

test("#436 AC1: an admin changes a status, with a history row of who, from, to and the note", async ({
  context,
  baseURL,
}) => {
  const admin = await signIn(context, baseURL!, () => ({}), { contentRole: "admin" });
  const changed = await stub("/rest/v1/rpc/set_ai_feature_status", admin.token, {
    target_feature: "rest_reply",
    new_status: "passed",
    change_note: "Read 10 replies",
  });
  expect(changed.status).toBe(204);
  const history = (await (
    await stub("/rest/v1/ai_feature_status_history?feature_slug=eq.rest_reply", admin.token)
  ).json()) as Record<string, unknown>[];
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({
    from_status: "exploring",
    to_status: "passed",
    note: "Read 10 replies",
    changed_by: admin.userId,
  });
  // The same status again, or one that does not exist, is refused.
  for (const new_status of ["passed", "done"]) {
    const again = await stub("/rest/v1/rpc/set_ai_feature_status", admin.token, {
      target_feature: "rest_reply",
      new_status,
    });
    expect(again.status, new_status).toBe(400);
  }
});

test("#436 AC1: a writer saves the sections, and an empty section stays empty (Not written yet)", async ({
  context,
  baseURL,
}) => {
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const purpose = [{ text: "Owner text.", source: null, draft: false }];
  const saved = await stub("/rest/v1/rpc/save_ai_feature_sections", writer.token, {
    target_feature: "closing_line",
    new_purpose: purpose,
    new_pass_questions: [],
    new_approach: [],
  });
  expect(saved.status).toBe(204);
  const [feature] = (await (
    await stub("/rest/v1/ai_features?slug=eq.closing_line", writer.token)
  ).json()) as (Feature & { pass_questions: unknown[]; approach: unknown[] })[];
  expect(feature.purpose).toEqual(purpose);
  expect(feature.pass_questions).toEqual([]);
  expect(feature.status).toBe("exploring");

  const bad = await stub("/rest/v1/rpc/save_ai_feature_sections", writer.token, {
    target_feature: "closing_line",
    new_purpose: [{ text: "" }],
    new_pass_questions: [],
    new_approach: [],
  });
  expect(bad.status).toBe(400);
});

test("#436 AC3: imported test runs are read back, a fake-model run marked as such", async ({
  context,
  baseURL,
}) => {
  await stub("/__ai_features", null, {
    testRuns: [
      {
        feature_slug: "plan_split",
        prompt_key: "plan_split",
        kind: "fake_model",
        run_at: "2026-11-25T20:15:34.722Z",
        prompt_version: 2,
        pass_count: 6,
        fail_count: 0,
        target_count: 6,
        summary: "Fake model (stub): says nothing about a real model.",
        report_path: "offline-runs/2026-11-25-stub/report.md",
      },
    ],
  });
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const runs = (await (
    await stub("/rest/v1/ai_feature_test_runs?feature_slug=eq.plan_split", writer.token)
  ).json()) as Record<string, unknown>[];
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ kind: "fake_model", prompt_version: 2, pass_count: 6 });
  const none = await stub("/rest/v1/ai_feature_test_runs?kind=eq.real", writer.token);
  expect(await none.json()).toEqual([]);
});
