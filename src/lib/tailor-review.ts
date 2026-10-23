// The file a person downloads after reviewing a tailor must carry only the changes they kept. It is rebuilt here from the
// ORIGINAL resume and the tailor's own recorded edits, never from text the page sends back: the page names the changes it
// keeps by id and nothing else, so a review cannot become a way to write arbitrary lines into a resume. And it is rebuilt
// only while the original file is byte-for-byte the one that was tailored; an original edited since would put the kept
// rewrites on the wrong paragraphs.
import { createHash } from "crypto"
import { blob, keyOf } from "@/lib/storage"
import type { TailorResult } from "./tailor"
import { applyRewrites, extractText, extractZones, roleSpanMonths, type Zones } from "./docx"
import { coveredJdKeywords } from "./keywords"
import { coveragePercent } from "./resume-quality"
import { acceptedEdits, tailorReview, type TailorReview } from "./resume-changes"

/** Where runTailor keeps its private record of a run, per library: the input, the requirements and the result. */
export function tailorRunKey(userResumeDir: string, token: string): string {
  return `tailor_runs/${createHash("sha256").update(userResumeDir).digest("hex")}/${token}.json`
}

export type TailorRun = {
  version: number
  sourceHash: string
  sourcePath: string
  input: { jd: string; confirmations?: string[]; refine?: string | null }
  requirements?: string[]
  result: TailorResult
}

/** Only the token's own letters and digits, as /api/tailor/file reads it. */
export const cleanToken = (t: unknown) => String(t || "").replace(/[^a-z0-9]/gi, "").slice(0, 64)

export async function readTailorRun(userResumeDir: string, token: string): Promise<TailorRun | null> {
  const t = cleanToken(token)
  if (!t) return null
  const raw = await blob.getText(tailorRunKey(userResumeDir, t)).catch(() => null)
  if (!raw) return null
  try {
    const run = JSON.parse(raw) as TailorRun
    return run && run.result && run.sourcePath ? run : null
  } catch { return null }
}

/** The original file, only when it is still exactly the one this run tailored. */
async function originalOf(run: TailorRun): Promise<{ buf: Buffer } | { error: string }> {
  const buf = await blob.get(keyOf(run.sourcePath)).catch(() => null)
  if (!buf) return { error: "The original resume is no longer in your Files, so this version cannot be rebuilt. Tailor again." }
  if (createHash("sha1").update(buf).digest("hex").slice(0, 12) !== run.sourceHash) {
    return { error: "Your original resume has changed since this was tailored, so the changes no longer line up with it. Tailor again." }
  }
  return { buf }
}

async function reviewFrom(run: TailorRun, buf: Buffer): Promise<{ review: TailorReview; zones: Zones }> {
  const [zones, text] = await Promise.all([extractZones(buf), extractText(buf)])
  return { zones, review: tailorReview({
    zones, text, edits: run.result.edits, dropped: run.result.review?.dropped || [],
    requirements: run.requirements || [], jd: run.input?.jd || "",
    evidence: (run.input?.confirmations || []).join("\n"), covers: coveredJdKeywords, spanOf: r => roleSpanMonths(r),
  }) }
}

/** The review for a run: the one it recorded, or (for a run made before 23 Oct 2026) one rebuilt from the original. */
export async function reviewOfRun(run: TailorRun): Promise<TailorReview | { error: string }> {
  if (run.result.review) return run.result.review
  const original = await originalOf(run)
  if ("error" in original) return original
  return (await reviewFrom(run, original.buf)).review
}

export type AcceptedFile = { token: string; kept: number; total: number; buffer: Buffer }

/**
 * Build the file that carries only the kept changes. All kept: the tailored file itself, unchanged. Otherwise the original
 * with just those edits applied, stored beside it under its own token so /api/tailor/file serves it like any other.
 */
export async function buildAccepted(run: TailorRun, accepted: string[]): Promise<AcceptedFile | { error: string }> {
  const original = await originalOf(run)
  if ("error" in original) return original
  // Recomputed from the original, not read from the stored list, so the ids the page sends are checked against the file.
  const { review, zones } = await reviewFrom(run, original.buf)
  const ids = new Set(review.changes.map(c => c.id))
  const kept = [...new Set(accepted)].filter(id => ids.has(id))
  const total = review.changes.length
  if (kept.length === total) {
    const buffer = await blob.get(`tailored/${run.result.token}.docx`).catch(() => null)
    if (buffer) return { token: run.result.token, kept: total, total, buffer }
  }
  const cut = acceptedEdits(run.result.edits, review.changes, kept, review.dropped)
  const { buffer } = await applyRewrites(original.buf, cut.edits, zones, { dropIdx: new Set(cut.dropIdx) })
  const token = `${cleanToken(run.result.token)}r${createHash("sha1").update(buffer).digest("hex").slice(0, 8)}`
  await blob.put(`tailored/${token}.docx`, buffer)
  return { token, kept: kept.length, total, buffer }
}

/** JD coverage of the file actually kept, so a resume filed in Files is not credited with keywords the person undid. */
export async function keptKeywords(run: TailorRun, buffer: Buffer): Promise<TailorResult["keyword_analysis"]> {
  const k = run.result.keyword_analysis
  const reqs = run.requirements?.length ? run.requirements : [...(k?.matched || []), ...(k?.added || []), ...(k?.missing || [])]
  const has = coveredJdKeywords(await extractText(buffer), reqs)
  const matched = (k?.matched || []).filter(t => has.has(t))
  const added = reqs.filter(t => has.has(t) && !matched.includes(t))
  const pct = (n: number) => (reqs.length ? coveragePercent(n / reqs.length) : 0)
  return { matched, added, missing: reqs.filter(t => !has.has(t)), coverage_before: k?.coverage_before ?? pct(matched.length), coverage_after: pct(has.size) }
}
