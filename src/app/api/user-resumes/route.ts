import { NextRequest, NextResponse } from "next/server"
import path from "path"
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
async function getUserId(request: NextRequest): Promise<string> {
  try {
    const supabase = await createClientFromRequest(request)
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? "demo"
  } catch { return "demo" }
}

async function hasDriveConnected(userId: string, request: NextRequest): Promise<boolean> {
  try {
    const supabase = await createClientFromRequest(request)
    const { data } = await supabase.from("user_drive").select("user_id").eq("user_id", userId).maybeSingle()
    return !!data
  } catch { return false }
}

// GET — list this user's resumes (including subdirectories) + their tier info
export async function GET(request: NextRequest) {
  const userId = await getUserId(request)

  const userDir = path.join(BASE_DIR, userId)
  const files = await scanDocx(userDir, userDir, formatSize)

  const driveConnected = await hasDriveConnected(userId, request)

  // Unlimited storage — limit is null.
  return NextResponse.json({ files, count: files.length, limit: null, driveConnected })
}

// POST — upload a resume (unlimited; no tier cap)
export async function POST(request: NextRequest) {
  const userId = await getUserId(request)

  const userDir = path.join(BASE_DIR, userId)

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file || !file.name.toLowerCase().endsWith(".docx"))
    return NextResponse.json({ error: "Upload a .docx file." }, { status: 400 })

  const safeName = file.name.replace(/[^A-Za-z0-9._\- ()]/g, "_")
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
  const userId = await getUserId(request)

  const { filename, filepath } = await request.json().catch(() => ({}))
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
  if (!fp.startsWith(path.resolve(userDir) + path.sep) && fp !== path.resolve(userDir))
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  await deletePath(fp)
  return NextResponse.json({ ok: true })
}
