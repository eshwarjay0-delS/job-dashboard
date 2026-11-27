# Confirmed-skill attribution and deterministic role-gap repair — 27 November 2026

## Approved scope

An explicit positive candidate confirmation supports only the named skill. It may be mapped into relevant existing project bullets across roles, including earlier roles, but does not create an employer, project, action, outcome, title, date, location, contact, metric or credential. The JD remains target context. Gemini ATS score/feedback and identifying missing/weak keywords are approved; automatic correction/re-export/recheck is not.

## Implementation

Clean current-master PR #598 carries the reviewed #595 resume source slice onto master.

1. Candidate attribution: split coordinated clauses before explicit team, colleague, client, organization, collective and passive external attribution. Candidate lists remain intact.
2. Role-level confirmed skills: context-fit confirmations are included in each relevant role's required evidence even when the first model pass omitted them. The missing-term helper and final deterministic weave can repair only relevant existing project bullets; unrelated roles remain excluded.
3. Prompt accuracy: gap repair distinguishes source-supported terms from confirmed skills and avoids inventing projects or new actions/outcomes.

## Regression evidence

New cases cover coordinated team, colleague, client, organization and collective clauses, passive team attribution, and normal candidate lists. A confirmed CyberArk EPM term omitted from an endpoint-hardening bullet is a gap candidate, while a marketing bullet is excluded.

Remote focused run 45932860471 on initial code commit 3b342abc failed 1/56 because the first clause retained a trailing comma. Correction commit a3e526eda9cbe5aebba0cbd54c5b26f575d069aa trims split-boundary punctuation. Full CI 45932860433 was still in progress; current-head runs were not visible after docs commits. No local checkout/dependencies or local execution are available.

## Release/acceptance boundary

PR #598 is ready for review but not independently approved, merged or deployed. No owner-authorized resume/JD/confirmation bundle, protected preview, model call, generated/exported DOCX or factual/ATS acceptance occurred. Do not declare 95–100%/98% live match.

## Next

Continue: verify exact-head remote focused/full workflows, resolve failures with tests, then require independent review, legitimate protected preview and owner-authorized source/JD/confirmation plus exported-DOCX inspection.
