# App text

#288 (APP-TEXT, `docs/decisions/0017`): the app's own words under keys `ui.<screen>.<slot>`. The first batch is 13 keys: the failure message and its Retry on F3, F-RET, R1 and END, the offline message R-OFF (stored, not shown until #21), the safety page's title, Get support now and Back to my Goal (S1), and the HOME-0 greeting. Home, `/focus`, `/rest`, `/end` and `/goal` read `getAppTexts()` on the server (published text, cached at most 60 seconds, or the code default) and pass it to the screens through `AppTextProvider`; `/try` and `/safety` show the defaults. ADM-07 `/admin/app-text` lists every key with its screen, published text and newer draft, and saves drafts, publishes and rolls back through server actions that check the role again

Path: `src/lib/app-text/`, `src/content/app-text.json`, `src/app/admin/app-text/`, `scripts/app-text/import.mjs`, `supabase/migrations/20261117000000_app_text.sql`
