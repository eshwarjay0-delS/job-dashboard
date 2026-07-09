import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { extractZones, type Edits, type Zones } from "@/lib/docx"
import { adapt } from "@/lib/claude"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { recentFeedback } from "@/lib/feedback"
import { extractKeywords } from "@/lib/keywords"
import { RESUMES_LIB as RESUMES_DIR, USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"

export const runtime = "nodejs"

// Overlay the model's tailored values onto the resume's zones so the builder opens
// pre-filled with the tailored content (and the rest as the resume's real text).
function buildModel(zones: Zones, edits: Edits | null) {
  const sk = new Map((edits?.skills || []).map(s => [s.idx, s.text]))
  const bl = new Map((edits?.bullets || []).map(b => [b.idx, b.text]))
  const expRoles = zones.roles.filter(r => r.role !== "Projects")
  return {
    header: {
      name: zones.header?.name || "",
      title: (edits?.headline?.title || zones.header?.title || "").trim(),
      tagline: (edits?.headline?.tagline || zones.header?.tagline || "").trim(),
      hasHeader: !!zones.header,
    },
    summary: (edits?.summary || zones.summaryText || "").trim(),
    skills: zones.skills.map(s => ({ idx: s.idx, text: (sk.get(s.idx) ?? s.text).trim() })),
    roles: zones.roles.map(r => ({
      role: r.role,
      current: !!r.current,
      bullets: r.bullets.map(b => ({ idx: b.idx, text: (bl.get(b.idx) ?? b.text).trim() })),
    })),
    extras: (zones.extras || []).map(e => ({ idx: e.idx, text: e.text.trim(), section: e.section })),
    experienceCount: expRoles.length,
    bulletCount: zones.roles.reduce((n, r) => n + r.bullets.length, 0),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const given = (body.filepath || "").trim()
    const jd = (body.jd || "").trim()
    if (!given) return NextResponse.json({ error: "Pick a resume to load." }, { status: 400 })

    const resolved = path.resolve(given)
    const ALLOWED = [path.resolve(RESUMES_DIR), path.resolve(USER_RESUMES_BASE)]
    if (!ALLOWED.some(a => resolved.startsWith(a))) {
      return NextResponse.json({ error: "That file is outside the resumes folder." }, { status: 403 })
    }
    const buf = await readFile(resolved)
    const zones = await extractZones(buf)

    // If a JD is supplied (and a key exists), pre-fill with the tailored content.
    let edits: Edits | null = null
    let tailored = false
    const keys = resolveKeys(body)
    if (jd && hasAnyKey(keys)) {
      try {
        const cat = path.relative(RESUMES_DIR, resolved).split(path.sep)[0] || ""
        const feedback = await recentFeedback(cat, 6)
        edits = await adapt({ keys, jd, zones, preferences: feedback.join("; "), jdKeywords: extractKeywords(jd) })
        tailored = true
      } catch { /* fall back to the untailored resume */ }
    }

    return NextResponse.json({
      tailored,
      filename: path.basename(resolved).replace(/\.docx$/i, ""),
      category: path.basename(path.dirname(resolved)),
      model: buildModel(zones, edits),
    })
  } catch (e) {
    return NextResponse.json({ error: `Could not load resume: ${String(e)}` }, { status: 500 })
  }
}
