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


## 24 November 2026 — opaque account anchor correction

The review identified that the first master-restack implementation placed the Gmail address in a public DOM id / URL fragment. The helper now emits a stable 16-hex-character hash of the normalized receiving inbox plus the provider thread ID. The thread ID remains in the fragment for direct card navigation; the inbox address does not. The hash is a UI key, not an authentication control.

- Source commit: `8ce61c327f78b18c517bbb6dc5688336f4fe0008`.
- Regression commit: `0e91d68c2a076f26616414da137343950b7f15d1`.
- Tests assert same-account normalization, distinct anchors for the same provider thread ID in different inboxes, and absence of the plaintext email from the fragment.
- Exact-head focused workflow is pending; full CI remains dependent on the separately reviewed #554 Kompas fix. No local checkout, protected preview, Gmail API/OAuth, inbox mutation, email send or device acceptance occurred.


## 24 November 2026 — exact-head regression results and shared lint blocker

On PR #577 head `1188d32fe11b4fa8252a4886ccfd721a6e6edf75`:
- Focused account-scoped-links workflow `45452255057`: SUCCESS.
- Plan Journal / REA schema workflow `45452255091`: SUCCESS.
- Kompas baseline `45452255115`: SUCCESS.
- Full CI `45452255006`: FAILURE at the existing master lint error `src/lib/kompasConsistency.ts:1059` (`prefer-const`, variable `s` is never reassigned). Type-check and subsequent gates were skipped; this is not attributed to the Gmail change.

The shared lint correction is already in PR #554, whose five exact-head gates pass, but the PR cannot merge until an independent authorized reviewer reviews it. Keep #577 draft and do not duplicate or bypass that fix. Protected preview requires the private `KOMPAS_VERCEL_API_TOKEN`; no local checkout, Gmail API/OAuth, inbox mutation, email send or device acceptance occurred.
