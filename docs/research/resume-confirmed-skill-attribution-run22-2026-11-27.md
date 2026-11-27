# Confirmed-skill attribution follow-up — 27 November 2026

## Scope
Static review of the current PR #595 head `db4322e0c293523e13b58af72da9617874d41fab`, approved resume/JD tailoring guard. No private resume, JD, confirmation bundle, model call, or exported DOCX was used.

## Review finding
The added bare-subject boundary tests correctly split cases such as `I used AWS, and my team used GCP`. The regexes still miss modifier-bearing group subjects and passive clauses:
- `I used AWS and my engineering team used GCP`
- `I used AWS and the SOC team deployed GCP`
- `I used AWS and our security team managed GCP`
- `I used AWS, GCP was used by the engineering team`
- `I used AWS, GCP was used by the SOC team`

An isolated JS check with the exact current regex literals confirmed these clauses remain unsplit/uncleaned, so GCP can still be returned in one candidate statement and become confirmed skill coverage. Review comment `7217065646` was posted with these cases. Suggested correction is conservative modifier-aware attribution (not a broad arbitrary prefix match), with regressions retaining the first-person AWS clause and rejecting/splitting the group-only GCP clause.

## Separate remaining gap
The deterministic role-scoped repair for explicitly confirmed skills missing from source bullets remains unresolved. Current PR #595 head has no exact-head workflow run; branch is 36 ahead/2 behind current master and DRAFT. Clean restack, exact CI, protected preview and owner-authorized source/JD/confirmation plus exported-DOCX inspection are still required.

## Next
Continue only on a compliant current-master checkout; add modifier-bearing attribution regressions and the bounded role-scoped repair. Preserve factual gates, never treat JD requirements as candidate history, and never claim 95–100%/98% live match without actual exported evidence.
