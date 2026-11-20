# src/lib/admin/roles.ts (cache control)

`src/lib/admin/roles.ts` also has `ADMIN_CACHE_CONTROL` and `withAdminCacheControl(response)`: every `/admin` response, the 404 included, is `private, no-store, max-age=0` (#288).
