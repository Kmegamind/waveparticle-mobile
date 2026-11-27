// #475 (registry slice 3): what the e2e Supabase stand-in (stub-supabase.mjs) adds for
// supabase/migrations/20261204000000_ai_registry_editing.sql, kept in its own file so the shared
// stub changes by one call only.
//
//   POST /rest/v1/rpc/save_ai_feature_registry_fields (editors) { target_feature, loaded_at,
//        new_name, new_where_used, ... new_notes }   the name (the title keeps its bracketed
//        prompt keys) and the six text fields, a field history row for each change, refused with
//        40001 when fields_updated_at is not loaded_at; answers the new fields_updated_at.
//   POST /rest/v1/rpc/list_ai_feature_people (editors)   also the accounts of the field history,
//        the example history, the last field editor and whoever set the example.

/**
 * Answers one request when it is one of the two above; returns false otherwise.
 * @param {{ path: string, request: import("node:http").IncomingMessage,
 *   response: import("node:http").ServerResponse, dataset: any, datasets: Map<string, any>,
 *   state: any, readBody: (request: any) => Promise<any>, json: Function,
 *   record: Function, textFields: string[], fieldMax: number[] }} ctx
 */
export async function registryEditingRoute(ctx) {
  const { path, request, response, dataset, json } = ctx;
  if (request.method !== "POST") return false;
  const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);

  if (path === "/rest/v1/rpc/save_ai_feature_registry_fields") {
    const body = (await ctx.readBody(request)) ?? {};
    if (!editor) {
      json(response, 403, {
        code: "42501",
        message: "only a content editor may change an AI feature",
      });
      return true;
    }
    const values = ctx.textFields.map((field) => body[`new_${field}`]);
    if (typeof body.new_name !== "string" || !values.every((value) => typeof value === "string")) {
      json(response, 400, { code: "22004", message: "a registry field is text, never null" });
      return true;
    }
    if (body.new_name.trim() === "") {
      json(response, 400, { code: "22023", message: "a feature needs a name" });
      return true;
    }
    // As the database: every "(" of the name is closed by a later ")".
    let depth = 0;
    for (const character of body.new_name) {
      depth += character === "(" ? 1 : character === ")" ? -1 : 0;
      if (depth < 0) break;
    }
    if (depth !== 0) {
      json(response, 400, { code: "22023", message: "the brackets of a name do not balance" });
      return true;
    }
    if (values.some((value, index) => value.length > ctx.fieldMax[index])) {
      json(response, 400, { code: "23514", message: "violates check constraint" });
      return true;
    }
    const feature = ctx.state.features.find((row) => row.slug === body.target_feature);
    if (!feature) {
      json(response, 400, { code: "P0002", message: `no AI feature ${body.target_feature}` });
      return true;
    }
    if ((feature.fields_updated_at ?? null) !== (body.loaded_at ?? null)) {
      json(response, 409, { code: "40001", message: "saved after it was loaded" });
      return true;
    }
    const keys = feature.title.match(/\s*\([^()]*\)\s*$/)?.[0] ?? "";
    // As the database: a name ending in brackets needs a keys group after it in the title.
    if (keys === "" && /\([^()]*\)$/.test(body.new_name.trim())) {
      json(response, 400, {
        code: "22023",
        message: "a name ends in brackets with no keys after it",
      });
      return true;
    }
    const title = body.new_name.trim() + keys;
    if (title.length > 120) {
      json(response, 400, { code: "23514", message: "violates check constraint" });
      return true;
    }
    ctx.record(ctx.state, feature.slug, "title", feature.title, title, dataset.user);
    feature.title = title;
    ctx.textFields.forEach((field, index) => {
      ctx.record(ctx.state, feature.slug, field, feature[field], values[index], dataset.user);
      feature[field] = values[index];
    });
    feature.fields_updated_at = new Date().toISOString();
    feature.fields_updated_by = dataset.user.id;
    json(response, 200, feature.fields_updated_at);
    return true;
  }

  if (path === "/rest/v1/rpc/list_ai_feature_people") {
    const body = (await ctx.readBody(request)) ?? {};
    if (!editor) {
      json(response, 403, {
        code: "42501",
        message: "only a content editor may read who changed an AI feature",
      });
      return true;
    }
    const slug = body.target_feature;
    const { state } = ctx;
    const feature = state.features.find((row) => row.slug === slug);
    const ids = new Set(
      [
        ...state.history.filter((row) => row.feature_slug === slug).map((row) => row.changed_by),
        ...state.fieldHistory
          .filter((row) => row.feature_slug === slug)
          .map((row) => row.changed_by),
        ...state.exampleHistory.filter((row) => row.feature_slug === slug).map((row) => row.set_by),
        feature?.sections_updated_by,
        feature?.fields_updated_by,
        feature?.example_set_by,
      ].filter(Boolean),
    );
    // auth.users: each seeded account that is not deleted, once.
    const found = new Map();
    for (const item of ctx.datasets.values()) {
      if (!item.deleted && ids.has(item.user.id)) found.set(item.user.id, item.user.email ?? null);
    }
    json(
      response,
      200,
      [...found].map(([user_id, email]) => ({ user_id, email })),
    );
    return true;
  }

  return false;
}
