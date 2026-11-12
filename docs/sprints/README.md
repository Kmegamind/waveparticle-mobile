# Sprints
One folder per sprint, `sprint-<n>/`: `planning.md`, `standups.md`, `review.md`, `retro.md`. GitHub issues, the project board and the `Sprint <n>` milestone are the source of truth for task status; these files hold the goal, commitments, meeting notes and lessons.

- Board: [WaveParticle Mobile](https://github.com/users/Kmegamind/projects/1). Fields: Status, Priority, Size, Area, Sprint.
- Roles: PO = TODO(human), SM = TODO(human), Developers = everyone + their agents.
- Length: 1 week, Thursday to Wednesday. Planning on Thursday, review and retro on Wednesday.
- Retro rule: a mistake agents repeat becomes one line in `AGENTS.md`; if it still repeats, it becomes a hook or a CI check.

## Calendar
| Sprint | Dates | Goal (detail in `sprint-<n>/planning.md`) |
|---|---|---|
| 1 | 2026-10-29 to 11-04 | Repository setup, account and platform foundations. Closed; open issues moved to Sprint 3 |
| 2 | 2026-11-05 to 11-11 | Goal dialogue and the focus page. Closed; open issues moved to Sprint 3 |
| 3 | 2026-11-12 to 11-18 | One full loop: Goal → Plan → focus with live cards → Done → summary |
| 4 | 2026-11-19 to 11-25 | Pause, the rest conversation and the return pop-up, with guard and cost caps |
| 5 | 2026-11-26 to 12-02 | Goals, Me, history and session records |
| 6 | 2026-12-03 to 12-09 | Companions, the Life Path and Home states |
| 7 | 2026-12-10 to 12-16 | Release readiness: safety, compliance, device checks, accessibility audit |

An unfinished issue moves to the next sprint at review; it keeps its priority unless the PO changes it.

## Priority
The `priority:*` label is set from `docs/USER_STORIES.md` and only the PO changes it. The board's Priority field adds the order of work inside a sprint.

| Priority | Rule | Meaning |
|---|---|---|
| P0 | `priority:must` and at least 5 open issues in the same sprint depend on it, directly or through others | Critical path. Start these first; never leave one unclaimed |
| P1 | `priority:must` | Sprint commitment. The sprint goal is not met until all P0 and P1 issues are Done |
| P2 | `priority:should` | Stretch. First to move to the next sprint when time is short |
| P3 | `priority:could` | Only when every P0–P2 issue in the sprint is Done or claimed |

Pick work in this order: P0, then P1, then P2, then P3; inside one level, the issue with more dependents first, then the smaller size.

## Status
| Status | Enter when |
|---|---|
| Backlog | It does not meet the Definition of Ready (missing criteria, `blocked`, or depends on an open issue in a later sprint) |
| Ready | It meets the Definition of Ready |
| In progress | Claimed: assignee, `in-progress` label, "Working on this." comment, branch open |
| In review | PR open with `Closes #N`, CI green, waiting for a human |
| Done | Merged and meeting the Definition of Done |

## Definition of Ready
An issue may move to Ready, and an agent may start it, only when:
- It has a user story or a problem statement, and acceptance criteria written as Given/Then, each one testable.
- It has `type:*`, `priority:*`, `size:*` and `area:*` labels and a `Sprint <n>` milestone.
- Every issue in its "Depends on" line is closed, or is in the same or an earlier sprint.
- It is not labelled `blocked`, and any human-only step it needs (a migration, a secret, a device) is named in the issue.
- Size L issues have been checked for a split; if they stay L, the issue says why.

## Definition of Done
The Definition of Done is in `AGENTS.md`; it is not copied here. An issue is Done only when it meets every line there.

## Sprint exit criteria
A sprint's goal is met when every item in the exit criteria of its `planning.md` is true at review. Each list includes:
- Every P0 and P1 issue of the sprint is Done.
- CI is green on `main`, and the preview deployment of `main` passes the smoke test in `docs/deploy.md`.
- The sprint's end-to-end journey (named in `planning.md`) passes in `e2e/`.
- Issues not finished are moved to the next sprint and listed in `review.md`.
