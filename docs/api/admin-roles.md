# src/lib/admin/roles.ts

`src/lib/admin/roles.ts` (server only, #287): `readContentRole(client)` returns `"admin"`, `"writer"` or `null` (any error is `null`) from `public.content_role()` through the user's own client; `isAdminPath(pathname)` and `adminAnswer(pathname, hasUser, role)` (`"pass"` or `"not-found"`) decide the proxy's 404 for `/admin`.
