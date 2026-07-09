// Standalone Documents page — real resume/file manager (upload, folders,
// move/delete, ZIP import). Was previously a redirect into the My Resume hub's
// Documents tab; now a real page at its own URL, scanning the SAME on-disk
// resume folder and rendering the SAME DocumentsClient component the hub tab
// uses — so the two stay perfectly in sync (add a file here, it shows there).
import { readdir, stat, mkdir } from "fs/promises"
import path from "path"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { USER_RESUMES_DIR } from "@/lib/paths"
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

async function scanDir(dir: string, category = ""): Promise<ResumeFile[]> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
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
      return [{
        id: fileId(fullPath),
        filename: entry.name.replace(/\.docx$/i, ""),
        filepath: fullPath,
        category: category || "General",
        size: formatSize(info.size),
        uploadedAt: info.mtime.toISOString(),
      }]
    })
  return (await Promise.all(tasks)).flat()
}

async function listFolders(dir: string, base = ""): Promise<string[]> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const out: string[] = []
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue
    const rel = base ? `${base} / ${e.name}` : e.name
    out.push(rel)
    out.push(...await listFolders(path.join(dir, e.name), rel))
  }
  return out
}

export const dynamic = "force-dynamic"

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? "demo"

  const userDir = path.join(USER_RESUMES_DIR, userId)
  await mkdir(userDir, { recursive: true }).catch(() => {})

  const [files, folders] = await Promise.all([scanDir(userDir), listFolders(userDir)])

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
