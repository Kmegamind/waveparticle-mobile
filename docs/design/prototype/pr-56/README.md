# Pull request for #56: R1 with the two-call pause message

- `R1-prototype.png`: the merged prototype's R1 (copied from `pr-372/R1-after.png`): the stuck
  story of call one on the first slip (with tape), then his message of call two (no tape).
- `R1-before.png`: the app on main: one slip, the single-call message.
- `R1-after.png`: the app on this branch: the stuck story first, then his message, in the same
  slip style; only the first slip in the thread has tape (DESIGN.md 6.11).

Both app screens: the live e2e app with the test-only stub model, iPhone 14 size, /try path
(`e2e/pause-two-calls.live.spec.ts`, `R1_SCREENSHOT=<file>`). The words are the stub's.

Intentional differences from the prototype: the header labels ("Back to step", the Test build
tag) and the composer are the app's existing R1 and are not changed here.
