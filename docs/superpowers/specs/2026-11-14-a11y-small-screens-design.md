# Accessibility and small-screen pass: design

Issues: #100 (large text, narrow screens, reduced motion), #101 (cards, rows, reading order), #5 (timer, live regions, button names), plus eight findings left by earlier pull requests. Approved by Yue on 2026-11-14 ("Approve, build without plan wait").

## Intent
Make the signed-in app usable at 200% text on a 320 px screen, with reduced motion, and with a screen reader. Nothing at normal size changes: prototype v4 stays the visual reference.

## What main does today (measured)
Signed in through the e2e Supabase stub at 320 by 640 with the root font at 200%:
- Home, Goals, Goal detail, Me, Companions, the Life Path and the goal dialogue are wider than the screen; `.app-shell` clips the overflow, so text is cut off without a scroll bar. Root cause: `.app-screen` grids have an implicit `auto` column whose minimum is the widest unbreakable content.
- Focus page: the Step ticks do not wrap (15 Steps run off the screen); Done and Pause stay side by side; on a 640 by 320 landscape screen Done sits below the fold and cannot be reached.
- Already in place: the timer role, "Step time reached", "Back to step", the 1.2 s hold announcement.

## Decided
| Item | Decision |
|---|---|
| Large text simulation in tests | Root `font-size: 200%` (every size token is in rem), viewport 320 by 640 |
| Layout | `.app-screen` gets one shrinkable column; long words wrap (`overflow-wrap: anywhere` where needed); page-level fixes only where the check still fails |
| Done and Pause | Flex with bases in the 62:38 ratio that sum to 14rem, so they sit side by side at normal size and stack when they do not fit |
| Step ticks | Wrap onto more lines |
| Short screens on the focus page | The middle keeps a minimum height and the focus page scrolls as a whole when the seam, middle and actions do not fit |
| Reduced motion | One global rule removes every animation and transition |
| Timer | `role="timer"` with `aria-live="off"` explicit |
| Toggle glyphs | "▾" and "▴" are `aria-hidden`, on the focus page and on Me |
| Card stack | Screen-reader text "Card x of n" and `aria-current` on the newest card; Earlier and Newer stay; dots stay decorative |
| Return pop-up | Named "Back to your step", described by his line; focus moves into the pop-up at once and to Start when his line is there |
| Goal dialogue ‹ | Named by its destination ("Back to your goal", "Back to the time", "Back to the split question", "Back to Home"); on the signed-in `/goal` the first ‹ goes to Home (`/`), not `/try` |
| Goals focus after a change | After a change or Undo, focus moves to the selected tab on `/goals` and to the page heading on `/goals/[id]` |
| Home toast | A new toast restarts the five seconds |
| Esc during a change (Home Goal options) | Esc does nothing while the change is saving, so its error stays visible |
| Moriarty's reason | A polite live region that always exists, and Enter is described by it |

## Non-goals
No model calls, prompts, caps or content. No new issues. No visual change at normal size. Hand layer and calendar work are not in scope beyond checking that they already pass.

## Left to the builder
Exact CSS per page, as long as the 200% check passes and normal-size screenshots match the references.
