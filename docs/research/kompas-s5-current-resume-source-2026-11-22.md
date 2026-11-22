# Kompas S5 current-resume source-of-truth correction — 22 November 2026

## Approval and scope

This is an approved correction to preserve the owner's source-of-truth rule: a non-empty, currently loaded resume is the authority for candidate claims. The Fortinet/Houston summary is a fallback only when no resume was supplied. It must not replace a different loaded profile.

The change is limited to the S5 honesty gate and its deterministic fixture. It does not change microphone, caption, audio, answer routing, account/session behavior, provider selection, or the separate first-press Listening-hold implementation in PR #540.

## Observed failure

PR #540 exact head `1b2a414122c79e0abe785ab431f39b2b702e84aa` ran full CI `45060694833` and failed at step 19, `Verify Parakeet S5 screen, press, and honesty gate`. The failing case was `saint-louis` in `scripts/tests/kompas-s5-gate.test.mjs`.

The implementation's `honestySource` returns a supplied non-empty resume unchanged and falls back to `HOUSTON_RESUME` only for an empty input. Its inline Round 6 comment records why: substituting the older Houston profile for the current Saint Louis resume caused supported current skills and certifications to be rejected. The top-level module comment and test assertion still described the superseded Saint-Louis-to-Houston substitution. The fixture also expected a Fortinet claim from a resume that contains no Fortinet evidence.

The same path exposed a privacy issue: `resumeLines` included email, URL and phone-only lines. A generic no-match fallback could therefore append contact information into spoken text.

## Correction

- Update the module documentation to state the current-resume source-of-truth rule.
- Keep the exact loaded resume as the internal honesty source; use Houston only when the supplied resume is empty.
- Filter email-bearing, URL-bearing and phone-only lines from the lines used to build spoken answers. This does not remove the source resume from storage or change account ownership.
- Update the Saint Louis synthetic case to preserve the supported university fact while rejecting unsupported Cigna/Fortinet/McKesson claims and preventing email leakage.
- Add a direct regression that proves the current resume remains authoritative, the empty input uses the fallback, and the email is not spoken.

## Evidence and validation state

- Production at the start of this work: READY deployment `dpl_6Kkkqq9UyJfGCV6fM38zwmJne5Ce`, exact master SHA `3eb16fa611c36c6c3e6384edd1a32614a44a6d63`, canonical alias `job-dashboard-fawn.vercel.app`.
- PR #540 exact-head checks: full CI `45060694833` FAILED at the S5 fixture; Kompas baseline `45060694908`, cross-device `45060694864`, and Windows executable `45060694835` SUCCESS.
- The S5 correction is prepared on `fix/kompas-s5-current-resume-source-20261122`; exact-head GitHub Actions validation is pending.
- No local checkout or installed dependencies were available, so no local test/build is claimed. No real resume, live model call, WhatsApp send, R2 write, email action or user-device test was performed.

## Next gates

1. Require exact-head full CI, including the 10-fold S5 gate, plus Kompas baseline, cross-device, Plan/REA and Windows package checks.
2. Merge only after those checks pass and the branch is reviewed.
3. Verify the resulting production deployment is READY on the merged SHA and the canonical alias maps to it.
4. Restack PR #540 on the new master and rerun its full exact-head gates.
5. Separately verify first press holds Listening and a deliberate second press re-asks on a consented native device. CI is not device acceptance.
