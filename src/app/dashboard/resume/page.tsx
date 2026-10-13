import path from "path"
import { createClient } from "@/lib/supabase/server"
import ResumeClient from "./ResumeClient"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { listFiles, statPath } from "@/lib/storage"
import { mendLibrary, LIBRARY_FILE } from "@/lib/resume-library-store"

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

// Two independent hashes + path length → a 64-bit-ish id. A single 32-bit FNV
// collided across large nested libraries, producing duplicate React keys AND
// double-selection (two files sharing an id both looked selected).
function fileId(fullPath: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < fullPath.length; i++) {
    const c = fullPath.charCodeAt(i)
    h1 ^= c; h1 = Math.imul(h1, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x85ebca77)
  }
  return "f_" + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + fullPath.length.toString(36)
}

// Files + folders, both derived from ONE recursive listing (R2-safe — object stores
// have no real directories). `.keep` markers (written by the New Folder action) keep
// empty folders visible; the "_keywords.json" index and dotfiles are excluded from files.
// `files` are the Word resumes, which can be fitted to a job. `pdfs` are kept and shown in My files only (13 Oct 2026).
async function scanLibrary(dir: string): Promise<{ files: ResumeFile[]; pdfs: (ResumeFile & { kind: "pdf" })[]; folders: string[] }> {
  const all = await listFiles(dir, { includeHidden: true })
  const files: ResumeFile[] = []
  const pdfs: (ResumeFile & { kind: "pdf" })[] = []
  const folders = new Set<string>()
  for (const full of all) {
    const rel = path.relative(dir, full)
    const parts = rel.split(path.sep)
    // Every ancestor directory of this key is a folder.
    // A folder's own record is kept out of sight, and a folder that holds nothing but its record is not shown at all
    // (found live on 13 Oct 2026: two email titles with 0 files, each holding only what a removed resume had taught).
    if (parts[parts.length - 1] === LIBRARY_FILE) continue
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join(" / "))
    const base = parts[parts.length - 1]
    if (base === "_keywords.json" || base.startsWith(".")) continue
    if (base.toLowerCase().endsWith(".pdf")) {
      const info = await statPath(full)
      pdfs.push({ id: fileId(full), filename: base.replace(/\.pdf$/i, ""), filepath: full, kind: "pdf", category: parts.length > 1 ? parts.slice(0, -1).join(" / ") : "General", size: info ? formatSize(info.size) : "", uploadedAt: (info?.mtime ?? new Date()).toISOString() })
      continue
    }
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
  return { files, pdfs, folders: [...folders] }
}

export const dynamic = "force-dynamic"

export default async function ResumePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Demo mode: show the page without auth (uses a shared demo folder)
  const userId = user?.id ?? "demo"

  const userDir = path.join(USER_RESUMES_DIR, userId)
  // A folder is named by the email and nothing else: one that was named with more ("x@gmail.comlinkedin") is put back
  // under the email before anything is listed (13 Oct 2026: "Both are same!!").
  await mendLibrary(userDir)
  const { files, pdfs, folders } = await scanLibrary(userDir)
  return <ResumeClient initialFiles={files} initialFolders={folders} otherFiles={pdfs} />
}
