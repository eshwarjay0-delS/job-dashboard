// The Plans page and the plan model behind it (approved 23 Oct 2026, "add all", idea 15). The owner sets every price;
// until he does, nothing anywhere shows a number he did not choose.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const C = await import('../../src/lib/plan-catalog.ts')

test('no plan carries a price or an amount of time that the owner has not set', () => {
  assert.ok(C.PLAN_CATALOG.length > 0)
  for (const plan of C.PLAN_CATALOG) {
    assert.equal(plan.price, null, `${plan.id} has a price nobody set`)
    assert.equal(plan.minutes, null, `${plan.id} has an amount of time nobody set`)
  }
})

test('a blank price reads "Price coming soon" and a blank amount reads "Amount coming soon"', () => {
  for (const plan of C.PLAN_CATALOG) {
    assert.equal(C.priceLabel(plan), C.isPaid(plan) ? 'Price coming soon' : 'Free')
    assert.equal(C.allowanceLabel(plan), 'Amount coming soon')
  }
})

test('the catalog file and the Plans page hold no price figures of their own', () => {
  const sources = ['src/lib/plan-catalog.ts', 'src/app/plans/page.tsx', 'src/app/plans/buy-button.tsx']
  for (const path of sources) {
    const code = read(path)
    assert.doesNotMatch(code, /amount:\s*\d/, `${path} sets an amount`)
    assert.doesNotMatch(code, /minutes:\s*\d/, `${path} sets a number of minutes`)
    assert.doesNotMatch(code, /[$₹]\s?\d/, `${path} shows a price`)
    assert.doesNotMatch(code, /\b(?:Rs\.?|INR|USD)\s?\d/, `${path} shows a price`)
  }
})

test('the plans are a free daily allowance, an hour pack paid once, and weekly and monthly plans that renew', () => {
  const byId = Object.fromEntries(C.PLAN_CATALOG.map(p => [p.id, p]))
  assert.deepEqual(Object.keys(byId).sort(), ['free-daily', 'hour-pack', 'monthly', 'weekly'])
  assert.equal(byId['free-daily'].per, 'day'); assert.equal(C.isPaid(byId['free-daily']), false)
  assert.equal(byId['hour-pack'].per, 'pack'); assert.equal(byId['hour-pack'].renews, false)
  assert.equal(byId.weekly.per, 'week'); assert.equal(byId.weekly.renews, true)
  assert.equal(byId.monthly.per, 'month'); assert.equal(byId.monthly.renews, true)
})

test('every plan is the whole product: plans differ by volume, never by a feature list of their own', () => {
  for (const plan of C.PLAN_CATALOG) assert.deepEqual(Object.keys(plan).sort(), ['forWho', 'id', 'minutes', 'name', 'per', 'price', 'renews'])
  assert.ok(C.WHOLE_PRODUCT.length >= 3)
  const page = read('src/app/plans/page.tsx')
  assert.match(page, /WHOLE_PRODUCT\.map/)
  assert.match(page, /Every plan is the whole product/)
})

test('a price is usable only when it is a positive, finite amount', () => {
  const base = C.planById('weekly')
  assert.equal(C.isPriced({ ...base, price: null }), false)
  assert.equal(C.isPriced({ ...base, price: { amount: 0, currency: 'INR' } }), false)
  assert.equal(C.isPriced({ ...base, price: { amount: -5, currency: 'INR' } }), false)
  assert.equal(C.isPriced({ ...base, price: { amount: Number.NaN, currency: 'INR' } }), false)
  // A made-up figure, used only to see the label once the owner sets one. It is not a price.
  const priced = { ...base, price: { amount: 1234, currency: 'INR' }, minutes: 90 }
  assert.equal(C.isPriced(priced), true)
  assert.match(C.priceLabel(priced), /₹1,234 a week/)
  assert.equal(C.allowanceLabel(priced), '90 minutes of practice a week')
  assert.equal(C.allowanceLabel({ ...C.planById('hour-pack'), minutes: 120 }), '2 hours of practice')
})

test('unknown plan ids find nothing', () => {
  for (const id of ['', 'pro', undefined, null, 42, { id: 'weekly' }]) assert.equal(C.planById(id), null)
})

test('the Plans and Responsible use pages are reachable without signing in and listed for search engines', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /path === "\/plans"/)
  assert.match(proxy, /path === "\/responsible-use"/)
  const sitemap = read('src/app/sitemap.ts')
  assert.match(sitemap, /"\/plans"/)
  assert.match(sitemap, /"\/responsible-use"/)
})
