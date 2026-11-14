# Owner-approved C2H aliases — 14 November 2026

## Exact approval recovered

Accessible prior-conversation retrieval surfaced an owner-authored instruction at `2026-11-12T07:41:33Z`:

> Contract To Perm and Right To Hire map to C2H; negations remain unknown.

This supersedes the earlier approval-pending statement in PR #376 and the corresponding absence note in `docs/research/owner-approval-provenance-2026-11-13.md`.

The same retrieval did **not** find owner-authored wording that generic contract administration, negotiation, lifecycle, or duration language alone is not employment-type evidence. That broader rule appeared only in prior assistant output. This restack deliberately does not implement it.

## Implemented scope

- Recognize the existing `C2H` and `Contract To Hire` forms plus `Contract To Perm`, `Contract To Permanent`, and `Right To Hire`, including space/hyphen variants.
- Treat direct negative forms such as `No C2H`, `Not Contract To Perm`, `Without Right To Hire`, and `Never Contract To Permanent` as negative evidence. They do not create a C2H label and do not leak into the generic `Contract` label by themselves.
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

This branch starts from canonical master `46043ec6ca926b2ab82424d255367426685f294d`. Implementation commit `b24076e48ff3dc63f2d959bc8ae85cbb68f420ec` adds the focused classifier change; Plan/REA commit `b230f87bbd1241c95d8856099a88e1eb0ac74bf1` records approval and scope. The implementation is source-only until the exact current head passes full CI, crawler regression, Kompas baseline, Plan/REA schema, and the legitimate protected preview. The active Safe Merge Gate must review the PR before any merge. Production acceptance requires READY on the exact approved merge SHA, the canonical alias, and public classification behavior; no post-change crawl is claimed. A live crawl requires a separate explicit owner request.

## 14 November 2026 20:42 UTC — prebuild exact-command regression correction

PR #402 correctly adds `node --test scripts/tests/crawl-classify.test.mjs` to the existing `package.json` `prebuild` chain so the owner-approved Contract To Perm / Right To Hire → C2H aliases and direct-negation cases run before a build. Full CI `43637952500` failed at `scripts/tests/kompas-deploy-build.test.mjs:12` because that guard still asserted the previous exact command string. The guard now expects the full updated command, retaining every prior baseline and regression step plus the crawler classifier suite.

This is a test-only correction. The C2H implementation and crawler schedule are unchanged. On the pre-fix head, crawler regression `43637951983`, Kompas baseline `43637952007`, and Plan/REA schema `43637952015` passed; full CI did not. Exact-head reruns are required. No crawl, portal request, production-row mutation, application submission, email or WhatsApp send occurred. Protected preview and Safe Merge Gate review remain pending.
