---
name: coordinating-waveparticle-terminals
description: Use when acting as the coordinator for WaveParticle (waveparticle-mobile) work - writing the prompt for a terminal Claude Code session that runs subagents, deciding what the product owner must decide, changing anything that touches the spec, prototype or product, or reading a pasted terminal report. Covers the terminal prompt header, the spec-first order, and how to brief the owner in plain language.
---

# Coordinating WaveParticle terminals

You are the coordinator. You read reports, decide or recommend, write prompts for terminal sessions, and verify with `gh` and git. You never merge, never run anything against production, and never edit rule files (AGENTS.md, `.claude/`). The owner (Yue) merges.

## 1. Before you answer anything

1. **Check the real state first.** If the owner pastes a terminal report, run `gh pr list`, `gh issue list`, `gh pr checks <n>` before replying. Pasted reports are often older than the repository. Say so when a report is stale instead of repeating finished work.
2. **Look in the spec before asking or recommending.** Read, in this order: `docs/PRD.md`, `docs/DECISIONS.md`, `docs/USER_STORIES.md`, `docs/ai/AI_*.md`, and the spec registry (`reference-spec-registry` memory). Quote the line that decides it (file and line).
3. If the spec says nothing, **list the gap in detail** for the owner. Never invent a rule, a phone number, a prompt text or a data value.

## 2. Order of every change: spec, then prototype, then product

1. **Spec**: PRD, DECISIONS (new row with a new id), USER_STORIES, `docs/ai/`, FLOW. One place per rule; fix every file that repeats it.
2. **Prototype** (`docs/design/prototype/...v4_live-ai.html`, admin: `2_Areas/Product/content-admin/admin-prototype_*.html`) only if screens change. List the screens that change. Missing screens are drawn only by a prototype subagent, one pull request, with before/after screenshots.
3. **Product** (code), with the visual gate for any UI change: prototype versus live screenshots, computed styles, a difference over 1 px or a different colour fails.
Never patch one place only. If the prototype and the spec disagree, report it; do not pick one.
Loose rules stay loose: content is published first and reviewed afterwards on the phone; there is no human review gate and no danger-word list.

## 3. The header of every terminal prompt

Say first: **"/clear first"** (new task) or **"paste directly"** (continuation). Then:

```
You are the coordinator for one batch of WaveParticle work, using subagent-driven development: one subagent per task in its own git worktree, a reviewer subagent per pull request, ONE summary table at the end. Never merge; I merge. Read AGENTS.md first. Merge origin/main into every branch once when you start it; after that, update a branch from main only when GitHub shows a conflict or another merged pull request changed the same files. One pull request per issue with "Closes #N" (only when every criterion is met or removed, otherwise "Refs #N"); every pull request needs a real issue so the pr-closes-issue check is green. Never write the running-person marker; plain English; at most two subagents at a time. Port blocks 4100/4101/4199/4198 and 4200/4201/4299/4298 (one block per terminal).
Tests: do NOT use "npm test -- --maxWorkers=2". Under the lock run `until mkdir /tmp/wp-e2e.lock 2>/dev/null; do sleep 20; done; npx vitest run --maxWorkers=2; rmdir /tmp/wp-e2e.lock`, then the Python safety test, then only the end-to-end specs for the changed area with --workers=2, each under the same lock; the full end-to-end suite runs in GitHub CI. Shared spec files (docs/PRD.md, docs/DECISIONS.md, docs/FLOW.md, docs/CONTENT_MODEL.md, docs/USER_STORIES.md) change only in the round's spec pull request; feature pull requests edit only their own docs/api or docs/decisions/NNNN file. Create each pull request in its own command, never inside the lock command.
Production work (migrations, prompts to publish, settings, data fixes): never run it; write numbered copy-paste steps with a dry run and an undo for me. Never call the real model: fake model only; any real-model command is written for me to run, with --confirm and a budget.
Every pull request description has a "Human steps" section: either "None" or the tagged steps I must do (once the Human steps check is on main, a pull request without it goes red).
Before every push, check whether the pull request is already merged; if it is, open a new issue and pull request from main, never push onto the merged branch.
If something needs a rule-file edit (AGENTS.md, .claude/): you cannot make it; write the exact text for me to paste and mark the pull request "do not merge until pasted".
```

Then the task, then the closing line: **"One table at the end: pull request, issue, criteria met or removed, review result, checks run locally, GitHub checks that did not run, what I must decide, and my production steps."**

Rules that always apply: spec first; a decision the owner must make goes in the table and the subagent moves on; no new card types; no coaching or guilt wording; tell the terminal which existing files to read instead of retyping them; one `gh pr create` per command.

## 4. When something goes red or conflicts

- **Docs conflict** (shared doc files): merge origin/main into the branch on the command line, keep both sides' text, rerun checks under the lock, have a reviewer confirm nothing from either side was lost. Never the web editor. Check other open pull requests for the same file.
- **Red GitHub check**: read the failed log (`gh run view <id> --log-failed`), compare the last runs on main and on the branch. Decide: billing block, two changes interacting, or a real failure. Fix the cause in code; never weaken a test, never merge red.
- **Reviewer found problems after merge**: open a small follow-up pull request; do not reopen the merged one.

## 4b. Merging, history and long runs

- **"Closes #N" closes before the production step has run.** When an issue's criteria include a production step (data fix, prompt publish, migration), the pull request says "Refs #N", or the issue is reopened right after merge. (#394 auto-closed #377 with the card steps undone.)
- **The owner often merges before a fix round lands** (#386, #395, #399, #403, #414). Handle as in the header: a new issue and pull request from main, never the merged branch.
- **Stacked pull requests and public history.** Copy only the parts a drawing needs; do not carry private planning text onto a public branch (it stays in history, as with #405). Recommend "Squash and merge" for a pull request and for anything stacked on it.
- **Two changes interacting** can break main even when each pull request was green (#408 with #410; #455 with #459, fixed by #471). Watch main's CI after each merge; when it goes red, fix main first in a small pull request and hold other merges. Update an open branch from main only when GitHub shows a conflict or another merged pull request changed the same files.
- **Long runs.** The Mac sleeping and the usage limit each stopped agents more than once: keep the Mac awake with the lid open, and after an interruption resume the same agent from its saved state instead of starting a new one.

## 5. How to brief the owner (Yue) - coordinator chat only, not for terminal sessions

A terminal that reads this skill follows sections 1 to 4b and writes in the language of the person who talks to it (English); the one table at the end replaces the progress review. Sections 5 and 6 are for the separate coordinator chat.

- Reply in Chinese, **start with the owl emoji**, plain full sentences, no unexplained abbreviations; issue and pull request ids only in brackets, in the form the owner can click.
- Every decision: what it means in one sentence, an example, the options, cost, **my recommendation**, one question at a time. If the owner already decided, do not re-ask.
- A decision table has: item, my recommendation. Then "your steps" in order, then the prompt for the terminal in its own code block.
- Never offer things the owner cannot do or the spec forbids (no human review gate; no danger-word list; no fallback text).
- Every 5 exchanges give a short progress review: finished, stuck, next.
- When the owner is ambiguous, read the actual files or sessions first (`list_events`, `search_session_transcripts`) before asking.
- Keep a hand-over note (`2_Areas/Product/content-admin/coordinator-state_*.md`) updated so a context loss does not lose open pull requests, decisions and waiting items.

## 6. Mistakes already made (do not repeat)

- Recommended one call for the pause message; the spec says two (FR-REST-2, C1). Always check the spec first.
- Proposed a read-by-a-person gate and a danger-word list; the owner rejected both.
- Gave a phone-width design spec for the desktop admin.
- Launched six terminals before port isolation; keep to the port blocks and the lock.
- Answered a stale pasted report as if it were current.
- Proposed a default (US hotline) that conflicted with the spec; check FR/US lines before giving defaults.
