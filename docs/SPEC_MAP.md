# Specification map

Verified against decisions up to 2026-11-12 (the answers file described in section 5), code `7b2b72e`, replaces `docs/READINESS.md` and the planning file `PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md` once the owner agrees.

This file answers three questions: which specification documents exist, which are still good, and which skill writes the next one. It is written from three read-only audits of 2026-11-12 (product, AI, content). Nothing has been moved, renamed or deleted yet; the folder layout in section 2 is a plan for a later pull request.

How to read it.

- "Decision log" means `docs/DECISIONS.md`. Where a document and the decision log disagree, the decision log wins, unless section 5 says it is out of date.
- The planning folder paths are short for `1_Projects/Newfeatures/` and `2_Areas/Product/` in the project root, which are outside the repository.
- The planning folder calls its features by codes. The code NF followed by a number means "new feature": NF1 is Goals, NF2 is the story map and Companions, NF3 is the Oppenheimer content, NF4 is Home and the character's own timeline, NF5 is the story format and cards, NF6 is focus and rest, and NF7 is the goal start dialogue.
- Issue numbers are GitHub issues in this repository. "Blocks" means the issue cannot be finished without the document; "blocked by" means the document waits for the issue.

## 1. The master table

Status words: **current** (use as is), **needs rewrite**, **missing**, **to archive** (superseded; do not archive before its content is imported). The reason follows the status.

### 1.1 Product-wide documents

| Document | Where | What it is for | Status and reason | Belongs to | Issues | Skill that writes it |
|---|---|---|---|---|---|---|
| Decision log | `docs/DECISIONS.md` | Every product decision with a date, and the list of superseded rules | **Current** to 2026-11-05. Yue's answers of 2026-11-12 are not recorded yet (a later pull request does that) | Whole product | Blocks every feature spec; open items in section 5 | superpowers:brainstorming, then edit the log by hand |
| Product requirements | `docs/PRD.md` | What the product must do, by requirement id | **Current**: searched for 17 superseded rules, found only in "removed" notes | Whole product | Epics #136 to #147 | writing-feature-spec for new sections |
| Screens and jump rules | `docs/FLOW.md` | The screen registry (41 screens) and how they connect | **Needs rewrite (small)**: section 7 is resolved by prototype v2; account sign-in screens are missing from the registry; section 8 lists 21 open questions | Whole product | Screen stories in epics #139, #140, #142 | writing-feature-spec |
| User stories | `docs/USER_STORIES.md` | 117 stories with acceptance criteria | **Current**: 117 stories match 117 issues. Nine stories wait on decisions that were never recorded | Whole product | #106, #107, #108, #109, #110, #111 are the unrecorded-decision ones | writing-feature-spec (acceptance tests section) |
| Content model | `docs/CONTENT_MODEL.md` | How stories, facts, key moments and cards are stored | **Needs rewrite**: sections 2.2, 2.3, 4 and 9 describe a database the repository never imported | Story content | #45, #47, #84 | writing-feature-spec, after the Character Pack specification |
| Readiness check | `docs/READINESS.md` | Whether development can start | **To archive**: says the technical design, decision records and API specification are missing; they exist now. This map replaces it | Whole product | None | None |
| Glossary and known issues | `docs/memory/` | Vocabulary, data notes, known problems | **Current** | Whole product | None | Edit by hand |
| Technology stack | `docs/TECH_STACK.md` | Pinned versions and why | **Current** (not covered by the audits) | Platform | #143 | An architecture decision record for every change |
| Architecture and interface description | `docs/architecture.md`, `docs/api/README.md` | How the app is built; the server interfaces | Not audited. Other pull requests are open on them | Platform | #132 | Edit by hand |
| Architecture decision records | `docs/decisions/` (0001 to 0009, template `0000-template.md`; 0010 is in open pull request #191) | Why a hard-to-reverse technical choice was made | **Current** | Platform | None | Template `docs/decisions/0000-template.md` |
| Test strategy | `docs/testing.md` | How each kind of test is run and named | **Needs rewrite**: nine lines; no table from acceptance criterion to test, no plan for testing model output | Whole product | #42, #46 | writing-feature-spec for the criteria; writing-evaluation-plan for model output |
| Deploy notes | `docs/deploy.md` | Environments, smoke test, rollback | **Current but short**: launch checklist, monitoring and runbook are missing | Platform | #135, #154 | Edit by hand |
| Research notes | `docs/research/` | Spikes on phone features, clock, live generation | **Current**. The benchmark's output limit must be raised before it runs (AI audit finding 5) | Platform, AI pipeline | #153, #130 | None |
| Design rules and prototype note | `DESIGN.md` (repository root), `docs/design/README.md` | Look and controls | `DESIGN.md` is current. The design note points to prototype version 1 and is **out of date** | Look | #170 | design-from-prototype |
| Prototype | Planning folder: `1_Projects/Newfeatures/wp-prototype_2026-11-05_v2.html` with `..._v2_diff.md` | The screens as drawn, built from the decision log | **Current but outside the repository**. Missing: password reset, account deletion, a few registry screens | Look | #170 | design-from-prototype |
| Earlier document map | Planning: `PRODUCT_doc-map-and-open-decisions_2026-11-04_v1_draft.md` | Provenance of the first document set | **To archive** after this map is merged; keep as history | Whole product | None | None |
| Vision and principles | Planning: `2_Areas/Product/PROD_core-experience-constitution.md` | The experience pillars | **Needs rewrite**: Chinese only; the repository has the pillars in `docs/PRD.md` sections 1 and 2 | Whole product | None | superpowers:brainstorming |
| July roadmap | Planning: `2_Areas/Product/PROD_ROADMAP_2026-H2.md` | An old plan | **To archive**: Chinese; its north star was cancelled (decision N1) | Whole product | None | None |
| Privacy and threat model | Not written | Data flow, retention, threats, what goes to the model provider | **Missing**; blocks the provider retention decision | Account and data, Safety | #102, #103, #105, #121 | None yet (spec-router will say so) |
| Non-functional budgets | Not written | Speed and cost limit per model call, offline behaviour | **Missing** | AI pipeline | #44, #130 | writing-ai-feature-spec (budget section) |
| Release and monitoring plan | Not written | Launch checklist, monitoring, runbook | **Missing** | Platform | #135 | None yet |

### 1.2 Feature documents (planning folder, to become one folder per feature)

The planning folder has two seven-document sets, one for Goals and one for the story map. The product audit found that decisions copied into many files went stale in all of them. The new standard is one short feature specification per feature (template `docs/templates/feature-spec.md`), linking to the decision log instead of copying rules.

| Document | Where | What it is for | Status and reason | Belongs to | Issues | Skill that writes it |
|---|---|---|---|---|---|---|
| Goals brief and frequently asked questions (`GOALS_01`) | `1_Projects/Newfeatures/Goals_Feature_Docs/` | Why Goals exist, rules | **Current**; the interviews behind it were simulated, so the demand evidence is weak | Goals (NF1) | epic #141, #73 to #84 | writing-feature-spec |
| Goals product requirements, user experience spec, Me page (`GOALS_02`, `_03`, `_07`) | same | Requirements and screens | **Needs rewrite**: partly restated in `docs/PRD.md`; mention the cancelled "Start with" field and the removed north star; `_03` is superseded | Goals (NF1) | epic #141 | writing-feature-spec |
| Goals technical design, measurement, launch readiness (`GOALS_04`, `_05`, `_06`) | same | Design, metrics, launch | **To archive**: `_04` assumed a Python app (decision records chose Next.js and Supabase); `_05` is built on the cancelled north star; `_06` is partly valid for privacy and no-shame checks | Goals (NF1) | #141 | None |
| Goals index (`GOALS_00`) | same | Index of the set | **To archive**: says Goals are deferred; they are in release 1 | Goals (NF1) | None | None |
| Story map set (`STORYMAP_00` to `_07`) | `1_Projects/Newfeatures/StoryMap_Feature_Docs/` | Life Path and Companions | **Needs rewrite** into one feature specification: `_01`, `_06`, `_07` partly current; `_02`, `_03`, `_04`, `_05` superseded (entry story, Chinese strings, progress table, north star) | Story map and Companions (NF2) | epic #147, #93 to #99 | writing-feature-spec |
| Story-map path lines draft | `StoryMap_Feature_Docs/path_lines_oppenheimer_draft_2026-10-29.json` | One memory line per story | **Needs review**: 26 drafts, nobody has read them, four disagree on forbidden words | Oppenheimer content (NF3) | #45 | story-content (pending adoption) |
| Product requirement drafts NF1 to NF7 (`PROD_NF*`) and user story drafts (`US_NF*`) | `1_Projects/Newfeatures/PRDs_MomTest/` | First product requirement and story drafts | **To archive**: replaced by `docs/PRD.md` and `docs/USER_STORIES.md`; the NF3 requirement is in Chinese | NF1 to NF7 | None | None |
| Post-user-test change notes (`NF1_v2`, `NF4_v4`, `NF6_v7`, `NF7_v7`, `NF5_card-stack-v3`, `NF3_story-side-after-user-test`) | same folder and `1_Projects/Newfeatures/` | Proposals after the user test | **To archive** after the open items are decided (section 5): the decision log covers the rest. The NF5 and NF3 notes are Chinese | NF1 to NF7 | #109, #110, #111 | None |
| Goal start dialogue notes (`NF7_v6`, `DIALOGUE_goal-setting-brief`) | planning folders | Dialogue design | **Needs rewrite** into one feature specification; the plan-editing and time-reading questions are open | Goal start dialogue (NF7) | epic #140, #109, #111 | writing-feature-spec, writing-ai-feature-spec |
| Home and life state specification (`NF4_..._v4`) | `PRDs_MomTest/` | Home screen states | **Needs rewrite** into one feature specification | Home (NF4) | epic #142 | writing-feature-spec |
| Focus and rest notes (`NF6_v7`, `US_NF6`) | `PRDs_MomTest/` | Focus page, pause, rest | **Needs rewrite** into one feature specification; `US_NF6` is partly Chinese | Focus and rest (NF6) | epic #139 | writing-feature-spec |
| Feature specification for each feature above | `docs/01-features/<feature>/` (planned) | The one-page brief with acceptance tests | **Missing** for all seven features | NF1 to NF7 | epics #139 to #142, #146, #147 | writing-feature-spec |
| Prototype v1 and design mock-ups v1 to v7 | `1_Projects/Newfeatures/` | Earlier looks | **To archive**: replaced by prototype v2; version 1 still holds the high-fidelity visual reference | Look | None | None |

### 1.3 AI documents

| Document | Where | What it is for | Status and reason | Belongs to | Issues | Skill that writes it |
|---|---|---|---|---|---|---|
| AI index, goal split, stuck story, rest chat, safety, check and fallback, closing line, decisions and to-do (`AI_00`, `_01`, `_03`, `_04`, `_05`, `_06`, `_07`, `_09`) | `docs/ai/` | The first AI specifications | **Needs rewrite**: written before the decision log; 0 of 145 required changes are done; `AI_03`, `_04`, `_05`, `_09` are changes only and their original text was never imported | AI pipeline | epic #138, #40, #44, #56 to #61, #117 | writing-ai-feature-spec |
| What each AI specification must change | `docs/ai/DIFFERENCES.md` | The work list for the rewrite | **Current**, with two stale items (introduction phrases, separate time-up card) | AI pipeline | #44 | None |
| Current planning prompt of the old web app | `docs/ai/AI_01a_current-planning-prompt.md` | Record of the old goal-split prompt | **Current as a record**; it is not the real planning prompt, which Yue will send | Goal start dialogue (NF7) | #40 | None |
| Status and landing lines; step cards on the focus page; screen notes (`AI_02`, `AI_10`, `AI_08`) | `docs/ai/` | Authored-card design | **To archive** after the new step-cards specification exists (authored cards are no longer shown to users) | Story format and cards (NF5) | #43 | None |
| Original versions of `AI_03`, `_04`, `_05`, `_09` | `1_Projects/Newfeatures/AI_Specs/*_v1_*` | Prompt text, output shapes, safety hook positions | **Keep until imported** into the rewrite, then archive. The version 2 files are the same as the repository copies | AI pipeline | #56, #59, #117 | None |
| Canyon authored pool | `AI_Specs/AI_example_canyon-authored-pool_2026-10-29_v1_draft.json` | Authored example cards | **Keep as reference examples and evaluation material**, no longer user-facing backup text | Story format and cards (NF5) | #134 | writing-evaluation-plan |
| Card model, immersion and in-task card prompts | `1_Projects/Newfeatures/PROMPTS_card-model_...`, `PROMPT_NF3_in-task-cards`, `PROMPT_NF6_immersion-fix` | Old card prompts | **To archive**: superseded by decisions X2, X3 and T1 (one card at step start; live generation) | Story format and cards (NF5) | None | None |
| Prompt snippet register and content rules (`NF5_prompt-snippets-register`, `NF5_content-rules-*`) | `PRDs_MomTest/` | Source of the check rules (Chinese) | **Needs import**: the rules must become one English rule table in code, then archive | Story format and cards (NF5) | #46 | writing-ai-feature-spec |
| Prompt Canvas | `1_Projects/Newfeatures/Opp/Prompt Canvas.html` and the published page | A test bench for prompt wording | **Keep one copy as a test bench only**: holds one story's old 15-minute model; not a source of rules | AI pipeline | None | None |
| Prompts in code | `src/prompts/` (does not exist yet); today `scripts/demo-prompts.mjs` and inline in the gateway code | The single source of prompt text, character-neutral | **Missing**; documents refer to prompts by identifier only | AI pipeline | #132, #44 | writing-ai-feature-spec (prompt reference section) |
| Check rules in code | `scripts/demo-checks.mjs`, gateway checks, planning Python checkers | The rules that accept or reject generated text | **Needs rewrite**: three implementations that disagree | AI pipeline | #44, #46, #134 | writing-ai-feature-spec (rules and checks section) |
| Model gateway | Open pull request #191 | Server-side calls to the model provider | In review; its prompts are stubs | AI pipeline | #132 | writing-ai-feature-spec |
| Specification per AI feature | `docs/03-ai/` (planned) | Twelve-section spec for each model call | **Missing** for: pipeline, background card, step cards, goal split, pause message, rest chat, return pop-up, closing line, safety | AI pipeline | #40, #43, #41, #56 to #61, #13, #117 | writing-ai-feature-spec |
| Evaluation plan per AI feature | `docs/03-ai/` (planned) | Golden examples, scoring, who reads samples | **Missing**; the test designs of 20 runs by 5 pauses and 180 replies exist on paper only | AI pipeline | #42 | writing-evaluation-plan |

### 1.4 Content and Character Pack documents

| Document | Where | What it is for | Status and reason | Belongs to | Issues | Skill that writes it |
|---|---|---|---|---|---|---|
| Oppenheimer stories | `src/content/oppenheimer/stories.json` | 26 stories: titles, goals, facts, forbidden words, key moments | **Current but incomplete**: the repository imported only part of the database (no background knowledge, notes or place); key moments are machine-derived and unconfirmed | Oppenheimer content (NF3) | #45, #47, #84 | story-content (pending adoption) |
| Story database and build scripts | `2_Areas/Product/oppenheimer-stories/en/database/` | The full source, with a logged build process | **Current**; it is the only content process with an audit trail; no import script lives in the repository | Oppenheimer content (NF3) | #133 (closed), #45 | story-content (pending adoption) |
| Demo inputs for one story | `docs/demo/site-search.*.json`, `docs/demo/README.md` | The only complete generator input for one story | **Current**, unreviewed; the README sentence about authored state cards is stale | Oppenheimer content (NF3) | #84 | story-content (pending adoption) |
| Character bible, voice profile, gold lines | `2_Areas/Product/PROD_oppenheimer-*` | Who Oppenheimer is and how he speaks | **Current as source**; older experiments (about 80 files) can be archived after the pack exists | Oppenheimer content (NF3) | None | character-pack (pending adoption) |
| Trinity data and Python checkers | `1_Projects/Newfeatures/NF3_content/` | Cards and checks for the Trinity night | **Needs rewrite**: checkers have hard-coded Trinity word lists; older pool shape | Oppenheimer content (NF3) | #134 | None |
| Character Pack specification | `docs/04-content/` (planned) | One definition of what a pack contains, for historical and fictional characters | **Missing**; today a pack is six layers produced at different times | All characters | #84, #45 | character-pack (pending adoption) |
| Moriarty setting document and pack | Another session is gathering the information | What he can and cannot know; his stories | **Missing**; first deliverable after the pack specification | Moriarty | None | character-pack, story-content (pending adoption) |
| Character prompts and character evaluation | Not written | Prompt inputs and evaluation per character | **Missing**: the skills `character-prompts` and `character-eval` do not exist yet | All characters | None | character-prompts, character-eval (do not exist yet) |

### 1.5 Skills that are not yet in the repository ("pending adoption")

Two draft skills exist outside the repository in `2_Areas/Product/character-skills/`: `character-pack` and `story-content`. Another session wrote them and is revising them. They are **pending adoption**: they will be reviewed and copied in by a later pull request, not by this one. A known problem: `story-content` calls a priority-3 slice a "key slice", which contradicts `docs/CONTENT_MODEL.md` (finding C-09 of the content audit). Two more skills, `character-prompts` and `character-eval`, **do not exist yet**.

## 2. Planned folder layout

The folders will be created and files moved in a later pull request. Until then, new documents go into the folder below that matches their topic, even if the file is the first one there.

| Folder under `docs/` | Holds |
|---|---|
| `00-product` | Vision, product requirements, decision log, glossary, roadmap, this map's open decisions register |
| `01-features/<feature>` | One folder per feature: the one-page feature specification, its acceptance tests, its screens |
| `02-flow` | The screen registry and jump rules, the prototype, the design note |
| `03-ai` | Specifications and evaluation plans for every model call, the check rule table |
| `04-content` | The Character Pack specification, story content rules, one folder per character |
| `05-engineering` | Architecture, interfaces, technology stack, architecture decision records, test strategy, privacy and threat model |
| `06-delivery` | Sprints, deploy notes, release and monitoring plan, readiness |
| `07-archive` | Superseded documents, each with a first line naming the file that replaced it |

The rule for where a new document goes: ask what question it answers. "What should the product do and why" goes to `00-product`; "how does one feature behave" to `01-features`; "what does the user see and where does it lead" to `02-flow`; "what does a model call do and how do we know it is good" to `03-ai`; "what does a character know and say" to `04-content`; "how is it built and run" to `05-engineering`; "when and how do we ship" to `06-delivery`. A document that answers two questions is two documents. Never copy a rule from the decision log into another file; link to its id.

## 3. When you want to ... use ...

| Situation | Use | What you get |
|---|---|---|
| Not sure which skill fits | spec-router | A one-line answer and the next step |
| Start a new feature | superpowers:brainstorming, then writing-feature-spec | A reviewed idea, then a one-page feature specification with acceptance tests |
| Start a new feature that calls a model | The two above, then writing-ai-feature-spec and writing-evaluation-plan | A twelve-section AI specification and an evaluation plan |
| Add a character | character-pack and story-content when adopted; until then, ask which draft to use | A pack that supports the historical or the fictional mode |
| Judge whether a character's lines are good | writing-evaluation-plan (character-eval does not exist yet) | A plan saying who reads how many samples |
| Change a decision | superpowers:brainstorming, then edit `docs/DECISIONS.md` in its own pull request; the older rule moves to the superseded table | A dated decision with consequences; every document that cited the old rule is listed in the pull request |
| Record an architecture decision | The template `docs/decisions/0000-template.md` | A numbered decision record |
| Plan the work for a specification | superpowers:writing-plans | A step list; no code until it is approved |
| Ship an issue | shipping-backlog-issues | Claim, branch, tests, four checks, pull request |
| Write code for an issue | superpowers:test-driven-development | A failing test per acceptance criterion, then the code |
| Get a change reviewed | superpowers:requesting-code-review | A review before merging |
| Claim that something is done | superpowers:verification-before-completion | The four checks run and their output read |
| Change the look of a screen | design-from-prototype | Tokens and rules taken from the prototype, with a visual check |
| Set up or reorganise the repository | scaffolding-project-repo | The standard repository structure |
| Make a new skill | superpowers:writing-skills (and skill-creator for evaluation) | A skill with a description that says when to use it |
| Write the privacy and threat model, release plan, or the character prompt and evaluation skills | Nothing exists yet | spec-router will say so; start with superpowers:brainstorming |

## 4. Order of work

The audits suggest this order. Each step needs the one before it unless said otherwise.

1. Record Yue's answers in the decision log (needs only Yue).
2. Correct `docs/ai/DIFFERENCES.md` for its two stale items and import the missing original sections of `AI_03`, `AI_04`, `AI_05` (no dependency).
3. Write the Character Pack specification (needs the reviewer-role answer in section 5).
4. Write the pipeline specification, then one AI specification per feature, each with an evaluation plan.
5. Create `src/prompts/` and port the check rules to one TypeScript rule table.
6. Add the account screens and prototype-only screens to the screen registry; copy prototype version 2 into the repository.
7. Write the cross-cutting documents: test strategy with a table from criterion to test, privacy and threat model, speed and cost budgets, release plan.
8. Retire the files marked **to archive**, only after their content is imported.

## 5. Open decisions register

Source of this register: the "Decisions needed" parts of the three audit reports, `docs/DECISIONS.md` section 3, and Yue's answers in `/Users/yue/Documents/2. Wave Particle/5_Code/_handoff/2026-11-12-spec-audit/01_DECISIONS_FROM_YUE_2026-11-12.md` (the "answers file"; a later pull request moves them into the decision log, and this register then points there). In the answers file the Moriarty answers are numbered M1 to M6; they are not the same as decisions M5 and M6 in the decision log, which concern original test data.

### 5.1 Answered by Yue on 2026-11-12 (recorded only in the answers file for now)

- **Moriarty pack questions.** Every story has its own goal and all serve the theme "The Invisible Empire"; the original-novel version is the base and the old television-style version is not used; he may say how he feels; story 8 is included with an open ending and new stories follow it; his relationship with the user is trust and the game is against Holmes; Yue reads the 31 cards of story 1 first and stories 2 to 7 wait.
- **Pause message.** Not an instruction to the user. Each pause means his own story is blocked and a new stuck situation is generated; from the third pause it is much harder and he says he is worried he may fail. This replaces the wording in the decision log (rule F1), and it answers the AI audit's question about addressing the user.
- **Return pop-up.** He may describe how the time felt in any words. Exact clock numbers are still open (5.2).
- **Questions he cannot know.** He answers as a person of his own era would, and he may guess.
- **First card and fallback.** The first card of the next step is generated during the previous step. No authored backup text is ever shown to users.
- **Card length.** One to three sentences and at most 45 words; the background card at most 70 words. Revisit after real cards are read.
- **Key moments.** The machine-derived ones are accepted for now and marked unconfirmed; to be discussed later.
- **Dates.** No dates or ages are shown to users and no approximate-date flags are stored for display. The Life Path is grouped into named periods.
- **Background knowledge in the planning database.** Cross-check it; import it if it can be used directly; otherwise Yue and the team decide the content together.
- **Which comes first, Moriarty setting document or pack specification.** No objection to the pack specification first; no longer blocking.
- **Every card must contain something new.** Yes (this was open item C3, which blocks issue #106).

### 5.2 Still open

| Topic | What is being decided | Blocks |
|---|---|---|
| Conflict between the answers and the decision log | The log (rules C1, T3, D5, A6) says authored text is the fallback; Yue says there is no authored backup text. The log needs updating, and the issues that plan authored fallbacks (#43, #62, #63, #134) need rewording | #43, #62, #63, #134, #21 |
| Failure screen | What the user sees if generation really fails, for example with no network | #21, every AI specification (section 7 of the template) |
| Waiting time limit | How long the user waits for generation; it has to be measured | Every AI specification (speed budget) |
| Exact clock numbers in the return pop-up | Whether he may say "ten minutes"; kept out for now | #57, #61, #69 |
| Mood of the closing line | Whether pauses should change it; Yue did not understand the question and it is being re-explained. The audit recommends choosing the mood by whether every key moment was reached, or dropping it | #41 |
| Safety tier names | Crisis, stress and none (recommended) against the three names now in code and specifications | #117 |
| Real planning prompt | Yue will send the prompt for splitting a goal; until then the gateway's prompt is used | #40 |
| Who reads content and how it is recorded | One named reviewer role per layer and three states (drafted, checked by script, read by human); being re-explained | #46, #84 |
| Goal dialogue reads the time from the goal text | Skip the time question when the goal states a length | #109 |
| Editing a plan | Allowed minutes per step and whether steps get move buttons | #111 |
| His lines never state the number of steps | Confirm the default as a rule | #110 |
| Reading aloud | Whether to keep the writing rules for cards that read well aloud | #108 |
| Which user test comes first | Toast test, pause-count test or history test | Test build content |
| Account screens in the screen registry | Documentation change only | None |
| What "Your record" shows on the summary | Plan length and focus time only, or also ideas | #75 |
| The other six companions | Whether to record that they are out of scope until a content plan exists | #93 |
| Benchmark run | Approve the 2 US dollar cap after the output limit is raised and provider retention is reviewed | #130 |
| Provider data retention (decision log item A7b) | What the model provider keeps | #105 |
| Phone features result (decision log item S2) | Engineering result on vibration, notifications and the clock | #153 |
| Original test data (decision log items M5 and M6) | May be skipped | None |
| Moriarty story 8 rework | Knowledge cut-off and forbidden words must be reworked because his path continues past the waterfall | Moriarty pack |
