// Standalone Documents page — real resume/file manager (upload, folders,
// move/delete, ZIP import). Was previously a redirect into the My Resume hub's
// Documents tab; now a real page at its own URL, scanning the SAME on-disk
// resume folder and rendering the SAME DocumentsClient component the hub tab
// uses — so the two stay perfectly in sync (add a file here, it shows there).
import path from "path"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { listFiles, statPath } from "@/lib/storage"
import DocumentsClient from "./DocumentsClient"

// Mirrors DocumentsClient's internal ResumeFile shape (it doesn't export the
// type). Structural typing lets these objects satisfy its prop.
type ResumeFile = {
  id: string; filename: string; filepath: string
  category: string; size: string; uploadedAt: string
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
    if (!base.toLowerCase().endsWith(".docx")) continue
    const info = await statPath(full)
    files.push({
      id: fileId(full),
      filename: base.replace(/\.docx$/i, ""),
      filepath: full,
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
  const { files, folders } = await scanLibrary(userDir)

  return (
    <div className="max-w-4xl mx-auto">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: "linear-gradient(135deg, var(--accent), var(--accent-h))",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff",
        }}>📁</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Documents</h1>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
            Upload, organize, and manage your resumes and cover letters. {files.length} file{files.length === 1 ? "" : "s"} stored.
          </p>
        </div>
        <Link href="/dashboard/resume" style={{
          fontSize: 12, color: "var(--accent-txt)", textDecoration: "none", fontWeight: 600,
          padding: "8px 14px", borderRadius: 9, background: "var(--accent-soft)",
          border: "1px solid var(--accent-border)", flexShrink: 0,
        }}>✦ Tailor a resume →</Link>
      </div>

      <DocumentsClient initialFiles={files} initialFolders={folders} />
    </div>
  )
}
