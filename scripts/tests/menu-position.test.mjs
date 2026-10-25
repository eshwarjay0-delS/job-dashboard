// Menu placement, 24 Oct 2026: the recruiter menu on /dashboard/mail opened
// as a blank card because it stretched left past its scrollable fold and
// the fold clipped it. The placement helper must keep the whole menu
// inside the viewport, never past an edge, and flip above the button
// when it would run off the bottom. Made-up rectangles, no real mail.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampMenuPosition } from '../../src/lib/menu-position.ts'

const anchor = (left, top, bottom, width = 80) => ({ left, top, bottom, width })
const view = (width = 390, height = 844) => ({ width, height })

test('a button near the left edge gets a menu that starts inside the viewport, not past it', () => {
  const p = clampMenuPosition(anchor(40, 200, 236), view(), { width: 280, height: 180 })
  assert.equal(p.left, 40)
  assert.equal(p.top, 242)
  assert.equal(p.width, 280)
})

test('a button near the right edge gets a menu pulled left so its right edge stays inside', () => {
  const p = clampMenuPosition(anchor(350, 200, 236), view(), { width: 280, height: 180 })
  assert.equal(p.left, 390 - 280 - 12)
  assert.equal(p.top, 242)
})

test('a narrow viewport caps the menu width instead of letting it run off the side', () => {
  const p = clampMenuPosition(anchor(10, 200, 236), view(320, 700), { width: 320, height: 180 })
  assert.equal(p.width, 320 - 24)
  assert.equal(p.left, 12)
})

test('a button near the bottom flips the menu above it', () => {
  const p = clampMenuPosition(anchor(40, 700, 736), view(), { width: 280, height: 180 })
  assert.equal(p.top, 700 - 180 - 6)
})

test('a button near the top never places the menu above the viewport', () => {
  const p = clampMenuPosition(anchor(40, 10, 46), view(390, 200), { width: 280, height: 180 })
  assert.ok(p.top >= 12)
  assert.ok(p.left >= 12)
  assert.ok(p.left + p.width <= 390 - 12)
})
