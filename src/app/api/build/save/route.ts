import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { extractZones, applyRewrites, type Edits } from "@/lib/docx"
import { RESUMES_LIB as RESUMES_DIR, USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { createClientFromRequest } from "@/lib/supabase/server"
import { readPath, blob } from "@/lib/storage"

export const runtime = "nodejs"

// Apply the builder's edited fields to the ORIGINAL resume in place (formatting kept,
// name/contact untouched) and write a downloadable file. Original is never modified.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const given = (body.filepath || "").trim()
    const edits: Edits = body.edits || {}
    if (!given) return NextResponse.json({ error: "No resume to save." }, { status: 400 })

    // AUTH. This route reads arbitrary .docx off the resume storage and returns
    // their extracted text, so it must not be anonymous. The allow-list below is
    // also scoped to the CALLER'S OWN folder — it previously allowed the whole
    // USER_RESUMES_BASE root, which let any caller read every other user's
    // resumes. Note `+ path.sep`: without it "/u/demo" also matches "/u/demo2".
    let userId = ""
    try {
      const supabase = await createClientFromRequest(request)
      const { data } = await supabase.auth.getUser()
      if (data.user?.id) userId = data.user.id
    } catch { /* unauthenticated */ }
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const resolved = path.resolve(given)
    const ALLOWED = [path.resolve(RESUMES_DIR), path.resolve(path.join(USER_RESUMES_BASE, userId))]
    if (!ALLOWED.some(a => resolved === a || resolved.startsWith(a + path.sep))) {
      return NextResponse.json({ error: "That file is outside your resumes folder." }, { status: 403 })
    }
    const buf = await readPath(resolved)
    if (!buf) return NextResponse.json({ error: "That resume could not be read." }, { status: 404 })
    const zones = await extractZones(buf)
    const { buffer, notes } = await applyRewrites(buf, edits, zones)

    const token = Math.random().toString(36).slice(2, 12)
    await blob.put(`tailored/${token}.docx`, buffer)

    return NextResponse.json({
      token,
      filename: path.basename(resolved).replace(/\.docx$/i, ""),
      notes,
    })
  } catch (e) {
    return NextResponse.json({ error: `Could not save: ${String(e)}` }, { status: 500 })
  }
}
