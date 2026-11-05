---
name: shipping-backlog-issues
description: Use when the user asks to pick up, work on, fix, or ship a GitHub issue or the next backlog item, in any language — "do issue #12", "work the backlog", "what's next in the backlog", "fix #3 and open a PR".
---

# Shipping Backlog Issues

## Overview

The issue tracker is shared state. **Claim before you work, report when you're done, and let the user choose what gets worked on.** Every step below is required, in order. If the repo has an `AGENTS.md`, its commands and conventions win where they are more specific.

## Steps

### 1. Pick the issue

- **User named an issue number** → use it, go to step 2.
- **User did not name one** → run `gh issue list --state open --json number,title,labels,assignees,milestone`. Prefer issues in the current `Sprint <n>` milestone. Rank by the repo's priority labels, highest first (`priority:must` > `should` > `could`, or `priority: high` > `medium` > `low`), then unlabeled. Drop issues with no acceptance criteria, with `in-progress`, with an assignee, or with an open PR. Reply with the top 3 as `#N [labels] title — why`, then **stop and wait for the user to choose.**

### 2. Gate: is it free? (before reading code or editing anything)

```bash
gh issue view N --json assignees,labels,comments
gh pr list --state open --search "N in:body"
```

Claimed = another assignee, an `in-progress` label, a comment like "I'm on this" / "PR coming", or an open PR for it. **If claimed: stop. Tell the user who claimed it and when, and ask whether to take it over. Write no code until they answer.**

### 3. Claim it

```bash
gh label create in-progress --color 0052CC 2>/dev/null
gh issue edit N --add-assignee @me --add-label in-progress
gh issue comment N --body "Working on this."
```

### 4. Branch

Use the branch pattern in `AGENTS.md` if it defines one (e.g. `feature/<N>-<slug>`). Otherwise prefix by issue type: bug → `fix/`, docs-only → `docs/`, setup/tooling → `chore/`, everything else → `feat/`. Name: `<prefix><N>-<short-slug>`, from up-to-date `main`.

For a **Full** change (step 5), check isolation first: `git rev-parse --git-dir` and `git rev-parse --git-common-dir`. Same output → you are in the main checkout → **REQUIRED SUB-SKILL:** superpowers:using-git-worktrees, with that branch name. Different → already in a worktree; branch there.

### 5. Do the work: pick the tier, then follow it

"REQUIRED SUB-SKILL" means calling the Skill tool for it. Doing the practice from memory does not count.

| Tier | Test (all must hold) | Required, in order |
|---|---|---|
| **Trivial** | No behavior change: docs, comments, typos | Edit |
| **Small** | Behavior change touching ≤ 2 files (tests included), no new public function or API, no new dependency | 1. superpowers:brainstorming, as **one message**: the change, your approach, the tests you'll add, and a 3–5 bullet plan. Wait for OK.<br>2. superpowers:test-driven-development |
| **Full** | Anything else | 1. superpowers:brainstorming, run **as that skill defines it** (its questions, its design doc). The one-message form is for Small only.<br>2. superpowers:writing-plans. Show the plan; wait for OK.<br>3. superpowers:subagent-driven-development or superpowers:executing-plans |

State the tier and why in one line before starting. Unsure between two tiers → take the larger one. If the user explicitly waives brainstorming or planning, honor it and say so. Steps 2–4 and 6–8 are never waived.

### 6. Verify (every tier)

**REQUIRED SUB-SKILL:** superpowers:verification-before-completion. Run the repo's test, e2e and lint commands (from `AGENTS.md` if present) and read the output before claiming anything works.

### 7. Open the PR

**REQUIRED SUB-SKILL:** superpowers:finishing-a-development-branch, option "PR". Use `.github/pull_request_template.md` if present. Commit messages follow Conventional Commits (`feat: … (#N)`). The body has `Closes #N`, what changed, and the test commands with their results.

### 8. Report

```bash
gh issue comment N --body "PR: <url>"
```

Your final message to the user has exactly these parts:

1. PR link
2. Tier, and why
3. Skills invoked via the Skill tool, in order
4. Required steps not done, with the reason (or "none")

Then stop. Don't merge and don't start another issue unless asked.

## Red Flags — STOP

| Thought | Reality |
|---|---|
| "#2 is obviously next, nothing for the user to decide" | Which issue gets worked on is the user's call. Show the top 3. |
| "I'll do it locally and ask before pushing" | The gate is before code. Local work on a claimed issue is still duplicate work. |
| "It's a small change, I'll use my default flow" | Small is a tier with its own required skills. Check the tier test. |
| "This copy is already isolated, no worktree needed" | Run the two `git rev-parse` commands. Only their output decides. |
| "The requirements are clear, a one-message design is enough" | That form is Small only. Full runs brainstorming as written. |
| "I ran the tests myself, no need for the verification skill" | Invoke it. Its checks are what you skip from memory. |
| "Only one line, skipping process" | Fine for brainstorming. Still claim, branch, verify, `Closes #N`, report. |
