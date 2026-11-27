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


## Exact validation update

Latest code commit c209bd2c631ad6e87bee3b0ddd5cb38a64d6d37e. Initial focused run 45932860471 failed 1/56; first correction a3e526 failed 2/56 because comma residue and Node.js punctuation stripping. Latest focused run 45933554666 passed 56/56; WhatsApp recovery 45933554510, Plan/REA schema 45933554488 and Kompas baseline 45933554535 passed. Full CI 45933554574 is still in progress. No local execution, protected preview, real resume/JD/confirmation, model or DOCX acceptance.

## Run 24 follow-up — possessive plural passive actors

Static source review found a narrow remaining case in the passive actor regex: after a passive verb, possessive plural actors such as `by my contractors`, `by our subcontractors`, and `by their external vendors` were not recognized by the possessive branch. The splitter can therefore leave the candidate-prefixed sentence intact. Source commit `6960a0580321a2fa0872992e5f9c7568fbea2a3b` expands the possessive passive actor group to plural nouns and optional external/outside/third-party modifiers; test commit `6eeb44181ec9471011a1984f61c3961c186d6dfb` adds three negative inputs requiring only `I used AWS` to survive. This is a source/test change, not local execution. Prior five-green gates on `0220196f` are not reused. Exact-head checks are pending; keep DRAFT, with independent review, protected preview and real resume/JD/confirmation/exported-DOCX acceptance still missing.


## Run 28 follow-up — bare and externally qualified SOC/security-operations actors

Static source review on PR #598 head `6fb23b1` found a remaining candidate-attribution gap: passive `by external SOC`, `by outside SOC`, `by third-party SOC`, and `by security operations` were not recognized, as were active and relative clauses with these actors. A first-person sentence could retain GCP despite the later actor not being the candidate.

Commit `c7e3939c781aee6755bc34e47a98aada580b5d43` expands the actor alternative to permit an optional article and optional external/outside/third-party modifier before SOC or security operations, including bare forms. Eight passive/active negative cases, three relative-clause hard rejects and three candidate-positive controls were added. An isolated source-derived regex simulation passed 13/13 expected outcomes; no repository test/build was run locally.

**Validation boundary:** new exact-head GitHub workflows are pending; previous green runs at `6fb23b1` are not reused. No protected preview, authorized resume/JD/confirmation, model call or exported DOCX inspection. Continue exact-head CI and review; do not merge/deploy or claim a live 95–100% match without the separate acceptance gate.

