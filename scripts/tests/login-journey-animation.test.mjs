import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../../", import.meta.url)
const login = readFileSync(new URL("src/app/login/page.tsx", root), "utf8")
const illustration = readFileSync(new URL("src/app/login/marketfit-journey.tsx", root), "utf8")
const styles = readFileSync(new URL("src/app/login/marketfit-journey.module.css", root), "utf8")

test("MarketFit login displays desktop illustration and compact mobile flow", () => {
  assert.match(login, /<MarketFitJourney \/>/)
  assert.match(login, /<MarketFitJourney compact \/>/)
  assert.match(login, /lg:hidden/)
  assert.match(login, /lg:flex/)
})

test("every animation class used by the component is defined", () => {
  const classNames = [...illustration.matchAll(/styles\.([a-zA-Z][\w]*)/g)].map(m => m[1])
  assert.ok(classNames.length > 10)
  for (const name of classNames) assert.ok(styles.includes(`.${name}`), `Missing CSS module class: ${name}`)
})

test("reduced-motion visitors retain the static illustration", () => {
  assert.match(styles, /prefers-reduced-motion:\s*reduce/)
  assert.match(styles, /animation:\s*none\s*!important/)
  assert.match(styles, /\.travelDot\s*\{\s*left:\s*48%/)
})

test("visual is optional and does not add external animation dependencies", () => {
  assert.match(illustration, /aria-hidden="true"/)
  assert.doesNotMatch(illustration, /<canvas|<video|<iframe|fetch\(|requestAnimationFrame/)
  assert.match(styles, /@keyframes travel/)
})
