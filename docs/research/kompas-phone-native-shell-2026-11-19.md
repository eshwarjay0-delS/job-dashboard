# Kompas phone-native live shell — 19 November 2026

## Approved request and scope

The owner-approved 31 October 2026 request is a full-screen, phone-first Kompas live copilot that adapts to device size and resolution. This restack is UI-only. It does not alter microphone capture, computer audio, Caption Capture, input-source priority, answer generation, authentication, account/session synchronization or voice behavior.

## Current-master restack

- Canonical base: `a6f6867ea61ba6d2d3a0bb16f6b2b49c22e543be`.
- PR: [#455](https://github.com/eshwarjay0-delS/job-dashboard/pull/455).
- Source commit: `c45a80e027f62f831f89b3e0fe6fbefabcafc316`.
- The previous branch's code commits were a3eb3ad5cdb41f30775cb2833ab3620ff65b27af, abbf8c8a3a2586c0251e2ce5294e70ae25af7ca9, 4f1b82e312c45ecac8213a46ee3de89284065693 and 4454d59f8f6e22788178409f161992fdaf78b537; those changes were reapplied to current master rather than copying stale files wholesale.
- `public/kompas/index.html` keeps the latest-master latest-ask scripts/cache stamp and adds only `mobile-shell.css` after `answer-aside.css`.
- `public/kompas/mobile-shell.css` provides a narrow-screen `100dvh` flex shell, safe-area padding, contained answer/transcript scrolling, 44px minimum touch targets, 48px primary controls and landscape sizing. Selectors exclude `html.kd`.
- The current-master desktop-control assertions are preserved. The phone tests check viewport-fit, standalone manifest, safe areas, internal scrolling, touch targets, landscape and desktop-focus isolation. Full CI runs the test file.

## Validation and release status

The predecessor branch's earlier workflow results are not reused. Exact-head full CI, Kompas baseline and Plan/REA must pass on the restacked PR head. The local container has no repository checkout and `git ls-remote` cannot resolve `github.com`, so no local npm/typecheck/build result is claimed.

The canonical Vercel alias remains READY at deployment `dpl_A8i4LFvu1EqqdKWmLe1SpiT1NUAN`, SHA `1c6c1622cddf533e8b268a51d0e4350e508a158e`, which is older than current master. The project reports `live:false`; a legitimate protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`. No bypass, unpause, preview promotion or production deployment occurred.

## Acceptance still required

On real iOS and Android devices or installed PWAs, verify:
- safe-area cutouts and home-indicator padding;
- address-bar and keyboard-driven dynamic viewport changes;
- portrait and landscape layouts;
- long-answer and transcript scrolling within the panel;
- 44px minimum touch targets and 48px primary actions;
- no change to Windows desktop-focus layout or voice/caption behavior.

A green source test is not a phone test. Do not mark this feature deployed or accepted until legitimate protected preview, production READY + canonical alias and real-device checks are recorded.
