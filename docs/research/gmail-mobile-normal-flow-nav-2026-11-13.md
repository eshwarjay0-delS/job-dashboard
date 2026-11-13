# Poke-inspired Gmail/mobile normal-flow navigation — 13 November 2026

## Owner-approved behavior

The owner corrections from 4 October, 5 October and 11 November require the mobile hamburger menu to expand below the sticky top bar in normal document flow and push page content down. It must not float over the page, dim it, use a scrim, or make the page inert. Existing sign-in, account menu, desktop rail and Gmail account boundaries must remain intact.

## Isolated implementation

- Draft PR #351: https://github.com/eshwarjay0-delS/job-dashboard/pull/351
- Branch: `fix/gmail-mobile-normal-flow-nav-20261113`
- Implementation commit: `f3c31cb276e7d8598f8159d4933cb4ac69855bab`
- Test-only correction: `e6984fa0d209733af8caa0491f174843fe0f7087`
- Plan/REA and completion-ledger reconciliation: `021d93fbeb1cac6d6ea3cfc17e74be628c5fc00e`
- Base: current canonical master `01ceb1dc79a86473c932861b8dddfa120077fc57`, independently verified READY on production before this change.
- The normal-flow implementation was extracted from the combined #346 stack. Only `dashboard-shell.css`, `sidebar-nav.tsx`, the focused test and the prebuild test hook were carried over. No WhatsApp storage/send, resume-generation, login/auth or Kompas voice changes were copied.

## Behavior and regression coverage

- Closed mobile navigation takes no page height; open navigation expands below the 64px sticky top bar and pushes the main content down.
- No fixed drawer, scrim, dimming, `inert` page or overlay remains.
- Outside pointer and link selection close the panel; Escape closes it and restores focus to the hamburger.
- The outer panel owns the unique `marketfit-navigation` ID referenced by `aria-controls`.
- A regression asserts the existing auth and account-menu controls remain present.
- `scripts/tests/dashboard-shell.test.mjs` is now included in `npm run build` through `prebuild`.

## Status and remaining gates

Implementation is committed and open as draft PR #351. The first full CI run 43365305559 failed because two Plan Journal entries used unsupported area `platform`; that was corrected. The next exact-head full CI run 43366439214 then failed on an overescaped `window.matchMedia` regex in `dashboard-shell.test.mjs`. Test-only commit e6984fa corrects the regex to match the actual source expression `window.matchMedia("(min-width: 1025px)")`; runtime navigation code was not changed. The docs/Plan/REA reconciliation is commit 021d93fb. On exact head 021d93fb, Plan/REA schema 43368474728 and Kompas baseline 43368474676 pass; full CI run 43368474666 remains in progress. No protected preview deployment exists. Do not merge or deploy until exact-head CI succeeds, the required protected preview/review gate succeeds, and a production deployment is READY on the intended commit with `job-dashboard-fawn.vercel.app` assigned.

No actual phone/browser viewport, Gmail API call, OAuth request, inbox mutation, email send, WhatsApp send or production deployment was performed. A passing source test will not be called mobile acceptance.