import { formatHistoryTime } from "@/lib/publish-history/admin";

// ADM-03 (#313, row 13): the "Shown to users" and "Last change" columns of the Companions table.
// Pure. Phones can open a Companion's Life Path only when he has a story, so a Companion without
// stories is "Not ready". The last change is the newest Publish history row whose key is his:
// his fields, his stories' fields and his stories' cards.

type HistoryFact = { kind: string; item_key: string; person: string; acted_at: string };

function belongsTo(row: HistoryFact, code: string, storyIds: ReadonlySet<string>): boolean {
  const parts = row.item_key.split(".");
  if (row.kind === "companion_field") return parts[0] === "chr" && parts[1] === code;
  if (row.kind === "story_card")
    return parts[0] === "crd" && parts[1] === code && storyIds.has(parts[2]);
  if (row.kind === "story_field") return parts[0] === code && storyIds.has(parts[1]);
  return false;
}

// "11-18" from "11-18 23:42"; a date that cannot be read is shown whole, never cut (#317).
const dayOf = (actedAt: string) =>
  Number.isNaN(Date.parse(actedAt)) ? actedAt : formatHistoryTime(actedAt).slice(0, 5);

export function companionRow(
  companion: { id: string; key_code: string },
  stories: { id: string; companion_id: string }[],
  history: HistoryFact[],
): { shown: "Published" | "Not ready"; lastChange: string } {
  const storyIds = new Set(stories.filter((s) => s.companion_id === companion.id).map((s) => s.id));
  const newest = history
    .filter((row) => belongsTo(row, companion.key_code, storyIds))
    .sort((a, b) => Date.parse(b.acted_at) - Date.parse(a.acted_at))[0];
  return {
    shown: storyIds.size > 0 ? "Published" : "Not ready",
    lastChange: newest ? `${newest.person} · ${dayOf(newest.acted_at)}` : "—",
  };
}
