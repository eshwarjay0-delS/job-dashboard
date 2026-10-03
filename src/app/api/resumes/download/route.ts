import { NextRequest, NextResponse } from "next/server"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { authenticatedUserId, signInRequired, ownedResumePath } from "@/lib/authBoundary"
import { readPath } from "@/lib/storage"

// GET /api/resumes/download?filepath=<path>&name=<filename>
// Serves the .docx file directly.
// Security rules:
//   1. filepath must resolve inside an allowed directory tree
//   2. if inside USER_RESUMES_BASE, it must be inside the requesting user's own subfolder
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const filepath = searchParams.get("filepath") ?? ""
  const name     = searchParams.get("name") ?? "resume"

  if (!filepath) {
    return NextResponse.json({ error: "No filepath provided" }, { status: 400 })
  }

  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const resolved = ownedResumePath(USER_RESUMES_BASE, userId, filepath)
  if (!resolved) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const buffer = await readPath(resolved)
  if (!buffer) return NextResponse.json({ error: "File not found" }, { status: 404 })
  const safeFilename = `${name.replace(/[^a-z0-9_\-. ]/gi, "_")}.docx`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Length":      String(buffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
