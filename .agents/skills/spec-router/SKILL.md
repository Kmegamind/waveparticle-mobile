---
name: spec-router
description: Use when the user asks what to write next, which document or skill fits a situation, where a specification belongs, or what state a specification is in — "I want a new feature", "how do I add a character", "which skill for this?", "what's missing?".
---

# Spec Router

## Overview

`docs/SPEC_MAP.md` is the single answer to "what do I write, when, and with which skill". This skill reads it and answers for the situation the user describes. It writes nothing itself.

## Steps

1. Read `docs/SPEC_MAP.md`. If it is missing, say so and stop.
2. Match the situation to a row in section 3 ("When you want to ... use ..."). If the user names a document, find its row in section 1 and report its status and reason.
3. Answer in this order, in plain full sentences:
   1. The skill to use, by exact name.
   2. The document it will produce and where that document goes (section 2, "Planned folder layout").
   3. What must exist first. Check section 5 ("Open decisions register") for open decisions that block it, and name them.
4. If the map says the skill is "pending adoption" or "does not exist yet", say so plainly. Do not invent a skill and do not copy a draft skill from outside the repository.
5. If the situation matches no row, say that, suggest `superpowers:brainstorming`, and propose a new row for the map.
6. If the map looks out of date (a listed file is gone, an issue is closed), say which line, and offer to update the map in its own pull request.

## Red Flags: STOP

| Thought | Reality |
|---|---|
| "I remember the skill list" | The map changes. Read it. |
| "I'll just start writing the spec" | Route first; the right skill and template save a rewrite. |
| "That draft skill outside the repo will do" | It is pending adoption. Say so. |
| "The open decision is probably fine" | Name it and let Yue decide. |
