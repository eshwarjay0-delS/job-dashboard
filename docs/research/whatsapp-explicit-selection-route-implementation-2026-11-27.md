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
