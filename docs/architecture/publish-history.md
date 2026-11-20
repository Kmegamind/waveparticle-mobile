# Publish history

#289 (`docs/decisions/0018`): every publish and roll back writes one `public.publish_history` row in the same transaction (kind, key, version, action, editor, time). ADM-12 `/admin/publish-history` lists the newest 100, newest first, with the editor's email, and a Roll back button on every row whose version is not published now; it runs the roll back path of the row's kind. App text shows a version published before as "Earlier version", never as a draft

Path: `src/lib/publish-history/admin.ts`, `src/app/admin/publish-history/`, `supabase/migrations/20261118000000_publish_history.sql`
