// The plain line diff of ADM-08 Prompts (#308 AC4): a draft against the active version, for the
// prompt text and for its settings. Each line is the same, added or removed; the page shows the
// kind as a visible + or − so it is never carried by colour alone.

import type { DiffLine } from "@/lib/admin/prompt-editor-types";

export type { DiffLine };

/** The lines of `after` against `before`, from their longest common run of lines. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  // common[i][j]: the longest common run of a[i..] and b[j..].
  const common = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      common[i][j] =
        a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (common[i + 1][j] >= common[i][j + 1]) {
      lines.push({ kind: "removed", text: a[i] });
      i += 1;
    } else {
      lines.push({ kind: "added", text: b[j] });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) lines.push({ kind: "removed", text: a[i] });
  for (; j < b.length; j += 1) lines.push({ kind: "added", text: b[j] });
  return lines;
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((name) => [name, sorted((value as Record<string, unknown>)[name])]),
  );
}

/**
 * Settings as the editor shows and the diff compares them: JSON with keys in alphabetical order at
 * every level and a two-space indent, so the database's own key order never shows as a change.
 */
export function settingsText(params: Record<string, unknown>): string {
  return JSON.stringify(sorted(params), null, 2);
}
