import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { readPath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { extractJdKeywords, coveredJdKeywords, extractCredentials } from "@/lib/keywords"

// Jobright-style match scoring: every job card gets a 0–100% match against the
// user's chosen resume, plus the why (matched keywords) and the gap (missing).
// Scores measure keyword overlap with the listing — never hiring probability,
// never invented.
export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()

  let body: { filepath?: string; jobs?: { id: string; title: string; description: string }[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) }
  const { filepath, jobs } = body || {}
  if (!filepath || !Array.isArray(jobs) || !jobs.length)
    return NextResponse.json({ error: "filepath and jobs[] are required." }, { status: 400 })
  if (jobs.length > 60)
    return NextResponse.json({ error: "Too many jobs (max 60)." }, { status: 400 })

  // Sandbox the resume path to the user's own directory (path traversal guard).
  const userResolved = path.resolve(path.join(USER_RESUMES_DIR, userId))
  const fileResolved = path.resolve(filepath)
  const inside = fileResolved === userResolved || fileResolved.startsWith(userResolved + path.sep)
  if (!inside) return NextResponse.json({ error: "Resume not found." }, { status: 404 })

  const buf = await readPath(fileResolved)
  if (!buf) return NextResponse.json({ error: "Resume not found." }, { status: 404 })
  let resumeText = ""
  try { resumeText = await extractText(buf) } catch { return NextResponse.json({ error: "Could not read resume." }, { status: 422 }) }
  if (resumeText.trim().length < 50) return NextResponse.json({ error: "Resume text too short to score." }, { status: 422 })

  // Candidate's real certifications — used to distinguish cert matches from skill gaps
  const candidateCerts = extractCredentials(resumeText)

  const scores = jobs.map(j => {
    const jd = `${j.title || ""}\n${j.description || ""}`.slice(0, 20000)
    const kws = extractJdKeywords(jd)
    if (!kws.length) return { id: j.id, score: null as number | null, matched: [] as string[], missing: [] as string[], certs: [] as string[] }
    const covered = coveredJdKeywords(resumeText, kws)
    const missing = kws.filter(k => !covered.has(k))
    // Which JD cert requirements does the candidate actually hold?
    const jdCerts = extractCredentials(jd)
    const matchedCerts = jdCerts.filter(c => candidateCerts.includes(c))
    return {
      id: j.id,
      score: Math.round((covered.size / kws.length) * 100),
      matched: [...covered].slice(0, 10),
      missing: missing.slice(0, 10),
      certs: matchedCerts,
    }
  })

  return NextResponse.json({ ok: true, scores }, { headers: { "Cache-Control": "no-store" } })
}
