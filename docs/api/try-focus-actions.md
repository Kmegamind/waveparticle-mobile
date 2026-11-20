# src/app/try/focus/actions.ts

`src/app/try/focus/actions.ts`: server actions used by `/try/focus`: `loadStepCards(request)` (runs `normaliseStepCardsRequest` first; an unusable request is `failed`), and `loadReturnLine({ trigger, awayMinutes })` for the return pop-up (`trigger` is `rest` or `absence`; `awayMinutes` goes to the prompt only). Both return `failed` when the test path is off. Nothing about the request is logged.
