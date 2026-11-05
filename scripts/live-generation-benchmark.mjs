import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const configUrl = new URL("./live-generation-benchmark.config.json", import.meta.url);
const costCapExceededCode = 2;
const surfaceSchedulesMs = {
  first_story_card: 0,
  later_story_card: 300_000,
};

export const numericResultKeys = [
  "session",
  "surface",
  "inputTokens",
  "outputTokens",
  "timeToFirstTokenMs",
  "totalTimeMs",
  "estimatedCostUsd",
  "success",
  "checkPassed",
  "fallbackUsed",
  "readyBeforeSchedule",
];

export function calculateCostUsd(inputTokens, outputTokens, inputPrice, outputPrice) {
  return (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
}

export function calculateScheduleReadiness(totalTimeMs, scheduleMs) {
  return scheduleMs === undefined || totalTimeMs < scheduleMs;
}

export function estimateMaximumCostUsd(
  sessions,
  callsPerSession,
  maxInputTokens,
  maxOutputTokens,
  inputPrice,
  outputPrice,
) {
  return calculateCostUsd(
    sessions * callsPerSession * maxInputTokens,
    sessions * callsPerSession * maxOutputTokens,
    inputPrice,
    outputPrice,
  );
}

export function shouldStopForCostCap(currentCost, nextCost, cap) {
  return currentCost + nextCost > cap;
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function summarizeRecords(records) {
  const firstTokenTimes = records.map((record) => record.timeToFirstTokenMs);
  const totalTimes = records.map((record) => record.totalTimeMs);
  const cardRecords = records.filter((record) =>
    ["first_story_card", "later_story_card"].includes(record.surface),
  );
  const totalCost = records.reduce((sum, record) => sum + record.estimatedCostUsd, 0);
  return {
    provider: records[0]?.provider ?? "",
    model: records[0]?.model ?? "",
    calls: records.length,
    medianTimeToFirstTokenMs: percentile(firstTokenTimes, 50),
    p95TimeToFirstTokenMs: percentile(firstTokenTimes, 95),
    medianTotalTimeMs: percentile(totalTimes, 50),
    p95TotalTimeMs: percentile(totalTimes, 95),
    costPerCallUsd: records.length ? totalCost / records.length : 0,
    oneHourSessionCostUsd: records
      .filter((record) => record.session === records[0]?.session)
      .reduce((sum, record) => sum + record.estimatedCostUsd, 0),
    scheduledCardReadinessPercent: cardRecords.length
      ? (cardRecords.reduce((sum, record) => sum + record.readyBeforeSchedule, 0) /
          cardRecords.length) *
        100
      : 0,
  };
}

function assertNoSecrets(value) {
  if (typeof value === "string" && /(api[_-]?key|secret|authorization|bearer)/i.test(value)) {
    throw new Error("Benchmark input contains a secret-like value");
  }
}

function samplePrompt(surface, session) {
  const goal = [
    "Sort a drawer of old maps into three labeled folders.",
    "Draft the opening paragraph for a small history essay.",
    "Repair a loose shelf and put the books back in order.",
    "Read a short article and mark the claims that need checking.",
  ][session % 4];
  const prompts = {
    first_story_card: `Invented benchmark goal: ${goal}. Write one short first-person story card about a person examining a room. Return JSON with one string field named card.`,
    later_story_card: `Invented benchmark goal: ${goal}. Write one short first-person story card about the next quiet change in the same room. Return JSON with one string field named card.`,
    stuck_story: `Invented benchmark goal: ${goal}. Write one short first-person line about a small snag in the character's own work, without adding an event. Return JSON with one string field named story.`,
    return_popup: `Invented benchmark goal: ${goal}. Write one short first-person line about what the character did while the scene stood still. Return JSON with one string field named returnLine.`,
    rest_chat: `Invented benchmark goal: ${goal}. Reply briefly from the character's own side, without advice or praise. Return JSON with one string field named reply.`,
    closing_line: `Invented benchmark goal: ${goal}. Write one or two short first-person sentences about the character's present feeling. Return JSON with one string field named closingLine.`,
  };
  return prompts[surface];
}

function checkGeneratedText(text) {
  return (
    typeof text === "string" && text.length > 0 && !text.includes("?") && !/\byou\b/i.test(text)
  );
}

function extractText(payload) {
  return (
    payload?.choices?.[0]?.delta?.content ??
    payload?.choices?.[0]?.delta?.reasoning_content ??
    payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ??
    ""
  );
}

function extractUsage(payload, provider) {
  if (provider === "deepseek") {
    return {
      inputTokens: payload?.usage?.prompt_tokens ?? 0,
      outputTokens: payload?.usage?.completion_tokens ?? 0,
    };
  }
  return {
    inputTokens: payload?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: payload?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function consumeSse(response, provider, startedAt) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider returned no stream");
  const decoder = new TextDecoder();
  let buffer = "";
  let firstTokenAt;
  let usage = { inputTokens: 0, outputTokens: 0 };
  let checked = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!data || data === "[DONE]") continue;
      const payload = JSON.parse(data);
      const text = extractText(payload);
      if (text && firstTokenAt === undefined) firstTokenAt = Date.now();
      if (text) checked = checkGeneratedText(text);
      const nextUsage = extractUsage(payload, provider);
      if (nextUsage.inputTokens || nextUsage.outputTokens) usage = nextUsage;
    }
  }

  const completedAt = Date.now();
  return {
    ...usage,
    timeToFirstTokenMs: (firstTokenAt ?? completedAt) - startedAt,
    totalTimeMs: completedAt - startedAt,
    checkPassed: checked ? 1 : 0,
  };
}

async function callProvider(provider, prompt, maxOutputTokens) {
  assertNoSecrets(prompt);
  const startedAt = Date.now();
  const headers = { "content-type": "application/json" };
  let url;
  let body;
  if (provider.provider === "deepseek") {
    headers.authorization = `Bearer ${process.env.DEEPSEEK_API_KEY}`;
    url = "https://api.deepseek.com/chat/completions";
    body = {
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxOutputTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`;
    body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens },
    };
  }

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Provider request failed with status ${response.status}`);
  }
  return consumeSse(response, provider.provider, startedAt);
}

function outputRecord(session, surface, provider, metrics, prices) {
  const scheduleMs = surfaceSchedulesMs[surface];
  return {
    provider: provider.provider,
    model: provider.model,
    session,
    surface,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    timeToFirstTokenMs: metrics.timeToFirstTokenMs,
    totalTimeMs: metrics.totalTimeMs,
    estimatedCostUsd: calculateCostUsd(
      metrics.inputTokens,
      metrics.outputTokens,
      prices.inputPricePerMillion,
      prices.outputPricePerMillion,
    ),
    success: 1,
    checkPassed: metrics.checkPassed,
    fallbackUsed: metrics.checkPassed ? 0 : 1,
    readyBeforeSchedule: calculateScheduleReadiness(metrics.totalTimeMs, scheduleMs) ? 1 : 0,
  };
}

async function loadConfig() {
  return JSON.parse(await readFile(configUrl, "utf8"));
}

export async function runBenchmark({ fetchImpl = fetch, write = console.log } = {}) {
  globalThis.fetch = fetchImpl;
  const config = await loadConfig();
  const callsPerSession = config.surfaces.length;
  const estimatedMaximumCost = config.providers.reduce(
    (total, provider) =>
      total +
      estimateMaximumCostUsd(
        config.sessionsPerProvider,
        callsPerSession,
        config.maxInputTokensPerCall,
        config.maxOutputTokensPerCall,
        provider.inputPricePerMillion,
        provider.outputPricePerMillion,
      ),
    0,
  );
  if (estimatedMaximumCost > config.costCapUsd) {
    throw new Error(`Estimated maximum cost ${estimatedMaximumCost} exceeds ${config.costCapUsd}`);
  }

  let totalCost = 0;
  for (const provider of config.providers) {
    if (provider.provider === "deepseek" && !process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not set");
    }
    if (provider.provider === "gemini" && !process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    const records = [];
    for (let session = 1; session <= config.sessionsPerProvider; session += 1) {
      for (const surface of config.surfaces) {
        const prompt = samplePrompt(surface, session);
        const metrics = await callProvider(provider, prompt, config.maxOutputTokensPerCall);
        const record = outputRecord(session, surface, provider, metrics, provider);
        if (shouldStopForCostCap(totalCost, record.estimatedCostUsd, config.costCapUsd)) {
          throw new Error(`Estimated run cost exceeded ${config.costCapUsd}`);
        }
        totalCost += record.estimatedCostUsd;
        records.push(record);
        write(JSON.stringify(record));
      }
    }
    write(JSON.stringify(summarizeRecords(records)));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBenchmark().catch((error) => {
    console.error(error instanceof Error ? error.message : "Benchmark failed");
    process.exitCode = error.code === costCapExceededCode ? costCapExceededCode : 1;
  });
}
