# 0036: Store the sample library and its source excerpts in two read-only tables filled by a printed import
- Status: proposed
- Date: 2026-11-26
- Issue: #479

## Context
The prompt lab fills a prompt's `{{variables}}` from a fixed sample library (AI-LAB-SAMPLES). The database stores only the source excerpt each story uses, readable by admin and writer only, with the source named (AI-SOURCE-EXCERPTS). Book text is never committed: an import reads the owner's local files and prints SQL (AI-SAMPLES-LOCAL). The run log (#476, `docs/decisions/0034`) already has a `sample_id` waiting for a foreign key.

## Options
| Option | For | Against |
|---|---|---|
| One table, the excerpt as a column of the sample | One read | The source and its passage are mixed with prompt inputs; an excerpt used by two samples would be stored twice |
| **Two tables: `ai_source_excerpts` (source named, passage) and `ai_samples` (inputs, pointing to an excerpt)** | The excerpt table is the one place book text lives, each row naming its source; the size cap guards against a whole book | Two reads (joined in code) |
| Writes through the API for editors | The page could add samples | No write is needed yet; a browser could store text that is not an excerpt |
| **No API writes; rows only from the owner's printed import, run in the SQL editor** | Book text only arrives by the owner's own step | Adding a sample needs the owner until "Add a finished story" exists |
| `ai_runs.sample_id` with `on delete cascade` or `set null` | Samples can always be deleted | Deleting a sample would delete or blur run records |
| **`ai_runs.sample_id` without cascade** | The run log keeps its sample | A sample with runs cannot be deleted |
| A unique `position` | No ties | The import fails when other samples already hold its positions |
| **`position` not unique, ties listed by id** | Imports and later additions never collide | Two samples may share a position |

## Decision
Two tables, `public.ai_source_excerpts` (with `source_label` required and the passage capped at 50 000 characters) and `public.ai_samples`, readable by content editors only through row level security, with no API writes; the rows come from `scripts/ai-samples/import-samples.mjs`, which reads a folder given on the command line (outside the repository, never `proposed4`) and prints SQL, a dry run, a check query and an undo. `ai_runs.sample_id` references `ai_samples.id` without cascade.

## Consequences
- App users and anon read nothing; nobody writes through the API.
- "Add a finished story as a sample" is not built: no finished story with its persona and source excerpt exists in the data model to pick from. Owner decided (2026-11-27): "Add a finished story as a sample" moved to #500.
- The Run route (#476) still answers `unknown-sample` for every id; #477 wires `readSample` to this library and decides how the sample's fields map to prompt variable names.
