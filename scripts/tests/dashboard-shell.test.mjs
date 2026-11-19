// Owner correction, 19 Nov 2026: the mobile menu expands below the sticky header in normal document flow.
// It pushes content down; it is not a modal drawer and must not dim, block, or inert the page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const shell = read('src/app/dashboard/dashboard-shell.css')
const narrow = shell.slice(shell.indexOf('@media (max-width:1024px)'), shell.indexOf('@media (max-width:560px)'))
const rule = (selector) => { const at = narrow.indexOf(selector + '{'); assert.ok(at >= 0, 'no rule for ' + selector); return narrow.slice(at, narrow.indexOf('}', at)) }
// How heavy a selector is: [ids, classes and attributes, elements]. A heavier selector wins between two !important rules.
const weight = (selector) => [(selector.match(/#/g) || []).length, (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length, (selector.replace(/[.#][\w-]+|\[[^\]]+\]/g, ' ').match(/\b[a-z]+\b/g) || []).length]
const heavier = (a, b) => { const [x, y] = [weight(a), weight(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false }

const CLOSED = 'html body .mf-dashboard-shell aside.dash-sidebar'
const OPEN = CLOSED + '.is-open'
const GUARD = 'html body aside.dash-sidebar'

test('the mobile menu is hidden when closed and expands as a full-width in-flow section', () => {
  const closed = rule(CLOSED)
  const open = rule(OPEN)
  assert.match(closed, /position:static!important/)
  assert.match(closed, /inset:auto!important/)
  assert.match(closed, /width:100%!important/)
  assert.match(closed, /height:auto!important/)
  assert.match(closed, /display:none!important/)
  assert.match(closed, /overflow:visible!important/)
  assert.match(open, /display:flex!important/)
  assert.doesNotMatch(open, /position:fixed/)
  assert.doesNotMatch(narrow, /position:fixed/)
  assert.doesNotMatch(narrow, /mf-nav-scrim/)
})

test('the flow menu overrides the global 240px sidebar guard', () => {
  assert.match(read('src/app/globals.css'), /html body aside\.dash-sidebar \{[^}]*width: 240px !important/)
  assert.ok(heavier(CLOSED, GUARD))
  assert.ok(heavier(OPEN, CLOSED))
  assert.deepEqual(weight(GUARD), [0, 1, 3])
  assert.deepEqual(weight(CLOSED), [0, 2, 3])
})

test('the menu is between the sticky header and the page content', () => {
  const nav = read('src/app/dashboard/sidebar-nav.tsx')
  const layout = read('src/app/dashboard/layout.tsx')
  const headerAt = nav.indexOf('<header className="mf-mobile-home">')
  const menuAt = nav.indexOf('<aside id="marketfit-navigation"')
  const sidebarAt = layout.indexOf('<SidebarNav')
  const mainAt = layout.indexOf('<main id="dashboard-content"')
  assert.ok(headerAt >= 0 && menuAt > headerAt, 'menu follows the sticky header')
  assert.ok(sidebarAt >= 0 && mainAt > sidebarAt, 'page content follows the menu component')
  assert.match(nav, /aria-controls="marketfit-navigation"/)
  assert.match(nav, /<aside id="marketfit-navigation"/)
  assert.match(rule('.mf-mobile-home'), /position:sticky;\s*top:0/)
})

test('the expanded menu is non-modal: no scrim, dimming, or page inertness', () => {
  const nav = read('src/app/dashboard/sidebar-nav.tsx')
  assert.doesNotMatch(nav, /mf-nav-scrim/)
  assert.doesNotMatch(nav, /setAttribute\("inert"/)
  assert.doesNotMatch(nav, /removeAttribute\("inert"/)
  assert.doesNotMatch(narrow, /mf-nav-scrim/)
  assert.doesNotMatch(narrow, /background:rgba\(12,11,8,\.45\)/)
})

test('Escape closes the menu and returns focus when focus was inside it', () => {
  const nav = read('src/app/dashboard/sidebar-nav.tsx')
  const start = nav.indexOf('const closeMenu = useCallback')
  const end = nav.indexOf('useEffect', start)
  const close = nav.slice(start, end)
  assert.match(close, /menuRef\.current\?\.contains\(el\)/)
  assert.match(close, /toggleRef\.current\?\.focus\(\)/)
  assert.match(nav, /if \(event\.key === "Escape"\) closeMenu\(\)/)
  assert.match(nav, /closest\("a"\)\) setMenuOpen\(false\)/)
  assert.match(nav, /window\.matchMedia\("\(min-width: 1025px\)"\)/)
  assert.match(nav, /if \(wide\.matches\) setMenuOpen\(false\)/)
})
