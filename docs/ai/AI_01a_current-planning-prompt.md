# Current goal-splitting prompt in the web app

> **Decisions of 2026-11-21 (#369).** The real planning prompt (P1) is still missing; Yue will supply the file, and engineering does not draft one. The problem points in this prompt and in the current prompts in `docs/ai/prompts/` are to be marked for a later full rewrite. The Goal's shape is decided by a local rule in version 1 (GOAL-SHAPE-LOCAL).

Source: `5_Code/Waveparticle-python-main/services/llm_service.py`, function `generate_task_breakdown`, called by `POST /api/generate-tasks` in `routes/api.py`. This file records what exists today so the new app can reuse it. It is a reference, not a specification; where it differs from `docs/DECISIONS.md`, the decisions win.

No file named "expert" or "planner" was found in that repository. This prompt is the only goal-splitting prompt there.

## What the function does today

Inputs: the goal text (up to a maximum length), the total time in minutes (1 to 480), the number of steps (1 to 20, default 4), and the character's name.

Output: a list of steps, each with `title`, `duration` (whole minutes) and `description` (one line). The durations are adjusted so that their sum equals the total time.

If the goal looks like an everyday activity (rest, food, chores, errands, personal care, gym or workout), a hint is added to the prompt asking for concrete physical steps and forbidding generic steps such as "Research", "Create a plan" or "Review". The detection is a fixed keyword list in `ai_backend/director/mundane.py`.

## Prompt text (as written in the code)

```
Break the following goal into {task_count} specific, actionable subtasks with a total duration of {total_time} minutes.
Goal: "{goal}"
[if an everyday activity:]
"{goal}" is a practical everyday task, not a research project. Generate concrete, physical steps someone would actually do — e.g. for laundry: sort clothes, load washer, run cycle, dry, fold. Do NOT generate steps like 'Research', 'Create a plan', or 'Review'.

Respond ONLY with a JSON array. Each element must have:
- "title": clear, concrete task title (no generic labels like "Research" or "Plan")
- "duration": time in minutes (integer)
- "description": one-line description

The sum of all durations must equal {total_time}.

Example for goal 'cook pasta':
[{"title":"Boil water","duration":10,"description":"Fill pot and bring to boil"},{"title":"Cook pasta","duration":12,"description":"Add pasta and cook to al dente"}]
```

Model settings: temperature 0.7, at most 1024 tokens, through the shared chat function of the app.

## Fallbacks today

1. If the reply is a JSON array, it is used; if it is a numbered list, the numbered lines are used; otherwise the fallback below runs.
2. Everyday activity with a known keyword: a fixed set of steps for that activity.
3. Everyday activity without a known keyword: four generic steps ("Get started on ...", "Work through ...", "Finish ...", "Wrap up and tidy").
4. Anything else: four generic steps ("Plan your approach to ...", "Start working on ...", "Make progress on ...", "Review and finish ...").

## How this matches the decisions

| Decision | Match |
|---|---|
| The plan always matches the time the user gave (D1d) | Yes: durations are adjusted to sum to the total time |
| Each step has a title and a short description (D1c) | Partly: the description is one line, the decision asks for one or two sentences |
| The user can choose any number of steps (T2) | Partly: the app allows 1 to 20; the new flow sets no maximum |
| Different kinds of goals are handled by the planning prompt (D1b) | Partly: only everyday activities get special treatment, by keyword |

## Other AI pieces in the original repository that matter for the new design

- `ai_backend/missions/engine.py` and `archetypes.py`: a character's independent mission with phases and twists, advanced by the narrative director. This is the existing counterpart of "the character's goal mirrors the user's goal" and of the story being given to the AI as a whole.
- `ai_backend/story_bank/`: one JSON file per character.
- `ai_backend/director/`: narrative direction, output guard and the mundane-activity detector.
- `routes/api.py` scene types: `start`, `stuck`, `anxious`, `scared`, `quit`, `focus`, `pause`, `resume`, `complete`, `all_complete`. The `stuck`, `pause` and `resume` scenes are the existing basis of the rest conversation.
- `safety/`: input guard, output guard and abuse logging; the existing basis of the safety tiers.

These are pointers for the engineers; they have not been reviewed against the new decisions.
