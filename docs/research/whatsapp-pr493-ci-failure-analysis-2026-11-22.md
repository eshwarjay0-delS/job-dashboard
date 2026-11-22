# WhatsApp resume hard-hold CI reconciliation — 22 November 2026

## Exact current PR states

- PR #493, `fix/whatsapp-explicit-library-fallback-20261121`, exact head `1040343cca65fd2a3b1ec0919365db43076ed00a`: full CI run `44934971531` FAILS with eight tests; WhatsApp recovery, Kompas baseline and Plan/REA checks pass on that head.
- PR #495, two-line JD-plus-resume selection parser, exact head `4522a4ed9612a22fa304eb52f3772b02eb8ba44a`: not draft, GitHub reports mergeable=true, and all four exact-head checks pass (full CI `44935011117`, WhatsApp recovery `44935011500`, Kompas baseline `44935011114`, Plan/REA `44935011506`). It is based on older master `13542c5`.
- The last recorded Safe Merge Gate review withheld #495 for sequencing with #493. The Safe Merge Gate automation is not currently enabled. Do not bypass that recorded hold or merge #495 solely because its checks are green.

## PR #493 failure analysis

The full CI log for job `136939503840` reports eight failing tests:

1. The named SOC resume integration test fails because the combined JD + `use the SOC resume` is two lines, while `splitTailInstruction` has an unconditional three-line minimum. PR #495 contains the separate JD-signature-guarded two-line parser correction. The explicit-selection assertion must not be weakened.
2. Two `whatsapp-resume-failsafe` fixtures at 30.8% coverage and/or `role_evidence_gaps` expect a tailored file. The acceptance policy correctly holds both: below 70% has no approved delivery band, and role evidence gaps are not a deliverable shortfall. Update tests to assert no tailored document. Do not change the production quality gate to send these drafts.
3. The fallback/root mismatch tests expect older wording. Current text says the exact Files resume selected could not be verified for this account.
4. The unsupported-JD explanation test expects “job-post terms”; current text says the draft added terms “from the job post” that are not in the resume.
5. The single-request test checks the entire accumulated document list for an email that appears in two earlier successful deliveries. Capture the document count before the failed attempt and assert it does not increase.
6. The final swipe-reply assertion expects “I did not send a file”; current safe wording is “I did not send another file.”
7. The fivefold export fallback test expects “updated Word file”; current wording says “the Word file could not be opened.”
8. The remaining message assertion is the same stale no-file wording in the hold/refinement path; update the expectation to the current text without changing the hold.

## Safe sequencing

- Keep #495 separate from #493 until the required Safe Merge Gate review or an explicit owner-approved sequence is available.
- After #495 is integrated, refresh #493 onto current master so it includes the two-line parser fix, then update the stale test fixtures/assertions. Preserve the hard hold for unsupported JD-only terms, below-70 coverage, incomplete role evidence, fresh uploads and automatic closest-match selections.
- Require full CI, WhatsApp recovery, Kompas baseline and Plan/REA on the final exact head, then the protected-preview/release gate.

## Historical 17 October incident

The 17 Oct 2026 17:28 Chicago delivery remains unverified. The exact output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound message ID and signed delivered/read receipt are still missing. No replay or resend was attempted. No real WhatsApp/Meta send, R2 write, DOCX generation or production mutation occurred in this review.
