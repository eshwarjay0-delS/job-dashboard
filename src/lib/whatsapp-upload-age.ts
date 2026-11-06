// 30 Oct 2026: a .docx sent earlier in WhatsApp and never used stayed paired with the next job post (no age check),
// so a Salesforce Security post ran against an unrelated resume and came back at 0%. A pending upload is now used
// only while it is fresh (default 30 minutes; the same-message "resume with the job post" case is seconds old).
// WHATSAPP_UPLOAD_MAX_AGE = minutes; 0/off turns the check off (old behaviour). Import-free for the tests' vm loader.
export const DEFAULT_UPLOAD_MAX_AGE_MIN = 30

export function uploadMaxAgeMin(env: Record<string, string | undefined> | undefined = globalThis.process?.env): number {
  const raw = String(env?.WHATSAPP_UPLOAD_MAX_AGE ?? "").trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return 0
  const n = Number(raw)
  return raw && Number.isFinite(n) && n > 0 ? n : DEFAULT_UPLOAD_MAX_AGE_MIN
}

/** True when a pending upload is too old to pair with this job post. An upload with no recorded time keeps the old behaviour. */
export function uploadStale(resumeAt: number | undefined, now = Date.now(), env?: Record<string, string | undefined>): boolean {
  const max = uploadMaxAgeMin(env ?? globalThis.process?.env)
  if (!max || !resumeAt || !Number.isFinite(resumeAt)) return false
  return now - resumeAt > max * 60_000
}

export type InboundResumeKind = "docx" | "pdf" | "image"

export type InboundResume = { kind: InboundResumeKind; id: string; name: string }

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/** The resume file on this WhatsApp message, if it is a Word file, a PDF, or a photo. Other attachments are not resumes. */
export function classifyInboundResume(msg: { type?: unknown; document?: { id?: string; filename?: string; mime_type?: string }; image?: { id?: string; mime_type?: string } } | null | undefined): InboundResume | null {
  const type = String(msg?.type || "")
  if (type === "document") {
    const doc = msg?.document
    if (!doc?.id) return null
    const name = doc.filename || "resume"
    const mime = String(doc.mime_type || "")
    const lower = name.toLowerCase()
    if (mime === DOCX_MIME || lower.endsWith(".docx")) return { kind: "docx", id: doc.id, name }
    if (mime === "application/pdf" || lower.endsWith(".pdf")) return { kind: "pdf", id: doc.id, name }
    return null
  }
  if (type === "image") {
    const image = msg?.image
    if (!image?.id) return null
    const mime = String(image.mime_type || "image/jpeg")
    if (mime && !mime.startsWith("image/")) return null
    return { kind: "image", id: image.id, name: "resume-photo" }
  }
  return null
}

/** A fresh upload is the resume for this job. The library's older file is not. */
export function freshUploadBlocksLibrary(resumePath: string | undefined, resumeAt: number | undefined, now = Date.now(), env?: Record<string, string | undefined>): boolean {
  return !!resumePath && !uploadStale(resumeAt, now, env)
}

/** Lines of extracted PDF text, capped, with no words added. */
export function pdfLines(text: string): string[] {
  const cleaned = String(text || "").replace(/\u0000/g, "").replace(/\r/g, "")
  const raw = cleaned.split("\n").map(line => line.trim()).filter(Boolean)
  const lines = raw.length > 1 ? raw : cleaned.split(/(?<=[.!?])\s+/).map(line => line.trim()).filter(Boolean)
  return lines.map(line => line.slice(0, 500)).slice(0, 400)
}

export function unreadableResumeReply(kind: "image" | "pdf", jdSaved = false): string {
  const what = kind === "image" ? "photo" : "PDF"
  const saved = jdSaved ? " The job description is saved." : ""
  return `I received the new ${what} and did not tailor an older resume.${saved} Export it to a Word .docx and send that file.`
}

/** A minimal editable .docx whose paragraphs are exactly the lines given. */
export async function textToResumeDocx(lines: string[]): Promise<Buffer> {
  const paragraphs = lines.map(line => line.trim()).filter(Boolean).slice(0, 400)
  if (!paragraphs.length) throw new Error("No resume text")
  const loaded = await import("jszip")
  const JSZip = loaded.default
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const zip = new JSZip()
  zip.file("[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>")
  zip.file("_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>")
  const body = paragraphs.map(line => `<w:p><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`).join("")
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`)
  return zip.generateAsync({ type: "nodebuffer" })
}
