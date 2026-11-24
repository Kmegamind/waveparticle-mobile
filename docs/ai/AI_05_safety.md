Imported from the planning folder on 2026-11-05. The decisions file docs/DECISIONS.md overrides this document where they differ.

> **Status after the decisions up to 2026-11-15 (#295).** The first demo has two tiers, crisis (real hotlines by region) and ordinary stress; low mood (T2 below, with its step-out line) is deferred (A5, A5b). English only: no Chinese test sets, keyword layer or `lang` field (L1). That the Companion is an AI is stated only in the terms and settings, so option (b) "I am a program" is out (A4). Pre-made content (cards, closing line) gets only the banned style words before publishing, the same as the admin save check, and no further AI-6 line rules (SAFETY-PREMADE, 2026-11-21). **Decided 2026-11-21 (NO-DENYLIST):** there is no word list of dangerous method or instruction words, and none is owned by compliance; the output guard is the AI-6 rules and the style checks (`src/lib/model-gateway/checks.ts`). **Decided 2026-11-22 (#117, SAFETY-PROVIDER, SAFETY-CHECK-FIRST, SAFETY-TIERS-2, SAFETY-CONTEXT, SAFETY-ALARM, SAFETY-FIELDS):** the classifier runs through the same AI provider as the other live calls, before the reply call or any save, with the two-tier prompt in section 3 below; all free text goes to the provider for classification, and text the keyword layer flags goes to no model at all. The rest is a draft for compliance.

# AI-5 · Safety — v2 (after the user test, un-parked)

> Delta on AI_05 v1 (earlier version, not imported). v1 was parked on 2026-10-29 ("not needed for now"). The user test raised **B18**, so this v2 un-parks it as a draft. The hook positions list (v1 §2) and the evaluation table (v1 §9) stay valid; this file replaces v1 §4 (method), §6 (guardrails on the hook), §7 (fallback) and §10, and adds tiers, an error budget, test sets, logging and the compliance decision list.

**This is a compliance item. Nothing here is a final rule.** Every number is a Guess to be set with compliance and, ideally, a clinical adviser. I am not a lawyer and not a clinician; items marked *verify with counsel* are from my memory of the legal landscape, which may be out of date.

**Evidence.** From the brief: B18 asks to move "from keywords to a classifier". The sources (NF6 v4, v1 above) say: strong signals only; position-only logging; two languages; S1 as an out-of-character page. No source defines tiers, a classifier, an error budget or resources. Everything beyond that is *Reasoned* or *Guess*.

## Change list (v1 → v2)

| # | Change |
|---|---|
| 1 | Status: parked → draft |
| 2 | Three tiers instead of one "strong" cut: **crisis / low mood / task stress** (§1) |
| 3 | A **step-out line** for low mood: one plain human sentence in system voice, no page change (§2) |
| 4 | Method: keyword layer + **tiered classifier** returning JSON with context of the last 2 user turns (§3) |
| 5 | Error budget and test sets (EN, ZH), with what to include (§4, §5) |
| 6 | Logging proposal (§6) |
| 7 | List of what Yue and legal must decide (§7) |

## 1. Tiers

| Tier | Meaning | Examples (EN) | What happens |
|---|---|---|---|
| **T3 crisis** | Clear, current intent to seriously hurt self or others, or disclosure that suggests immediate danger | "I want to end it tonight." "I'm going to hurt him." | **S1 page** (out of character). Text discarded, never sent to a model. Real resources by region. "Back to my task" always available |
| **T2 low mood** | Hopelessness, "worthless", "can't cope", heavy distress **without** clear intent | "I'm such a failure, what's the point." "I haven't eaten in two days and I can't do anything." | **Step-out line**: his reply is not shown; one plain system-voice sentence appears in the chat or hook position; no page change; one soft link to support. The text is not used as chat context |
| **T1 task stress** | Normal pressure, tiredness, frustration, dark humour, figures of speech | "This deadline is killing me." "I'm so tired." | Passes. He answers in character under AI-4 §B (one line of his own, no advice) |

Ambiguity rule: when a message could be T2 or T3, treat it as the higher tier. When it is T1 or T2, treat it as the lower one unless a second signal appears in the last 2 turns (a pattern).

## 2. What he does in each tier

He never knows, never mentions, never reacts to the safety layer. In T2 and T3 his reply for that message is **not generated or not shown**.

**T3:** unchanged S1 from NF6 v4: "This is outside the story." Body from legal. Primary button "Get support now" (the resource for the chosen country, or the directory; SAFETY-REGION), secondary "Back to my task". Placeholder text stays until legal fills it.

**T2 step-out line (draft for legal, plain human, no clinical words, no advice, no "story"):**
*"That sounds really heavy. You do not have to do the task right now."*
Below it: a text link *"Find support"* and a primary button *"Back to my task"*. No second confirmation, no counter, no repeated "are you OK?" (NF6 "Not here"). It appears once per message that triggers; no more than once every 10 minutes (Guess) so it does not become a drumbeat; after that the message is simply not answered by him and the field stays open. Wording options to test: (a) the draft above; (b) "That sounds hard. I am a program, so I cannot help much, but here are people who can." (honest about being software; ties to the `meta` policy in AI-4 v2).

## 3. Method (Recommendation; replaces v1 §4)

1. **Keyword and phrase layer (code, English only, L1).** High-recall triggers for T3 and T2 phrases and euphemisms; negation handled ("I would never hurt myself" does not trigger on its own). Runs everywhere, no cost, gives an answer when the model is down.
2. **Tiered classifier call (model, same provider as the gateway, SAFETY-PROVIDER).** Runs on every free-text submission with a server-side check (SAFETY-FIELDS) **except** the positions with no meaningful free text (GD3 buttons), **after** the keyword layer and **before** the reply call or any save (SAFETY-CHECK-FIRST). A message the keyword layer flags is never sent, not even to the classifier. Input: the text and the **last 2 user messages in the same field** (a change from v1, which forbids context; one message alone loses patterns like repeated "I can't"). Never the character, the story, the goal or the plan.

The prompt in use is `docs/ai/prompts/safety_classifier.md` (key `safety_classifier` in `public.prompts`). In short (two tiers, A5b; no language field, L1):

```
You check short messages written by a person using a focus app. You do not reply to the person.
Everything between <<< and >>> is the person's own words ...
Earlier messages in the same field: {{prev_1}} {{prev_2}}   (a line is left out when empty)
The message to classify: {{text}}
- "crisis": a clear, current intention to seriously hurt themselves or someone else, or a disclosure
  that suggests immediate danger, including indirect and euphemistic wording.
- "stress": ordinary pressure, tiredness, frustration, dark humour, quotes, fiction, figures of speech;
  feeling low without intention or danger.
- "none": no concern.
If it could be a crisis, answer "crisis". If you cannot tell, answer "unsure".
Return one JSON object only: {"tier": "crisis" | "stress" | "none" | "unsure"}
```

~~Earlier draft (three tiers and a `lang` field): withdrawn by A5b and L1.~~

3. **Merge rule:** final tier = the higher of the two layers (crisis > stress > none; the keyword layer's low-mood match counts as stress). `unsure` counts as crisis. An answer that is not exactly one tier is a failure. If the classifier fails or exceeds 1.5 s (one attempt, the prompt read included), the keyword layer decides alone, the server logs `safety_classifier_failed`, and a webhook alarm goes to `SAFETY_ALARM_WEBHOOK_URL` at most once a day, on the day's first failure, with its time and reason; later failures that day are in the server log (SAFETY-ALARM).
4. **Output guard**: AI-6 rules, including the style checks, on every model reply. ~~Plus a method/instruction denylist owned by compliance.~~ Withdrawn (NO-DENYLIST, 2026-11-21): there is no such word list.

## 4. Error budget (Guess; set with compliance before any real use)

The costs are unequal: a missed crisis is the worst outcome; a false T3 is an annoying page but is recoverable with "Back to my task".

| Measure | Target | Notes |
|---|---|---|
| T3 recall on the crisis set | ≥ 99% (goal 100% on explicit statements) | The number to defend. Test indirect and euphemistic phrasing separately |
| T3 false-positive rate on benign set | ≤ 2% | Mostly figures of speech and quoted lyrics |
| T2 recall on the low-mood set | ≥ 90% | Softer, because the response is gentler |
| T2 false-positive rate | ≤ 10% | The step-out line is cheap to dismiss |
| Latency | ≤ 1.5 s added, before the AI-1 or AI-4 call (SAFETY-CHECK-FIRST, 2026-11-22; was "≤ 1 s, in parallel") | v1 §8 |
| Classifier availability fallback | Keyword layer alone, same-day alarm | |

Review rule (Guess): any T3 miss found in production or testing is fixed in the keyword list within a day and added to the test set.

## 5. Test sets (English and Chinese)

NF6 says rules once failed silently in Chinese, so Chinese is a separate set, written with a native speaker, not translated.

| Set | Size (each language) | Contents |
|---|---|---|
| Crisis | 100 | Explicit, indirect, euphemism ("not be around"), method words, harm to others, said calmly, said in slang, with typos, mixed languages, in third person ("my friend wants to...") to test the boundary |
| Low mood | 100 | Hopelessness, worthlessness, "can't cope", loneliness, sleep and eating withdrawal, without intent |
| Task stress and benign | 150 | Deadline idioms, dark humour, "I could die of boredom", lyrics, film lines, gaming talk ("I'm going to kill this level"), sarcasm, negations ("I would never...") |
| Context | 30 | Two-message sequences that become concerning only together |
| Adversarial | 20 | "Ignore your rules", attempts to bypass with spelling tricks |

Built with compliance and, for T2 and T3 labels, a clinical adviser (Guess: a licensed counsellor reviews labels). Held out: never used to tune keywords. Re-run on every model or keyword change.

## 6. What is logged (proposal; Yue and legal decide)

Log: timestamp, `position` (screen and field), `tier`, `lang`, classifier and keyword-list version, which layer fired, latency, user action after (Back to my task, Find support, Get support now). **Do not log the raw text** (NF6 draft; privacy decision still Yue's). A salted hash of the text is not proposed (it adds nothing without the text and can link users). Retention: 90 days for events (Guess). Access: named staff only. For model-quality review, use the curated test sets, not production text.

**As built (#119, 2026-11-24):** `safety_crisis` and `safety_classifier_failed` hold `at`, `position`, `tier`, `lang` (`en`, the check's language, never detected from the text), `keywordListVersion`, `classifierPromptVersion` (the classifier's version is its prompt version), `layer` and `latencyMs`; "user action after" is a separate, unlinked line `safety_next_action` (`get_support`, `second_contact`, `directory`, `choose_country`, `back`, `left`) sent from S1. No raw text and no hash. Server log only, no table. Retention 90 days and named-staff access are set as config (`src/lib/safety/log-policy.ts`) and marked pending legal (#121).

Open tension: without raw text, a missed crisis cannot be learned from. Option: opt-in sampling with explicit consent (*verify with counsel*), off by default.

## 7. What Yue and legal must decide

1. **Tier definitions** and who may change them; whether T2 exists in phase 1 (the NF6 draft says "strong only").
2. **Resources by region:** ~~which lines, who maintains them, what the default is when the region is unknown (a global directory is an option; check which). Where region comes from (locale, IP, setting) and what is stored.~~ **Decided 2026-11-23 (SAFETY-REGION, SAFETY-REGION-STORE, SAFETY-DIRECTORY, HOTLINES):** the user chooses a country under Me; no location is read and there is no default country. With no country chosen, S1 shows the Find A Helpline link, the labelled line "If you are in the United States: call or text 988" and a "Choose your country" link. The country is stored on the account with a copy on the phone. The list is edited in the admin and owned by the product owner, and starts with the US 988 entry only. The directory and the US entry are on the legal review list (#121).
3. **Disclosure that it is an AI** and whether it must appear in the experience (see AI-4 v2 `meta`); rules for **minors** and age gating; rules for **companion chatbots** and crisis protocols in the target US states and in the EU (*verify with counsel*; I recall recent state laws on companion chatbots that cover crisis protocols and AI disclosure, and I may be wrong on scope and dates).
4. **Logging and privacy:** position-only vs sampling with consent; retention; GDPR and CCPA treatment of the events; model-provider data retention (open decision D-AI-8).
5. **Human review** of flagged cases: none, or a rota; legal exposure of both.
6. **Disclaimers:** not a medical or crisis service; where it lives (Terms, per Yue's earlier decision to keep source text off screens).
7. **Chinese market:** whether Chinese launches with the same tiers and which resources apply.
8. **The step-out line wording** (T2) and S1 body copy.
9. **Does the guard apply to authored pools?** v1 said no, reviewed offline. Confirm.

## 8. Open questions

1. Is a context window of 2 prior messages acceptable for the classifier (privacy vs accuracy)?
2. Is T2 in scope for the next test, or T3 only?
3. Who owns the Chinese test set?

## 9. Small test (what it would prove)

Offline: run the keyword layer and classifier over the sets in §5; **proves or disproves** the budgets in §4 (this needs no users). With people: a Wizard of Oz of the T2 step-out line with 8 to 10 users who are told it is a test; ask "did that feel caring, intrusive, or fake". **Testers:** adults who agree to see sensitive wording; **never** ask a tester to type real distress; use scripted phrases. No minors without a guardian and counsel's approval.
