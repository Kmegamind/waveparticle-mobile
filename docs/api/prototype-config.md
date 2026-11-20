# src/lib/prototype/config.ts

`src/lib/prototype/config.ts`: `isPrototypeEnabled(env)` is true only when `PROTOTYPE_ENABLED` is `1`. `isTryPath(pathname)` and `tryPathIsHidden(pathname, enabled)` decide the 404 for `/try` in `src/proxy.ts`. Only `/try` depends on the flag: `/goal`, `/focus`, `/rest` and `/end` exist in every environment for signed-in users (#278).
