import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { createClient } from "@/lib/supabase/server"
import { RESUME_FORMATS, validFormat, renderResumeDocx, renderResumeHtml } from "@/lib/resume-formatting"

export const runtime = "nodejs"
export const maxDuration = 60
const LIMIT = 4 * 1024 * 1024
export async function GET() { return NextResponse.json({ templates: RESUME_FORMATS }) }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in to format resumes." }, { status: 401 })
  const form = await request.formData()
  const format = String(form.get("template") || "jakes")
  const output = String(form.get("output") || "preview")
  if (!validFormat(format)) return NextResponse.json({ error: "Unknown template." }, { status: 400 })
  let text = String(form.get("text") || "").trim()
  const file = form.get("file")
  if (file instanceof File) {
    if (!file.name.toLowerCase().endsWith(".docx") || file.size > LIMIT) return NextResponse.json({ error: "Upload a DOCX file smaller than 4 MB." }, { status: 400 })
    try { text = (await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })).value.trim() }
    catch { return NextResponse.json({ error: "Could not read this DOCX file." }, { status: 422 }) }
  }
  if (!text || text.length > 100000) return NextResponse.json({ error: "Resume text is empty or too long." }, { status: 400 })
  if (output === "docx") {
    const docx = await renderResumeDocx(text, format)
    return new NextResponse(new Uint8Array(docx), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": 'attachment; filename="MarketFit_Formatted_Resume.docx"', "Cache-Control": "no-store" } })
  }
  if (output !== "preview" && output !== "html") return NextResponse.json({ error: "Invalid output." }, { status: 400 })
  const html = renderResumeHtml(text, format)
  if (output === "html") return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
  return NextResponse.json({ text, html, template: format, warning: "Review all extracted text before downloading. This version supports DOCX uploads." })
}
