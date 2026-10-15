// The navigation menu on a narrow window (12 Oct 2026). The owner, of the menu opening as a block above the page with
// blank space beside it: "I was expecting an overflow or floating navigation window, or simply that navigation window
// just push the content to the right side ... And this should happen like every other place, not just here."
// What went wrong: the visibility guard at the end of globals.css ("html body aside.dash-sidebar") forces display:flex
// and width:240px, and it out-ranked the shell's own rules for narrow windows, which wanted a full-width panel in the
// page. So the opened menu was a 240px block in the flow of the page. These hold the drawer that replaced it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const shell = read('src/app/dashboard/dashboard-shell.css')
const narrow = shell.slice(shell.indexOf('@media (max-width:1024px)'), shell.indexOf('@media (max-width:560px)'))
const rule = (selector) => { const at = narrow.indexOf(selector + '{'); assert.ok(at >= 0, 'no rule for ' + selector); return narrow.slice(at, narrow.indexOf('}', at)) }
// How heavy a selector is: [ids, classes and attributes, elements]. A heavier one wins between two !important rules.
const weight = (selector) => [(selector.match(/#/g) || []).length, (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length, (selector.replace(/[.#][\w-]+|\[[^\]]+\]/g, ' ').match(/\b[a-z]+\b/g) || []).length]
const heavier = (a, b) => { const [x, y] = [weight(a), weight(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false }

const CLOSED = 'html body .mf-dashboard-shell aside.dash-sidebar'
const OPEN = CLOSED + '.is-open'
const GUARD = 'html body aside.dash-sidebar'

test('on a narrow window the menu is a drawer over the page, not a block in it', () => {
  const closed = rule(CLOSED)
  assert.match(closed, /position:fixed!important/)
  assert.match(closed, /display:none!important/)                       // closed means gone: its links cannot be tabbed to
  assert.match(closed, /inset:var\(--mf-topbar-h\) auto 0 0!important/) // from under the top bar to the bottom, at the left
  assert.match(closed, /width:min\(300px,calc\(100vw - 48px\)\)!important/)
  assert.match(rule(OPEN), /display:flex!important/)
  assert.doesNotMatch(narrow, /dash-sidebar[^}]*\{[^}]*position:relative/) // never again part of the page's flow
})

test('the drawer rules out-rank the guard that forced the menu to 240px in the page', () => {
  assert.match(read('src/app/globals.css'), /html body aside\.dash-sidebar \{[^}]*width: 240px !important/)
  assert.ok(heavier(CLOSED, GUARD))
  assert.ok(heavier(OPEN, CLOSED))
  assert.deepEqual(weight(GUARD), [0, 1, 3])
  assert.deepEqual(weight(CLOSED), [0, 2, 3])
  // The class the selector leans on is really on the element that wraps the menu.
  assert.match(read('src/app/dashboard/layout.tsx'), /<div className="mf-dashboard-shell"/)
})

test('the drawer starts where the top bar ends: one number, used by both', () => {
  assert.match(shell, /:root\{--mf-topbar-h:64px\}/)
  assert.match(rule('.mf-mobile-home'), /min-height:var\(--mf-topbar-h\)/)
  assert.match(rule('.mf-nav-scrim'), /inset:var\(--mf-topbar-h\) 0 0 0/)
})

test('the rest of the page is dimmed while the menu is open, and pressing it closes the menu', () => {
  const nav = read('src/app/dashboard/sidebar-nav.tsx')
  assert.match(nav, /\{menuOpen && <button type="button" className="mf-nav-scrim" aria-label="Close navigation" tabIndex=\{-1\} onClick=\{closeMenu\} \/>\}/)
  assert.match(shell, /\n\.mf-nav-scrim\{display:none\}/)              // on a wide window there is no drawer and nothing to dim
  const scrim = rule('.mf-nav-scrim')
  assert.match(scrim, /position:fixed/)
  assert.ok(Number(scrim.match(/z-index:(\d+)/)[1]) < Number(rule(CLOSED).match(/z-index:(\d+)/)[1]))   // under the drawer
  assert.match(nav, /if \(event\.key === "Escape"\) closeMenu\(\)/)
  assert.match(nav, /closest\("a"\)\) setMenuOpen\(false\)/)           // choosing a page closes it
  // Said outright as well as by its edges: an empty button need not stretch between them in every browser.
  assert.match(scrim, /width:100%/)
  assert.match(scrim, /height:calc\(100% - var\(--mf-topbar-h\)\)/)
})

// ── Found by the review of 12 Oct 2026 ───────────────────────────────────────────────────────────────────────────────

test('the top bar stays at the top of a narrow window, so the drawer under it has nothing live above it', () => {
  // Measured: with overflow-x:hidden on body the bar's "sticky" held to body, which never scrolls, and 300px down the
  // page the bar (and the menu button in it) stood at -300. The drawer and the dimming begin where the bar ends.
  assert.match(narrow, /html,body\{width:100%;max-width:100%;overflow-x:hidden\}/)
  assert.match(narrow, /\n  body\{overflow-x:clip\}/)
  assert.ok(narrow.indexOf('body{overflow-x:clip}') > narrow.indexOf('html,body{width:100%'), 'after the line it corrects, so it wins')
  assert.match(rule('.mf-mobile-home'), /position:sticky;\s*top:0/)
})

test('the keyboard is not lost when the drawer closes, and cannot wander behind it while it is open', () => {
  const nav = read('src/app/dashboard/sidebar-nav.tsx')
  const close = nav.slice(nav.indexOf('const closeMenu = useCallback'), nav.indexOf('useEffect', nav.indexOf('const closeMenu = useCallback')))
  assert.match(close, /drawerRef\.current\?\.contains\(el\)/)          // closed from inside it (Escape on a link, the dimmed page)
  assert.match(close, /toggleRef\.current\?\.focus\(\)/)               // the keyboard goes back to the menu button
  assert.match(nav, /ref=\{toggleRef\}\s*type="button"\s*className=\{`mf-menu-toggle/)
  assert.match(nav, /<aside ref=\{drawerRef\}/)
  // The page under the dimming is out of reach while the drawer is open, and is given back the moment it closes.
  assert.match(nav, /page\?\.setAttribute\("inert", ""\)/)
  assert.match(nav, /page\?\.removeAttribute\("inert"\)/)
  assert.match(read('src/app/dashboard/layout.tsx'), /<main id="dashboard-content"/)
  // Widened past the drawer's width, it is closed: the page is never left out of reach behind a drawer that is gone.
  assert.match(nav, /window\.matchMedia\("\(min-width: 1025px\)"\)/)
  assert.match(nav, /if \(wide\.matches\) setMenuOpen\(false\)/)
  assert.match(shell, /@media \(max-width:1024px\)/)                   // the same width the drawer is written for
})
