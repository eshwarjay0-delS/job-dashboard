// A resume sent as a PDF, made into a Word file that can be tailored.
//
// Asked on 13 Oct 2026, twice: "for the files, take PDFs ... not just [Word] and zip", then, on finding the My Resume
// page still refused one: "PDF? format in resumes? and myfiles library???". Tailoring edits a Word file in place, so a
// PDF needs a Word file to stand in for it. This makes one from the PDF's words with the project's own resume layout
// (src/lib/resume-formatting.ts): same words, same order, a plain clean page. It does not copy the PDF's fonts, columns
// or tables, and it says so wherever the copy is offered. Nothing is rewritten and no model is called.

import { pdfText } from "./pdf-text.ts"
import { renderResumeDocx, isHeading, type FormatId } from "./resume-formatting.ts"

/** The layout a Word copy is given: readable, chronological, nothing ornamental. The person can pick another later. */
export const COPY_FORMAT: FormatId = "careeronestop"
/** Fewer words than this and it is not a resume that was read (a scan, a cover page): no copy is made. */
export const FEWEST_WORDS = 60

const BULLET = /^[\u2022\u25cf\u25aa\u25e6\u00b7\u2023\u2043\u27a2\uf0b7*-]\s+/
const ENDS = /[.!?:;]$/
const HAS_DATES = /\b(?:19|20)\d{2}\b.*$/
const startsSmall = (line: string): boolean => /^[a-z(]/.test(line)

/**
 * A PDF breaks a sentence wherever the page is too narrow for it, so one bullet arrives as two or three lines. This puts
 * them back together: a line carries on the one before it when it starts with a small letter, or when the line before
 * ran to the full width and did not end its sentence. A title, a bullet, or a line with its dates always starts anew.
 * A bullet mark printed as a line of its own is joined to the words after it.
 */
export function unwrapPdfLines(text: string): string {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map(l => l.replace(/[ \t\u00a0]+/g, " ").trim()).filter(Boolean)
  if (!lines.length) return ""
  // How wide a full line is in this file: most wrapped lines are close to the longest ones.
  const lengths = lines.map(l => l.length).sort((a, b) => a - b)
  const full = lengths[Math.floor(lengths.length * 0.9)] || 0
  const out: string[] = []
  let open = false           // the last line kept is running text that may be carried on
  for (let raw of lines) {
    // "•" alone on a line, the words on the next.
    if (/^[\u2022\u25cf\u25aa\u25e6\u00b7\u2023\u2043\u27a2\uf0b7]$/.test(raw)) { out.push("\u2022 "); open = true; continue }
    raw = raw.replace(/^[\u25cf\u25aa\u25e6\u00b7\u2023\u2043\u27a2\uf0b7]\s*/, "\u2022 ").replace(/^\u2022(?=\S)/, "\u2022 ")
    const last = out[out.length - 1] || ""
    if (last === "\u2022 ") { out[out.length - 1] = last + raw; open = true; continue }
    const fresh = BULLET.test(raw) || isHeading(raw) || (HAS_DATES.test(raw) && raw.length <= 120 && !startsSmall(raw))
    const carries = open && !fresh && last && !ENDS.test(last) && (startsSmall(raw) || (full >= 50 && last.length >= full * 0.82))
    if (carries) { out[out.length - 1] = `${last}${last.endsWith("-") && /[a-z]-$/.test(last) ? "" : " "}${raw}`; continue }
    out.push(raw)
    // Only what reads as running text is carried on: a bullet, or an ordinary line under a section title.
    open = BULLET.test(raw) || (!isHeading(raw) && out.length > 3 && raw.length >= 40)
  }
  return out.join("\n")
}

export const wordCount = (text: string): number => (String(text || "").match(/[\p{L}\p{N}][\p{L}\p{N}'&+#./-]*/gu) || []).length

/** The Word copy of a PDF resume, or null when its words could not be read (a scan, a locked file). */
export async function wordFromPdf(bytes: Uint8Array): Promise<{ docx: Buffer; text: string } | null> {
  const text = unwrapPdfLines(await pdfText(bytes))
  if (wordCount(text) < FEWEST_WORDS) return null
  try { return { docx: await renderResumeDocx(text, COPY_FORMAT), text } } catch { return null }
}

/** The name the copy is kept under: "Dana Resume (from PDF).docx". */
export const copyName = (pdfName: string): string => `${String(pdfName || "Resume").replace(/\.pdf$/i, "").replace(/\s*\(from PDF\)$/i, "").slice(0, 140)} (from PDF).docx`
