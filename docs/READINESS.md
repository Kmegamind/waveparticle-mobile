# Readiness check: can development start?

Date: 2026-11-05. Status: draft. This checks what a feature normally needs before an engineering team builds it, against what exists. "Ready" means an engineer could start from the document without asking the product owner. Nothing here was tested with real users; the earlier test list may have been simulated.

## 1. Result

Development of the repository setup (Sprint 1) can start now. Feature work should not start until the items marked "Blocks" below are done.

## 2. Product documents

| Document | State | Notes |
|---|---|---|
| Master PRD (`PRD.md`) | Ready for review | Rewritten from the sources and the decision log; the product owner has not read it in full |
| Decision log (`DECISIONS.md`) | Ready | The authority when documents disagree |
| User stories (`USER_STORIES.md`) | Ready for review | 117 stories, Must, Should, Could, four milestones. Needs one pass by the product owner and one check that acceptance criteria match the latest decisions |
| Content model (`CONTENT_MODEL.md`) | Ready for review | A proposal for the database; the schema needs an engineering review |

## 3. UX

| Item | State | Blocks |
|---|---|---|
| Screens and jump rules (`FLOW.md`) | Ready for review | |
| Interactive wireframes (`wp-prototype`, published version 7) | **Out of date** | Blocks designer and tester use, not Sprint 0. It still shows several cards at step start, a landing page, a third-pause warning, a language row, no return pop-up, no background card, later chapters tappable, the old goal dialogue and no session record page. The list of changes is at the end of `FLOW.md` |
| Accessibility rules | Written in `DESIGN.md` | Not tested on devices |

## 4. UI

| Item | State | Blocks |
|---|---|---|
| High-fidelity screens | **Not started** | Blocks the look of the product, not the build: build to a theme file of design tokens |
| Design tokens | Proposed | Eight conflicts between `design.md`, the old prototype and this repo are listed in `DESIGN.md` section 11 (version 7); resolve them before the theme file is written |
| Logo | Available | Use as described in `DESIGN.md` |
| Art bible for scene images and portraits | Missing | Blocks real images, not the build |

## 5. Content and AI

| Item | State | Blocks |
|---|---|---|
| Story database (26 stories, facts) | Ready | |
| Pre-written fallback cards | Two stories only; generic fallback lines for the rest are not written | Blocks Sprint 2 |
| Planning prompt for goal splitting | Exists in the old web app (`AI_01a`); needs an update for step descriptions of one or two sentences and no maximum number of steps | Blocks Sprint 1 |
| Prompts for the card stack, the background card, the stuck story, the rest conversation and the return pop-up | Specs exist but are older than the decisions | Blocks Sprint 2 and 3; `ai/DIFFERENCES.md` lists what each AI spec must change |
| Safety: classifier design, hotline list by region, English test sets, legal and clinical review | Not done | Blocks Sprint 3 |
| Checks on generated text (first person, no future facts, no clock times) | Exist as scripts for authored content; not yet running on live output | Blocks Sprint 2 |

## 6. Engineering documents

| Document | State |
|---|---|
| Technical design (architecture, services, API, error handling) | Missing; write after the technology check |
| Technology stack (`TECH_STACK.md`) | Done on 2026-11-05; items to verify are listed in it |
| Architecture decision records | Missing |
| API specification | Missing |
| Security and privacy review (task text stored on our server; text sent to a model) | Missing |
| Privacy policy and terms | Exist for the old web app; must be redrafted for this app |
| Test plan (unit, end-to-end, accessibility, model checks) | Missing |
| Environments and secrets plan (development, preview, production; where keys live) | Missing |
| Launch checklist, monitoring, runbook | Missing |

Not planned: analytics events and success measures. Measurement will be designed later (decision N1).

## 7. What each sprint needs

| Sprint | Goal | Needs before it starts |
|---|---|---|
| 1 | Repository, environments, continuous integration, sign-up and login, a deployed empty app, spikes | Technology check (done), repository structure, technical design (short version) |
| 2 | Goal dialogue and the focus page with the clock | Planning prompt update, design tokens settled |
| 3 | Story cards, background card, the AI pipeline | Card prompts updated, fallback lines, checks running on live output |
| 4 | Pause and the rest conversation, safety | Stuck-story and chat prompts updated, safety design and legal review |
| 5 | Goals, history, session record, Me | None beyond the stories |
| 6 | Companions, Life Path, Home states | Chapter order rules in place |
| 7 | Polish, accessibility, compliance, small beta | Test plan, privacy policy |

## 8. Recommended order of work

1. The product owner reads `PRD.md`, `FLOW.md` and the user stories, and corrects anything wrong.
2. Update the wireframes to the next version (all items in the list at the end of `FLOW.md`).
3. Resolve the design-token conflicts and write the theme file.
4. Write the short technical design and the first architecture decision records; run the spikes (phone features, model latency and cost, clock from timestamps).
5. Scaffold the repository with the standard structure, continuous integration and labels.
6. Create the backlog: one epic per feature area, one issue per user story, one milestone per sprint.
7. Sprint 1: build the thinnest end-to-end path (sign-up, goal dialogue, focus page with one card, Done), deployed and tested.
