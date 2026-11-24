# API
There is no HTTP interface yet. The app is a Next.js application with one page (`src/app/page.tsx`).

Planned: Next.js route handlers for goal planning, story card generation, the rest conversation, safety checks and the return pop-up (see `docs/ai/` and `docs/CONTENT_MODEL.md`). When the first handler exists, document it in `docs/api/openapi.yaml`, generated from the real handler (methods, paths, status codes, bodies).

The public code interfaces today are listed below, one file per interface in this folder. To add one, create `docs/api/<module>.md` that starts with a `# Title` line and a first sentence, then run `node scripts/docs-index.mjs` (`npm run docs:index`); it rewrites only the lines between the index markers. `npm test` fails when the index is out of date or a relative link under `docs/api/` or `docs/architecture/` points to a missing file.

<!-- index:start -->
- [src/lib/account/export.ts](account-export.md): `readAccountExport(client, { id, email }, now)` gives `{ exportedAt, account, profile, goals, steps, sessions, sessionSteps, sessionLines }`, ids in chunks of 100; any failed read throws `export read…
- [src/app/focus/actions.ts and src/app/rest/actions.ts](account-session-actions.md): `src/app/focus/actions.ts` and `src/app/rest/actions.ts` (#257): server actions of the signed-in `/focus` and `/rest`.
- [src/lib/admin/roles.ts (cache control)](admin-cache-control.md): `src/lib/admin/roles.ts` also has `ADMIN_CACHE_CONTROL` and `withAdminCacheControl(response)`: every `/admin` response, the 404 included, is `private, no-store, max-age=0` (#288).
- [src/lib/admin/roles.ts](admin-roles.md): `readContentRole(client)` returns `"admin"`, `"writer"` or `null` (any error is `null`) from `public.content_role()` through the user's own client; `isAdminPath(pathname)` and `adminAnswer(pathname,…
- [Database functions for app text](app-text-database-functions.md): Database functions for app text (`supabase/migrations/20261117000000_app_text.sql`): `public.save_app_text_draft(text_key text, text_body text) returns integer` (the new draft version),…
- [src/lib/app-text/](app-text.md): `catalog.ts` (browser-safe) has `APP_TEXT_KEYS`, `AppTextKey`, `AppTexts` (`Record<AppTextKey, string>`), `APP_TEXT_DEFAULTS` (from `src/content/app-text.json`, the one source of the defaults),…
- [src/lib/clock.ts](clock.md): `formatClock(totalSeconds)` returns `MM:SS` and never goes below `00:00`.
- [src/app/continue-link.tsx](continue-link.md): `continueHref(goal)` gives `/focus?goal=<id>` for an `in_progress` Goal in every environment (#278), otherwise `null`.
- [src/lib/prototype/cost-cap.ts](cost-cap.md): `takeModelCall(cookie, today)` allows `MODEL_CALL_LIMIT` (20) real model calls per browser per day, counted in the httpOnly cookie `wp_try_model_calls`.
- [src/lib/account/delete-account.ts](delete-account.md): `deleteAccount({ userId, rpc, signOut })` returns `{ status: "signed-out" }` without a user (no call), `{ status: "failed" }` when the database refuses (no sign-out, nothing removed), otherwise `{…
- [supabase/migrations/20261114120000_delete_my_account.sql](delete-my-account-function.md): `public.delete_my_account()`, `security definer` with an empty search path, deletes only `auth.uid()`'s rows from the six tables and then the `auth.users` row; executable by `authenticated` only.
- [src/app/end/actions.ts](end-actions.md): server action `finishRunAction({ sessionId })` for `/end`.
- [src/lib/prototype/focus-cards.ts](focus-cards.md): server-only `cardsForStep({ storyId?, index, planMinutes, earlierCards }, gateway)` (#254: the chosen story's facts and inputs; a missing `storyId` is chapter 8, and an unknown one makes…
- [src/lib/goal-dialogue/](goal-dialogue-turns.md): `src/lib/goal-dialogue/turns.ts`: `takeTurn(request, deps)` counts and checks one turn of the goal dialogue on the server (#31, `docs/decisions/0026`).
- [src/lib/prototype/goal-lines.ts](goal-lines.md): his draft dialogue lines (READ-STATUS: written), `pickReturningOpening(previous)`, `classifyGoalShape(goal)` and `reactionFor(shape)`.
- [src/lib/prototype/goal-time.ts](goal-time.md): `parseTypedTime(text)` (5 to 300 minutes, rounded to 15, otherwise `null`), `findTimeInGoal(goal)` (GOAL-TIME; whole minutes as written, NO-ROUNDING; a duration that describes the thing, such as "a 2…
- [src/app/goals/actions.ts](goals-actions.md): server actions, each returning `{ status: "ok" }` or `{ status: "failed" }` with no Goal text.
- [Help lines by region (#118)](help-lines.md): `src/lib/safety/help-lines.ts` (browser-safe; SAFETY-REGION, SAFETY-REGION-STORE, SAFETY-DIRECTORY, HOTLINES): `DIRECTORY` (Find A Helpline, `https://findahelpline.com`), `US_LINE` (S1-0's labelled…
- [src/app/home-actions.ts](home-actions.md): server action `setGoalStatusAction({ goalId, status, sessionId?
- [src/lib/summary/life-path.ts](life-path.md): `lifePath(progress, startId = chapter 1)` gives `{ periods: [{ name, rows }], currentId }`.
- [src/app/me/actions.ts](me-actions.md): `saveDisplayNameAction({ name })` returns `{ status: "ok", name }` (trimmed, 1 to 60 characters), `{ status: "crisis" }` (the server's safety check, `serverSafetyCheck()` at position `display_name`,…
- [writeClosingLine](model-gateway-closing-line.md): `writeClosingLine({ facts, lastMoment, forbidTerms?, earlierLines?
- [src/lib/model-gateway/](model-gateway.md): server-only `createModelGateway` and `createServerModelGateway`.
- [src/lib/prototype/opening-memory.ts](opening-memory.md): `loadLastOpening` and `saveLastOpening(storage, index)` for the returning opening; never throws.
- [src/lib/prototype/plan-edit.ts](plan-edit.md): pure Plan edit rules (`commitTitle`, `setDescription`, `changeMinutes`, `addStep`, `removeStep`, `moveStep`, `canRemove`, `countLine`, `toSavedSteps`).
- [Prompt editing](prompt-editing.md): Prompt editing (#308, `docs/decisions/0025`, `supabase/migrations/20261125000000_prompt_editing.sql`): `public.list_prompt_versions()` returns `(key, version, active, body, params, note, created_at,…
- [src/lib/prompts/repository.ts](prompts-repository.md): `getActivePrompt(key)` returns the active row `{ key, version, body, params }` of `public.prompts` or `null`; the model gateway reads every prompt through it.
- [src/lib/prototype/config.ts](prototype-config.md): `isPrototypeEnabled(env)` is true only when `PROTOTYPE_ENABLED` is `1`.
- [Rest and return in src/lib/prototype/session.ts](prototype-session-rest.md): Rest and return in `src/lib/prototype/session.ts` (same key, still version 1; sessions stored before these fields load with the defaults): `startRest(session, now)` is Pause (freezes the clock,…
- [src/lib/prototype/session.ts](prototype-session.md): browser-only focus-page session for `/try/focus`, stored under its own key `waveparticle.prototype.session` (version 1).
- [src/lib/prototype/store.ts](prototype-store.md): browser-only test-path state `{ version, goal, steps, currentStep, storyId?
- [Publish history](publish-history.md): Publish history (#289, `docs/decisions/0018`, `supabase/migrations/20261118000000_publish_history.sql`): `private.set_published_app_text` now inserts one `public.publish_history` row (`kind`…
- [src/lib/prototype/rest-lines.ts](rest-lines.md): server-only `pauseMessageFor({ storyId?, pauseNumber, stepTitle, lastCard }, gateway)`, `restReplyFor({ storyId?, message, history, replyIndex }, gateway)` and `returnLineFor({ storyId?, trigger,…
- [src/lib/safety/ (classifier, check, alarm, server)](safety-classifier.md): `src/lib/safety/check.ts`: `createSafetyCheck({ classifier, onEvent })` returns a `SafetyCheck`, `(text, { position, previous?
- [src/lib/safety/crisis.ts](safety-crisis.md): `gateFreeText(text)` returns `{ action: "crisis-page", modelRequest: null }` when the keyword layer reports `crisis`, and `{ action: "continue" }` otherwise.
- [src/lib/safety/keyword.ts](safety-keyword.md): `checkSafetyText(text)` returns `{ tier, flagged }` and does not return the text.
- [src/app/_session/paths.ts](session-paths.md): `accountPathsFor(sessionId)` is `ACCOUNT_PATHS` with `end` set to `/end?session=<id>`.
- [src/lib/prototype/split-goal.ts](split-goal.md): `splitGoal(input, deps)`, the logic behind that action: safety gate first, then the model gateway (when `MODEL_API_KEY`, `MODEL_API_URL` and `MODEL_NAME` are set) or the test-data splitter.
- [src/lib/prototype/story-inputs.ts](story-inputs.md): server-only inputs of the 26 Oppenheimer stories on the test path (#254), from `docs/demo/<story-id>.stage0.json` (AI-drafted, unreviewed, see each file's `_note`).
- [src/lib/story/start.ts](story-start.md): `startStory(story, plan)` builds the brief for pressing Start.
- [src/lib/summary/finish-run.ts](summary-finish-run.md)
- [src/lib/summary/run-writer.ts](summary-run-writer.md): `claimClosingLine(sessionId, line)` sets `closing_line` only while it is empty (`claimed` or `taken`).
- [src/lib/summary/run.ts](summary-run.md): `focusSecondsOf(session)` gives the real seconds on the device's clocks at Done, overtime included, or `null` before the last Done; `focusLabel(seconds)` gives "Under 1 min" or "N min".
- [src/lib/supabase/session.ts](supabase-session.md): `isPublicPath(pathname, prototypeEnabled)` lists the paths a signed-out visitor may open: `/auth/*`, `/safety`, and `/try` only while the test path is on.
- [src/lib/prototype/test-splitter.ts](test-splitter.md): `splitWithTestData(input)` (TEST DATA, 15-minute units).
- [src/lib/prototype/test-story.ts](test-story.md): server-only `loadTestStory()` returns chapter 8 test data (`isTestData: true`): background card, four Steps with cards, pause message, rest replies, return line and closing line.
- [src/app/try/focus/actions.ts](try-focus-actions.md): server actions used by `/try/focus`: `loadStepCards(request)` (runs `normaliseStepCardsRequest` first; an unusable request is `failed`), and `loadReturnLine({ trigger, awayMinutes })` for the return…
- [src/app/try/goal/actions.ts](try-goal-actions.md): server action `goalTurnAction(request)` for the goal dialogue on `/try`, one call per turn (#31).
- [src/app/try/rest/actions.ts](try-rest-actions.md): server actions `loadPauseMessage` and `loadRestReply` used by `/try/rest`.
<!-- index:end -->
