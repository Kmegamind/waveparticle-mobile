# Timestamp-based clock

## Finding

The clock must derive elapsed time from recorded timestamps. A JavaScript interval
or timeout is not a reliable source of elapsed time because mobile browsers can
throttle or suspend page execution when a tab is hidden, the screen is locked, or
the operating system reclaims the page.

On iPhone and Android, the page should record lifecycle events such as
`visibilitychange` and `pagehide`, then calculate the next display from the
stored timestamps when the page becomes visible again. The default behavior
freezes during an absence. The optional keep-running setting uses the same
timestamps but includes the absence. The clock state must therefore survive a
stopped page timer and must never depend on a timer firing in the background.

The timestamp module also owns the 1.2-second hold after Done. The hold is a
timestamp interval, not a delayed callback, so returning from the background
cannot skip it or add extra elapsed time.

## Implications for the PRD

- Keep the clock timestamp-based as required by FR-FOCUS-3, FR-FOCUS-11 and
  FR-FOCUS-12.
- Treat page lifecycle events as state boundaries, not as elapsed-time sources.
- Recalculate the display on visibility and foreground events; a missed browser
  callback must not change the result.
- Test pause, leave, return, keep-running, and the Done hold with a fake clock.
