# Prompt: plan_split

Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.
`{{name}}` is filled in by the app. A line whose values are all missing is left out.

## Settings

```json
{
  "key": "plan_split",
  "version": 1,
  "note": "Goal split into Steps (AI_01). Moved from gateway.ts unchanged.",
  "params": {
    "checks": {
      "description_max_words": 40,
      "step_title_max_chars": 80,
      "title_max_chars": 40
    },
    "text": {
      "split_finer_no": "no",
      "split_finer_yes": "yes"
    }
  }
}
```

## Prompt

```text
Return JSON only with a short title and at least one step.
Shape: {"title":"...","steps":[{"title":"...","description":"...","minutes":1}]}
Minutes are positive whole numbers and add up to the total.
Goal: {{goal}}
Total minutes: {{totalMinutes}}
Split into finer steps: {{splitFiner}}
```
