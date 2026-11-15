# Owner-approved C2H aliases — 14 November 2026

## Exact approval recovered

Accessible prior-conversation retrieval confirmed the owner-authored approval at `2026-11-14T05:51:27Z`: **Contract To Perm and Right To Hire map to C2H; negated labels remain unknown.** The separate `2026-11-12T05:03:03Z` instruction establishes the broader job-type taxonomy (W2, W2 Contract, C2C, 1099, temporary, permanent and C2H; W2 payroll alone is not contract). The previously cited `2026-11-12T07:41:33Z` timestamp was assistant-generated status text, not the C2H approval source.

This supersedes the earlier approval-pending statement in PR #376 and the corresponding absence note in `docs/research/owner-approval-provenance-2026-11-13.md`.

The same retrieval did **not** find owner-authored wording that generic contract administration, negotiation, lifecycle, or duration language alone is not employment-type evidence. That broader rule appeared only in prior assistant output. This restack deliberately does not implement it.

## Implemented scope

- Recognize the existing `C2H` and `Contract To Hire` forms plus `Contract To Perm`, `Contract To Permanent`, and `Right To Hire`, including space/hyphen variants.
- Treat direct prefix negatives such as `No C2H`, `Not Contract To Perm`, `Without Right To Hire`, and `Never Contract To Permanent` as negative evidence. Also strip the owner-provided trailing negatives `Right To Hire is not available`, `Contract To Perm is not offered`, and `C2H not available`. They do not create a C2H label and do not leak into the generic `Contract` label by themselves.
- Preserve a separate positive signal when the same listing contains both positive and negative C2H evidence; a negative phrase must not erase an independent positive alias.
- Check both listing text and the structured employment-type field.
- Preserve existing W2, C2C, 1099, Temporary and generic Contract behavior outside the exact negated C2H phrase.
- Add positive/negative regression cases and run them in the prebuild gate.

## Preserved operational boundaries

- Contract crawling remains manual/on-demand only. `vercel.json` must continue to omit `/api/crawl/run` from `crons`.
- The separate Gmail crawler schedule is not changed.
- Robert Half remains manual-only pending express written permission or a sanctioned feed/API with commercial-aggregation rights.
- eTeam remains retired from active adapters.
- No live crawl, portal request, production-row mutation, application submission, or external notification was performed.

## Verification and pending gates

This branch is based on canonical master `8ad319d1092fffa7e6a31a4da1b4dc61ac634934`. The current follow-up implementation commit is `dd59cb28736e67e699aed94b7b05d3e575a77558`; regression commit `7b24ec893345b16ea270375a34f9f07e7c145c1e` adds the three exact owner-provided trailing-negation examples, structured-field coverage and mixed positive/negative cases. The source correction addresses the Safe Merge Gate finding that all three trailing-negative examples were previously classified as positive C2H. Exact-head full CI, crawler regression, Kompas baseline, Plan/REA schema and the legitimate protected preview are still required. The active Safe Merge Gate must review the PR before any merge. Production acceptance requires READY on the exact approved merge SHA, the canonical alias, and public classification behavior; no post-change crawl is claimed. A live crawl requires a separate explicit owner request.

## 14 November 2026 20:42 UTC — prebuild exact-command regression correction

PR #402 correctly adds `node --test scripts/tests/crawl-classify.test.mjs` to the existing `package.json` `prebuild` chain so the owner-approved Contract To Perm / Right To Hire → C2H aliases and direct-negation cases run before a build. Full CI `43637952500` failed at `scripts/tests/kompas-deploy-build.test.mjs:12` because that guard still asserted the previous exact command string. The guard now expects the full updated command, retaining every prior baseline and regression step plus the crawler classifier suite.

This is a test-only correction. The C2H implementation and crawler schedule are unchanged. On the pre-fix head, crawler regression `43637951983`, Kompas baseline `43637952007`, and Plan/REA schema `43637952015` passed; full CI did not. Corrected exact head `cd03aa73c9528aa9cf9546b33c0ef219832159aa` passed full CI `43638829170`, crawler regression `43638829173`, Kompas baseline `43638829157` and Plan/REA schema `43638829190`, all SUCCESS. No crawl, portal request, production-row mutation, application submission, email or WhatsApp send occurred. Protected preview and Safe Merge Gate review remain pending; PR #419 remains DRAFT and is not deployed.
