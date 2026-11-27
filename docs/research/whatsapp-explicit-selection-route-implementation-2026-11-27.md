# WhatsApp explicit Files/Library fallback — route implementation, 27 November 2026

## Binding owner correction

Scoped prior-context retrieval records the direct 20 Nov 2026 01:47:17Z correction: only a uniquely explicit same-account Files/Library resume may be used as an original fallback; the exact label is **Original resume — NOT TAILORED**. Do not use automatic closest-match selection, fresh-upload substitution or silent fallback. If no valid selected source exists, explain and preserve the request. This supersedes earlier closest-resume auto-selection and upload/reuse guidance for this fallback.

The separate 20 Nov 03:33:26Z confirmation boundary remains: confirmed skills may map into relevant existing projects; the JD is not candidate experience; never invent employers, projects, dates, metrics, credentials or results. Automatic Gemini correction/re-export/recheck remains proposed, not approved.

## Installed Next.js guidance

The exact installed Next.js 16.3.8 route-handler guide was retrieved from the successful GitHub Actions audit run 44842752926, job 136654945477, in the canonical repository. The relevant guidance covers Route Handlers, supported request/response APIs and current route-handler conventions. This satisfies the AGENTS.md documentation-read prerequisite for this route slice. It does not create a local checkout or dependencies.

## Source findings and implementation

- The 26 Nov exact-head full CI for PR #591 failed tests 93, 94, 96, 97 and 98 in `scripts/tests/whatsapp-resume-failsafe.test.mjs`; this was a route-level policy failure, not a flaky provider test. The route's `sendClosest` read `session.resumePath` and sent it after provider, unchanged, missing-file, identity and quality failures when the profile-email helper returned true.
- The prior helper returned true when no email was supplied and allowed `unverified_jd_terms` in its shortfall set. The fail-closed helper/tests from #591 are retained in this clean restack: missing email fails closed; unverified additions and their blocker code are hard holds; high scores cannot mask a high-coverage role-evidence gap.
- The route records `explicitSelection` only when a user-supplied hint resolves to exactly one library candidate. Automatic role matching and ambiguous title matches do not earn the marker.
- The marker is persisted in `ResumeRecoveryJob.files`, so a scheduled retry cannot silently lose selection proof. Older jobs without it remain false/undefined and cannot use fallback.
- Before sending an original, the route checks the verified user root, absolute source path equality, relative email folder, DOCX extension and exactly one matching profile email inside the file. The first caption line is the exact required label. A fresh upload without explicit Files selection receives text-only hold/retry messaging.
- The progress message no longer promises a Word file “either way”; it describes the conditional fallback and text-only outcome.
- Automated coverage adds explicit unique selection, automatic and ambiguous selection rejection, cross-account root rejection, source-path mismatch, missing email, exact caption label and durable recovery-marker round trip. The WhatsApp recovery workflow now runs the route fallback tests as well as the quality/recovery tests.

## Change state

Branch: `fix/whatsapp-explicit-library-fallback-20261127-run22`, based on `1eb604b33cfe58f3c0f6ad611d346d5921e184ff`. Source commit `422df8d59433251b8adba01a05e20e56054d159` and two test-only corrections `45d59b5cf2421ecc2503af96821bbb6c7c19ff75` / `c95c278ab2e4170283ff45865e40195927a11054` are now present. The initial full CI failed only the stale `resume-guards.test.mjs` assertion expecting `sendClosest`; recovery failed one stale contract assertion expecting the old unchanged-resume wording. The assertions now expect the guarded `sendSelectedOriginal` call and the current message. Exact-head full CI `45966667425` and WhatsApp recovery `45966667371` are running; baseline `45966667947` passed. Local checkout/tests remain unavailable because this runtime cannot resolve github.com. Keep the PR DRAFT pending exact-head gates, independent review, protected preview and owner acceptance.

## Historical 17 October incident — still unverified

The 17 Oct 17:28 Chicago incident is not declared resolved. The exact uploaded source DOCX, generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound message ID and signed delivered/read receipt remain missing. A same-name archive item and prior digest are historical only; they do not prove the exact uploaded bytes. Do not replay or resend.

## Verification and safety boundary

No local checkout or local npm execution was available. GitHub's canonical Actions runner is available for remote exact-head tests; results will be recorded separately from source implementation. The persistent Vercel sandbox restore remains quota-blocked until 1 Dec 2026 00:00 UTC. No protected preview has been accessed, no deployment or alias change was attempted, and no credentials, private resume/JD, R2 object, database row, email inbox or WhatsApp channel was mutated. No real WhatsApp/Meta message or historical replay was sent.

## Next

Wait for exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA schema checks. Keep the PR DRAFT; do not merge or deploy until the protected preview and owner acceptance gates are satisfied. If tests fail, fix the exact failure without weakening assertions. Recover the original 17 Oct artifact and delivery trace before claiming that incident resolved.

## Run 25 — correct the 60-second progress promise

Static review found that the initial progress message had been corrected, but the 60-second timer still promised a Word file “either way.” It now branches on the durable `explicitSelection` marker: an explicitly selected same-account Files/Library resume is described as a possible original with the exact `Original resume — NOT TAILORED` label; uploads and automatic picks are told no original fallback is eligible, and the request will remain saved if tailoring fails.

A regression in `scripts/tests/resume-guards.test.mjs` asserts that the 60-second timer contains both policy branches and rejects the stale unconditional promise. Source commit `e4469bbbe8721c49cbf6adf37961caa03f342099` is pending exact-head remote validation. No local test/build or real WhatsApp send/replay was performed.
## Run 23 — protected-preview trigger (27 November 2026)

The exact branch head c751ab5b4d20ca06c8d88a56fbb8842fda0468db has full CI, WhatsApp recovery, Plan/REA schema and Kompas baseline SUCCESS. The latest source review confirms the explicit-selection marker is persisted in recovery jobs and fallback is bound to the verified account root, exact selected path, DOCX and profile email; automatic/ambiguous selection and uploads remain fail-closed. The previously canceled preview dpl_6DSJnRHCpYB32hVtZgYvjAkLgjKA was skipped by the Vercel Ignored Build Step because the commit lacked the [ship] marker.

Vercel project metadata read-only shows SSO protection enabled for non-custom-domain deployments. This commit is on the PR branch (not master) and uses the normal [ship] build marker to request a protected preview only. No production alias promotion, access-control bypass, WhatsApp send/replay, DOCX/R2 mutation, or owner-device acceptance is performed. If the preview is not READY/protected, keep the PR DRAFT and record the exact provider state.


## Run 27 — require depth-zero source for the original fallback (27 November 2026)

Static review of PR #600 exact head `71fb3a46c056b0826cde1b8f1547210f52410a2c` found a remaining provenance bypass: a unique user hint can set `explicitSelection=true` for a named tailored library copy. The fallback helper validated the verified account root, exact path, email and DOCX, but not the candidate's source depth. Since the library classifier uses depth 0 for non-tailored originals, depth 1 for a first-generation tailored copy and depth 2 for subsequent or unrecognized tailored copies, a depth-1/2 document could otherwise be mislabeled **Original resume — NOT TAILORED**.

The route now requires `files.depth === 0` in addition to all existing explicit-selection and identity checks. The route-level regression harness accepts a source-depth parameter and adds separate negative cases for unique depth-1 and depth-2 copies. The existing unique depth-0 positive case is retained. Code and test are committed together at `190815c83bddac5c7529ad9763450a131b905b56` on PR #600; exact-head remote checks are pending. Previous green checks on parent `71fb3a46` do not validate this commit.

No local test/build, protected preview, deployment, real WhatsApp/Meta send or replay, private DOCX, R2/DB mutation or device acceptance occurred. Production remains READY at runtime SHA `a17b3267e271c77cd8887312445271b7fa172bd0`; the branch is not deployed. The 17 Oct 17:28 Chicago incident remains unverified pending exact source/output, R2 object/version, webhook correlation, Meta outbound ID and signed delivery receipt.


## Run 27 exact-head remote validation — 27 November 2026

The source/test head `4c772f54282b987ab65a8fd8735169038a5ad6ef` passed all four remote gates:

- Full CI `46064385707` — SUCCESS (51 steps).
- WhatsApp resume recovery `46064385766` — SUCCESS.
- Kompas baseline `46064385720` — SUCCESS.
- Plan/REA schema `46064385653` — SUCCESS.

The source/test commit is `190815c83bddac5c7529ad9763450a131b905b56`. A docs-only `[ship]` commit will request a protected preview and trigger fresh exact-head checks. The PR remains DRAFT. No production deployment, live WhatsApp/Meta send or replay, source/output DOCX inspection, R2/DB mutation or owner-device acceptance occurred. The 17 October 17:28 Chicago incident remains unverified.
