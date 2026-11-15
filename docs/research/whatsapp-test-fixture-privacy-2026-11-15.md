# WhatsApp regression fixture privacy — 15 November 2026

## Owner request and scope

On 15 November 2026, the owner explicitly required personal test fixtures in the WhatsApp resume fallback work to be sanitized. This change is limited to source-controlled regression data and test wiring. It does not change resume generation, identity checks, fallback behavior, delivery, storage, or production configuration.

## Source audit

The current canonical master before this change was `17f8dada7ce1acf11064b1129ca4e33764ebb8a3`.

The following WhatsApp regression fixtures contained personal identity/contact values rather than fully synthetic data:

- `scripts/tests/whatsapp-5fold.test.mjs`
- `scripts/tests/whatsapp-resume-failsafe.test.mjs`
- `scripts/tests/whatsapp-single-request.test.mjs`

The audit found five distinct normalized email identities and three phone identities across these fixtures, plus owner-name references and account-like path fragments. No values are reproduced here.

## Implemented correction

- Replaced personal email values with distinct `candidateN@example.test` addresses so same-account and cross-account test distinctions remain intact.
- Replaced phone values with distinct fictional numbers in the reserved 555-0100 through 555-0199 range.
- Replaced personal-name and account-path fragments with synthetic names and paths.
- Added `scripts/tests/whatsapp-fixture-privacy.test.mjs`, which checks the three fixture files for non-reserved email domains and phone numbers outside the fictional range.
- Wired the guard into full CI and the WhatsApp resume recovery workflow, including path filters so fixture changes cannot silently skip the dedicated gate.

## Validation and limits

- The branch is `fix/whatsapp-fixture-privacy-20261115`.
- Source updates and the privacy guard are committed; exact-head GitHub Actions validation is pending.
- This is a test-fixture privacy correction only. It does not establish WhatsApp delivery, a successful DOCX export, a real R2 write, or a live resume/JD match.
- No real WhatsApp or email message, model call, production database write, R2 mutation, or owner-device action occurred.
- The active PR #411 branch is a separate draft and must carry the same sanitized fixtures before any future release review. Its provider-timeout fallback remains subject to the explicit owner-decision gate recorded in the Completion Watch.

## Next

Require exact-head full CI, WhatsApp recovery, Kompas baseline, and Plan/REA schema checks. Let MFit Safe Merge Gate sequence the privacy-only PR. Then restack PR #411 onto the sanitized master without weakening its separate approval, protected-preview, or delivery-acceptance gates.


## CI diagnosis and correction — 15 November 2026

The first exact-head full CI run for PR #416, head `f81df144b45db21c83ecc0e5f75f6056dd8c53bb`, failed three of 55 WhatsApp failsafe cases. The failures were in the test fixture, not the webhook: two synthetic resume strings had the candidate name and email joined without a line break. The strict selected-profile guard therefore parsed a different address and correctly refused to send the file in the test harness.

The test-only correction is commit `f2affec74ed7a669d9955a76f299b12abbc414cf`. It restores the line break in both synthetic strings and does not weaken the account/profile check or change runtime code. On that code head, the WhatsApp recovery workflow (43699322376), Kompas baseline (43699322370) and Plan/REA schema (43699322402) passed; full CI (43699322349) was still running at 09:28 UTC. The accompanying Plan/REA and Completion Watch update creates a new PR head, so all required checks must be verified again on the final head.

The privacy-only PR remains DRAFT pending exact-head full CI and MFit Safe Merge Gate review. No production release, real WhatsApp send, R2 write, model call, or device acceptance occurred.


## Privacy guard completion follow-up — 15 November 2026

The Safe Merge Gate review of PR #416 found that the first privacy regression covered email domains and formatted phone numbers but did not mechanically enforce the synthetic-name and account-path categories described above. This follow-up makes the fixture identities visibly synthetic (Candidate / Candidate One / Candidate Two), uses the reserved synthetic test UUID and candidateN@example.test account folders, and checks those name/path contracts in the privacy test. WhatsApp recipient fixtures also use the reserved fictional 555-0100–0199 range.

The current Plan & Vision baseline is corrected: the exact 17 Oct source DOCX is not currently available in the Library. A prior private review's size/digest is historical only, and the source facts are unverified/unreconciled rather than a proven contradiction. No private archive path, digest, personal email, phone, or document text is added to this repository.

This remains test/documentation work only. It does not change the WhatsApp webhook, resume generation, identity guard, R2 behavior, delivery policy, or production configuration. The previous PR #416 head e9a18145f4cf387d81d22f1bd232b31c1adb1e08 passed full CI 43699468090, WhatsApp recovery 43699468076, Kompas baseline 43699468109, and Plan/REA 43699468067; this follow-up creates a new head and requires all four checks again. No protected preview, deployment, model call, DOCX generation, R2 write, real message, or device acceptance is claimed.


## Privacy scanner false-positive correction — 15 November 2026

The expanded guard normalizes escaped resume line breaks before scanning contact values. Without that normalization, a source literal containing the two characters backslash+n immediately before an email can make a simple regex see a leading n as part of the email. This is a scanner-only correction; it does not alter fixture content or any runtime identity logic. The final-head gates must include this correction.
