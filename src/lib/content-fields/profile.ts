import type { ContentRole } from "@/lib/admin/roles";
import type { FieldView } from "./view";

// #442: the Companion profile page as the admin prototype draws it (ADM-04): one row per field
// with its state pill, and one Save draft and one Publish in the header. Each field keeps its
// own versions (#309): Save draft makes a new draft of every changed field, Publish publishes the
// draft of every field that has one. Pure: no database, no React.

export type FieldPill = { state: "published" | "draft" | "earlier"; label: string };

/** The field's state in words: a newer draft, the published text, or nothing written yet. */
export function fieldPill(view: FieldView): FieldPill {
  if (view.draft) return { state: "draft", label: `Draft v${view.draft.version}` };
  if (view.shown.trim() !== "") return { state: "published", label: "Published" };
  return { state: "earlier", label: "Not written" };
}

/** The text a field's editor starts from: its newer draft, else the text shown now. */
export const startText = (view: FieldView) => view.draft?.body ?? view.shown;

/**
 * The fields whose typed text differs from where their editor started (spaces around a text are
 * not part of it, #317). A field never typed in is unchanged.
 */
export function changedFields(
  views: FieldView[],
  typed: Record<string, string>,
): { key: string; text: string }[] {
  return views.flatMap((view) => {
    const text = typed[view.key];
    if (text === undefined || text.trim() === startText(view).trim()) return [];
    return [{ key: view.key, text: text.trim() }];
  });
}

export type PublishPlan =
  { ok: true; drafts: { key: string; version: number }[] } | { ok: false; reason: string };

/** What the header's Publish does: every saved draft, admin only, never a text not yet saved. */
export function publishPlan(role: ContentRole, views: FieldView[], unsaved: number): PublishPlan {
  if (role !== "admin") {
    return { ok: false, reason: "Only an admin can publish. Ask an admin to publish the drafts." };
  }
  if (unsaved > 0) {
    return {
      ok: false,
      reason:
        unsaved === 1
          ? "Save draft first: 1 changed field is not saved yet."
          : `Save draft first: ${unsaved} changed fields are not saved yet.`,
    };
  }
  const drafts = views.flatMap((view) =>
    view.draft ? [{ key: view.key, version: view.draft.version }] : [],
  );
  if (drafts.length === 0)
    return { ok: false, reason: "Nothing to publish: no field has a draft." };
  return { ok: true, drafts };
}

const fields = (count: number) => (count === 1 ? "1 field" : `${count} fields`);

/** The header's status after Save draft or Publish: what was done, then what was not. */
export function saveSummary(kind: "save" | "publish", done: number, failed: number): string {
  if (kind === "save") {
    if (done === 0 && failed === 0) return "Nothing changed, so nothing was saved.";
    const saved =
      done === 0
        ? ""
        : `Saved ${done === 1 ? "1 draft" : `${done} drafts`}. The app still shows the published text.`;
    const refused =
      failed === 0
        ? ""
        : failed === 1
          ? "1 field was not saved; see the field."
          : `${failed} fields were not saved; see each field.`;
    return [saved, refused].filter(Boolean).join(" ");
  }
  const published = done === 0 ? "" : `Published ${fields(done)}.`;
  const refused =
    failed === 0
      ? ""
      : failed === 1
        ? "1 field was not published; see the field."
        : `${failed} fields were not published; see each field.`;
  return [published, refused].filter(Boolean).join(" ");
}
