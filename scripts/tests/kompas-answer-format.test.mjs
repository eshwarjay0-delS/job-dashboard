import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { test } from "node:test"

import vm from "node:vm"
import { JSDOM } from "jsdom"

const app = await readFile(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const css = await readFile(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")

function renderer() {
  const document = new JSDOM('<ul></ul>').window.document
  const ctx = { window: { kompasDesktop: true }, document }
  vm.runInNewContext(app.slice(app.indexOf('function unbracket'), app.indexOf('function renderCard')), ctx)
  return ctx
}

test("missing metrics never become invented qualitative achievements", () => {
  const { unbracket } = renderer()
  assert.equal(unbracket('Reduced alerts by [percentage]%.'), 'Reduced alerts.')
  assert.equal(unbracket('Used [the EDR product you used].'), 'Used the EDR product.')
  assert.equal(unbracket('Inspect [Event ID 4625], logs[idx] and [::1].'), 'Inspect [Event ID 4625], logs[idx] and [::1].')
  assert.equal(unbracket('Pause [beat] here.'), 'Pause [beat] here.')
})

test("spoken answers preserve prose and bullets while omitting template headings and code", () => {
  const { answerLines } = renderer()
  const lines = answerLines('## Template heading\nA clear passage.\n- A **bold** point and *stress*.\n```js\nsecretCode()\n```')
  assert.deepEqual(JSON.parse(JSON.stringify(lines)), [
    { t: 'A clear passage.', kind: 'passage' },
    { t: 'A **bold** point and *stress*.', kind: 'bullet' },
  ])
})

test("emphasis is rendered safely without interpreting answer HTML", () => {
  const { inline, document } = renderer()
  const li = document.createElement('li')
  inline(li, '**bold** *stress* <img src=x onerror=alert(1)>')
  assert.equal(li.querySelector('strong').textContent, 'bold')
  assert.equal(li.querySelector('em').textContent, 'stress')
  assert.equal(li.querySelector('img'), null)
  assert.ok(li.textContent.includes('<img src=x onerror=alert(1)>'))
})

test("bold emphasis is typographic, not a colored box", () => {
  assert.match(css, /\.a li strong,\.a strong \.w\{font-weight:800;color:var\(--ink\);background:transparent;padding:0;border-radius:0\}/)
  assert.match(css, /\.a li em\{font-style:italic;color:var\(--ink\);text-decoration:none\}/)
})
