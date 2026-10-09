import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { safeResumeName, readLimitedStream, MAX_ARCHIVE_FILES } from "@/lib/uploadSafety"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { ensureIndex } from "@/lib/keywords"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { listFiles, statPath, writePath, existsPath, deletePath, deleteDir } from "@/lib/storage"

export const runtime = "nodejs"
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

async function scanDir(dir: string): Promise<ResumeFile[]> {
  const files = (await listFiles(dir)).filter(
    f => f.toLowerCase().endsWith(".docx") && path.basename(f) !== "_keywords.json",
  )
  const out = await Promise.all(files.map(async (fullPath) => {
    const rel = path.relative(dir, fullPath)
    const parts = rel.split(path.sep)
    const category = parts.length > 1 ? parts.slice(0, -1).join(" / ") : "General"
    const info = await statPath(fullPath)
    return {
      id: fileId(fullPath),
      filename: path.basename(fullPath).replace(/\.docx$/i, ""),
      filepath: fullPath,
      category,
      size: info ? formatSize(info.size) : "",
      uploadedAt: (info?.mtime ?? new Date()).toISOString(),
    } as ResumeFile
  }))
  return out
}




// GET — list the user's resumes
export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const user = { userId, dir: path.join(USER_RESUMES_BASE, userId) }

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
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const user = { userId, dir: path.join(USER_RESUMES_BASE, userId) }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    // Explicit, confirmed bulk deletion. Never delete the user's root directory or WhatsApp version history.
    if (body.clearAll === true) {
      if (body.confirm !== "CLEAR MY RESUME LIBRARY") return NextResponse.json({ error: "Confirmation required." }, { status: 400 })
      const all = await scanDir(user.dir)
      for (const item of all) await deletePath(item.filepath)
      await deletePath(path.join(user.dir, ".resume-library-index.json")).catch(() => {})
      await ensureIndex(user.dir).catch(() => {})
      return NextResponse.json({ ok: true, deleted: all.length })
    }
    const files: string[] = body.files ?? (body.filepath ? [body.filepath] : [])
    const folders: string[] = body.folders ?? []

    if (![files, folders].every(items => Array.isArray(items) && items.length <= 200 && items.every(item => typeof item === "string"))) return NextResponse.json({ error: "Invalid file selection." }, { status: 400 })
    const userResolved = path.resolve(user.dir)
    const inside = (p: string) => p === userResolved || p.startsWith(userResolved + path.sep)
    let deleted = 0

    for (const f of files) {
      const resolved = path.resolve(f)
      if (!inside(resolved) || resolved === userResolved) continue
      await deletePath(resolved); deleted++
      // No empty-dir cleanup needed: object stores have no real folders, and on fs an
      // orphaned empty dir is harmless (scanDir ignores it).
    }
    for (const rel of folders) {
      const parts = String(rel).split("/").map(s => s.trim()).filter(Boolean)
      if (!parts.length) continue
      const resolved = path.resolve(path.join(user.dir, ...parts))
      if (!inside(resolved) || resolved === userResolved) continue
      await deleteDir(resolved); deleted++
    }

    await ensureIndex(user.dir).catch(() => {})
    return NextResponse.json({ ok: true, deleted })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — upload a new .docx (or .zip) to the user's personal dir
export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const user = { userId, dir: path.join(USER_RESUMES_BASE, userId) }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!(file instanceof File) || !file.name) {
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
      let expanded = 0
      let candidates = 0
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue
        const parts = entry.name.split("/").filter(p => p && p !== "." && !p.startsWith("__MACOSX"))
        const base = parts[parts.length - 1] || ""
        if (!base.toLowerCase().endsWith(".docx") || base.startsWith("~$") || base.startsWith(".")) continue
        if (++candidates > MAX_ARCHIVE_FILES) return NextResponse.json({ error: "ZIP contains too many resumes (max 200).", added, skipped }, { status: 413 })
        const safe = parts.map(p => p.replace(/[^A-Za-z0-9._ \-()]/g, "_"))
        const rel = safe.length > 1 ? safe : [safe[0].replace(/\.docx$/i, ""), safe[0]]
        const dest = path.join(user.dir, ...rel)
        // Security: dest must stay inside the user's folder
        if (!path.resolve(dest).startsWith(path.resolve(user.dir) + path.sep)) continue
        if (await existsPath(dest)) { skipped++; continue }
        let bytes: Buffer
        try { bytes = await readLimitedStream(entry.nodeStream(), Math.min(MAX_DOCX_SIZE, MAX_ZIP_SIZE - expanded)) }
        catch { return NextResponse.json({ error: "ZIP expanded size limit exceeded (5 MB per resume, 50 MB total).", added, skipped }, { status: 413 }) }
        expanded += bytes.length
        await writePath(dest, bytes)
        added++
      }
      await ensureIndex(user.dir).catch(() => {})
      return NextResponse.json({ zip: true, added, skipped })
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Upload a .docx resume or a .zip of resumes." }, { status: 400 })
    }

    // No resume-count limit — unlimited storage (personal use).
    const existing = await scanDir(user.dir)
    const duplicate = existing.find(r => r.filename.toLowerCase() === file.name.replace(/\.docx$/i, "").toLowerCase())
    const replace = formData.get("replace") === "true"
    const buffer = Buffer.from(await file.arrayBuffer())

    if (duplicate && !replace) {
      return NextResponse.json({ file: duplicate, duplicate: true })
    }
    if (duplicate && replace) {
      await writePath(duplicate.filepath, buffer)
      const info = await statPath(duplicate.filepath)
      await ensureIndex(user.dir).catch(() => {})
      return NextResponse.json({
        file: { ...duplicate, size: info ? formatSize(info.size) : duplicate.size, uploadedAt: (info?.mtime ?? new Date()).toISOString() },
        replaced: true,
      })
    }

    // New file — create a folder named after it and save inside
    let safeName: string
    try { safeName = safeResumeName(file.name) }
    catch { return NextResponse.json({ error: "Invalid filename." }, { status: 400 }) }
    const folderName = safeName.replace(/\.docx$/i, "")
    const savePath = path.resolve(user.dir, folderName, safeName)
    if (!savePath.startsWith(path.resolve(user.dir) + path.sep)) return NextResponse.json({ error: "Invalid filename." }, { status: 400 })
    await writePath(savePath, buffer)

    const info = await statPath(savePath)
    const entry: ResumeFile = {
      id: fileId(savePath),
      filename: folderName,
      filepath: savePath,
      category: folderName,
      size: info ? formatSize(info.size) : formatSize(buffer.length),
      uploadedAt: (info?.mtime ?? new Date()).toISOString(),
    }

    await ensureIndex(user.dir).catch(() => {})
    return NextResponse.json({ file: entry })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
