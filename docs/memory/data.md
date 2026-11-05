# Data
Where data lives and what fields mean. For large files write the path, never paste the content.

| Dataset / store | Location | Fields | Notes |
|---|---|---|---|
| Oppenheimer story database (26 stories, facts) | `2_Areas/Product/oppenheimer-stories/en/database/` in the planning folder (outside this repo) | story id, era, date, goal, tasks, happened, knowledge | Source of the facts the AI writes cards from; must be imported or referenced before Sprint 3 |
| Authored fallback cards | `1_Projects/Newfeatures/NF3_content/` in the planning folder (outside this repo) | cards for two stories ("finding the place", the Trinity night) | Used when generation fails |
| Planned application data | Supabase Postgres | see `docs/CONTENT_MODEL.md` | Not created yet |
