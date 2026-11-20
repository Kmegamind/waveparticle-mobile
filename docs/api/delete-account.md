# src/lib/account/delete-account.ts

`src/lib/account/delete-account.ts` (#103): `deleteAccount({ userId, rpc, signOut })` returns `{ status: "signed-out" }` without a user (no call), `{ status: "failed" }` when the database refuses (no sign-out, nothing removed), otherwise `{ status: "deleted" }` after signing out. `signInNotice({ error, deleted })` gives Sign in's line. `src/app/me/delete-account/actions.ts`: `deleteAccountAction()` calls `rpc("delete_my_account")` with the user's own client and redirects to `/auth/sign-in?deleted=1`.
