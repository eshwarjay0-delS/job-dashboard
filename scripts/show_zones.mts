// Inspect the zones a resume parses into (no API). Shows header, summary, skills,
// and each role's title line + bullet count — so role-title editing can be made surgical.
// Run:  FILE="resumes/.../X.docx" npx tsx scripts/show_zones.mts
import { readFile } from "fs/promises"
import { extractZones } from "../src/lib/docx"

const FILE = process.env.FILE || "resumes/CYBER GC/CYBER GC/APPSEC/Eshwar Cyber resume.docx"

const z = await extractZones(await readFile(FILE))
console.log("FILE:", FILE)
console.log("\nHEADER:", JSON.stringify(z.header, null, 2))
console.log("\nSUMMARY idx", z.summaryIdx, "\n ", JSON.stringify(z.summaryText.slice(0, 240)))
console.log("\nSKILLS:", z.skills.length, "lines")
for (const s of z.skills.slice(0, 4)) console.log("  [" + s.idx + "]", s.text.slice(0, 90))
console.log("\nROLES:", z.roles.length)
for (const r of z.roles) console.log(`  role(${r.current ? "CURRENT" : "older"}): ${JSON.stringify(r.role.slice(0, 110))}  (${r.bullets.length} bullets)`)
