# Gmail account-switch cache isolation — 27 November 2026 (run27)

## Static review

The approved multi-account Gmail branch #576 already keys shared and in-flight loads by authenticated user and checks generation/current-user before publishing data and writing per-user snapshots. The earlier static review COMMENT `6090182960` requested an executable A→B race test, not a confirmed leak.

## Regression added

Test commit `e6ba204e4ff5079eb2933190f29c29c7674b5328` defers Account A's seven endpoint responses, switches the auth mock to B, resolves B first and A last, then asserts A never publishes or snapshots after the switch while B is the only cached/published account. The test is source-executed CI code; it was not run locally.


## Validation and release gates

- Exact-head full CI `46039242535`: IN_PROGRESS.
- Kompas baseline `46039242543`: SUCCESS.
- PR #576 remains DRAFT and stale (20 commits ahead/8 behind current master). No clean restack, independent review, protected preview, two-inbox collision, selected-From, reconnect or narrow-phone acceptance.
- Four-account limit is unchanged. Poke worker/scheduler/notifications/sending remain disabled. No Gmail OAuth, inbox read or message send.

## Next

Await exact-head CI; then clean restack only after local checkout/dependency recovery. Keep privacy gates, independent review and real acceptance separate. No deployment or live Gmail acceptance is claimed.
