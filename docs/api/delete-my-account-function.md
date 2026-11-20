# supabase/migrations/20261114120000_delete_my_account.sql

`supabase/migrations/20261114120000_delete_my_account.sql` (#103): `public.delete_my_account()`, `security definer` with an empty search path, deletes only `auth.uid()`'s rows from the six tables and then the `auth.users` row; executable by `authenticated` only.
