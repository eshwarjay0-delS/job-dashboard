# Owner-approved Gmail mobile no-cover correction — 17 November 2026

## Recovered owner correction

Accessible owner-authored prior-context retrieval recovered a direct correction dated 4 October 2026, 23:32 UTC: the mobile menu must not block or cover the view. The 15 November owner confirmation makes the acceptance concrete:

- Hidden when closed.
- When opened, expands below the sticky header in normal document flow.
- Pushes the page content down.
- No overlay, scrim, dimming or inert page.

The earlier Plan & Vision note that the exact hamburger interaction/layout was unapproved is superseded by this correction. Exact animation/styling remain implementation choices. Per-account Calendar targeting and exact waiting-on-them radar semantics remain proposed.

## Implementation and evidence

PR #435 current-master restack, head `b5138e57b0738a4a45724b76b227baa9b47a5b3c`, implements the normal-flow no-cover behavior. Exact-head full CI `43988493361`, Kompas baseline `43988493279` and Plan/REA `43988493296` all completed SUCCESS. Regression coverage checks the mobile menu expansion, no overlay/inert state, Escape/outside-click close and focus return.

## Release and acceptance

The implementation is not production-live. Canonical alias remains READY at deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`; the Vercel project reports `live=false`, and the latest production deployment is CANCELED. Protected preview, two-authorized-inbox collision/selected-From/reconnect checks and a real narrow-phone device test remain required. No Gmail API/OAuth call, inbox mutation, email/WhatsApp send or device test occurred.
