# Confirmed-skill attribution and WhatsApp/Crawler/Gmail checkpoint — 27 November 2026 (run27)

## Resume source review and correction

Current PR #598 was reviewed at head `40a7be3372b95325ee71d1c1bce9b7a030680fcf`. The passive matcher missed `people from a vendor` and `the SOC`; active variants also needed coverage. Review COMMENT `6091245042` is not approval.

Four synthetic negatives were committed test-first in `adc9239c9d844a44215a42b0ee09dee66906771e`. Final source head `ec3ba54bcc59f0e2f18e1365fe33b728541722b9` uses dedicated actor and passive patterns. Isolated source-derived regex simulation: 4/4 negatives split to AWS-only; normal `I used AWS and GCP` positive retained. This is not repository execution. Earlier intermediate source attempts `7cf800d` and `1d0f5af` were superseded/corrected; final exact-head checks are pending.

Final-head workflow state: full CI `46038439342`, focused `46038439358`, WhatsApp recovery `46038439352` IN_PROGRESS; Plan/REA schema `46038439384` and Kompas baseline `46038439390` SUCCESS. PR #598 is Ready for review but remains unmerged/unreleased; protected preview and owner-authorized source resume/JD/confirmation and exported-DOCX inspection are missing.

## WhatsApp fallback and historical incident

PR #600 head `c751ab5b4d20ca06c8d88a56fbb8842fda0468db`: full CI `46013398748`, recovery `46013398715`, schema `46013398810`, baseline `46013398837` all SUCCESS. Its progress wording is conditional on durable explicit same-account Files/Library selection. Vercel preview canceled by the ignored-build marker. No send/replay or production deployment.

The 17 Oct 17:28 Chicago delivery remains UNVERIFIED. A read-only iZap scope refresh found one business, no WhatsApp number, disconnected and no inbound/outbound evidence; this is not established as the incident business. Required evidence: correct authorized business/scope, exact source and generated DOCX, per-run R2 object/version, webhook correlation, Meta outbound ID, signed delivery/read receipt.

## Independent approved backlog

- Contract crawler PR #605 head `bc6c0879cfa2a83cf6ce7cfd7706c1bda646eeaf`: full CI `46028682703`, freshness/classification `46028682536`, manual-only `46028682513`, baseline `46028682704` SUCCESS; draft, no protected preview/API smoke/live crawl. Location/remote filters after the 100-row page may underfill and route duration is 60s versus 230s runner.
- Gmail/Poke: #576 exact head `28d67d66db298bae4bc71e12e377a7837cccbc0b` full CI `45989032477` and baseline `45989032526` SUCCESS but stale. Four accounts max; #580 owner merge tap required. Proactive workers/scheduler/notifications/sending remain disabled; OAuth, two-inbox and mobile acceptance absent.
- Kompas: real 50-pair/human grading, protected-preview acceptance, native Windows/mobile/WhatsApp acceptance remain open.
- Production alias `job-dashboard-fawn.vercel.app` independently READY at runtime SHA `a17b3267e271c77cd8887312445271b7fa172bd0`; master `1eb604b33cfe58f3c0f6ad611d346d5921e184ff` is docs-only.

## Limits and next

No local checkout/dependencies, local tests/build, real resume/JD/model/DOCX, protected preview, live send/replay, Gmail OAuth/inbox mutation, crawl, DB/R2 mutation or device acceptance. Continue: await exact-head #598 CI/focused/recovery, fix failures, then independent review/preview/authorized DOCX acceptance; maintain the incident as unverified and continue the other approved backlog.
