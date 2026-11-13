// Test-only stub model server for the e2e run (#254). The live e2e app points MODEL_API_URL here.
// POST answers in the provider's chat format; GET /prompts lists the prompts received.
import { createServer } from "node:http";
import { stubAnswer } from "./stub-cards.mjs";

const port = Number(process.env.STUB_MODEL_PORT ?? "3199");
const prompts = [];

createServer((request, response) => {
  if (request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(request.url === "/prompts" ? prompts : { ok: true }));
    return;
  }
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const prompt = JSON.parse(body || "{}").messages?.[0]?.content ?? "";
    prompts.push(prompt);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: stubAnswer(prompt) } }] }));
  });
}).listen(port, "127.0.0.1");
