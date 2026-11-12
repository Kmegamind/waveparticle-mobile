---
name: writing-feature-spec
description: Use when writing or rewriting the specification of a product feature or screen group, turning a feature idea into acceptance tests, or replacing an old product requirements, user experience or user story document.
---

# Writing a Feature Spec

## Overview

A feature specification is one short page plus acceptance tests, built from `docs/templates/feature-spec.md`. It links to decisions; it never copies them. Copied rules went stale in every old document set, which is why this standard exists.

## Steps

1. **Check the map.** Read `docs/SPEC_MAP.md`: find the feature's row, the old documents it replaces, and open decisions in section 5 that block it. Stop and tell the user about any open decision that blocks a requirement.
2. **Understand the idea.** If the feature is new or unclear, **REQUIRED SUB-SKILL:** superpowers:brainstorming first.
3. **Collect sources.** Read `docs/DECISIONS.md` (the authority), the matching section of `docs/PRD.md`, the screens in `docs/FLOW.md`, the stories and issues for the feature (`gh issue list`, read only), and the old documents named in the map. Where sources disagree, the decision log wins; record every disagreement you find.
4. **Copy the template** to `docs/01-features/<feature>/spec.md` (or to the folder the map names while the layout is not yet created). Fill the header line: decisions up to which date, code at which commit (`git rev-parse --short HEAD`), and the file replaced.
5. **Write the brief and the frequently asked questions** in plain full sentences, with no abbreviation or internal id left unexplained.
6. **Write requirements.** Each has an id, one sentence, and at least one given, when, then test line that names a test. Cover the failure case. A requirement without a test name is unfinished.
7. **Link decisions by id**, with a few words each. If the feature calls a model, link to its AI specification, and use writing-ai-feature-spec for that file.
8. **Check.** Every id and link resolves; the header line is filled; no rule is copied from the decision log; the page reads in one sitting.
9. **Update `docs/SPEC_MAP.md`**: set the status of the new document and of the ones it replaces. Do not move or delete the old files in the same pull request unless the issue says so.
10. Ship with the `shipping-backlog-issues` skill.

## Red Flags: STOP

| Thought | Reality |
|---|---|
| "I'll copy the rule so the reader sees it" | Link it. Copies go stale. |
| "The acceptance test names can come later" | A requirement without a test name is not a requirement. |
| "The old document has it, I'll paste it" | Verify against the decision log first. |
| "An open decision is blocking, I'll guess" | Name it; the owner decides. |
