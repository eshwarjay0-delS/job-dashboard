"use client"

/**
 * Windows-Explorer-style folder navigation for resume files (owner, 20 Oct 2026):
 * top-level folders, click a folder to go INTO it, breadcrumb to get back — the same
 * navigation in My Files and when picking a resume in Apply.
 *
 * Files carry their folder in `category` ("email / kind of job"), split on "/".
 * mode "browse": checkboxes for bulk actions (keys "f:<filepath>", "d:<relpath>").
 * mode "pick": clicking a file selects it.
 */
import { useMemo, useState } from "react"

export interface FolderBrowserFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
  kind?: "docx" | "pdf"
}

interface TreeNode { name: string; folders: Map<string, TreeNode>; files: FolderBrowserFile[] }

function ensurePath(root: TreeNode, parts: string[]): TreeNode {
  let node = root
  for (const p of parts) {
    let child = node.folders.get(p)
    if (!child) { child = { name: p, folders: new Map(), files: [] }; node.folders.set(p, child) }
    node = child
  }
  return node
}

function buildTree(files: FolderBrowserFile[], folders: string[]): TreeNode {
  const root: TreeNode = { name: "", folders: new Map(), files: [] }
  for (const f of folders) ensurePath(root, f.split("/").map(s => s.trim()).filter(Boolean))
  for (const f of files) ensurePath(root, (f.category || "General").split("/").map(s => s.trim()).filter(Boolean)).files.push(f)
  return root
}

function countFiles(n: TreeNode): number {
  let c = n.files.length; n.folders.forEach(f => { c += countFiles(f) }); return c
}

const shownName = (name: string) => name.replace(/__[a-f0-9]{16}$/i, "")
const viewHref = (file: FolderBrowserFile) => file.kind === "pdf"
  ? `/api/resumes/download?filepath=${encodeURIComponent(file.filepath)}&name=${encodeURIComponent(shownName(file.filename))}&inline=1`
  : `/api/resumes/pdf?filepath=${encodeURIComponent(file.filepath)}&name=${encodeURIComponent(shownName(file.filename))}&autoprint=0`

function FolderIcon() {
  return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: "#e8b93e" }}><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" /></svg>
}
function FileIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" style={{ color: "var(--accent)" }}><path strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path strokeLinejoin="round" d="M14 2v6h6" /></svg>
}

export default function FolderBrowser(props: {
  files: FolderBrowserFile[]
  folders?: string[]
  mode: "browse" | "pick"
  selectedPath?: string
  onPick?: (f: FolderBrowserFile) => void
  checked?: Set<string>
  onToggle?: (key: string) => void
}) {
  const { files, folders = [], mode, selectedPath, onPick, checked, onToggle } = props
  const root = useMemo(() => buildTree(files, folders), [files, folders])
  const [path, setPath] = useState<string[]>([])

  // If the current path no longer exists (files changed), fall back to root.
  let node = root
  const validPath: string[] = []
  for (const seg of path) {
    const next = node.folders.get(seg)
    if (!next) break
    node = next; validPath.push(seg)
  }
  const atRoot = validPath.length === 0
  const childFolders = [...node.folders.values()]
  const childFiles = node.files

  const check = (key: string) => {
    if (mode !== "browse" || !onToggle) return null
    const on = !!checked?.has(key)
    return (
      <button type="button" aria-label="Select" onClick={e => { e.stopPropagation(); onToggle(key) }}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all"
        style={{ borderColor: on ? "var(--accent)" : "var(--border)", background: on ? "var(--accent)" : "var(--surface)" }}>
        {on && <svg className="w-2.5 h-2.5" fill="none" stroke="#fff" strokeWidth={3.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </button>
    )
  }

  return (
    <div>
      {/* Breadcrumb — the Explorer address bar */}
      <div className="flex items-center gap-1 flex-wrap rounded-lg px-2 py-1.5 mb-2" style={{ background: "var(--surface-2)" }}>
        <button type="button" onClick={() => setPath([])}
          className="text-sm font-semibold px-1.5 py-0.5 rounded"
          style={{ color: atRoot ? "var(--accent-txt)" : "var(--text)" }}>📁 Files</button>
        {validPath.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <span style={{ color: "var(--text-soft)" }}>›</span>
            <button type="button" onClick={() => setPath(validPath.slice(0, i + 1))}
              className="text-sm font-semibold px-1.5 py-0.5 rounded"
              style={{ color: i === validPath.length - 1 ? "var(--accent-txt)" : "var(--text)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seg}</button>
          </span>
        ))}
        {!atRoot && (
          <button type="button" onClick={() => setPath(validPath.slice(0, -1))}
            className="text-xs px-2 py-0.5 rounded-full ml-1"
            style={{ background: "var(--surface)", color: "var(--text-soft)", border: "1px solid var(--border)" }}>⬆ Up</button>
        )}
      </div>

      {childFolders.length === 0 && childFiles.length === 0 && (
        <p className="text-sm px-2 py-3" style={{ color: "var(--text-soft)" }}>This folder is empty.</p>
      )}

      <div className="space-y-0.5">
        {childFolders.map(f => {
          const rel = [...validPath, f.name].join("/")
          return (
            <div key={f.name} className="flex items-center gap-2.5 rounded-lg py-2 px-2 transition-colors hover:bg-gray-50">
              {check("d:" + rel)}
              <button type="button" onClick={() => setPath([...validPath, f.name])} className="flex flex-1 items-center gap-2.5 min-w-0 text-left">
                <FolderIcon />
                <span className="flex-1 truncate text-sm font-semibold" style={{ color: "var(--text)" }}>{f.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-soft)" }}>{countFiles(f)}</span>
                <span style={{ color: "var(--text-soft)" }}>›</span>
              </button>
            </div>
          )
        })}
        {childFiles.map(f => {
          const fmt = new Date(f.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          const picked = mode === "pick" && selectedPath === f.filepath
          return (
            <div key={f.id}
              className="flex items-center gap-2.5 rounded-lg py-2 px-2 transition-colors"
              style={{ background: picked ? "var(--accent-soft)" : undefined, cursor: mode === "pick" ? "pointer" : undefined }}
              onClick={mode === "pick" ? () => onPick?.(f) : undefined}>
              {check("f:" + f.filepath)}
              <FileIcon />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{shownName(f.filename)}{picked ? " ✓" : ""}</p>
                <p className="text-xs" style={{ color: "var(--text-soft)" }}>{f.kind === "pdf" ? "PDF · " : ""}{f.size} · {fmt}</p>
              </div>
              {mode === "browse" && f.filepath && (
                <>
                  <a href={viewHref(f)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Look at this resume"
                    className="text-xs px-2 py-1 rounded-lg border" style={{ color: "var(--text)", borderColor: "var(--border)", background: "var(--surface)", textDecoration: "none", fontWeight: 600 }}>View</a>
                  <a href={`/api/resumes/download?filepath=${encodeURIComponent(f.filepath)}&name=${encodeURIComponent(shownName(f.filename))}`}
                    download onClick={e => e.stopPropagation()}
                    className="text-xs px-2 py-1 rounded-lg border transition-colors"
                    style={{ color: "var(--accent-txt)", borderColor: "var(--border)", background: "var(--surface)" }}>↓</a>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
