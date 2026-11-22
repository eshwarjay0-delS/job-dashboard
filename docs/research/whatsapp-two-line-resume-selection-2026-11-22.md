# WhatsApp two-line named-resume selection — current-master restack, 22 November 2026

## Owner approval and current correction

This is a narrow continuation of the approved WhatsApp Files/Library resume-selection work. The latest owner correction still controls: an unchanged fallback is allowed only for a resume explicitly selected for the current request and belonging to the same account, with the exact label **Original resume — NOT TAILORED**. Automatic closest-match selection, silent substitution, a fresh uploaded original, and partial rewrite as fallback are not allowed. Unsupported JD-only qualifications remain a hard hold. No account may be inferred from a resume name.

## Incident boundary

The WhatsApp resume delivery observed on 17 October 2026 at 17:28 Chicago remains unverified. The exact generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound message ID, and signed delivered/read receipt are missing. Do not replay or resend the historical request and do not call a replacement document historical evidence.

## Root cause of the named-resume prerequisite

- PR #493's failing synthetic case combined a 122-character one-line JD with a second line `use the SOC resume`.
- The short-instruction parser rejects a combined message longer than 120 characters. The fallback parser then rejected every two-line message because `splitTailInstruction` required at least three non-empty lines, dropping the named-resume hint.
- Current master `db32d9f3e5680fdd63e8cb4a728f38c0bd8a9a71` still contained that three-line guard.

## Implemented in PR #515

- Based on exact current master; original PR #495 is preserved.
- A two-line message is split only when the first line contains an existing job-post signature (`JD_SIGNS`). A short chat or a title-only first line stays intact. Existing three-or-more-line behavior remains unchanged.
- The signature matcher is rebuilt without the global flag, preventing mutable `RegExp.lastIndex` from making repeated calls inconsistent.
- Parser tests cover positive selection, repeated calls, short-chat negative and title-only negative.
- Synthetic WhatsApp integration keeps the SOC hint while asking which account email to use; it starts no run before account selection, then verifies the exact SOC resume path after reply `1`.
- The dedicated WhatsApp recovery workflow now includes `role-match.test.mjs` and `whatsapp-library.test.mjs` in its exact source path filter and test command.

## Commits and current gate

- Current master base: `db32d9f3e5680fdd63e8cb4a728f38c0bd8a9a71`.
- Implementation commit: `e19e40b5496c7f8b90ada941d7ae9fdd8875ee80`.
- Test escaping correction: `071c668403ab563c742274ec0e1707b0aa4ed74e`.
- Pull request: https://github.com/eshwarjay0-delS/job-dashboard/pull/515 (DRAFT; exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA checks pending).
- Prior PR #495 head `4522a4ed9612a22fa304eb52f3772b02eb8ba44a` had four green checks but was 22 commits behind current master; those results are not reused.

## What this does not complete

This parser prerequisite does not add durable explicit-selection provenance to the webhook/recovery record, does not remove unsupported JD terms from the WhatsApp shortfall allowlist, and does not prove the exact same-account fallback route. PR #493 and #486 remain separate DRAFT/non-mergeable candidates; do not blindly merge or overwrite them. The route-level work still requires an approved runnable environment with the canonical checkout and installed Next.js 16.3.8 route-handler docs as required by AGENTS.md.

No local tests/build ran because this scheduled runtime has no canonical checkout or installed node_modules. GitHub Actions is the execution path. No real WhatsApp/Meta send, model call, DOCX generation, R2 write, production mutation, historical replay or native-device test occurred.

## Next steps

1. Require full CI, WhatsApp resume recovery, Kompas baseline and Plan/REA schema to pass on the final PR #515 head.
2. Review the source and merge only when all exact-head checks are green; then verify Vercel READY, production target, exact merge SHA and `job-dashboard-fawn.vercel.app` alias.
3. Continue the explicit same-account selection proof and unsupported-JD hard hold as a separate route-level slice when the required installed Next.js docs and runnable environment are available.
4. Recover the original 17 Oct artifacts/receipt before making any historical delivery claim.