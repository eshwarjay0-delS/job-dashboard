# Gmail interview-board anchor account isolation — 24 November 2026

## Scope and approval

This is a narrow, owner-approved account-isolation correction within the Poke-inspired multi-account Gmail/mobile work. It does not change the four-account ceiling, email sending, proactive Poke scheduling, OAuth, or inbox mutation.

## Source-level finding

Interview matching already uses receiving account + provider thread ID, but the Calendar board's HTML anchor and Mail-to-Calendar href used the provider thread ID alone (`interview-<threadId>`). Two inboxes can contain the same provider thread ID; duplicate DOM anchors can make the link land on the wrong interview.

## Correction

- Normalize receiving account (trim + lowercase) and keep account + thread ID in the board anchor.
- Require Mail-to-Calendar links to pass the receiving account at both call sites.
- Use the same account-scoped helper for board card IDs and link targets.
- Use synthetic `example.test` identities in public tests.
- Add a focused remote workflow for anchor/link and UI wiring regressions.

## Restack and validation

- The code is now based directly on canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`, not the #576 snapshot. It is independent of #576's digest/mobile changes.
- Original stacked-head focused run `45405533164` passed **11/11**. A fresh focused run on the master restack is required.
- Full CI remains blocked by shared Kompas #554 dependency; #554 has five exact-head gates green but needs a second authorized reviewer. Do not copy or merge around that gate.
- No local tests (no canonical checkout/dependencies). Protected Vercel preview requires private `KOMPAS_VERCEL_API_TOKEN`.
- Two-inbox collision/selected-From/reconnect and narrow-phone acceptance remain separate. No Gmail API/OAuth, inbox mutation, email send or real-device acceptance occurred.
