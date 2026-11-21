# WhatsApp two-line named-resume selection correction — 21 Nov 2026

## Request and approval

Continuation of the approved explicit Files/Library resume-selection work. Preserve account isolation and do not send a real WhatsApp message or infer an account from a resume name.

## Evidence and root cause

- Current canonical master: `13542c5e1127ed7c1ccf59e4faa034d0af021fc1` (documentation-only ahead of production).
- PR #493's failing named-resume fixture sends a 122-character one-line JD followed by `use the SOC resume` (141 characters total).
- `parseInstruction` has a 120-character guard, so it returns `null` for this combined message. The actual selection is dropped by `splitTailInstruction` because it required at least three non-empty lines. This corrects the prior diagnosis that the instruction parser intercepted the JD.
- PR #493 exact-head full CI run [44934971531](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44934971531) failed eight tests. The named-resume case currently expects an immediate run despite two profiles; account confirmation must remain explicit. Other failures are test expectation/fixture corrections in the hard-hold branch and remain owned by the Safe Merge Gate.

## Implemented in this slice

- `splitTailInstruction` now accepts a two-line message only when the first line matches existing job-post signatures (`JD_SIGNS`). Three-line job posts retain prior behavior; short two-line chat is not split.
- Unit test covers the one-line JD + explicit selection and a short-chat negative case.
- WhatsApp library regression confirms the hint is preserved while the bot asks which email, then a reply of `1` selects the exact SOC resume path. No account is guessed.

## Commits and validation

- Parser: `39e3f7e54db1ea0e315324dd600946a577d9ffc8`
- Unit test: `19df4e36cb4a727c9bd397e067f3d125b759503b`
- Integration regression: `92d9338fadd0229a6b11eaa1c2c193530c63f1a1`
- Branch: `fix/whatsapp-two-line-resume-selection-20261121`
- Remote CI pending on the PR's exact head. No local tests ran because this environment has no repository checkout/node_modules and `git ls-remote` failed DNS.

## Limits and next steps

This parser PR does not contain the explicit-selection recovery provenance or hard-hold implementation in PR #493, and does not prove delivery. Require full CI, WhatsApp recovery, Kompas baseline, Plan/REA, and Safe Merge Gate review. Rework PR #493's integration fixture to the actual two-step email-confirmation flow; fix its remaining assertions without weakening the hard hold. Keep the 17 Oct 17:28 Chicago delivery unverified: the exact output DOCX, R2 object/version, webhook correlation, Meta message ID and signed delivery/read receipt remain missing. No model call, DOCX generation, R2 write, WhatsApp send, replay, or production deploy occurred.
