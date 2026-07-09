import { NextRequest, NextResponse } from "next/server"
import { readdir, stat, writeFile, unlink, mkdir } from "fs/promises"
import path from "path"

// Recursively scan for .docx files in userDir and subdirectories.
async function scanDocx(dir: string, base: string, formatSize: (b: number) => string): Promise<{
  filename: string; filepath: string; size: string; uploadedAt: string
}[]> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const tasks = entries
    .filter(e => !e.name.startsWith("~$") && !e.name.startsWith("."))
    .map(async e => {
      const fp = path.join(dir, e.name)
      if (e.isDirectory()) return scanDocx(fp, base, formatSize)
      if (!e.name.toLowerCase().endsWith(".docx")) return []
      const info = await stat(fp)
      return [{ filename: e.name.replace(/\.docx$/i, ""), filepath: fp, size: formatSize(info.size), uploadedAt: info.mtime.toISOString() }]
    })
  return (await Promise.all(tasks)).flat()
}
import { createClientFromRequest } from "@/lib/supabase/server"
import { USER_RESUMES_DIR as BASE_DIR } from "@/lib/paths"

export const runtime = "nodejs"

// Free-tier resume limit (no Drive connected)
const FREE_LIMIT = 2
// Drive-connected limit
const DRIVE_LIMIT = 78

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
  await mkdir(userDir, { recursive: true })

  const files = await scanDocx(userDir, userDir, formatSize)

  const driveConnected = await hasDriveConnected(userId, request)
  const limit = driveConnected ? DRIVE_LIMIT : FREE_LIMIT

  return NextResponse.json({ files, count: files.length, limit, driveConnected })
}

// POST — upload a resume (enforces tier limit)
export async function POST(request: NextRequest) {
  const userId = await getUserId(request)

  const userDir = path.join(BASE_DIR, userId)
  await mkdir(userDir, { recursive: true })

  const driveConnected = await hasDriveConnected(userId, request)
  const limit = driveConnected ? DRIVE_LIMIT : FREE_LIMIT

  // Count existing resumes (including subdirectories to match the recursive GET)
  const existingFiles = await scanDocx(userDir, userDir, formatSize)

  if (existingFiles.length >= limit) {
    return NextResponse.json(
      {
        error: driveConnected
          ? `Resume limit reached (${DRIVE_LIMIT}). Delete some to upload more.`
          : `Free plan stores up to ${FREE_LIMIT} resumes. Connect Google Drive in Settings to store up to ${DRIVE_LIMIT}.`,
        limitReached: true,
        driveConnected,
        limit,
      },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file || !file.name.toLowerCase().endsWith(".docx"))
    return NextResponse.json({ error: "Upload a .docx file." }, { status: 400 })

  const safeName = file.name.replace(/[^A-Za-z0-9._\- ()]/g, "_")
  const dest = path.join(userDir, safeName)
  await writeFile(dest, Buffer.from(await file.arrayBuffer()))

  const info = await stat(dest)
  return NextResponse.json({
    file: { filename: safeName.replace(/\.docx$/i, ""), filepath: dest, size: formatSize(info.size), uploadedAt: info.mtime.toISOString() },
    count: existingFiles.length + 1,
    limit,
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

  try { await unlink(fp) } catch { /* already gone */ }
  return NextResponse.json({ ok: true })
}
