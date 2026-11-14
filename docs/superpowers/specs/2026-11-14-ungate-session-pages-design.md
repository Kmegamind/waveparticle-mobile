# Signed-in session pages in every environment (#278)

**Intent.** Signed-in users can walk the whole flow on Production, not only on Preview. The owner monitors usage and accepts the model-call cost without a per-account cap; #256 stays in "Later".

**Goals.** `/goal`, `/focus`, `/rest` and `/end` and their server actions work for a signed-in user whatever `PROTOTYPE_ENABLED` is. Every link to them always shows: Home (New session, Continue, Start something else, Quick Replay), Life Path Begin, Goals (New goal, Continue, Start), Goal detail, Me's Continue. "The goal dialogue is in test builds only." is gone.

**Non-goals.** No per-account cap (#256). No change to `/try`, which stays gated exactly as today (decision 0011: 404 and not public where the flag is off). No change to what the pages do.

**Anti-goal.** A signed-out visitor reaching a session page. Sign-in stays required.

**Approaches.** (1) Remove the gate in all three layers (proxy, pages and actions, link settings) and delete the `sessionPagesEnabled` / `canBegin` props: chosen, no dead branches left. (2) Keep the props and always pass `true`: rejected, it keeps the code paths the request says to remove. (3) A second flag defaulting to on: rejected, adds a switch nobody asked for.

**Docs.** `docs/DECISIONS.md` gets one decision dated 2026-11-14; `docs/deploy.md` says only `/try` depends on `PROTOTYPE_ENABLED`; `docs/architecture.md` and `docs/api/README.md` drop "only when PROTOTYPE_ENABLED is 1" for these pages.

**Left to the builder.** Test names and file layout; the e2e servers all run with the flag on, so flag-off behaviour is proven with unit tests of the proxy rules and source checks.
