import { NextRequest, NextResponse } from "next/server"
import { readdir, stat, mkdir, writeFile } from "fs/promises"
import path from "path"
import { createClient } from "@/lib/supabase/server"
import { ensureIndex } from "@/lib/keywords"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"

export const runtime = "nodejs"
const FREE_LIMIT = 2
const DRIVE_LIMIT = 78
const MAX_DOCX_SIZE = 5 * 1024 * 1024  // 5 MB per .docx
const MAX_ZIP_SIZE  = 50 * 1024 * 1024 // 50 MB per .zip (may contain many .docx files)

export interface ResumeFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileId(fullPath: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < fullPath.length; i++) {
    h ^= fullPath.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return "f_" + (h >>> 0).toString(36)
}

async function scanDir(dir: string, category = ""): Promise<ResumeFile[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const tasks = entries
    .filter(e => !e.name.startsWith("~$") && !e.name.startsWith(".") && e.name !== "_keywords.json")
    .map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const subCat = category ? `${category} / ${entry.name}` : entry.name
        return scanDir(fullPath, subCat)
      }
      if (!entry.name.toLowerCase().endsWith(".docx")) return []
      const info = await stat(fullPath)
      const file: ResumeFile = {
        id: fileId(fullPath),
        filename: entry.name.replace(/\.docx$/i, ""),
        filepath: fullPath,
        category: category || "General",
        size: formatSize(info.size),
        uploadedAt: info.mtime.toISOString(),
      }
      return [file]
    })

  const nested = await Promise.all(tasks)
  return nested.flat()
}

async function getUserDir(): Promise<{ dir: string; userId: string }> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id ?? "demo"
    const dir = path.join(USER_RESUMES_BASE, userId)
    await mkdir(dir, { recursive: true })
    return { dir, userId }
  } catch {
    const dir = path.join(USER_RESUMES_BASE, "demo")
    await mkdir(dir, { recursive: true }).catch(() => {})
    return { dir, userId: "demo" }
  }
}

async function hasDriveConnected(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from("user_drive").select("user_id").eq("user_id", userId).maybeSingle()
    return !!data
  } catch { return false }
}

// GET — list the user's resumes
export async function GET() {
  const user = await getUserDir()

  try {
    const files = await scanDir(user.dir)
    return NextResponse.json({ files })
  } catch (err) {
    console.error("[/api/resumes GET]", err)
    return NextResponse.json({ files: [] })
  }
}

// DELETE — remove files and/or folders from the user's personal dir
export async function DELETE(request: NextRequest) {
  const user = await getUserDir()

  try {
    const body = await request.json().catch(() => ({}))
    const files: string[] = body.files ?? (body.filepath ? [body.filepath] : [])
    const folders: string[] = body.folders ?? []

    const userResolved = path.resolve(user.dir)
    const inside = (p: string) => p === userResolved || p.startsWith(userResolved + path.sep)
    const { unlink, rm, rmdir, readdir: rd } = await import("fs/promises")
    let deleted = 0

    for (const f of files) {
      const resolved = path.resolve(f)
      if (!inside(resolved) || resolved === userResolved) continue
      try { await unlink(resolved); deleted++ } catch { /* ignore */ }
      const parent = path.dirname(resolved)
      if (parent !== userResolved) {
        try { if ((await rd(parent)).length === 0) await rmdir(parent) } catch { /* ignore */ }
      }
    }
    for (const rel of folders) {
      const parts = String(rel).split("/").map(s => s.trim()).filter(Boolean)
      if (!parts.length) continue
      const resolved = path.resolve(path.join(user.dir, ...parts))
      if (!inside(resolved) || resolved === userResolved) continue
      try { await rm(resolved, { recursive: true, force: true }); deleted++ } catch { /* ignore */ }
    }

    await ensureIndex(user.dir).catch(() => {})
    return NextResponse.json({ ok: true, deleted })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — upload a new .docx (or .zip) to the user's personal dir
export async function POST(request: NextRequest) {
  const user = await getUserDir()

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || !file.name) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 })
    }

    // File size guards — prevent OOM from large uploads
    if (file.size > MAX_ZIP_SIZE && file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: `ZIP too large (max ${MAX_ZIP_SIZE / 1024 / 1024} MB).` }, { status: 413 })
    }
    if (file.size > MAX_DOCX_SIZE && file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: `File too large (max ${MAX_DOCX_SIZE / 1024 / 1024} MB).` }, { status: 413 })
    }

    // ── ZIP: extract every .docx inside ──────────────────────────────────────
    if (file.name.toLowerCase().endsWith(".zip")) {
      const JSZip = (await import("jszip")).default
      const zip = await JSZip.loadAsync(Buffer.from(await file.arrayBuffer()))
      let added = 0
      let skipped = 0
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue
        const parts = entry.name.split("/").filter(p => p && p !== "." && !p.startsWith("__MACOSX"))
        const base = parts[parts.length - 1] || ""
        if (!base.toLowerCase().endsWith(".docx") || base.startsWith("~$") || base.startsWith(".")) continue
        const safe = parts.map(p => p.replace(/[^A-Za-z0-9._ \-()]/g, "_"))
        const rel = safe.length > 1 ? safe : [safe[0].replace(/\.docx$/i, ""), safe[0]]
        const dest = path.join(user.dir, ...rel)
        // Security: dest must stay inside the user's folder
        if (!path.resolve(dest).startsWith(path.resolve(user.dir) + path.sep)) continue
        try { await stat(dest); skipped++; continue } catch { /* not there → import */ }
        await mkdir(path.dirname(dest), { recursive: true })
        await writeFile(dest, Buffer.from(await entry.async("nodebuffer")))
        added++
      }
      await ensureIndex(user.dir).catch(() => {})
      return NextResponse.json({ zip: true, added, skipped })
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Upload a .docx resume or a .zip of resumes." }, { status: 400 })
    }

    // Enforce tier limit for single-file uploads
    const driveConnected = await hasDriveConnected(user.userId)
    const limit = driveConnected ? DRIVE_LIMIT : FREE_LIMIT
    const existing = await scanDir(user.dir)
    const duplicate = existing.find(r => r.filename.toLowerCase() === file.name.replace(/\.docx$/i, "").toLowerCase())
    const replace = formData.get("replace") === "true"
    const buffer = Buffer.from(await file.arrayBuffer())

    if (duplicate && !replace) {
      return NextResponse.json({ file: duplicate, duplicate: true })
    }
    if (duplicate && replace) {
      await writeFile(duplicate.filepath, buffer)
      const info = await stat(duplicate.filepath)
      await ensureIndex(user.dir).catch(() => {})
      return NextResponse.json({
        file: { ...duplicate, size: formatSize(info.size), uploadedAt: info.mtime.toISOString() },
        replaced: true,
      })
    }

    if (existing.length >= limit) {
      return NextResponse.json(
        {
          error: driveConnected
            ? `Resume limit reached (${DRIVE_LIMIT}). Delete some to upload more.`
            : `Free plan stores up to ${FREE_LIMIT} resumes. Connect Google Drive in Settings to store up to ${DRIVE_LIMIT}.`,
          limitReached: true,
        },
        { status: 403 },
      )
    }

    // New file — create a folder named after it and save inside
    const folderName = file.name.replace(/\.docx$/i, "")
    const folderPath = path.join(user.dir, folderName)
    await mkdir(folderPath, { recursive: true })
    const savePath = path.join(folderPath, file.name)
    await writeFile(savePath, buffer)

    const info = await stat(savePath)
    const entry: ResumeFile = {
      id: fileId(savePath),
      filename: folderName,
      filepath: savePath,
      category: folderName,
      size: formatSize(info.size),
      uploadedAt: info.mtime.toISOString(),
    }

    await ensureIndex(user.dir).catch(() => {})
    return NextResponse.json({ file: entry })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
