import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #473: the local Supabase stand-in serves the registry columns and functions of
// 20261202000000_ai_registry.sql. Each test gives its account its own copy of the features
// (POST /__ai_features { token, own: true }), so nothing here changes a row another test or the
// visual gate reads. The prompt test adds one invented pipeline key and removes it again.

/** The server's prompt reader token in the e2e run (playwright.config.ts). */
const PROMPTS_READ_TOKEN = "e2e-prompts-reader";

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

async function own(token: string) {
  expect((await stub("/__ai_features", null, { token, own: true })).status).toBe(200);
}

type Feature = {
  slug: string;
  feature_id: string;
  category: string;
  status: string;
  requirement: string;
  notes: string;
  example_text: string;
  example_state: string;
};

const fields = (requirement: string) => ({
  target_feature: "rest_reply",
  new_where_used: "Invented place",
  new_requirement: requirement,
  new_output_format: "Invented format",
  new_design_rationale: "",
  new_room_to_improve: "",
  new_notes: "Invented note",
});

test("test_473_runtime_rows_carry_feature_id_category_and_empty_fields", async ({
  page,
  context,
}) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await own(writer.token);
  const rows = (await (
    await stub("/rest/v1/ai_features?order=position.asc", writer.token)
  ).json()) as Feature[];
  expect(rows.map((row) => row.feature_id)).toEqual([
    "R-01",
    "R-02",
    "R-03",
    "R-04",
    "R-05",
    "R-06",
    "R-07",
  ]);
  expect(new Set(rows.map((row) => row.category))).toEqual(new Set(["runtime"]));
  expect(new Set(rows.map((row) => row.requirement))).toEqual(new Set([""]));
  expect(new Set(rows.map((row) => row.example_state))).toEqual(new Set(["none"]));
});

test("test_473_a_writer_edits_fields_and_the_example_with_history", async ({ page, context }) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await own(writer.token);
  expect(
    (await stub("/rest/v1/rpc/save_ai_feature_fields", writer.token, fields("Invented need")))
      .status,
  ).toBe(204);
  expect(
    (
      await stub("/rest/v1/rpc/set_ai_feature_example", writer.token, {
        target_feature: "rest_reply",
        new_text: "Invented example",
        new_state: "confirmed",
      })
    ).status,
  ).toBe(204);
  const [row] = (await (
    await stub("/rest/v1/ai_features?slug=eq.rest_reply", writer.token)
  ).json()) as Feature[];
  expect(row).toMatchObject({
    requirement: "Invented need",
    notes: "Invented note",
    example_text: "Invented example",
    example_state: "confirmed",
    status: "exploring",
    category: "runtime",
  });
  const history = (await (
    await stub("/rest/v1/ai_feature_field_history?feature_slug=eq.rest_reply", writer.token)
  ).json()) as { field: string; old_value: unknown; new_value: unknown; changed_by: string }[];
  // Only the fields that changed: the two left empty have no row.
  expect(history.map((item) => item.field).sort()).toEqual([
    "notes",
    "output_format",
    "requirement",
    "where_used",
  ]);
  expect(history.find((item) => item.field === "requirement")).toMatchObject({
    old_value: "",
    new_value: "Invented need",
    changed_by: writer.userId,
  });
  const examples = (await (
    await stub("/rest/v1/ai_feature_example_history?feature_slug=eq.rest_reply", writer.token)
  ).json()) as { example_state: string; set_by: string }[];
  expect(examples).toEqual([
    expect.objectContaining({ example_state: "confirmed", set_by: writer.userId }),
  ]);
});

test("test_473_a_writer_cannot_change_the_status_or_the_category", async ({ page, context }) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await own(writer.token);
  const category = await stub("/rest/v1/rpc/set_ai_feature_category", writer.token, {
    target_feature: "plan_split",
    new_category: "gate",
  });
  expect(category.status).toBe(403);
  expect((await category.json()).code).toBe("42501");
  const status = await stub("/rest/v1/rpc/set_ai_feature_status", writer.token, {
    target_feature: "plan_split",
    new_status: "passed",
  });
  expect(status.status).toBe(403);
  const [row] = (await (
    await stub("/rest/v1/ai_features?slug=eq.plan_split", writer.token)
  ).json()) as Feature[];
  expect(row).toMatchObject({ category: "runtime", status: "exploring" });
  expect(await (await stub("/rest/v1/ai_feature_field_history", writer.token)).json()).toEqual([]);
});

test("test_473_an_admin_changes_the_category_with_a_history_row", async ({ page, context }) => {
  const admin = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await own(admin.token);
  expect(
    (
      await stub("/rest/v1/rpc/set_ai_feature_category", admin.token, {
        target_feature: "plan_split",
        new_category: "gate",
      })
    ).status,
  ).toBe(204);
  const history = await (
    await stub("/rest/v1/ai_feature_field_history?feature_slug=eq.plan_split", admin.token)
  ).json();
  expect(history).toEqual([
    expect.objectContaining({ field: "category", old_value: "runtime", new_value: "gate" }),
  ]);
});

test("test_473_no_role_and_no_session_read_nothing_new_and_write_nothing", async ({
  page,
  context,
}) => {
  const plain = await signIn(context, baseUrlOf(page));
  for (const table of ["ai_feature_field_history", "ai_feature_example_history"]) {
    const answer = await stub(`/rest/v1/${table}`, plain.token);
    expect(answer.status, table).toBe(200);
    expect(await answer.json(), table).toEqual([]);
    expect((await stub(`/rest/v1/${table}`, null)).status, table).toBe(401);
  }
  for (const token of [plain.token, null]) {
    expect((await stub("/rest/v1/rpc/save_ai_feature_fields", token, fields("x"))).status).toBe(
      403,
    );
    expect(
      (
        await stub("/rest/v1/rpc/set_ai_feature_example", token, {
          target_feature: "rest_reply",
          new_text: "x",
          new_state: "candidate",
        })
      ).status,
    ).toBe(403);
  }
});

test("test_473_get_active_prompts_returns_runtime_keys_only", async ({ page, context }) => {
  const key = "p99_invented_pipeline";
  try {
    expect(
      (
        await stub("/__prompts", null, {
          importRows: [{ key, body: "Invented pipeline prompt.", category: "pipeline" }],
        })
      ).status,
    ).toBe(200);
    const active = (await (
      await stub("/rest/v1/rpc/get_active_prompts", null, { reader_token: PROMPTS_READ_TOKEN })
    ).json()) as { key: string }[];
    expect(active.map((row) => row.key)).toContain("plan_split");
    expect(active.map((row) => row.key)).not.toContain(key);

    // The admin reads every key, with its category; a draft keeps the key's category.
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    expect(
      (
        await stub("/rest/v1/rpc/save_prompt_draft", writer.token, {
          prompt_key: key,
          prompt_body: "Invented draft.",
          prompt_params: {},
          prompt_note: "",
        })
      ).status,
    ).toBeLessThan(300);
    const versions = (await (
      await stub("/rest/v1/rpc/list_prompt_versions", writer.token, {})
    ).json()) as { key: string; version: number; category: string }[];
    expect(versions.filter((row) => row.key === key)).toEqual([
      expect.objectContaining({ version: 2, category: "pipeline" }),
      expect.objectContaining({ version: 1, category: "pipeline" }),
    ]);
    expect(versions.find((row) => row.key === "plan_split")?.category).toBe("runtime");
  } finally {
    await stub("/__prompts", null, { reset: key });
  }
});
