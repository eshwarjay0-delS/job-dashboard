// Standalone Documents page — real resume/file manager (upload, folders,
// move/delete, ZIP import). Was previously a redirect into the My Resume hub's
// Documents tab; now a real page at its own URL, scanning the SAME on-disk
// resume folder and rendering the SAME DocumentsClient component the hub tab
// uses — so the two stay perfectly in sync (add a file here, it shows there).
import path from "path"
import { createClient } from "@/lib/supabase/server"
import PageIntro from "../_components/page-intro"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { listFiles, statPath } from "@/lib/storage"
import { mendLibrary } from "@/lib/resume-library-store"
import DocumentsClient from "./DocumentsClient"

// Mirrors DocumentsClient's internal ResumeFile shape (it doesn't export the
// type). Structural typing lets these objects satisfy its prop.
type ResumeFile = {
  id: string; filename: string; filepath: string
  category: string; size: string; uploadedAt: string
  /** A PDF is kept and can be downloaded; only a Word file can be tailored. */
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

// Files + folders derived from one recursive listing (R2-safe; empty folders kept
// visible via ".keep" markers). Mirrors scanLibrary in the resume hub page.
async function scanLibrary(dir: string): Promise<{ files: ResumeFile[]; folders: string[] }> {
  const all = await listFiles(dir, { includeHidden: true })
  const files: ResumeFile[] = []
  const folders = new Set<string>()
  for (const full of all) {
    const rel = path.relative(dir, full)
    const parts = rel.split(path.sep)
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join(" / "))
    const base = parts[parts.length - 1]
    if (base === "_keywords.json" || base.startsWith(".")) continue
    // Word resumes, and PDFs (13 Oct 2026: "for the files, take PDFs ... as well").
    const kind = base.toLowerCase().endsWith(".docx") ? "docx" : base.toLowerCase().endsWith(".pdf") ? "pdf" : null
    if (!kind) continue
    const info = await statPath(full)
    files.push({
      id: fileId(full),
      filename: base.replace(/\.(docx|pdf)$/i, ""),
      filepath: full,
      kind,
      category: parts.length > 1 ? parts.slice(0, -1).join(" / ") : "General",
      size: info ? formatSize(info.size) : "",
      uploadedAt: (info?.mtime ?? new Date()).toISOString(),
    })
  }
  return { files, folders: [...folders] }
}

export const dynamic = "force-dynamic"

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? "demo"

  const userDir = path.join(USER_RESUMES_DIR, userId)
  // A folder is named by the email and nothing else: one that was named with more ("x@gmail.comlinkedin") is put back
  // under the email before anything is listed (13 Oct 2026: "Both are same!!").
  await mendLibrary(userDir)
  const { files, folders } = await scanLibrary(userDir)

  return (
    <div style={{ maxWidth: 900 }}>
      <PageIntro page="/dashboard/documents" action={{ label: "Add a resume file", htmlFor: "doc-upload" }} />
      <DocumentsClient initialFiles={files} initialFolders={folders} />
    </div>
  )
}
