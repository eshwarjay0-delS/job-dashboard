// A resume made for a job on the website is filed in the person's Files the way the WhatsApp bot files its own: in the
// folder of its email and kind of job, named for the role and company, one job one file (saveTailored), and the resume
// it started from is counted as used. Until 20 Oct 2026 Apply's "auto-tailor" downloaded the result and uploaded it
// again as a new file, so every posting opened left another copy that no record knew (owner: "do not have a duplicate
// resumes ... I'm saying this multiple times").
import path from "path"
import { blob } from "@/lib/storage"
import type { TailorResult } from "@/lib/tailor"
import { isTailoredName } from "@/lib/resume-library"
import { markUsed, relOf, saveTailored } from "@/lib/resume-library-store"

export type FiledResume = { rel: string; filepath: string; email: string; category: string; name: string }

/** File what a tailor run made. Null when the file cannot be read back or filed: the run's own result still stands. */
export async function fileTailored(o: { userDir: string; base: string; jd: string; result: TailorResult; role?: string; company?: string }): Promise<FiledResume | null> {
  const bytes = await blob.get(`tailored/${o.result.token}.docx`).catch(() => null)
  if (!bytes) return null
  const from = relOf(o.userDir, o.base)
  const k = o.result.keyword_analysis
  try {
    const saved = await saveTailored({
      userDir: o.userDir, bytes, jd: o.jd, role: String(o.role || "").slice(0, 120), company: String(o.company || "").slice(0, 80),
      // A resume the person wrote is built on at depth 1; one made for another job is already a copy (depth 2, never built on again).
      depth: isTailoredName(path.basename(o.base)) ? 2 : 1,
      ...(from && !from.startsWith("..") ? { from } : {}),
      asked: [...(k?.matched || []), ...(k?.added || []), ...(k?.missing || [])],
      covers: [...(k?.matched || []), ...(k?.added || [])],
    })
    await markUsed(o.userDir, o.base).catch(() => {})
    return { rel: saved.rel, filepath: saved.abs, email: saved.email, category: saved.category, name: path.basename(saved.abs).replace(/\.docx$/i, "").replace(/__[a-f0-9]{16}$/i, "") }
  } catch (e) {
    console.error("[tailor] not filed", String(e).slice(0, 200))
    return null
  }
}
