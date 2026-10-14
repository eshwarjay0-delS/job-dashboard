// What Files and My Resume list: every resume in a person's folder, and every folder, from ONE listing of storage
// (R2 has no real directories, so a folder is any part of a file's path; `.keep` markers keep an empty folder shown).
// One scanner for both pages, so the two can never list the same library two ways. Sizes and dates come with the
// listing: the pages used to ask storage for them one file at a time, which made both pages slow (14 Oct 2026).
import path from "path"
import { listFilesInfo } from "@/lib/storage"
import { LIBRARY_FILE } from "@/lib/resume-library-store"

export interface LibraryFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
  /** A Word file can be tailored; a PDF is kept and can be downloaded (13 Oct 2026: "take PDFs ... as well"). */
  kind: "docx" | "pdf"
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Two independent hashes + path length → a 64-bit-ish id. A single 32-bit FNV collided across large nested libraries,
// producing duplicate React keys AND double-selection (two files sharing an id both looked selected).
export function fileId(fullPath: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < fullPath.length; i++) {
    const c = fullPath.charCodeAt(i)
    h1 ^= c; h1 = Math.imul(h1, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x85ebca77)
  }
  return "f_" + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + fullPath.length.toString(36)
}

export async function scanLibrary(dir: string): Promise<{ files: LibraryFile[]; folders: string[] }> {
  const all = await listFilesInfo(dir, { includeHidden: true })
  const files: LibraryFile[] = []
  const folders = new Set<string>()
  for (const { path: full, size, mtime } of all) {
    const parts = path.relative(dir, full).split(path.sep)
    // A folder's own record is kept out of sight, and a folder that holds nothing but its record is not shown at all
    // (found live on 13 Oct 2026: two email titles with 0 files, each holding only what a removed resume had taught).
    if (parts[parts.length - 1] === LIBRARY_FILE) continue
    // Every ancestor directory of this key is a folder.
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join(" / "))
    const base = parts[parts.length - 1]
    if (base === "_keywords.json" || base.startsWith(".")) continue
    const kind = base.toLowerCase().endsWith(".docx") ? "docx" : base.toLowerCase().endsWith(".pdf") ? "pdf" : null
    if (!kind) continue
    files.push({
      id: fileId(full),
      filename: base.replace(/\.(docx|pdf)$/i, ""),
      filepath: full,
      kind,
      category: parts.length > 1 ? parts.slice(0, -1).join(" / ") : "General",
      size: formatSize(size),
      uploadedAt: (mtime.getTime() ? mtime : new Date()).toISOString(),
    })
  }
  return { files, folders: [...folders] }
}
