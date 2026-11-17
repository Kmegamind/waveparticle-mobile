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

export type ContentFieldWriteError = "not-allowed" | "invalid" | "checks-failed" | "failed";

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
    /** The text's problems for this field, or null when the Companion's stories cannot be read. */
    problemsOf: (key: FieldKey, body: string) => Promise<string[] | null>;
    /** A stored version's text, or null when it does not exist or cannot be read. */
    storedBody: (key: string, version: number) => Promise<string | null>;
  },
): Promise<ContentFieldWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  const key = parseFieldKey(write.key);
  if (!key) return { ok: false, error: "invalid" };

  if (write.kind === "save") {
    const body = typeof write.body === "string" ? write.body : "";
    const problems = await deps.problemsOf(key, body);
    if (problems === null) return { ok: false, error: "failed" };
    if (problems.length > 0) return { ok: false, error: "checks-failed", problems };
    const { data, error } = await deps.rpc("save_content_field_draft", {
      field_key: write.key,
      field_body: body,
    });
    if (error) return { ok: false, error: "failed" };
    return typeof data === "number" ? { ok: true, version: data } : { ok: true };
  }

  // Publish and roll back: the admin role only (#309 AC3).
  if (deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (!Number.isInteger(write.version) || write.version < 1) return { ok: false, error: "invalid" };
  const body = await deps.storedBody(write.key, write.version);
  if (body === null) return { ok: false, error: "invalid" };
  const problems = await deps.problemsOf(key, body);
  if (problems === null) return { ok: false, error: "failed" };
  if (problems.length > 0) return { ok: false, error: "checks-failed", problems };
  const { error } = await deps.rpc(
    write.kind === "publish" ? "publish_content_field" : "roll_back_content_field",
    { field_key: write.key, field_version: write.version },
  );
  return error ? { ok: false, error: "failed" } : { ok: true };
}
