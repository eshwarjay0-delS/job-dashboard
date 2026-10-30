// Speed r6 stacked on grounding r5 (29 Oct 2026): offline, code-level only. The prebuilt index must give exactly
// what the r5 per-question scan gives, on r5's own fixtures.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as R from "../../src/lib/kompasSourceRetrieval.ts"
import { BEHAVIORAL_R5 } from "../kompas-behavioral-r5-cases.mjs"
import { CASES_R4 } from "../kompas-weighting-r4.mjs"

const load = (f) => JSON.parse(readFileSync(new URL(`../../tests/fixtures/${f}`, import.meta.url), "utf8"))
const S5 = load("kompas-behavioral-sources-r5.json"), S4 = load("kompas-weighting-sources-r4.json"), S = load("kompas-sample-sources.json")
const strip = (r) => JSON.parse(JSON.stringify(r))
const qOf = (c) => Array.isArray(c) ? c.find((x) => typeof x === "string" && /\?|^(tell|describe|walk|how|what|why|when)/i.test(x)) || c[1] : (c.q || c.question)
const QS = [...BEHAVIORAL_R5.map((c) => c[1]), ...CASES_R4.map(qOf).filter(Boolean),
  "Our pain was a noisy SIEM and missed deadlines across teams, so how did you handle a deadline you failed?", "", "What else?"]

for (const [name, src] of [["r5 behavioral", S5], ["r4 weighting", S4], ["sample", S]]) {
  test(`index equals the r5 scan on ${name} sources (${QS.length} asks x k 1/4/8 x recent)`, () => {
    R.clearSourceIndexCache()
    const docs = R.sourceDocs(src)
    let n = 0
    for (const q of QS) for (const k of [1, 4, 8]) for (const recent of [undefined, ["disagreed with the CTO"]]) {
      const a = strip(R.retrievePassages(q, docs, k, { recent }))
      const b = strip(R.retrievePassages(q, docs, k, { recent, index: false }))
      assert.deepEqual(a, b, `${name} / ${q} / k=${k}`)
      n++
    }
    assert.ok(n > 300)
  })
}
test("an index from other sources is never used across content", () => {
  const ix = R.sourceIndexFor(R.sourceDocs(S4))
  const docs = R.sourceDocs(S5)
  assert.ok(ix)
  assert.deepEqual(strip(R.retrievePassages("Tell me about a time you failed.", docs, 4)), strip(R.retrievePassages("Tell me about a time you failed.", docs, 4, { index: false })))
})
