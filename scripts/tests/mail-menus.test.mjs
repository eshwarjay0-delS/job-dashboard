// Gmail menus, 24 Oct 2026 regression: the recruiter menu opened as a
// blank card on a phone because it was absolute right:0 inside a
// scrollable fold, which clipped it. Neither menu may go back to an
// absolute right-aligned panel inside a fold, both must be fixed against
// the viewport with 44px touch targets, and the folds must stack rather
// than squeeze when a thread is open on a narrower viewport.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')

test('recruiter menu is fixed against the viewport, not absolute inside a fold', () => {
  const src = read('src/app/dashboard/_components/recruiter-button.tsx')
  assert.ok(src.includes('position: "fixed"'), 'menu must be fixed')
  assert.ok(src.includes('zIndex: 9999'), 'menu must sit above the folds')
  assert.ok(!src.includes('right: 0'), 'no right:0 menu inside a scrollable fold')
  assert.ok(src.includes('minHeight: 44'), 'menu items must be at least 44px tall')
})

test('thread actions panel is fixed against the viewport with 44px targets', () => {
  const src = read('src/app/dashboard/mail/_components/thread-actions.tsx')
  assert.ok(src.includes("position:'fixed'"), 'panel must be fixed')
  assert.ok(src.includes('zIndex:9999'), 'panel must sit above the folds')
  assert.ok(!src.includes('right:0'), 'no right:0 panel inside a scrollable fold')
  assert.ok(src.includes('minHeight:44'), 'panel items must be at least 44px tall')
})

test('folds stack with a thread open up to 1100px and use border-box widths', () => {
  const css = read('src/app/dashboard/mail/folds.css')
  assert.ok(css.includes('.mf-mail-fold{box-sizing:border-box'), 'fold widths must include padding')
  assert.ok(css.includes('@media(max-width:1100px)'), 'detail-open stacking must reach desktop-mode phone widths')
  assert.ok(css.includes('.mf-mail-folds.mf-detail-open .mf-mail-list{display:none}'), 'list must step aside with a thread open')
})

test('the Gmail page surfaces Patterns and Apply Needs-you where the user lives', () => {
  const page = read('src/app/dashboard/mail/page.tsx')
  assert.ok(page.includes('NewShipments'), 'mail page must render the new-shipments strip')
  const strip = read('src/app/dashboard/mail/_components/new-shipments.tsx')
  assert.ok(strip.includes('/dashboard/mail/patterns'), 'strip must link to Patterns')
  assert.ok(strip.includes('/dashboard/apply'), 'strip must link to Apply')
  assert.ok(strip.includes('reply-patterns?view=cards') && strip.includes('/api/apply/activity'), 'counts must come from the app data, not literals')
  assert.ok(strip.includes('patternTotal != null') && strip.includes('applyNeeds != null'), 'a count must be shown only when it was actually read')
})
