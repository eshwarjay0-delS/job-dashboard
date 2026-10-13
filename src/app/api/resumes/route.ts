import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { createHash } from "node:crypto"
import { extractText } from "@/lib/docx"
import { resumeEmails, rankResumeCategories } from "@/lib/resumeOrganization"
import { safeResumeName, readLimitedStream, MAX_ARCHIVE_FILES } from "@/lib/uploadSafety"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { ensureIndex } from "@/lib/keywords"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { listFiles, readPath, statPath, writePath, existsPath, deletePath, deleteDir } from "@/lib/storage"
import { saveUpload } from "@/lib/resume-library-store"
import { isPdf } from "@/lib/pdf-text"

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
  /** A PDF is kept in Files and can be downloaded; only a Word file can be tailored. GET lists Word files only. */
  kind?: "docx" | "pdf"
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
    if (file.size > MAX_DOCX_SIZE && /\.(docx|pdf)$/i.test(file.name)) {
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
        const isPdfEntry = base.toLowerCase().endsWith(".pdf")
        if ((!base.toLowerCase().endsWith(".docx") && !isPdfEntry) || base.startsWith("~$") || base.startsWith(".")) continue
        if (++candidates > MAX_ARCHIVE_FILES) return NextResponse.json({ error: "ZIP contains too many resumes (max 200).", added, skipped }, { status: 413 })
        if (isPdfEntry) {
          // A PDF in the zip is filed at once, under the email written on it and its kind of work: the tidy-up that
          // follows a zip import sorts Word resumes only. Its name carries a hash of what is in it, so the same PDF
          // sent again lands on the same file.
          let pdfBytes: Buffer
          try { pdfBytes = await readLimitedStream(entry.nodeStream(), Math.min(MAX_DOCX_SIZE, MAX_ZIP_SIZE - expanded)) }
          catch { return NextResponse.json({ error: "ZIP expanded size limit exceeded (5 MB per file, 50 MB total).", added, skipped }, { status: 413 }) }
          expanded += pdfBytes.length
          if (!isPdf(pdfBytes)) { skipped++; continue }
          const kept = await saveUpload({ userDir: user.dir, bytes: pdfBytes, filename: base, kind: "pdf" })
          if (kept.existed) skipped++; else added++
          continue
        }
        const safe = parts.map(p => p.replace(/[^A-Za-z0-9.@+_ \-()]/g, "_"))
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

    // ── PDF: kept in Files as it is ──────────────────────────────────────────
    // Asked on 13 Oct 2026: "for the files, take PDFs ... not just [Word] and zip, but also PDFs." Its words are read
    // only to choose the folder. It is never rewritten: tailoring edits a Word file in place.
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const bytes = Buffer.from(await file.arrayBuffer())
      if (!isPdf(bytes)) return NextResponse.json({ error: "That file is named as a PDF but is not one." }, { status: 400 })
      const kept = await saveUpload({ userDir: user.dir, bytes, filename: file.name, kind: "pdf" })
      const info = await statPath(kept.abs)
      const entry: ResumeFile = {
        id: fileId(kept.abs), filename: kept.name, filepath: kept.abs, category: kept.folder, kind: "pdf",
        size: info ? formatSize(info.size) : formatSize(bytes.length), uploadedAt: (info?.mtime ?? new Date()).toISOString(),
      }
      // `read` is false when no words could be read from it (a scan): it was filed by its name alone.
      return NextResponse.json({ file: entry, pdf: true, read: kept.read, already: kept.existed })
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Upload a Word file (.docx), a PDF, or a .zip of them." }, { status: 400 })
    }

    // No resume-count limit — unlimited storage (personal use).
    const existing = await scanDir(user.dir)
    const buffer = Buffer.from(await file.arrayBuffer())
    const plain = await extractText(buffer)
    const emails = resumeEmails(plain)
    const identity = emails.length === 1 ? emails[0] : null
    let duplicate: ResumeFile | undefined
    if (identity) {
      for (const candidate of existing.filter(r => r.filename.replace(/__[a-f0-9]{16}$/, "").toLowerCase() === file.name.replace(/\.docx$/i, "").toLowerCase())) {
        const bytes = await readPath(candidate.filepath)
        if (!bytes) continue
        const contacts = resumeEmails(await extractText(bytes))
        if (contacts.length === 1 && contacts[0] === identity) { duplicate = candidate; break }
      }
    }
    const replace = formData.get("replace") === "true"

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
    const category = rankResumeCategories(plain, safeName)[0]
    const folderName = path.join(identity || "Needs email review", category.score ? category.category : "General Security")
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16)
    const savePath = path.resolve(user.dir, folderName, `${safeName.replace(/\.docx$/i, "")}__${hash}.docx`)
    if (!savePath.startsWith(path.resolve(user.dir) + path.sep)) return NextResponse.json({ error: "Invalid filename." }, { status: 400 })
    await writePath(savePath, buffer)

    const info = await statPath(savePath)
    const entry: ResumeFile = {
      id: fileId(savePath),
      filename: safeName.replace(/\.docx$/i, ""),
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
