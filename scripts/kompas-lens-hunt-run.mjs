const { HUNT3: H3 } = await import("./kompas-lens-hunt-r3.mjs"); const { HUNT4 } = await import("./kompas-lens-hunt-r4.mjs"); const { HUNT5 } = await import("./kompas-lens-hunt-r5.mjs"); const { HUNT6 } = await import("./kompas-lens-hunt-r6.mjs"); const HUNT3 = process.argv[2] === "6" ? HUNT6 : process.argv[2] === "5" ? HUNT5 : process.argv[2] === "4" ? HUNT4 : H3
import { openerCategory } from "../src/lib/kompasOpener.ts"
import { explainModesAsked } from "../src/lib/kompasDesktopResponse.ts"
import { depthFor } from "../src/lib/kompasAudience.ts"
const bad = { story: [], explain: [], depth: [] }; let slow = []
for (const h of HUNT3) {
  const t0 = performance.now()
  const st = openerCategory(h.q) === "experience-story", ex = explainModesAsked(h.q), d = depthFor(h.q)
  const ms = performance.now() - t0; if (ms > 20) slow.push(`${ms.toFixed(0)}ms ${h.q.slice(0, 40)}`)
  if (st !== h.story) bad.story.push(`${h.fam}: ${h.q.slice(-80)} -> ${st}`)
  if (ex !== h.explain) bad.explain.push(`${h.fam}: ${h.q.slice(-80)} -> ${ex}`)
  if (d !== h.depth) bad.depth.push(`${h.fam}: ${h.q.slice(-80)} -> ${d}`)
}
for (const k in bad) { console.log(`== ${k} wrong ${bad[k].length}/200`); bad[k].forEach((x) => console.log("  " + x)) }
console.log("slow", slow)
