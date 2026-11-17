# 0024: Companion and story fields are edited as drafts in the admin, and only the admin role publishes them
- Status: accepted (Yue approved the design on 2026-11-17)
- Date: 2026-11-17
- Issue: #309

## Context
The Companions and stories live in `public.companions` and `public.stories` (#284). The app reads
them through `get_story_content`, cached for at most a minute. Until now they could only be
changed in the SQL editor or by the content import. ADMIN (2026-11-14) puts every content change
through a draft and a Publish. These fields appear on the Life Path and the goal dialogue, so they
never carry a year, a date or an age (PERIODS, DATES-ADMIN-ONLY).

## Decision
- **One versions table, `public.content_fields`**, in the shape of `app_text` (#288). Keys follow
  NAMING:
  - `chr.<code>.name`, `tags`, `who` and `period.<n>` for a Companion;
  - `<code>.<story>.title`, `period`, `goal`, `who`, `opening` and `path` for a story.
- **A save adds a draft and changes nothing the app reads.** Publish copies the text into the column
  `get_story_content` already reads, so that function is unchanged and no draft reaches a phone.
- **Starting version.** The first save of a field keeps the text the app shows now as version 1,
  published, unless that text is blank. Roll back can always return to the imported text.
- **Two new columns:** `companions.who` ("Who I am") and `stories.path` (the Life Path description).
  Only the admin shows them for now.
- **Periods** have no table. Period n is the n-th run of neighbouring stories with one name.
  - Publishing a period name renames that period on all its stories.
  - A story may stay in its own period or move to the period of the story just before or after it.
    It may never move out of a period it is alone in, so the number of periods never changes.
  - No two periods may share a name.
- **Checks** (`src/lib/content-fields/fields.ts`) run on save and again on the stored version before
  Publish and Roll back. A failing text is refused, with each reason in words:
  - blank, or longer than the field's limit;
  - a year, a date or an age, including `{age}` (AGE-TEXT), using `src/lib/content/dates.ts`, which
    the card checks share;
  - an opening that doesn't end with "What are you working on?";
  - the period rules above.
- **Publish and roll back:** the admin role only, checked in the editor, the server action and the
  database. `private.set_published_content_field` re-checks the period rules, writes the column and
  writes a `publish_history` row (`companion_field` or `story_field`) in one transaction.
- **The content import** still inserts new Companions and stories. On existing rows it no longer
  overwrites a Companion's name and tags, or a story's title, period, goal sentence, "Who I am" and
  opening. The admin's published text is the source for those fields.

## Consequences
- **The database checks the role and the period rules, not dates.** An admin who calls
  `publish_content_field` directly through the API skips the date check.
- **The pages:**
  - `/admin/companions` is ADM-03.
  - `/admin/companions/<id>` is ADM-04 and ADM-05: the profile, the period names and the stories.
  - `/admin/companions/<id>/stories/<story>` holds the story fields and the read-only model inputs.

  These sit under the Companion, so the card pages of #304 are unchanged.
- **The export doesn't write the two new columns** back to the seed files yet.
- **Stale story period versions.** After a period is renamed, an older version of a story's period
  still holds the old name. Rolling back to it is refused, because that name no longer belongs to a
  neighbouring period.
- **Not done yet:**
  - editing the model-only inputs;
  - showing "Who I am" and the Life Path description on phones;
  - reordering or adding stories.
