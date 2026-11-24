# MFit continuation review — 24 November 2026, 08:53 CST

## Canonical production
- GitHub master: `794e8cfdbd3103409552857806bab89851d5bfcb`.
- Vercel production deployment: `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`, READY; `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app` are assigned to that deployment.
- Round 15's `jsonAnswer` shaping fix is live. Real Round 16 paired model evaluation is not performed: an authorized `KOMPAS_API_TOKEN`, source resume/JD bundle, and authenticated session are absent.

## Shared release gate
PR #554 (S5 current-resume authority + first-press Listening hold + VM fixtures) is mergeable at `4fafd56663bb5ddce064dcebea8802d758bb8259`. Exact-head full CI 45123770495, Kompas baseline 45123770380, cross-device 45123770446, Plan/REA 45123770546 and Windows executable 45123770398 all passed. The only recorded review is owner-authored; GitHub rejected self-approval. A second authorized reviewer is missing. No merge, promotion or bypass was attempted.

## WhatsApp priority
PR #572 is current-master based at `fc16b77a349231d840e1c673ac93d1dfc0bf4d22`. WhatsApp recovery 45383665978, Kompas baseline 45383665803 and Plan/REA 45383666072 passed. Full CI 45383666040 reached 72 question/voice tests: 70 passed, 2 failed on the first-press Listening-hold assertions; the runtime fix is in #554. The explicit-selection fallback/hard-hold source remains unmerged and undeployed. The 17 Oct 2026 17:28 Chicago delivery remains historical and unverified; do not replay/resend.

## Independent approved work rechecked
- #570 confirmed-skill alignment head `7f249f5a0f52ecdac6e902dc7909497506c145f7`: focused, WhatsApp recovery, baseline and Plan/REA passed; full CI 45386097754 failed in the question-framing suite.
- #571 four-account Gmail/mobile head `0ccde7e48784b2e845e92b859da70c366e5b9d83`: focused 12/12 and baseline passed; full CI 45289419329 failed at lint.
- #573 crawler diagnostics head `5b719759066c649975b4582b41b20f111b194450`: crawler regression, baseline and Plan/REA passed; full CI 45354245507 failed at lint.
- #574 contract match-any head `3d03ea05e797bd9d25b1fa12d2625e91268b0ffa`: regression and baseline passed; full CI 45382941056 failed in question-framing/typed/voice.
- #575 clearance-safe crawler pagination head `e618ae96f008786ee3bc6d81f1563ae7ee1340c7`: manual-only, crawler, Plan/REA and baseline passed; full CI 45400055679 failed at lint.
- #576 Gmail digest/mobile restack head `1757fb68715081525de0f8c7b8bd3bf531ebff20`: baseline passed; full CI 45401091730 failed at lint.

## Gmail review completed
PR #577 at `723a13377fe8c53e7ba2d67821429485978459fe` passed the focused account-scoped interview-link test 11/11 (run 45409242379; repeat 45409224285 also green). The account+thread identity correction is functionally distinct across two inboxes with the same provider thread ID.

**Review finding:** `interviewBoardAnchor` embeds the normalized account email directly in the DOM id and URL fragment. A fragment is not sent in the HTTP request, but the email can still appear in copied links, history, screenshots and DevTools. Non-blocking review 6041657441 requests an opaque stable account identifier/hash while retaining account/thread uniqueness and tests that do not assert raw email in the anchor. PR #577 has no full CI or protected preview and is not merged/deployed.

## Execution limits
- No local canonical checkout or dependencies; `git ls-remote` failed DNS resolution for `github.com`. Remote GitHub Actions is the test path.
- Vercel Sandbox remains unavailable due the documented 402 usage cap until 1 Dec 2026. Protected preview requires the private owner token; none was accessed.
- No local build, live model call, WhatsApp send/replay, R2/database mutation, Gmail OAuth/inbox read/send, live crawl, application submission or native-device acceptance.

## Next
1. Obtain a second authorized review for #554; do not self-approve/merge.
2. After normal merge, restack #572 and dependent approved slices and rerun exact-head gates.
3. Address #577's opaque-anchor review note, rerun full CI, then require protected preview and consented two-inbox/mobile acceptance.
4. Keep the 17 Oct WhatsApp incident, real resume/JD/DOCX review, 50-pair human-grade Kompas benchmark, and native Windows/phone/WhatsApp acceptance open until evidence exists.


## Historical WhatsApp incident and related production evidence

Accessible prior-chat context records a screenshot at about 17:28 Chicago on 17 October 2026: a live resume-generation failure was visible and the assistant said the file was held after repair. The full JD, generated DOCX and server trace were not available; an earlier WhatsApp search found no matching record. No exact message text, recipient, original file, request correlation, R2 object/version, Meta outbound ID or signed delivered/read receipt has been recovered.

A read-only iZap check is **not the MFit channel**: its single business had no WhatsApp number, connection status was disconnected, no inbound had ever been recorded, no outbound had ever been proven to Meta, and a 17-Oct resume message search returned 0. This cannot establish that MFit's separate Meta channel was disconnected; it only means iZap has no historical evidence to provide.

Open issue #132 documents a separate 30-Oct production refusal at 100% keyword/support coverage with quality_incomplete, quality_not_deliverable, and role_evidence_gaps across five roles. PR #570 current-master restack contains role-scoped deterministic gap weaving plus explicit confirmed-skill alignment; its exact-head focused/recovery/baseline/Plan-REA checks pass, but full CI fails on the shared Kompas #554 question/voice dependency. It is unmerged/unreleased, and no resume/JD/DOCX was processed. PR #572 includes a regression that an incomplete 100%-coverage draft is held; exact-head recovery/baseline/Plan-REA pass, full CI is 70/72 because the two Listening-hold assertions await #554. Neither PR proves the 30-Oct incident is repaired in production.

Issue #201 separately tracks durable, identity-safe recovery for swipe-reply refinements; it is not proof the 17-Oct incident used that path. No resend/replay or live WhatsApp test occurred.

## 24 Nov — #572 exact-shape acceptance review

Review comment 6041959064 on PR #572 asks for a synthetic regression matching production issue #132: 100% raw and supported coverage, quality.incomplete true, and quality_blockers containing role_evidence_gaps. It should assert both whatsappRewriteUsable and deliveredWithShortfall reject that result. The existing 100% incomplete test checks partial:true without the blocker; the separate role-evidence-gap test uses a completed 30.8% shortfall and permits delivery under the documented shortfall policy. This is a test-only request; the quality gate must not be loosened. The review is a COMMENT, not an approval.
\n\n## Fresh 7-day production runtime evidence — 24 Nov 2026\n\nRead-only Vercel error clustering on POST /api/whatsapp/webhook found 2 quality-gate refusals across 2 users, first 29 Oct 18:00:41 UTC and last 20 Nov 20:25:58 UTC, on deployment dpl_EZce7dEERrv1eVUFf64YoAzwoicb (commit 3a1b0bb718874f8fca5adc5f78362d3009a11281). Aggregate samples: (1) 100% raw/support coverage, 5 roles, 0 JD terms placed, quality_not_deliverable + roles_unrewritten, complete/non-partial; (2) 100% raw/support coverage but partial/incomplete, blockers draft_parts_missing, quality_incomplete, quality_not_deliverable and roles_unrewritten. Other 7-day clusters: one ServiceUnavailable (19 Nov) and one skills-only 43.1% no-AI-writer result (20 Nov). These occurred on an older deployment than current READY master 794e8cf. This does not reveal exact request/DOCX or root cause. Read-only evidence was posted to issue #132 as comment 7135769358; no personal resume/JD data, send/replay or live test.\n