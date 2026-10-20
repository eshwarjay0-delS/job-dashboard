# Credential target boundary audit — 20 October 2026

Continues the owner rule recorded in keyword-targets.ts on 19 October: certifications are not tailoring targets; unsupported credentials must not be added. This supersedes neither the factual-evidence rules nor score thresholds.

Source audit found a trailing regex word boundary after `+` fails at end-of-string and before punctuation. Security+, Network+, CySA+, CASP+, Pentest+ and A+ could therefore be treated as skills. Salesforce Platform Developer I/II and Salesforce CPQ Specialist without a Certified prefix were also absent.

A regression failed before the fix on Security+. The token-end assertion and explicit Salesforce names now pass classification, target exclusion, unsupported-addition removal, source-preservation and ordinary-skill negative controls. 31 targeted tests passed across keyword extraction, targets and WhatsApp request/library suites. Provider and messaging calls are mocked in those suites; no real messages were sent.

Current master at inspection: 6cf9f3aea41e164aee08bb730e1e37caf7227cec, Vercel commit status success. Typecheck, scoped lint and full production build passed; three REA register tests also passed (34 tests total). Deployment verification remains pending. This does not prove 98% live resume quality. Exact 17:28 failed-run inputs/output and a fresh authenticated generation remain pending. Separate Kompas work was not modified.
