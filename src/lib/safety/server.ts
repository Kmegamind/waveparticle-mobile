import { createClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { logEvent, type LogFields, type LogLevel } from "@/lib/logging/server-log";
import { createHttpModelProvider } from "@/lib/model-gateway/http";
import { getActivePrompt } from "@/lib/prompts/repository";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createSafetyAlarm, type FailureCounter } from "./alarm";
import {
  createSafetyClassifier,
  SAFETY_CLASSIFIER_MAX_TOKENS,
  type ClassifierPromptSource,
} from "./classifier";
import { createSafetyCheck, type SafetyCheck, type SafetyEvent } from "./check";

/**
 * The server's safety check (US-SAF-4, #117): the keyword layer plus the classifier, with the
 * failure log line and the same-day alarm. Server only.
 *
 * The classifier uses the gateway's provider settings (`MODEL_API_KEY`, `MODEL_API_URL`,
 * `MODEL_NAME`); each `SAFETY_MODEL_*` setting, when set, replaces its gateway setting, so a
 * smaller, faster model can be used (owner decision of 2026-11-22, SAFETY-PROVIDER). Without a
 * model there is no classifier: the keyword layer decides, and no alarm is raised.
 */

export const SAFETY_ENV_NAMES = [
  "SAFETY_MODEL_API_KEY",
  "SAFETY_MODEL_API_URL",
  "SAFETY_MODEL_NAME",
  "SAFETY_ALARM_WEBHOOK_URL",
] as const;

type Env = Record<string, string | undefined>;

const setting = (env: Env, own: string, shared: string) =>
  (env[own]?.trim() || env[shared]?.trim()) ?? "";

export function safetyClassifierSettings(
  env: Env,
): { apiKey: string; apiUrl: string; model: string } | null {
  const apiKey = setting(env, "SAFETY_MODEL_API_KEY", "MODEL_API_KEY");
  const apiUrl = setting(env, "SAFETY_MODEL_API_URL", "MODEL_API_URL");
  const model = setting(env, "SAFETY_MODEL_NAME", "MODEL_NAME");
  return apiKey && apiUrl && model ? { apiKey, apiUrl, model } : null;
}

/** The shared day counter in the database (20261127000000_safety_alarm_days.sql). */
export function supabaseFailureCounter(env: Env, fetchImpl?: typeof fetch): FailureCounter {
  return async () => {
    const token = env.PROMPTS_READ_TOKEN?.trim();
    if (!token) throw new Error("no reader token");
    const { url, anonKey } = readSupabaseEnv(env);
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: fetchImpl ? { fetch: fetchImpl } : undefined,
    });
    const { data, error } = await client
      .rpc("record_safety_classifier_failure", { reader_token: token })
      .abortSignal(AbortSignal.timeout(3_000));
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row || typeof row.failures !== "number") throw new Error("count failed");
    return { failures: row.failures, sendAlarm: row.send_alarm === true };
  };
}

type Log = (level: LogLevel, fields: LogFields, durationMs?: number) => void;

const serverLog: Log = (level, fields, durationMs) =>
  logEvent("safety", fields, { level, durationMs });

/** Runs the alarm after the answer is sent, so the person never waits for the webhook. */
function afterResponse(work: () => Promise<void>): void {
  try {
    after(work);
  } catch {
    // Outside a request (a script or a test) there is no `after`: run it now, unawaited.
    void work();
  }
}

export function serverSafetyCheckFrom(options: {
  env: Env;
  fetchImpl?: typeof fetch;
  prompts?: ClassifierPromptSource;
  /** The shared day counter; `null` keeps the count in this server instance only. */
  counter?: FailureCounter | null;
  log?: Log;
  schedule?: (work: () => Promise<void>) => unknown;
}): SafetyCheck {
  const log = options.log ?? serverLog;
  const schedule = options.schedule ?? afterResponse;
  const settings = safetyClassifierSettings(options.env);
  if (!settings) return createSafetyCheck({ classifier: null, onEvent: logOnly(log) });

  const classifier = createSafetyClassifier({
    provider: createHttpModelProvider({
      ...settings,
      fetchImpl: options.fetchImpl,
      maxTokens: SAFETY_CLASSIFIER_MAX_TOKENS,
    }),
    prompts: options.prompts ?? getActivePrompt,
  });
  const alarm = createSafetyAlarm({
    webhookUrl: options.env.SAFETY_ALARM_WEBHOOK_URL,
    fetchImpl: options.fetchImpl,
    counter:
      options.counter === undefined
        ? supabaseFailureCounter(options.env, options.fetchImpl)
        : options.counter,
    log: (event) => log(event.event === "safety_alarm_failed" ? "error" : "warn", event),
  });

  return createSafetyCheck({
    classifier,
    onEvent: (event) => {
      logOnly(log)(event);
      if (event.kind === "classifier_failed") {
        schedule(() => alarm.classifierFailed(event.reason));
      }
    },
  });
}

/** One log line per event: identifiers and timing only, never the text. */
function logOnly(log: Log) {
  return (event: SafetyEvent) => {
    if (event.kind === "classifier_failed") {
      log(
        "error",
        { event: "safety_classifier_failed", reason: event.reason, position: event.position },
        event.latencyMs,
      );
      return;
    }
    log(
      "warn",
      {
        event: "safety_crisis",
        layer: event.layer,
        position: event.position,
        promptVersion: event.promptVersion,
      },
      event.latencyMs,
    );
  };
}

let shared: SafetyCheck | null = null;

/** The check every server action passes on (#117). Built once per server instance. */
export function serverSafetyCheck(): SafetyCheck {
  shared ??= serverSafetyCheckFrom({ env: process.env });
  return shared;
}
