# Additive prebuild regression contract — 11 November 2026

## Trigger

The MFit Safe Merge Gate inspected current master and reported two unrelated, narrowly scoped pull requests failing the same assertion in scripts/tests/kompas-deploy-build.test.mjs:

- PR #291 adds scripts/tests/crawl-classify.test.mjs to the first node --test group in package.json.
- PR #290 adds scripts/tests/dashboard-shell.test.mjs to that same group.

The existing test compared the complete prebuild command to one literal string. The extra test files caused the equality to fail before the Webpack build, even though the original baseline and regression suites remained present.

## Repair

The test now verifies the actual invariants instead of freezing the entire command string:

1. node scripts/kompas-baseline.mjs remains the first fail-fast step.
2. The existing resume-guard / WhatsApp-gap-report group remains present under node --test.
3. The WhatsApp acceptance / rollback / recovery / storage / contract group remains present and ordered after the first group.
4. The dossier / Bible / metric-evidence group remains present and ordered after the second group.
5. Additional test files may be added to those groups without breaking the build contract.
6. Vercel and CI continue to use npm run build -- --webpack; the production build script is unchanged.

A focused Node regression exercises both current additive test filenames against the revised contract.

## Scope and safety

Test-only change. No runtime code, package prebuild command, crawler adapter, database row, resume output, Gmail account, WhatsApp send, Kompas capture behavior, or production setting is changed. No credentials are used. No production deployment or preview promotion is attempted.

## Verification state

- Source: canonical eshwarjay0-delS/job-dashboard, branch fix/ci-prebuild-contract-additive-suites-20261111.
- Base: 11efbbfe7781592bc2fad1216f67546882a1c3ed.
- Implementation commit: 09852335d8c47ac7a8ef483db753c2e7aac703cd.
- Journal and completion-watch updates: committed on the same branch.
- Local Node 22 focused contract test: PASS, 3/3 tests on each of the current-master, crawler-addition and mobile-addition prebuild fixtures. This isolates the assertion contract; it is not the repository full CI.
- Exact-head GitHub full CI and Plan/REA schema: pending.
- Protected Vercel preview: unavailable while the team reports resource_creation_blocked / live:false.
- Production: current control-plane metadata reports READY at 11efbbfe7781592bc2fad1216f67546882a1c3ed and the alias points to it, but the current production HTTP check reported 402 DEPLOYMENT_DISABLED. This test-only branch is not deployed.

## Next

Run exact-head CI and Plan/REA schema. Restack PR #291 and PR #290 on this branch without dropping their feature changes, rerun their exact-head checks, and retain the normal protected-preview/review gates. Do not merge either feature while the Vercel project remains blocked.
