import type { PromptKey } from "@/lib/prompts/repository";

// The shapes ADM-08 Prompts (#308) passes from its server pages to its client editor. Types only,
// so the client editor never imports the prompt modules under src/lib/prompts (#282: the prompt
// reader and its token stay out of client code).

/** One line of the plain line diff (src/lib/prompts/diff.ts). */
export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

export type PromptVersionState = "active" | "draft" | "earlier";

export type PromptDetail = {
  key: PromptKey;
  purpose: string;
  active: { version: number; body: string; params: Record<string, unknown>; note: string } | null;
  draft: {
    version: number;
    body: string;
    params: Record<string, unknown>;
    note: string;
    problems: string[];
    bodyDiff: DiffLine[];
    settingsDiff: DiffLine[];
  } | null;
  /** Newest first. */
  versions: { version: number; state: PromptVersionState; note: string; createdAt: string }[];
};

export type PromptWriteError =
  | "not-allowed"
  | "invalid"
  | "blank"
  | "too-long"
  | "note-too-long"
  | "settings-json"
  | "unchanged"
  | "checks-failed"
  | "never-published"
  | "failed";
