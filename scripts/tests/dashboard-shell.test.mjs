// Owner requirement, 4 Oct 2026: the mobile menu must not block or cover the view. Normal-flow expansion below the
// sticky top bar, pushing content down, is the chosen implementation of that requirement.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = p => readFileSync(new URL("../../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n")
const shell = read("src/app/dashboard/dashboard-shell.css")
const narrow = shell.slice(shell.indexOf("@media (max-width:1024px)"), shell.indexOf("@media (max-width:560px)"))
const rule = selector => {
  const at = narrow.indexOf(selector + "{")
  assert.ok(at >= 0, "no rule for " + selector)
  return narrow.slice(at, narrow.indexOf("}", at))
}
const CLOSED = "html body .mf-dashboard-shell aside.dash-sidebar"
const OPEN = CLOSED + ".is-open"
const GUARD = "html body aside.dash-sidebar"
const weight = selector => [
  (selector.match(/#/g) || []).length,
  (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length,
  (selector.replace(/[.#][\w-]+|\[[^\]]+\]/g, " ").match(/\b[a-z]+\b/g) || []).length,
]
const heavier = (a, b) => {
  const [x, y] = [weight(a), weight(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

test("on a narrow window the closed menu takes no page height and the open menu expands in normal flow", () => {
  const closed = rule(CLOSED)
  const open = rule(OPEN)
  assert.match(closed, /position:static!important/)
  assert.match(closed, /inset:auto!important/)
  assert.match(closed, /width:100%!important/)
  assert.match(closed, /max-height:0!important/)
  assert.match(closed, /visibility:hidden!important/)
  assert.match(open, /max-height:calc\(100vh - var\(--mf-topbar-h\)\)!important/)
  assert.match(open, /visibility:visible!important/)
  assert.match(open, /overflow-y:auto!important/)
  assert.doesNotMatch(narrow, /position:fixed!important/)
  assert.ok(heavier(CLOSED, GUARD), "mobile rule must beat the global desktop-rail guard")
  assert.deepEqual(weight(GUARD), [0, 1, 3])
  assert.deepEqual(weight(CLOSED), [0, 2, 3])
})

test("the expanded navigation sits between the top bar and the main page content", () => {
  const nav = read("src/app/dashboard/sidebar-nav.tsx")
  const layout = read("src/app/dashboard/layout.tsx")
  assert.match(nav, /aria-controls="marketfit-navigation"/)
  assert.match(nav, /<aside id="marketfit-navigation" aria-label="MarketFit navigation"/)
  assert.equal((nav.match(/id="marketfit-navigation"/g) || []).length, 1, "the hamburger must control one unique navigation target")
  assert.doesNotMatch(nav, /<nav id="marketfit-navigation"/, "the inner page list must not duplicate the panel id")
  assert.ok(layout.indexOf("<SidebarNav") < layout.indexOf("<main id=\"dashboard-content\""), "sidebar must render before main content")
  assert.match(rule(".mf-mobile-home"), /position:sticky;\s*top:0/)
  assert.match(shell, /:root\{--mf-topbar-h:64px\}/)
  assert.match(rule(CLOSED), /position:static!important/)
})

test("opening the menu never dims or makes the page inert; outside click and link selection close it", () => {
  const nav = read("src/app/dashboard/sidebar-nav.tsx")
  assert.doesNotMatch(nav, /mf-nav-scrim/)
  assert.doesNotMatch(shell, /\.mf-nav-scrim/)
  assert.doesNotMatch(nav, /setAttribute\("inert"/)
  assert.doesNotMatch(nav, /removeAttribute\("inert"/)
  assert.match(nav, /document\.addEventListener\("pointerdown", closeOutside\)/)
  assert.match(nav, /drawerRef\.current\?\.contains\(target\)/)
  assert.match(nav, /toggleRef\.current\?\.contains\(target\)/)
  assert.match(nav, /closest\("a"\)\) setMenuOpen\(false\)/)
})

test("Escape closes the expanded menu and returns focus to the hamburger", () => {
  const nav = read("src/app/dashboard/sidebar-nav.tsx")
  const close = nav.slice(nav.indexOf("const closeMenu = useCallback"), nav.indexOf("useEffect", nav.indexOf("const closeMenu = useCallback")))
  assert.match(close, /drawerRef\.current\?\.contains\(el\)/)
  assert.match(close, /toggleRef\.current\?\.focus\(\)/)
  assert.match(nav, /if \(event\.key === "Escape"\) closeMenu\(\)/)
  assert.match(nav, /aria-expanded=\{menuOpen\}/)
  assert.match(nav, /aria-controls="marketfit-navigation"/)
})


test("normal-flow navigation preserves the existing account and authentication controls", () => {
  const nav = read("src/app/dashboard/sidebar-nav.tsx")
  assert.match(nav, /LOGIN_OFF_OWNER_EMAIL, isAuthDisabled/)
  assert.match(nav, /serverReportsAuthDisabled/)
  assert.match(nav, /const accountRef = useRef/)
  assert.match(nav, /Manage account/)
  assert.match(nav, /Log out/)
  assert.match(nav, /window.matchMedia\("\\(min-width: 1025px\\)"\)/)
})


test("Gmail Plan & Vision records the approved normal-flow decision and pending device acceptance", () => {
  const plan = read("src/lib/plan-vision.ts")
  const journal = read("src/lib/plan-vision-journal.ts")
  assert.match(plan, /hamburger expands below the sticky top bar in normal flow/)
  assert.match(plan, /no phone acceptance exists/)
  assert.match(journal, /gmail-mobile-normal-flow-nav-2026-11-13/)
  assert.match(journal, /"area":"gmail"/)
  assert.match(journal, /"approval":"approved","delivery":"in progress"/)
  assert.match(journal, /f3c31cb276e7d8598f8159d4933cb4ac69855bab/)
})
