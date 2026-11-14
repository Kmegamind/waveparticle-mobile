# Account screens and Safety page to prototype v4 (issue #262)

Closes #229 to #233. Look and wording only; no behaviour change except one new placeholder page.

- **Intent:** the four account screens and the Safety page look like prototype v4 (`reference-screenshots/auth-*-day.png`, `s1.png`).
- **Authorities:** the prototype outranks DESIGN.md for looks (DESIGN.md version 8). The shared styles of #240/#244 are used as they are.
- **Non-goals:**
  - the goal dialogue, focus, rest, summary and Life Path files;
  - the final safety wording (US-SAF-8, #121);
  - the real privacy notice (US-ACC-4).
- **Approach (one sensible way, approved by Yue on 2026-11-13):** restyle `src/app/auth/auth-form.tsx`, `src/app/safety/crisis-page.tsx` and their CSS in `src/app/globals.css`, using tokens only.
  - The auth form is centred vertically.
  - The back row is "‹ SIGN IN", in the small capital label style.
  - The lead sentences, the centred link lines and the privacy line are added.
  - Titles, field labels and button words follow the prototype.
  - **Safety:** one `--raised` card (`--r-card`, 1 px `--edge`), centred. The lead sentence comes first. Both existing PLACEHOLDER texts go in one dashed box that keeps `#region-resource`. Then the two buttons, 56 px high, the second saying "Back to my Goal".
- **Privacy notice (Yue's pick):** `/privacy` is a public placeholder page reading "The privacy notice is not written yet." with a link back to sign in. Signed-out visitors may open it.
- **Tests changed on purpose for the new wording:**
  - `tests/crisis-page.test.ts`;
  - `e2e/auth.spec.ts`;
  - the e2e clicks on "Back to my Step" in `crisis-page.spec.ts`, `prototype-rest.spec.ts` and `try-goal-dialogue.spec.ts`.
- **Proof:** for each screen, light and dark, the reference, before and after screenshots side by side in `docs/design/prototype/pr-262/`.
