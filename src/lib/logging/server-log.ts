/**
 * The one way the server writes a log line (#135). A line names what happened, never what a user
 * wrote: it carries the feature, an event name, a request id, an optional duration and a few
 * identifier fields (a prompt key, a rule id, a reason).
 *
 * Two guards keep user text out:
 * - field names that hold user text (goal, step, chat, card, text, ...) are refused, by type and
 *   at run time;
 * - every string value must look like an identifier (letters, digits, `_ . : -`, at most 64
 *   characters), so a sentence cannot slip in under a harmless name.
 *
 * Outside production a refused entry throws, so a test catches the mistake. In production the
 * entry is replaced by a `log_refused` line that names the refused fields but never their values,
 * because logging must not break the page that is failing.
 */

export type LogFeature = "app_text" | "prompts" | "story-content" | "story-cards" | "model-gateway";

export type LogLevel = "warn" | "error";

/** Field names that would hold what a user wrote, or the text shown to them. */
export const USER_TEXT_FIELDS = [
  "goal",
  "goals",
  "step",
  "steps",
  "title",
  "description",
  "chat",
  "message",
  "messages",
  "reply",
  "card",
  "cards",
  "line",
  "lines",
  "text",
  "body",
  "content",
  "prompt",
  "input",
  "answer",
  "nickname",
  "name",
  "email",
  "error",
] as const;

type UserTextField = (typeof USER_TEXT_FIELDS)[number];
type ReservedField = "level" | "feature" | "requestId" | "durationMs";

export type LogValue = string | number | boolean | null | readonly string[];

export type LogFields = { event: string } & { [field: string]: LogValue | undefined } & {
  [K in UserTextField | ReservedField]?: never;
};

export type LogSink = (level: LogLevel, line: string) => void;

export type LogOptions = {
  /** Ties lines of one request together; a new id is made when none is passed. */
  requestId?: string;
  durationMs?: number;
  level?: LogLevel;
  /** Where the line goes; the server console unless a test passes another. */
  sink?: LogSink;
};

const IDENTIFIER = /^[A-Za-z0-9_.:-]{1,64}$/;
const FORBIDDEN = new Set<string>([
  ...USER_TEXT_FIELDS,
  "level",
  "feature",
  "requestId",
  "durationMs",
]);

const consoleSink: LogSink = (level, line) => {
  if (level === "error") console.error(line);
  else console.warn(line);
};

function safeValue(value: unknown): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return IDENTIFIER.test(value);
  if (Array.isArray(value))
    return (
      value.length <= 20 && value.every((item) => typeof item === "string" && IDENTIFIER.test(item))
    );
  return false;
}

function refusedFields(fields: Record<string, unknown>, requestId: string): string[] {
  const refused = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .filter(([name, value]) => FORBIDDEN.has(name) || !IDENTIFIER.test(name) || !safeValue(value))
    .map(([name]) => name);
  if (!IDENTIFIER.test(requestId)) refused.push("requestId");
  return refused;
}

export function logEvent(feature: LogFeature, fields: LogFields, options: LogOptions = {}): void {
  const level = options.level ?? "warn";
  const sink = options.sink ?? consoleSink;
  const requestId = options.requestId ?? crypto.randomUUID();
  const refused = refusedFields(fields, requestId);

  if (refused.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `logEvent refused ${refused.map((name) => `"${name}"`).join(", ")}: log lines carry identifiers only, never user text.`,
      );
    }
    const names = refused.filter((name) => IDENTIFIER.test(name)).slice(0, 20);
    sink(
      "error",
      JSON.stringify({ level: "error", feature, event: "log_refused", refusedFields: names }),
    );
    return;
  }

  const entry: Record<string, unknown> = { level, feature, event: fields.event, requestId };
  if (options.durationMs !== undefined) entry.durationMs = Math.round(options.durationMs);
  for (const [name, value] of Object.entries(fields)) {
    if (name !== "event" && value !== undefined) entry[name] = value;
  }
  sink(level, JSON.stringify(entry));
}
