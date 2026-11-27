# 0035: Edit registry rows on one editor page, with the name saved by a new function
- Status: proposed
- Date: 2026-11-26
- Issue: #475

## Context
FR-AIREG-7 and AI-PAGE-EDIT (extended 2026-11-26): an admin or a writer edits every field of a registry row except the status and the category, which are admin only; every change is kept in a history with who and when. AI-EXAMPLE-CONFIRM: any role marks an example candidate or confirmed, and a replaced confirmed example stays in history. `20261202000000_ai_registry.sql` (#473) already saves the six text fields (`save_ai_feature_fields`), the example (`set_ai_feature_example`) and the category (`set_ai_feature_category`, admin only), each with its history.

Three gaps were found:

1. The **Name** is "admin, writer" in PRD section 4.14, but no function writes `ai_features.title`, and the field history does not accept the field `title`.
2. `list_ai_feature_people` (20261201000000) only names the accounts of the status history and the (a) to (c) editor, so the field and example history would show "Account 1234abcd" instead of an email.
3. The drawing (#reg-feature, AIR-2) shows every field read only and draws no editor for the registry fields. It draws Confirm on a candidate example and the admin's status control.

## Options
| Option | For | Against |
|---|---|---|
| Name not editable | No migration | Breaks PRD 4.14 ("Name: admin, writer") and AC1 "every field" |
| Save the name with a second call beside `save_ai_feature_fields` | No new function | Two calls: half a save on failure; the "changed since" check is not in one transaction |
| **One new function `save_ai_feature_registry_fields` (name, six fields, load time) that calls `save_ai_feature_fields`** | One transaction; the load-time check is in the database; the history rules stay in one place | A migration and a production step |
| Edit each field in place on the feature page | Close to the drawing's page | No drawing for it either; many Save buttons; harder to keep a load-time check |
| **One editor page `/admin/ai-features/<slug>/fields` built from the drawing's editor parts (AIF-7's form and side panel, AIR-2's status control and tables), linked from the feature page** | Same pattern as the #453 editors; every part is in the visual gate | One more page; its layout is not drawn (owner decision) |

## Decision
`20261204000000_ai_registry_editing.sql` adds `public.save_ai_feature_registry_fields(target_feature, loaded_at, new_name, …six fields)`: content editors; the title becomes the name plus the title's existing bracketed prompt keys (AI-PAGE-TITLES), with a `title` history row; the six fields go through `save_ai_feature_fields`; a save is refused (`40001`) when `fields_updated_at` is not the one the editor loaded. The field history accepts `title`. `list_ai_feature_people` also names the accounts of the field and example histories and of the last field and example edits.

The editor is one page, `/admin/ai-features/<slug>/fields`, for every row of every category: the name and the six text fields with Save in the header and the last save beside them (AIF-7), then the example with its state (any role), the category (admin only; dimmed with "Admin only" for a writer, as the status), and the field history (when, who, field, old and new). The feature page links it ("Edit fields"), shows Confirm on a candidate example, and gives the admin's status control on every row. The pass standard editor works on every row; Purpose and Current approach stay on the Runtime rows (they exist only there).

## Consequences
- The owner applies the migration to dev and prod (a production step with a dry run, a check and an undo, in the pull request).
- Until the migration is applied, Save on the editor page answers "Could not save the change" (the function is missing); the example, category, status and Confirm work, since they use #473's functions.
- A changed category does not change `public.prompts.category` of the row's prompt key: the app's prompt read (runtime keys only) follows the prompt's own category. Owner to decide whether a category change should move the prompt key too.
- Set as candidate from a run and the latest run belong to #477/#478; this page sets an example by hand.
