# Ungate the signed-in session pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/goal`, `/focus`, `/rest`, `/end` and every link to them exist for signed-in users in every environment; `/try` stays gated.

**Architecture:** Remove the flag from the proxy rules, the four pages and their actions, and remove the link-hiding props from Home, Goals, Goal detail, Me, Continue and the Life Path.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-ungate-session-pages-design.md`

## Global Constraints
- `/try` behaviour unchanged: `tryPathIsHidden` and the `/try` branch of `isPublicPath` keep the flag.
- Sign-in still required for the four pages (not in `isPublicPath`).
- Remove the copy "The goal dialogue is in test builds only." entirely.
- Do not edit tests to weaken them; tests asserting the gate are rewritten to assert the new rule.

## Review Focus
1. Signed-out visitor with the flag off opening `/focus`: redirected to sign in, not 404 and not the page. Test in Task 1.
2. `/try/goal` with the flag off still 404 after the proxy change. Test in Task 1.
3. A path like `/goals` or `/ending` was never affected and stays a normal route. Test in Task 1.
4. A Goal not `in_progress` still gets no Continue (`continueHref` keeps its status rule). Test in Task 2.
5. Goals rows for a Goal without Steps still show Start (`/goal?line=`), not Continue. Test in Task 2.

---

### Task 1: Routes and actions (`src/lib/prototype/config.ts`, `src/proxy.ts`, `src/app/{goal,focus,rest,end}/{page,actions,layout}.ts(x)`)
**Produces:** `config.ts` keeps `isPrototypeEnabled`, `isTryPath`, `tryPathIsHidden` and loses `isGoalPath`, `goalPathIsHidden`, `isAccountSessionPath`, `accountSessionPathIsHidden`.
- [ ] Failing tests (`tests/signed-in-focus.test.ts`, `tests/start-goal-route.test.ts`, `tests/summary-routes.test.ts`): the proxy source has no `accountSessionPathIsHidden`; `config.ts` exports none of the four removed names; each of the four pages and four action files has no `isPrototypeEnabled`; `isPublicPath("/focus", false)` and `isPublicPath("/goal", true)` are false; `tryPathIsHidden("/try/goal", false)` is true.
- [ ] Remove the gate; update layout comments. Tests pass. Commit `feat: signed-in session pages in every environment (#278)`.

### Task 2: Links (`continue-link.tsx`, `page.tsx`, `protected-home.tsx`, `goals/*`, `lib/goals/goals-view.ts`, `me/page.tsx`, `companions/oppenheimer/*`)
**Produces:** `continueHref(goal: Pick<ProgressGoal,"id"|"status">): string | null`; `ViewOptions = { now; timeZone }`; `ProtectedHome({ view, continueHref })`; `LifePathList({ view })`; `GoalsScreen`/`GoalDetailScreen` without `sessionPagesEnabled`.
- [ ] Failing tests (`tests/home-screen.test.ts`, `tests/goals-view.test.ts`, `tests/continue-link.test.ts`, `tests/life-path-rows.test.ts`): Home HOME-1 shows Start something else, HOME-NONE shows New session and Quick Replay chips as links to `/goal`; Life Path current row shows Begin and never "test builds only"; Goals rows give Continue or Start; `continueHref` takes one argument and returns null for a Goal not in progress; no file under `src/app` except `try/` and `proxy` imports `isPrototypeEnabled`.
- [ ] Remove the props and branches. Tests pass. Commit `feat: links to the session pages always show (#278)`.

### Task 3: Docs and checks
- [ ] `docs/DECISIONS.md` decision dated 2026-11-14; `docs/deploy.md` (only `/try` depends on the flag); `docs/architecture.md`; `docs/api/README.md`.
- [ ] `npm test`, `npm run lint`, `npm run format:check`, `CI=1 npm run test:e2e`; merge origin/main; open the PR closing #278.
