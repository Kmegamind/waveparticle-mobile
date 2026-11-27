// #479: the sample library in the Supabase stand-in (e2e/support/stub-supabase.mjs), as
// supabase/migrations/20261205000000_ai_samples.sql: content editors (admin or writer) read
// public.ai_samples and public.ai_source_excerpts; an account without a role reads no row; anon is
// refused; nobody writes through the API. Every text here is short and invented for the tests
// (AI-SAMPLES-LOCAL): no book text.
//
//   GET  /rest/v1/ai_samples | ai_source_excerpts   (editors) the library; others read []
//   POST|PATCH|DELETE on either table                42501, as the migration grants select only
//   POST /__ai_samples { token, library: "empty" | null }   that account reads an empty library,
//                                                    or the shared invented one again with null.
//   POST /__fail_reads { token, tables: ["ai_samples"] }   (stub-supabase.mjs) that read answers 500.

export const STUB_EXCERPTS = [
  {
    id: "invented-lamp-maker",
    source_label: "Invented notebook for tests, page 1",
    body: "The lamp maker counts the wicks twice before dark and writes the number on the wall.",
  },
  {
    id: "invented-ferry-clerk",
    source_label: "Invented ledger for tests, entry 12",
    body: "The ferry clerk stamps nine tickets, then finds the tenth passenger has none.",
  },
];

export const STUB_SAMPLES = [
  {
    id: "invented-lamp-maker",
    position: 1,
    name: "Lamp maker, first evening (invented)",
    companion: "Ada Tester",
    mode: "historical",
    persona: "A careful maker of lamps who trusts numbers more than weather.",
    source_excerpt_id: "invented-lamp-maker",
    background: "",
    facts: ["She sells lamps on market days.", "Her workshop has one window."],
    world_record: "",
    standing_task: "Finish twelve lamps before the fair.",
    plan: {
      goal: "Have twelve lamps ready by the fair.",
      aims: [
        { title: "Count the wicks", note: "Twice, before dark." },
        { title: "Fill the oil", note: "One jar per lamp." },
      ],
    },
  },
  {
    id: "invented-ferry-clerk",
    position: 2,
    name: "Ferry clerk, one crossing (invented)",
    companion: "Ben Sample",
    mode: "fictional",
    persona: "A tidy clerk who dislikes loose ends.",
    source_excerpt_id: "invented-ferry-clerk",
    background: "",
    facts: ["The ferry crosses twice a day."],
    world_record: "The river is wide and slow.",
    standing_task: "",
    plan: null,
  },
  {
    id: "invented-dialogue",
    position: 3,
    name: "One invented dialogue scene",
    companion: null,
    mode: null,
    persona: "",
    source_excerpt_id: null,
    background: "",
    facts: [],
    world_record: "",
    standing_task: "",
    plan: null,
  },
];

/**
 * Answers the sample library's requests; returns false for any other request.
 * @param {{ path: string, request: import("node:http").IncomingMessage,
 *   response: import("node:http").ServerResponse, url: URL, dataset: any, datasets: Map<string, any>,
 *   json: Function, matches: Function, ordered: Function, readBody: Function }} context
 */
export async function handleAiSamples(context) {
  const { path, request, response, url, dataset, datasets, json, matches, ordered, readBody } =
    context;

  if (path === "/__ai_samples" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const account = datasets.get(body.token);
    if (!account) {
      json(response, 404, { message: "no such account" });
      return true;
    }
    if (![null, "empty"].includes(body.library)) {
      json(response, 400, { message: "library is empty or null" });
      return true;
    }
    account.aiSamplesEmpty = body.library === "empty";
    json(response, 200, { ok: true });
    return true;
  }

  const table = path.match(/^\/rest\/v1\/(ai_samples|ai_source_excerpts)$/);
  if (!table) return false;
  const user = dataset && !dataset.deleted ? dataset : null;
  if (request.method !== "GET") {
    json(response, user ? 403 : 401, {
      code: "42501",
      message: `permission denied for table ${table[1]}`,
    });
    return true;
  }
  if (!user) {
    json(response, 401, { code: "42501", message: "permission denied" });
    return true;
  }
  if ((user.failReads ?? []).includes(table[1])) {
    json(response, 500, { message: "stub read failure" });
    return true;
  }
  const editor = ["admin", "writer"].includes(user.contentRole);
  const all = user.aiSamplesEmpty ? [] : table[1] === "ai_samples" ? STUB_SAMPLES : STUB_EXCERPTS;
  const params = [...url.searchParams.entries()];
  const rows = ordered(
    (editor ? all : []).filter((row) => matches(row, params)),
    url.searchParams.get("order"),
  );
  json(response, 200, rows);
  return true;
}
