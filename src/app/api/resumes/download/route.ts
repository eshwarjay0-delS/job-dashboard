import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { RESUMES_LIB as RESUMES_DIR, USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { createClientFromRequest } from "@/lib/supabase/server"

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

  const resolved = path.resolve(filepath)
  const sharedLib = path.resolve(RESUMES_DIR)
  const userBase  = path.resolve(USER_RESUMES_BASE)

  // Resolve the requesting user's id so we can scope per-user folder access
  let userId = ""
  try {
    const supabase = await createClientFromRequest(request)
    const { data } = await supabase.auth.getUser()
    if (data.user?.id) userId = data.user.id
  } catch { /* unauthenticated */ }

  // Allow access to the shared library regardless of auth
  if (resolved.startsWith(sharedLib + path.sep) || resolved === sharedLib) {
    // Shared library — no per-user restriction needed
  } else if (resolved.startsWith(userBase + path.sep)) {
    // User-scoped folder: must be authenticated and the file must live inside THIS user's subfolder
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }
    const userFolder = path.resolve(path.join(userBase, userId))
    if (!resolved.startsWith(userFolder + path.sep) && resolved !== userFolder) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } else {
    // Outside all allowed roots
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const buffer = await readFile(resolved)
    const safeFilename = `${name.replace(/[^a-z0-9_\-. ]/gi, "_")}.docx`

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length":      String(buffer.length),
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
