// One Companion or story field as the admin shows it (#309): the text the app shows now (the
// column `get_story_content` reads), the newer draft and every version, as app text does (#288).

/** One row of `public.content_fields`, as the editor's own client reads it. */
export type ContentFieldRow = {
  key: string;
  version: number;
  body: string;
  published: boolean;
  published_at: string | null;
};

export type FieldVersionState = "published" | "draft" | "earlier";

export type FieldView = {
  key: string;
  /** The text the app and the phones show now. */
  shown: string;
  /** The newest version above the published one that was never published. */
  draft: { version: number; body: string } | null;
  /** Newest first. Roll back is offered on every version that was published before. */
  versions: { version: number; body: string; state: FieldVersionState; canRollBack: boolean }[];
};

export function fieldView(key: string, shown: string, rows: ContentFieldRow[]): FieldView {
  const versions = rows
    .filter((row) => row.key === key)
    .sort((left, right) => right.version - left.version);
  const current = versions.find((row) => row.published) ?? null;
  const draft =
    versions.find(
      (row) =>
        !row.published && row.published_at === null && (!current || row.version > current.version),
    ) ?? null;
  return {
    key,
    shown,
    draft: draft ? { version: draft.version, body: draft.body } : null,
    versions: versions.map((row) => {
      const state: FieldVersionState = row.published
        ? "published"
        : row.published_at !== null
          ? "earlier"
          : "draft";
      return {
        version: row.version,
        body: row.body,
        state,
        canRollBack: state === "earlier" && current !== null,
      };
    }),
  };
}
