# Story content

#284 (`docs/decisions/0019`): the Companions and their stories, read from `public.companions`, `public.stories` and `public.story_inputs` through `getStoryContent()` (one keyed call, cached at most 60 seconds). Every screen and server action that shows or uses story content takes that snapshot; no app code imports the seed files. Display fields are readable by signed-in users; the model inputs are closed to the API; dates never leave the database

Path: `src/lib/content/`, `supabase/migrations/20261119000000_story_content.sql`, `scripts/content/`, seed files `src/content/companions.json`, `src/content/<companion>/{stories.json,periods.json}` and `docs/demo/<story-id>.stage0.json` (any Companion since #302, `docs/decisions/0022`)
