# Companion and story fields in the admin (#309): design

Approved by Yue on 2026-11-17.

## Intent
Writers edit a Companion's and a story's display text in the admin (ADM-03 to ADM-05 of the content
admin), with the draft, publish and roll back steps of app text, so the app and the phones only
ever read published text. These fields appear on the Life Path, so they never carry a year, date
or age (PERIODS, DATES-ADMIN-ONLY).

## Fields
| Item | Field | Key | Column written on publish |
|---|---|---|---|
| Companion | Name | `chr.<code>.name` | `companions.name` |
| Companion | Tags | `chr.<code>.tags` | `companions.tags` |
| Companion | Who I am | `chr.<code>.who` | `companions.who` (new) |
| Companion | Period name n | `chr.<code>.period.<n>` | `stories.period` of every story in period n |
| Story | Title | `<code>.<story>.title` | `stories.title` |
| Story | Period | `<code>.<story>.period` | `stories.period` |
| Story | Goal sentence | `<code>.<story>.goal` | `stories.goal_short` |
| Story | Who I am | `<code>.<story>.who` | `stories.who` |
| Story | Opening | `<code>.<story>.opening` | `stories.opening` |
| Story | Life Path description | `<code>.<story>.path` | `stories.path` (new) |

`<code>` is the Companion's `key_code` (NAMING). Period n is the n-th run of neighbouring stories
with the same period name, in story order.

## Approaches
- **A (chosen): one versions table, `public.content_fields`,** in the shape of `app_text`.
  Publishing copies the text into the column the app already reads. `get_story_content` (#284) is
  unchanged, so phones never see a draft.
- B: draft columns beside each field. There are no versions, so roll back can't work.
- C: one versioned copy of the whole Companion or story per change. Publish history would show
  whole records, not fields.

## Rules
- **Save:** an admin or writer saves a new draft version. It is refused, with the reason in words,
  when the text:
  - is blank;
  - is longer than the field's limit;
  - contains a year, a date or an age (`datesProblems`, #304);
  - is an opening that doesn't end with "What are you working on?";
  - is a story period other than its own or a neighbouring story's;
  - is a story period that would empty its period;
  - is a period name another period of the Companion already uses.
- **Starting version:** the first save of a field that has no versions inserts version 1 from the
  current column, marked published (when the column is not blank). Roll back can always return to
  the imported text.
- **Publish and Roll back:** admin role only, checked in the editor, the server action and the
  database (`content_role() = 'admin'`). The server re-runs the checks on the stored version first;
  the database re-checks the period rules. Each writes one `publish_history` row, kind
  `companion_field` or `story_field`, in the same transaction.
- **Content import:** it keeps inserting new Companions and stories. It no longer overwrites name,
  tags, title, period, goal sentence, "Who I am" or opening on existing rows.
- **New fields:** "Who I am" (Companion) and the Life Path description are shown in the admin only.
  Showing them on phones is left for later.

## Pages
- **`/admin/companions`** (ADM-03) lists the Companions.
- **`/admin/companions/<id>`** (ADM-04 and ADM-05) shows:
  - the profile fields;
  - the period names;
  - the stories in order with their period, each linking to its fields page.
- **`/admin/companions/<id>/stories/<story>`** shows the six story fields and the model-only inputs
  read-only, with a link to the story's cards (`/admin/stories/<story>`). The fields page lives
  under the Companion so the #304 card editor files stay untouched.

## Left to the builder
- Field length limits.
- Styling, within the existing admin classes.
- The test names.
