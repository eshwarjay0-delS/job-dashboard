import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { authenticatedUser, signInRequired, ownedResumePath } from "@/lib/authBoundary"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { fileTailored } from "@/lib/tailor-file"
import { buildAccepted, cleanToken, keptKeywords, readTailorRun, reviewOfRun } from "@/lib/tailor-review"

export const runtime = "nodejs"

// Review before download (23 Oct 2026). A tailored resume used to be downloaded, or filed for an application, with every
// rewrite in it and none of them seen. This route serves the change list for a run and builds the file that carries only
// the changes the person kept.
//
// GET  ?token=<token>                       → { review }: the original as the parser read it, and every changed line.
// POST { token, accepted: string[], save? } → { token, kept, total, saved? }: the kept-changes file, served by
//                                              /api/tailor/file like any other; `save: { role, company }` also files it in
//                                              Files (one job, one file) so Apply can pick it.
//
// Both read the private run record kept under the signed-in person's own library (src/lib/tailor-review.ts), so a token
// from someone else's run finds nothing here. The page sends change ids only, never text.

function runFor(userId: string, token: string) {
  return readTailorRun(path.join(USER_RESUMES_BASE, userId), token)
}

const NOT_FOUND = "This tailored resume's change record was not found. Tailor it again to review its changes."

export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return signInRequired()
  const token = cleanToken(request.nextUrl.searchParams.get("token"))
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 })
  const run = await runFor(user.id, token)
  if (!run || !ownedResumePath(USER_RESUMES_BASE, user.id, run.sourcePath)) return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
  const review = await reviewOfRun(run)
  if ("error" in review) return NextResponse.json({ error: review.error }, { status: 409 })
  return NextResponse.json({ review }, { headers: { "Cache-Control": "private, no-store" } })
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return signInRequired()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  const token = cleanToken(body.token)
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 })
  if (!Array.isArray(body.accepted) || body.accepted.length > 2000 || body.accepted.some((id: unknown) => typeof id !== "string" || id.length > 80)) {
    return NextResponse.json({ error: "accepted must be a list of change ids." }, { status: 400 })
  }
  const userDir = path.join(USER_RESUMES_BASE, user.id)
  const run = await runFor(user.id, token)
  if (!run || !ownedResumePath(USER_RESUMES_BASE, user.id, run.sourcePath)) return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
  try {
    const built = await buildAccepted(run, body.accepted as string[])
    if ("error" in built) return NextResponse.json({ error: built.error }, { status: 409 })
    const save = body.save && typeof body.save === "object" && !Array.isArray(body.save) ? body.save as { role?: unknown; company?: unknown } : null
    const saved = save
      ? await fileTailored({
          userDir, base: run.sourcePath, jd: run.input?.jd || "",
          result: { ...run.result, token: built.token, keyword_analysis: await keptKeywords(run, built.buffer) },
          role: typeof save.role === "string" ? save.role : "", company: typeof save.company === "string" ? save.company : "",
        })
      : null
    if (save && !saved) return NextResponse.json({ token: built.token, kept: built.kept, total: built.total, error: "The file was built but could not be saved in Files." }, { status: 500 })
    return NextResponse.json({ token: built.token, kept: built.kept, total: built.total, ...(saved ? { saved } : {}) })
  } catch (e: unknown) {
    return NextResponse.json({ error: `Could not build your reviewed resume: ${String(e).slice(0, 200)}` }, { status: 500 })
  }
}
