// Exhaustive bug-sweep: tailor EVERY resume in the library through the real
// /api/tailor endpoint (one identity-appropriate JD per resume's folder), and
// classify each result. Surfaces parse / JSON / apply bugs across the whole library.
// Run:  npx tsx scripts/test_all.mts        (server must be running with the key)
import { writeFile } from "fs/promises"
import path from "path"

const SERVER = process.env.SERVER || "http://localhost:3000"
const LIMIT = Number(process.env.LIMIT || 0) // 0 = all
// FILTER="iam saviynt,security architect" → only test resumes whose category matches.
const FILTER = (process.env.FILTER || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean)
const SUFFIX = FILTER.length ? "_filtered" : ""

interface ResumeFile { id: string; filename: string; filepath: string; category: string }
interface Row {
  n: number; category: string; filename: string
  ok: boolean; kind: "OK" | "NO-CHANGE" | "ERROR"
  before?: number; after?: number
  edits: { title: boolean; summary: number; skills: number; bullets: number }
  notes: string[]; error?: string
}

function jdFor(category: string): string {
  const leaf = (category.split("/").pop() || category).trim()
  const ctx = category.replace(/\//g, " ").trim()
  return [
    leaf,
    "",
    `We are hiring a ${leaf}. Responsibilities: hands-on ${leaf} work, partnering across engineering and security teams, owning delivery, reliability, and continuous improvement.`,
    `Requirements: proven experience as a ${leaf}; strong fundamentals; hands-on with the tools, platforms, and best practices central to ${ctx}.`,
    `Qualifications: prior ${leaf} experience; able to communicate with stakeholders and document work clearly.`,
  ].join("\n")
}

async function main() {
  const listRes = await fetch(`${SERVER}/api/resumes`)
  const files: ResumeFile[] = (await listRes.json()).files || []
  let todo = FILTER.length ? files.filter(f => FILTER.some(x => f.category.toLowerCase().includes(x))) : files
  if (LIMIT) todo = todo.slice(0, LIMIT)
  console.log(`testing ${todo.length} resumes through /api/tailor (explicit filepath)…\n`)

  const rows: Row[] = []
  for (let i = 0; i < todo.length; i++) {
    const f = todo[i]
    const n = i + 1
    try {
      const res = await fetch(`${SERVER}/api/tailor`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jd: jdFor(f.category), filepath: f.filepath }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) {
        const error = String(d.error || `HTTP ${res.status}`)
        rows.push({ n, category: f.category, filename: f.filename, ok: false, kind: "ERROR", edits: { title: false, summary: 0, skills: 0, bullets: 0 }, notes: [], error })
        console.log(`  [ERR  ${n}/${todo.length}] ${f.category}  ->  ${error.slice(0, 90)}`)
        continue
      }
      const e = d.edits || {}
      const edits = {
        title: !!(e.headline?.title),
        summary: (e.summary || "").trim() ? 1 : 0,
        skills: (e.skills || []).filter((x: { text?: string }) => (x.text || "").trim()).length,
        bullets: (e.bullets || []).filter((x: { text?: string }) => (x.text || "").trim()).length,
      }
      const changed = edits.title || edits.summary || edits.skills > 0 || edits.bullets > 0 || (d.notes || []).length > 0
      const kind = changed ? "OK" : "NO-CHANGE"
      rows.push({ n, category: f.category, filename: f.filename, ok: true, kind, before: d.score_before, after: d.score, edits, notes: d.notes || [] })
      const tag = kind === "OK" ? "ok " : "NOCH"
      console.log(`  [${tag} ${n}/${todo.length}] ${f.category}  (${d.score_before}->${d.score}%)  H:${edits.title ? "y" : "n"} S:${edits.summary} Sk:${edits.skills} B:${edits.bullets}`)
    } catch (err) {
      rows.push({ n, category: f.category, filename: f.filename, ok: false, kind: "ERROR", edits: { title: false, summary: 0, skills: 0, bullets: 0 }, notes: [], error: String(err).slice(0, 120) })
      console.log(`  [ERR  ${n}/${todo.length}] ${f.category}  ->  ${String(err).slice(0, 90)}`)
    }
  }

  const errs = rows.filter(r => r.kind === "ERROR")
  const noch = rows.filter(r => r.kind === "NO-CHANGE")
  const oks = rows.filter(r => r.kind === "OK")

  const lines: string[] = []
  lines.push(`# Exhaustive tailor sweep — ${rows.length} resumes`)
  lines.push(`OK: ${oks.length}   NO-CHANGE: ${noch.length}   ERROR: ${errs.length}`)
  lines.push("")
  if (errs.length) {
    lines.push("## ERRORS (hard bugs)")
    for (const r of errs) lines.push(`- ${r.category} / ${r.filename}\n    ${r.error}`)
    lines.push("")
  }
  if (noch.length) {
    lines.push("## NO-CHANGE (parsed but nothing rewritten — investigate)")
    for (const r of noch) lines.push(`- ${r.category} / ${r.filename}`)
    lines.push("")
  }
  lines.push("## ALL")
  for (const r of rows) {
    lines.push(`${String(r.n).padStart(2, "0")}. [${r.kind}] ${r.category} / ${r.filename}  ${r.before ?? "?"}->${r.after ?? "?"}%  H:${r.edits.title ? "y" : "n"} S:${r.edits.summary} Sk:${r.edits.skills} B:${r.edits.bullets}`)
    if (r.notes.length) lines.push(`      notes: ${r.notes.join(" | ")}`)
  }

  const out = path.join(process.cwd(), "data", `TEST_REPORT${SUFFIX}.txt`)
  await writeFile(out, lines.join("\n"))
  await writeFile(path.join(process.cwd(), "data", `test_results${SUFFIX}.json`), JSON.stringify(rows, null, 2))
  console.log(`\n==== DONE ====`)
  console.log(`OK ${oks.length} | NO-CHANGE ${noch.length} | ERROR ${errs.length}`)
  console.log(`Report: ${out}`)
}
main()
