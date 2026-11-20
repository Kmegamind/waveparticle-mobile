# src/app/continue-link.tsx

`src/app/continue-link.tsx` (#69 AC3): `continueHref(goal)` gives `/focus?goal=<id>` for an `in_progress` Goal in every environment (#278), otherwise `null`. `ContinueLink({ href })` renders it as a plain link (a full page load), so the focus page reads the device clock and opens the return pop-up after 5 minutes or more away or an open rest. Home and Goals use it; the Home Goal card (#86) can reuse it.
