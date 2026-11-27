// Test-only stub model server for the e2e run (#254). The live e2e app points MODEL_API_URL here.
// POST answers in the provider's chat format; GET /prompts lists the prompts received.
import { createServer } from "node:http";
import { stubAnswer } from "./stub-cards.mjs";

const port = Number(process.env.STUB_MODEL_PORT ?? process.env.E2E_STUB_PORT ?? "3199");
const prompts = [];
const STUB_INPUT_TOKENS = 120;
const STUB_OUTPUT_TOKENS = 30;
const STUB_ERROR_PROMPT = "STUB MODEL ERROR";

createServer((request, response) => {
  if (request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(request.url === "/prompts" ? prompts : { ok: true }));
    return;
  }
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    let prompt = "";
    try {
      prompt = JSON.parse(body || "{}").messages?.[0]?.content ?? "";
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }
    prompts.push(prompt);
    // #476: a prompt that is exactly this marker gets a provider error, so the prompt lab's error
    // run can be tested; nothing in the app sends it.
    if (prompt === STUB_ERROR_PROMPT) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "stub error" }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [{ message: { content: stubAnswer(prompt) } }],
        // #476: fixed token counts, so the prompt lab's run log and cost can be tested.
        usage: { prompt_tokens: STUB_INPUT_TOKENS, completion_tokens: STUB_OUTPUT_TOKENS },
      }),
    );
  });
}).listen(port, "127.0.0.1");
