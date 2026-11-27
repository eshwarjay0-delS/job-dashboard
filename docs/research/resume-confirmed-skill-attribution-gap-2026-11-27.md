# Confirmed-skill attribution and deterministic role-gap repair — 27 November 2026

## Approved scope

An explicit positive candidate confirmation supports only the named skill. It may be mapped into relevant existing project bullets across roles, including earlier roles, but does not create an employer, project, action, outcome, title, date, location, contact, metric or credential. The JD remains target context. Gemini ATS score/feedback and identifying missing/weak keywords are approved; automatic correction/re-export/recheck is not

## Implementation

Clean current-master PR [#598](https://github.com/eshwarjay0-delS/job-dashboard/pull/598), code commit 3b342abc9f199254007b5b925d529ea53310e6c7, carries the reviewed #595 resume source slice onto master

1. Candidate attribution: split coordinated clauses before explicit team, colleague, client, organization, collective and passive external attribution. Candidate lists remain intact
2. Role-level confirmed skills: context-fit confirmations are included in each relevant role's required evidence even when the first model pass omitted them. The missing-term helper and final deterministic weave can repair only relevant existing project bullets; unrelated roles remain excluded
3. Prompt accuracy: gap repair distinguishes source-supported terms from confirmed skills and avoids inventing projects or new actions/outcomes

## Regression evidence

New cases cover coordinated team, colleague, client, organization and collective clauses, passive team attribution, and normal candidate lists. A confirmed CyberArk EPM term omitted from an endpoint-hardening bullet is a gap candidate, while a marketing bullet is excluded

Remote workflows on initial code head: full CI 45932860433, Kompas baseline 45932860435, confirmed-skill regression 45932860471, WhatsApp recovery 45932860472 were IN_PROGRESS. Documentation commits change the PR head; exact-head CI must be rerun and checked to terminal success. No local checkout/dependencies or local execution are available

## Release/acceptance boundary

PR #598 is DRAFT. No owner-authorized resume/JD/confirmation bundle, protected preview, model call, generated/exported DOCX or real factual/ATS acceptance occurred. The feature is not merged or deployed. Do not declare 95–100%/98% live match

## Next

Continue: inspect exact-head remote workflows, resolve failures with tests, keep the draft until independent review, legitimate protected preview and owner-authorized source/JD/confirmation plus exported-DOCX inspection
