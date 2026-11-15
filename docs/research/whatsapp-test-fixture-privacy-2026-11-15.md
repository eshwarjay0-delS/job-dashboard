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
