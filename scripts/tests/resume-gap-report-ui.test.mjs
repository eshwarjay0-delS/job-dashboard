import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const page = readFileSync(new URL("../../src/app/dashboard/resume/result/page.tsx", import.meta.url), "utf8")
const panel = readFileSync(new URL("../../src/components/ResumeGapReportPanel.tsx", import.meta.url), "utf8")

test("every tailoring result hydrates the evidence-separated gap report", () => {
  assert.match(page, /buildResumeGapReport\(r\)/)
  assert.match(page, /buildResumeGapReport\(data\)/)
  assert.match(page, /<ResumeGapReportPanel report=\{gapReport\}/)
})

test("the result report distinguishes absent document keywords from unsupported requirements", () => {
  assert.match(panel, /Missing keywords in exported DOCX/)
  assert.match(panel, /Requirements without candidate evidence/)
  assert.match(panel, /not a judgement about your experience/)
  assert.match(panel, /Keep them out of work claims and credentials/)
})

test("the report labels Gemini suggestions as advisory, not proof", () => {
  assert.match(panel, /Gemini keyword suggestions/)
  assert.match(panel, /A suggestion does not become candidate experience/)
  assert.match(panel, /Keyword overlap is not an ATS vendor score/)
})

test("per-role counts are shown without claiming independent employment verification", () => {
  assert.match(panel, /Experience evidence by role/)
  assert.match(panel, /do not verify employment independently/)
  assert.match(panel, /\{role.skills\}\/\{role.required\}/)
})
