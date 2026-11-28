# REA source-locator schema failure — Run 29 (28 Nov 2026)

## Evidence
PR #632's Plan/REA run 46115504464 failed test 7 in `scripts/tests/rea-register.test.mjs` on exact head 35f21605e7e24eb84f6e5aeebc0db9525ff653d1. The test treats every `source.path` as a file in the current checkout. The current master REA record `kompas-seeded-pack-cards-2026-11-28` intentionally points to a remote branch locator `origin/ops/second-bot-packs:docs/kompas-packs/second-bot-INDEX.md`, which cannot exist in this local checkout.

## Test-only repair
This branch keeps strict local-path checks and adds separate validation for remote locators: they must match `origin/<branch>:<path>`, contain both parts, and contain no traversal segment. It does not download, import or copy remote packs. The test file was changed on a clean branch based on current master `be063d6977760f902c1ced3a3078d9323229ea38`.

## Gate
Local canonical tests are unavailable. Remote CI/Plan-REA/baseline must pass before merge. This is a test-contract correction, not evidence that the remote pack is present or usable. No deployment.
