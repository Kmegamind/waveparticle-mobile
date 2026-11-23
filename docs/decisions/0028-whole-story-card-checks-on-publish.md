# 0028: Whole-Story card checks on admin Publish, and the fix for the published cards
- Status: accepted (owner, 2026-11-23; `docs/DECISIONS.md` ROLLBACK-WARN, CARD-PAIR-OTHERS, FIX-BY-ACCOUNT)
- Date: 2026-11-22, accepted 2026-11-23
- Issue: #377 (follow-up to #46 and pull request #375)

## Context
#375 runs the repeated-lines checks (the same card again, the same first three words as one of
the four cards before, a near repeat) on the seed file in the pull request checks. The admin
(ADM-06, #304) checked one card at a time, so a card that repeats an earlier card of its Story
could be published. Version 1 of every card was loaded as published without the checks (#293);
#375 fixed 25 cards in the seed file only, and the import leaves existing rows alone.

## Options
| Question | Options | Chosen |
|---|---|---|
| Which repeats block Publish | Every problem of the whole Story after publishing; only problems that involve this card | Only problems that involve this card: an earlier card it repeats, and a later card that would repeat it. A problem between two other cards would otherwise block every fix (owner, 2026-11-23, CARD-PAIR-OTHERS) |
| Where the problems show | Only on Publish; on the draft and on Publish | Both: every saved draft and every shown version runs the same function as Publish (`publishProblems`, `storyRepeatProblems` in `src/lib/story-cards/pool-checks.ts`) |
| The pool | Every version; the published versions | The Story's published versions, with the new version in the place of its card's published one. Drafts are not live |
| Roll back of a version with problems | Not checked (0023); blocked; a warning the admin confirms | A warning (owner, 2026-11-23, ROLLBACK-WARN): never a block, because roll back is the emergency undo |
| Fixing the published cards | An admin edits 25 cards by hand; a SQL script | A script that prints SQL (`scripts/story-cards/fix-published.mjs`), run by the owner |
| How the script publishes | Update the rows; add a version and publish it | Add the seed text as a new version and publish it through `private.set_published_story_card`, as the admin account named with `--by` (owner, 2026-11-23, FIX-BY-ACCOUNT), so Publish history has the row and the old version can be rolled back to. `--dry-run` rehearses it on the real database and undoes everything |

## Decision
- **Publish and drafts.** A card version fails when, read in story order among the Story's
  published cards, it repeats an earlier card, opens with the same three words as one of the four
  cards before it, or comes close to an earlier card (the run-list rules of #44, as #46), or when
  a later card does one of these to it. The message names the other card ("part 1, card 1
  (`crd.opp.<story>.p1.c1`)") and the rule. A repeat is reported once, not also as a near repeat
  or the same opening. The per-card checks (#304, with the scene person check of #374) still run.
- **Refused Publish.** The server re-runs the checks on Publish, so a draft that passed when saved
  but repeats a card published since is refused; the editor lists the problems under the status.
- **Roll back warns, never blocks** (owner, 2026-11-23, ROLLBACK-WARN). Both roll back buttons for
  story cards (the card's Versions on ADM-06 and the row in Publish history) first run the same
  checks as Publish (`publishProblems`, the whole-Story checks included) on the version that would
  become live, in the place of the card's published version
  (`storyCardRollBackWarningsAction`, `src/lib/story-cards/roll-back-warning.ts`). With problems,
  the admin sees them ("v1 fails 1 check. Rolling back puts it live on phones anyway. Roll back
  anyway?") and presses **Roll back anyway** or **Cancel**; a check that cannot run is shown as a
  problem too. With no problems the roll back runs at once, as before. The server and the database
  never refuse a roll back for a check problem: 0023 stands. Prompts, app text and Companion and
  story fields are not story cards and roll back as before (prompts keep their own gateway check,
  #308).
- **The fix.** One transaction. Each seed card whose published text is the seed text is left
  alone, so a second run changes nothing. A card with only version 1, published, gets the seed
  text as version 2, published. A card with more than one version (edited in the admin after the
  import), no published version or no row is reported, never overwritten.

## Consequences
- The ADM-06 list counts a card as failing for a repeat too, and both cards of a repeated pair
  show the problem.
- The database still checks only the role (0023): a direct API call to `publish_story_card` skips
  the text checks.
- The fix is a manual production step (`docs/deploy.md`, Story cards). Until the owner runs it,
  phones show the old text of the cards fixed in #375.
