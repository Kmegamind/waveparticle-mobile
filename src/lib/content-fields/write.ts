import type { ContentRole } from "@/lib/admin/roles";
import { parseFieldKey, type FieldKey } from "./fields";

// The writes behind Save draft, Publish and Roll back of a Companion or story field (#309). Each
// is refused here before any database call when the account, the role, the key or the text is
// wrong: an admin or writer saves, only an admin publishes or rolls back, and Publish and Roll back
// run the checks again on the stored version (a year, date or age never reaches the Life Path).
// The database functions check the role and the period rules again. Server only.

export type ContentFieldWrite =
  | { kind: "save"; key: string; body: string }
  | { kind: "publish" | "roll_back"; key: string; version: number };

export type ContentFieldWriteError =
  "not-allowed" | "invalid" | "unknown-item" | "never-published" | "checks-failed" | "failed";

export type ContentFieldWriteResult =
  | { ok: true; version?: number }
  | { ok: false; error: ContentFieldWriteError; problems?: string[] };

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export async function writeContentField(
  write: ContentFieldWrite,
  deps: {
    userId: string | null;
    role: ContentRole | null;
    rpc: Rpc;
    /**
     * The text's problems for this field; "unknown-item" when its Companion or story does not
     * exist; null when the Companion's stories cannot be read.
     */
    problemsOf: (key: FieldKey, body: string) => Promise<string[] | "unknown-item" | null>;
    /** A stored version's text, or null when it does not exist or cannot be read. */
    storedBody: (key: string, version: number) => Promise<string | null>;
  },
): Promise<ContentFieldWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  const key = parseFieldKey(write.key);
  if (!key) return { ok: false, error: "invalid" };

  if (write.kind === "save") {
    // Spaces around the text are not saved (#317), as the field check ignores them.
    const body = typeof write.body === "string" ? write.body.trim() : "";
    const problems = await deps.problemsOf(key, body);
    if (problems === null) return { ok: false, error: "failed" };
    if (problems === "unknown-item") return { ok: false, error: "unknown-item" };
    if (problems.length > 0) return { ok: false, error: "checks-failed", problems };
    const { data, error } = await deps.rpc("save_content_field_draft", {
      field_key: write.key,
      field_body: body,
    });
    if (error) return refusal(error);
    return typeof data === "number" ? { ok: true, version: data } : { ok: true };
  }

  // Publish and roll back: the admin role only (#309 AC3).
  if (deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (!Number.isInteger(write.version) || write.version < 1) return { ok: false, error: "invalid" };
  const body = await deps.storedBody(write.key, write.version);
  if (body === null) return { ok: false, error: "invalid" };
  const problems = await deps.problemsOf(key, body);
  if (problems === null) return { ok: false, error: "failed" };
  if (problems === "unknown-item") return { ok: false, error: "unknown-item" };
  if (problems.length > 0) return { ok: false, error: "checks-failed", problems };
  const { error } = await deps.rpc(
    write.kind === "publish" ? "publish_content_field" : "roll_back_content_field",
    { field_key: write.key, field_version: write.version },
  );
  return error ? refusal(error) : { ok: true };
}

/**
 * A database refusal with its reason (#317), so the page can say why. The functions of
 * 20261124000000_content_fields.sql raise 23514 with the failed rule, 42501 for a role, P0002 for
 * a field that does not exist, and "needs a version … that was published before" for a roll back
 * to a draft. Anything else is a failure the person may retry.
 */
function refusal(error: unknown): ContentFieldWriteResult {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  const text = typeof message === "string" ? message : "";
  if (code === "42501") return { ok: false, error: "not-allowed" };
  if (code === "P0002") return { ok: false, error: "invalid" };
  if (code === "23514") {
    const rule = text.match(/^field \S+ version \d+: (.+)$/)?.[1]?.trim();
    if (rule) {
      const sentence = `${rule[0].toUpperCase()}${rule.slice(1)}`;
      return {
        ok: false,
        error: "checks-failed",
        problems: [/[.!?]$/.test(sentence) ? sentence : `${sentence}.`],
      };
    }
  }
  if (/that was published before/.test(text)) return { ok: false, error: "never-published" };
  return { ok: false, error: "failed" };
}
