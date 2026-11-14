# Account screens and Safety page to prototype v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The four account screens and the Safety page look like prototype v4 (issue #262).
**Architecture:** Wording and markup changes in `auth-form.tsx` and `crisis-page.tsx`, CSS in `globals.css` with tokens, and one public placeholder page `/privacy`.
**Tech Stack:** Next.js 16, React 19, Vitest (static render), Playwright.
**Spec:** `docs/superpowers/specs/2026-11-13-auth-safety-v4-design.md`

## Global Constraints
- Tokens only. Values measured in prototype v4 (probe run 2026-11-13):
  - **Title:** 32/800 Bricolage, margin-bottom 6 px.
  - **Caption:** 13.5 px `--ink-2`, line height 1.4, margin-bottom 8 px.
  - **Label:** caption style, 10 px above it.
  - **Field:** 56 px high, 14 px padding, 1 px `--edge`.
  - **Button:** 14 px above it.
  - **Links:** 15/700, 44 px high, centred, 2 px apart.
  - **Back row:** "‹" 22 px in a 44 px box, then the small label (12.5 px, capitals, 0.09em, `--ink-2`), 4 px below.
  - **Form:** centred vertically.
- **Behaviour unchanged:**
  - the same inputs (names, autocomplete, `minLength`);
  - the same Supabase calls, messages and redirects;
  - `#region-resource` and both `data-placeholder` texts kept;
  - the safety gate unchanged.
- Do not edit the goal dialogue, focus, rest, summary or Life Path files.

## Review Focus
1. **Text at 200% or a 320 px wide screen:** the centred form still scrolls and nothing is cut off. Test: e2e at 320 px checks that the page has no horizontal scroll.
2. **"Get support now" still jumps to the resource placeholder.** Unit test: `href="#region-resource"` and `id="region-resource"`.
3. **A signed-out visitor can open `/privacy`.** Unit test: `isPublicPath("/privacy")`. e2e: the page shows the placeholder.
4. **The crisis card inside the goal dialogue and the rest page still works.** The existing e2e tests, with the new label.
5. **Dark scheme readable.** Covered by the screenshots in the PR.

### Task 1: Account screens (#229 to #232) and `/privacy`
**Files:** `src/app/auth/auth-form.tsx`, `src/app/privacy/page.tsx` (new), `src/lib/supabase/session.ts` (`isPublicPath`), `src/app/globals.css`, `tests/auth-screens-v4.test.ts` (new), `e2e/auth.spec.ts`.
- [ ] Failing unit tests (render each mode with `renderToStaticMarkup`):
  - **Sign in:** "An account keeps your Goals and Steps on every device.", links "Forgot your password?" (→ `/auth/forgot-password`), "Create an account" (→ `/auth/sign-up`) after "New here?", and "Privacy notice" (→ `/privacy`).
  - **Create an account:** a back link labelled "Back to Sign in" (→ `/auth/sign-in`) with the label "Sign in"; the line "What is stored and what is sent to the language model:" and "Privacy notice".
  - **Forgot your password:** the title "Forgot your password", the sentence "Enter your email. We will send a link to choose a new password.", the button "Send link" and the back link.
  - **Choose a new password:** the field label "New password" and the button "Save password".
  - **Unchanged:** the same `autoComplete` and `type` attributes.
  - **Public path:** `isPublicPath("/privacy", false)` is true.
- [ ] Update `e2e/auth.spec.ts` for the new link names; add the `/privacy` and 320 px no-scroll checks.
- [ ] Implement, run unit and e2e, commit `feat: account screens match prototype v4 (#262)`.

### Task 2: Safety card (#233)
**Files:** `src/app/safety/crisis-page.tsx`, `src/app/globals.css`, `tests/crisis-page.test.ts`, and the e2e files that click "Back to my Step".
- [ ] Failing unit test:
  - the `.crisis-card`;
  - the lead sentence "If you are thinking about hurting yourself or someone else, please reach out to people who can help right now.";
  - one `.crisis-placeholder` box containing both placeholders, keeping `id="region-resource"`;
  - "Back to my Goal".
- [ ] Update the e2e clicks to "Back to my Goal". Implement, run, commit `feat: the Safety page matches prototype v4 (#262)`.

### Task 3: Screenshots
- [ ] Take after shots with `scripts/.shots-tmp.mjs` (not committed). Compose reference | before | after per screen and scheme into `docs/design/prototype/pr-262/`. Compare each with the reference and fix the differences. Commit `docs: screenshots for #262`.
