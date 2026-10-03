import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { MAX_RESUME_BYTES, safeResumeName } from "@/lib/uploadSafety"
import { createClientFromRequest } from "@/lib/supabase/server"
import { USER_RESUMES_DIR as BASE_DIR } from "@/lib/paths"
import { listFiles, statPath, writePath, deletePath } from "@/lib/storage"

// Recursively scan for .docx files in userDir → filename/filepath/size/uploadedAt.
async function scanDocx(dir: string, _base: string, formatSize: (b: number) => string): Promise<{
  filename: string; filepath: string; size: string; uploadedAt: string
}[]> {
  const files = (await listFiles(dir)).filter(f => f.toLowerCase().endsWith(".docx"))
  return Promise.all(files.map(async fp => {
    const info = await statPath(fp)
    return {
      filename: path.basename(fp).replace(/\.docx$/i, ""),
      filepath: fp,
      size: info ? formatSize(info.size) : "",
      uploadedAt: (info?.mtime ?? new Date()).toISOString(),
    }
  }))
}

export const runtime = "nodejs"

// Resume storage is unlimited (personal use). `limit: null` signals "no cap" to
// the Settings UI.
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Takes the real incoming request so callers that can't send cookies (the
// Chrome extension's content scripts) can authenticate via `Authorization:
// Bearer` instead — see createClientFromRequest, which falls back to the
// normal cookie session unchanged when there's no such header (every existing
// browser-tab caller is unaffected).


async function hasDriveConnected(userId: string, request: NextRequest): Promise<boolean> {
  try {
    const supabase = await createClientFromRequest(request)
    const { data } = await supabase.from("user_drive").select("user_id").eq("user_id", userId).maybeSingle()
    return !!data
  } catch { return false }
}

// GET — list this user's resumes (including subdirectories) + their tier info
export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()

  const userDir = path.join(BASE_DIR, userId)
  const files = await scanDocx(userDir, userDir, formatSize)

  const driveConnected = await hasDriveConnected(userId, request)

  // Unlimited storage — limit is null.
  return NextResponse.json({ files, count: files.length, limit: null, driveConnected })
}

// POST — upload a resume (unlimited; no tier cap)
export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()

  const userDir = path.join(BASE_DIR, userId)

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".docx"))
    return NextResponse.json({ error: "Upload a .docx file." }, { status: 400 })

  if (file.size > MAX_RESUME_BYTES) return NextResponse.json({ error: "Resume too large (max 5 MB)." }, { status: 413 })
  let safeName: string
  try { safeName = safeResumeName(file.name) }
  catch { return NextResponse.json({ error: "Invalid resume filename." }, { status: 400 }) }
  const dest = path.join(userDir, safeName)
  await writePath(dest, Buffer.from(await file.arrayBuffer()))

  const info = await statPath(dest)
  const files = await scanDocx(userDir, userDir, formatSize)
  return NextResponse.json({
    file: { filename: safeName.replace(/\.docx$/i, ""), filepath: dest, size: info ? formatSize(info.size) : "", uploadedAt: (info?.mtime ?? new Date()).toISOString() },
    count: files.length,
    limit: null,
  })
}

// DELETE — remove a resume by filepath (full path) or filename (basename, flat lookup)
export async function DELETE(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()

  const body = await request.json().catch(() => null)
  if (!body || (body.filepath !== undefined && typeof body.filepath !== "string") || (body.filename !== undefined && typeof body.filename !== "string")) return NextResponse.json({ error: "Invalid filename or filepath." }, { status: 400 })
  const { filename, filepath } = body
  if (!filename && !filepath) return NextResponse.json({ error: "No filename or filepath." }, { status: 400 })

  const userDir = path.join(BASE_DIR, userId)
  let fp: string

  if (filepath) {
    // Caller supplied a full path (e.g. from the recursive file list)
    fp = path.resolve(filepath)
  } else {
    // Fallback: bare filename → flat lookup in user root
    fp = path.join(userDir, path.basename(filename))
  }

  // Security: must stay inside this user's folder
  if (!fp.startsWith(path.resolve(userDir) + path.sep))
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  await deletePath(fp)
  return NextResponse.json({ ok: true })
}
