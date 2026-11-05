# Data
Where data lives and what fields mean. For large files write the path, never paste the content.

| Dataset / store | Location | Fields | Notes |
|---|---|---|---|
| Oppenheimer story database (26 stories, facts) | `src/content/oppenheimer/stories.json` | story id, sequence, title, date, goal, facts, forbidden terms, key slices, provenance | Imported from the planning database; the source entry paths and the key-slice derivation are recorded per story |
| Oppenheimer story database source | `2_Areas/Product/oppenheimer-stories/en/database/` in the planning folder (outside this repo) | story id, era, date, goal, tasks, happened, knowledge | Source of the facts the AI writes cards from |
| Oppenheimer story order and leak map | `1_Projects/Newfeatures/NF3_content/story_openers_2026-10-29.json` in the planning folder (outside this repo) | sequence, story id, title, dialogue opener, forbidden terms | Canonical chapter order and terms that must not leak into generated story text |
| Authored fallback cards | `1_Projects/Newfeatures/NF3_content/` in the planning folder (outside this repo) | cards for two stories ("finding the place", the Trinity night) | Used when generation fails |
| Planned application data | Supabase Postgres | see `docs/CONTENT_MODEL.md` | Not created yet |
