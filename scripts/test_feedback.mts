// Phase C — test the FEEDBACK-REGENERATION path (result-page Refine→Regenerate).
// For each case: tailor (run1, no feedback) → POST /api/feedback → re-tailor (run2).
// Verifies feedback is applied and actually changes the output. Backs up + restores
// data/feedback.json so the real feedback history (and the deliverable) is untouched.
// Run:  npx tsx scripts/test_feedback.mts   (server running with the key)
import { readFile, writeFile, rm } from "fs/promises"
import path from "path"

const SERVER = process.env.SERVER || "http://localhost:3000"
const FB = path.join(process.cwd(), "data", "feedback.json")

interface ResumeFile { filename: string; filepath: string; category: string }
interface TailorResp { token?: string; score?: number; score_before?: number; error?: string; applied_feedback?: string[]; edits?: { summary?: string; bullets?: { idx: number; text: string }[]; skills?: { idx: number; text: string }[] } }

const JD = (leaf: string) =>
  `${leaf}\n\nWe are hiring a ${leaf}. Responsibilities include hands-on ${leaf} delivery and cross-team collaboration. Requirements: proven ${leaf} experience with the core tools and platforms. Qualifications: prior ${leaf} work.`

async function tailor(filepath: string, jd: string): Promise<TailorResp> {
  const res = await fetch(`${SERVER}/api/tailor`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jd, filepath }),
  })
  return res.json().catch(() => ({ error: `HTTP ${res.status}` }))
}
const avgLen = (b?: { text: string }[]) => (b && b.length ? Math.round(b.reduce((s, x) => s + (x.text || "").length, 0) / b.length) : 0)

async function main() {
  const files: ResumeFile[] = (await (await fetch(`${SERVER}/api/resumes`)).json()).files || []
  const pick = (kw: string) => files.find(f => f.category.toLowerCase().includes(kw))
  const cases = [pick("devops"), pick("appsec") || pick("cloud sec"), pick("iam")].filter(Boolean) as ResumeFile[]
  if (!cases.length) cases.push(files[0])

  // Back up the real feedback history.
  let backup: string | null = null
  try { backup = await readFile(FB, "utf8") } catch { backup = null }

  const out: string[] = ["# Feedback-regeneration test", ""]
  let pass = 0
  try {
    for (const c of cases) {
      const leaf = (c.category.split("/").pop() || c.category).trim()
      const jd = JD(leaf)
      await writeFile(FB, "[]") // isolate: run1 sees no feedback

      const r1 = await tailor(c.filepath, jd)
      const fb = { chips: ["Make bullets shorter"], custom: `Put hands-on ${leaf} tool work inside the most recent role.` }
      await fetch(`${SERVER}/api/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fb) })
      const r2 = await tailor(c.filepath, jd)

      const noErr = !r1.error && !r2.error
      const appliedOk = (r2.applied_feedback || []).length > 0 && (r1.applied_feedback || []).length === 0
      const changed = JSON.stringify(r1.edits?.bullets) !== JSON.stringify(r2.edits?.bullets) ||
                      (r1.edits?.summary || "") !== (r2.edits?.summary || "")
      const ok = noErr && appliedOk && changed
      if (ok) pass++

      out.push(`## ${c.category} / ${c.filename}  -> ${ok ? "PASS" : "FAIL"}`)
      out.push(`   run1 err=${r1.error || "-"}  applied=${(r1.applied_feedback || []).length}  bulletAvg=${avgLen(r1.edits?.bullets)}`)
      out.push(`   run2 err=${r2.error || "-"}  applied=${(r2.applied_feedback || []).join(" | ") || "-"}  bulletAvg=${avgLen(r2.edits?.bullets)}`)
      out.push(`   feedback applied: ${appliedOk}   output changed: ${changed}`)
      out.push("")
      console.log(`  [${ok ? "PASS" : "FAIL"}] ${c.category}  applied=${appliedOk} changed=${changed}  bulletAvg ${avgLen(r1.edits?.bullets)}->${avgLen(r2.edits?.bullets)}`)
    }
  } finally {
    if (backup === null) await rm(FB, { force: true }).catch(() => {})
    else await writeFile(FB, backup) // restore real feedback history
  }

  out.unshift(`Result: ${pass}/${cases.length} passed`, "")
  await writeFile(path.join(process.cwd(), "data", "FEEDBACK_TEST.txt"), out.join("\n"))
  console.log(`\n==== feedback test: ${pass}/${cases.length} passed ====  (feedback.json restored)`)
}
main()
