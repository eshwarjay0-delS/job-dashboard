// The first question of setup: the resume. POST a Word file or a PDF (form field "file").
//
// It is kept in the person's Files (under the email written on it, in the folder for its kind of work), and read:
// name, title, email, mobile, location, LinkedIn, and the kind of work it points to. What was read is only SHOWN to the
// person; it goes into their profile after they say yes (POST /api/onboarding { action: "use_resume" }).
// -> { ok, resumeName, read, suggested, readable }. Nothing here calls a model.
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { extractText } from "@/lib/docx"
import { extractProfile } from "@/lib/profile"
import { extractKeywords, ensureIndex } from "@/lib/keywords"
import { isPdf, pdfText } from "@/lib/pdf-text"
import { copyName, wordFromPdf } from "@/lib/pdf-to-word"
import { saveUpload } from "@/lib/resume-library-store"
import { readSetup, writeSetup, writeWords } from "@/lib/onboarding-store"
import { hasContact, readContact, suggestFromResume, tidyContact, type Contact } from "@/lib/onboarding"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }
const MOST_BYTES = 5 * 1024 * 1024
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, ...PRIVATE })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return no("Sign in again.", 401)
  if (!checkRateLimit(`onboarding-resume:${user.id}`, { max: 12, windowMs: 60 * 60_000 }).ok) return no("That is a lot of files in an hour. Try again later.", 429)

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File) || !file.name) return no("No file came through. Choose your resume again.", 400)
  const kind = /\.docx$/i.test(file.name) ? "docx" : /\.pdf$/i.test(file.name) ? "pdf" : null
  if (!kind) return no("Send your resume as a Word file (.docx) or a PDF.", 400)
  if (file.size > MOST_BYTES) return no("That file is over 5 MB. Send a smaller one.", 413)
  const bytes = Buffer.from(await file.arrayBuffer())
  if (kind === "pdf" && !isPdf(bytes)) return no("That file is named as a PDF but is not one.", 400)

  let text = "", contact: Contact, skills: string[] = []
  try {
    if (kind === "docx") {
      text = await extractText(bytes)
      const p = await extractProfile(bytes)
      contact = tidyContact({ name: p.name, title: p.title, email: p.email, phone: p.phone, location: p.location, linkedin: p.linkedin })
      skills = (p.skills || []).map(s => String(s).replace(/\s+/g, " ").trim()).filter(Boolean)
    } else {
      text = await pdfText(bytes)
      contact = tidyContact(readContact(text))
    }
  } catch {
    return no("That file could not be opened. Save it again from Word as .docx, or send a PDF.", 400)
  }

  const userDir = path.join(USER_RESUMES_DIR, user.id)
  const saved = await saveUpload({ userDir, bytes, filename: file.name, kind })
  // A PDF also gets a Word copy made from its words, so the person can have a resume fitted to a job from day one.
  let tailorable = kind === "docx"
  if (kind === "pdf") {
    const word = await wordFromPdf(bytes)
    if (word) { await saveUpload({ userDir, bytes: word.docx, filename: copyName(file.name), kind: "docx" }); tailorable = true }
  }
  // The index other pages pick a resume from is brought up to date; a failure there does not undo the upload.
  if (tailorable) await ensureIndex(userDir).catch(() => {})

  const suggested = suggestFromResume(text)
  const setup = await readSetup(user.id)
  await writeSetup(user.id, { ...setup, resumeName: `${saved.name}.${kind}`, read: contact, ...(suggested.domain ? { suggested } : {}) })
  await writeWords(user.id, { skills, keywords: extractKeywords(text) }).catch(() => {})

  return NextResponse.json({
    ok: true, resumeName: `${saved.name}.${kind}`, read: hasContact(contact) ? contact : null, suggested: suggested.domain ? suggested : null,
    // false when no words could be read (a scan): the file is kept, and the person fills their profile in themselves.
    readable: !!text.trim(), folder: saved.folder, tailorable,
  }, PRIVATE)
}
