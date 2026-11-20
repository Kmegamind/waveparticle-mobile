# src/lib/account/export.ts

`src/lib/account/export.ts` (#103): `readAccountExport(client, { id, email }, now)` gives `{ exportedAt, account, profile, goals, steps, sessions, sessionSteps, sessionLines }`, ids in chunks of 100; any failed read throws `export read failed`. `exportFileName(now)` is `waveparticle-data-YYYY-MM-DD.json`. `GET /me/export/download` returns it as a JSON attachment (`no-store`), 401 when signed out, 500 with a message on a read error.
