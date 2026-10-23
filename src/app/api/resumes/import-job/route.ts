import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import path from "node:path"
import { createServiceClient } from "@/lib/supabase/service"
import { isAdminEmail } from "@/lib/owner"
import { writePath, readPath } from "@/lib/storage"
import { DATA_DIR, USER_RESUMES_DIR } from "@/lib/paths"
import { recoverLibraryResume } from "@/lib/resumeRecovery"
import { extractText } from "@/lib/docx"
import { extractKeywords } from "@/lib/keywords"
import { CATEGORY_FOLDERS, resumeEmails } from "@/lib/resumeOrganization"
import { importedOriginalFileName } from "@/lib/resume-library"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

// No caller-provided owner or files: a service-created job fixes both. Its random
// 256-bit capability expires and is atomically consumed before any storage write.
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  if (!token) return NextResponse.json({ error: "Import authorization required" }, { status: 401 })
  const db = createServiceClient()
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const { data: job, error } = await db.from("resume_import_jobs").update({ status: "running" })
    .eq("token_hash", tokenHash).eq("status", "pending").gt("expires_at", new Date().toISOString())
    .select("id,user_id,payload").maybeSingle()
  if (error || !job) return NextResponse.json({ error: "Invalid, expired, or consumed import" }, { status: 403 })
  try {
    const { data: account, error: accountError } = await db.auth.admin.getUserById(job.user_id)
    if (accountError || !isAdminEmail(account.user?.email)) throw new Error("Import owner is not a configured admin")
    if (!Array.isArray(job.payload) || job.payload.length > 100) throw new Error("Invalid import size")
    const files: { bytes: Buffer; text: string; email: string; category: string; filename: string; sha256: string }[] = []
    let total = 0
    for (const row of job.payload) {
      if (typeof row.base64 !== "string" || typeof row.filename !== "string" || !CATEGORY_FOLDERS.includes(row.category)) throw new Error("Invalid import record")
      const bytes = Buffer.from(row.base64, "base64")
      total += bytes.length
      if (!bytes.length || bytes.length > 5 * 1024 * 1024 || total > 50 * 1024 * 1024) throw new Error("Import exceeds size limit")
      const sha256 = createHash("sha256").update(bytes).digest("hex")
      if (sha256 !== row.sha256) throw new Error("Original file checksum mismatch")
      const text = await extractText(bytes)
      const emails = resumeEmails(text)
      if (emails.length !== 1 || emails[0] !== row.email) throw new Error("Contact email does not match document")
      if (!/^[^/\\]+\.docx$/i.test(row.filename)) throw new Error("Invalid filename")
      files.push({ bytes, text, email: row.email, category: row.category, filename: row.filename, sha256 })
    }
    const root = path.join(USER_RESUMES_DIR, job.user_id)
    const libraries = new Map<string, string>()
    const folders = new Map<string, string>()
    for (const email of new Set(files.map(f => f.email))) {
      const { data: lib, error: libError } = await db.from("resume_email_libraries")
        .upsert({ user_id: job.user_id, email }, { onConflict: "user_id,email" }).select("id").single()
      if (libError || !lib) throw libError || new Error("Library creation failed")
      libraries.set(email, lib.id)
      const { data: rows, error: folderError } = await db.from("resume_specializations")
        .upsert(CATEGORY_FOLDERS.map(name => ({ user_id: job.user_id, library_id: lib.id, name })), { onConflict: "library_id,name" }).select("id,name")
      if (folderError || !rows) throw folderError || new Error("Folder creation failed")
      for (const row of rows) {
        folders.set(email + "\0" + row.name, row.id)
        await writePath(path.join(root, email, row.name, ".keep"), "")
      }
    }
    const verified: { filename: string; email: string; category: string; sha256: string; bytes: number }[] = []
    for (const file of files) {
      // Preserve distinct originals that arrived with the same visible filename.
      // An identical retry resolves to the same path; different bytes never overwrite it.
      const filename = importedOriginalFileName(file.filename, file.sha256)
      const target = path.join(root, file.email, file.category, filename)
      await writePath(target, file.bytes)
      const saved = await readPath(target)
      if (!saved || createHash("sha256").update(saved).digest("hex") !== file.sha256) throw new Error("Production readback checksum mismatch")
      const { data: indexed, error: indexError } = await db.from("resume_documents").upsert({
        user_id: job.user_id, library_id: libraries.get(file.email), specialization_id: folders.get(file.email + "\0" + file.category),
        sha256: file.sha256, storage_path: path.relative(DATA_DIR, target).split(path.sep).join("/"), source: "library_import",
        keywords: extractKeywords(file.text), searchable_text: file.text.slice(0, 50000)
      }, { onConflict: "user_id,sha256" }).select("id").single()
      if (indexError || !indexed) throw indexError || new Error("Document indexing failed")
      const recovered = await recoverLibraryResume(job.user_id, indexed.id)
      if (!recovered?.bytes.equals(file.bytes)) throw new Error("Original resume recovery failed")
      verified.push({ filename, email: file.email, category: file.category, sha256: file.sha256, bytes: file.bytes.length })
    }
    const result = { verified, emailLibraries: libraries.size, foldersPerEmail: CATEGORY_FOLDERS.length }
    const { error: doneError } = await db.from("resume_import_jobs").update({ status: "completed", payload: [], result }).eq("id", job.id)
    if (doneError) throw doneError
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[resume-import]", error)
    await db.from("resume_import_jobs").update({ status: "failed", result: { error: error instanceof Error ? error.message : String(error) } }).eq("id", job.id)
    return NextResponse.json({ error: "Import failed; completed original files remain intact. Inspect the import job before retrying." }, { status: 500 })
  }
}
