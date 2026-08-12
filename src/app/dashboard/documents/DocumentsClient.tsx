"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDialogs } from "@/components/ui/dialog-provider"

// Resume-library entry shape. This view was folded into the resume hub, so its
// sibling ./page is now a redirect and no longer exports this type — keep it local.
interface ResumeFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function CloudIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 11.095"/>
    </svg>
  )
}
function SpinIcon() {
  return <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
}

// ── Tree components ────────────────────────────────────────────────────────────
interface TreeNode { name: string; folders: Map<string, TreeNode>; files: ResumeFile[] }

function ensurePath(root: TreeNode, parts: string[]): TreeNode {
  let node = root
  for (const p of parts) {
    let child = node.folders.get(p)
    if (!child) { child = { name: p, folders: new Map(), files: [] }; node.folders.set(p, child) }
    node = child
  }
  return node
}

function buildTree(files: ResumeFile[], folders: string[]): TreeNode {
  const root: TreeNode = { name: "", folders: new Map(), files: [] }
  for (const f of folders) ensurePath(root, f.split("/").map(s => s.trim()).filter(Boolean))
  for (const f of files) ensurePath(root, (f.category || "General").split("/").map(s => s.trim()).filter(Boolean)).files.push(f)
  return root
}

function countFiles(n: TreeNode): number {
  let c = n.files.length; n.folders.forEach(f => { c += countFiles(f) }); return c
}

function Chevron({ open }: { open: boolean }) {
  return <svg className="w-3 h-3 transition-transform" style={{ transform: open ? "rotate(90deg)" : "" }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
}
function FolderIcon() {
  return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: "#f59e0b" }}><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" /></svg>
}
function FileIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" style={{ color: "var(--accent)" }}><path strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path strokeLinejoin="round" d="M14 2v6h6" /></svg>
}

interface TreeCtx {
  checked: Set<string>
  onToggle: (key: string) => void
}

function CheckBox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onToggle() }}
      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all"
      style={{ borderColor: checked ? "var(--accent)" : "var(--border)", background: checked ? "var(--accent)" : "var(--surface)" }}>
      {checked && <svg className="w-2.5 h-2.5" fill="none" stroke="#fff" strokeWidth={3.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
    </button>
  )
}

function FileRow({ file, depth, ctx }: { file: ResumeFile; depth: number; ctx: TreeCtx }) {
  const key = "f:" + file.filepath
  const on = ctx.checked.has(key)
  const fmt = new Date(file.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return (
    <div className="flex items-center gap-2.5 rounded-lg py-2 pr-2 transition-colors"
      style={{ paddingLeft: 8 + depth * 16, background: on ? "var(--accent-soft)" : undefined }}>
      <CheckBox checked={on} onToggle={() => ctx.onToggle(key)} />
      <FileIcon />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{file.filename}</p>
        <p className="text-xs" style={{ color: "var(--text-soft)" }}>{file.category} · {file.size} · {fmt}</p>
      </div>
      <a
        href={`/api/resumes/download?filepath=${encodeURIComponent(file.filepath)}&name=${encodeURIComponent(file.filename)}`}
        download
        onClick={e => e.stopPropagation()}
        className="text-xs px-2 py-1 rounded-lg border transition-colors"
        style={{ color: "var(--accent-txt)", borderColor: "var(--border)", background: "var(--surface)" }}
      >
        ↓
      </a>
    </div>
  )
}

function FolderRow({ node, depth, relpath, ctx }: { node: TreeNode; depth: number; relpath: string; ctx: TreeCtx }) {
  const [open, setOpen] = useState(true)
  const key = "d:" + relpath
  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-lg py-2 pr-2 transition-colors hover:bg-gray-50"
        style={{ paddingLeft: 8 + depth * 16 }}>
        <CheckBox checked={ctx.checked.has(key)} onToggle={() => ctx.onToggle(key)} />
        <button onClick={() => setOpen(o => !o)} className="flex flex-1 items-center gap-2 min-w-0 text-left">
          <span style={{ color: "var(--text-soft)" }}><Chevron open={open} /></span>
          <FolderIcon />
          <span className="flex-1 truncate text-sm font-semibold" style={{ color: "var(--text)" }}>{node.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-soft)" }}>
            {countFiles(node)}
          </span>
        </button>
      </div>
      {open && (
        <div>
          {[...node.folders.values()].map(c => <FolderRow key={c.name} node={c} depth={depth + 1} relpath={`${relpath}/${c.name}`} ctx={ctx} />)}
          {node.files.map(f => <FileRow key={f.id} file={f} depth={depth + 1} ctx={ctx} />)}
        </div>
      )}
    </div>
  )
}

function LibraryTree({ files, folders, checked, onToggle }: { files: ResumeFile[]; folders: string[]; checked: Set<string>; onToggle: (k: string) => void }) {
  const root = buildTree(files, folders)
  const ctx: TreeCtx = { checked, onToggle }
  if (files.length === 0 && folders.length === 0) return null
  return (
    <div className="space-y-0.5">
      {[...root.folders.values()].map(c => <FolderRow key={c.name} node={c} depth={0} relpath={c.name} ctx={ctx} />)}
      {root.files.map(f => <FileRow key={f.id} file={f} depth={0} ctx={ctx} />)}
    </div>
  )
}

// ── Upload entry ───────────────────────────────────────────────────────────────
interface UploadedEntry {
  file: ResumeFile
  status: "scanning" | "ready" | "error"
  errorMsg?: string
}

// ── Main component ─────────────────────────────────────────────────────────────
// `onDone` is optional: when this is embedded as a tab inside the Resume hub
// (its only caller today), it switches tabs in-place instead of a full page
// navigation. Falls back to a real link to /dashboard/resume if ever rendered
// standalone again.
export default function DocumentsClient({ initialFiles, initialFolders = [], onDone }: { initialFiles: ResumeFile[]; initialFolders?: string[]; onDone?: () => void }) {
  const router = useRouter()
  const { confirm, prompt } = useDialogs()
  const [preloaded, setPreloaded] = useState<ResumeFile[]>(initialFiles)
  useEffect(() => { setPreloaded(initialFiles) }, [initialFiles])

  const [uploaded, setUploaded] = useState<UploadedEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [err, setErr] = useState("")
  const [notice, setNotice] = useState("")

  function toggleCheck(key: string) {
    setChecked(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }

  const allFiles: ResumeFile[] = [
    ...preloaded,
    ...uploaded.filter(u => u.status === "ready").map(u => u.file),
  ]

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function uploadZip(file: File) {
    const tempId = `zip_${Date.now()}`
    setUploaded(prev => [{ file: { id: tempId, filename: `${file.name} — extracting…`, filepath: "", category: "ZIP", size: `${(file.size / 1024).toFixed(0)} KB`, uploadedAt: new Date().toISOString() }, status: "scanning" }, ...prev])
    try {
      const fd = new FormData(); fd.append("file", file)
      const res = await fetch("/api/resumes", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      setUploaded(prev => prev.filter(u => u.file.id !== tempId))
      if (res.ok && data.zip) {
        setNotice(`Imported ${data.added} resume${data.added === 1 ? "" : "s"} from ${file.name}${data.skipped ? ` · skipped ${data.skipped} duplicate${data.skipped === 1 ? "" : "s"}` : ""}.`)
        router.refresh()
      } else {
        setErr(data.error ?? "Zip import failed.")
      }
    } catch (e) {
      setUploaded(prev => prev.filter(u => u.file.id !== tempId))
      setErr(`Zip error: ${String(e)}`)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const accepted = [...files].filter(f => /\.(docx|zip)$/i.test(f.name))
    if (!accepted.length) { setErr("Upload a .docx resume or a .zip of resumes."); return }
    setErr(""); setNotice("")

    for (const file of accepted) {
      if (/\.zip$/i.test(file.name)) { await uploadZip(file); continue }
      const tempId = `tmp_${Date.now()}_${Math.random()}`
      const tempEntry: UploadedEntry = {
        file: { id: tempId, filename: file.name.replace(/\.docx$/i, ""), filepath: "", category: "Uploaded", size: `${(file.size/1024).toFixed(0)} KB`, uploadedAt: new Date().toISOString() },
        status: "scanning",
      }
      setUploaded(prev => [tempEntry, ...prev])
      try {
        const fd = new FormData(); fd.append("file", file)
        const res = await fetch("/api/resumes", { method: "POST", body: fd })
        const data = await res.json()
        if (res.ok && data.duplicate) {
          const replace = await confirm(`"${data.file.filename}" is already in your library.\n\nReplace it with this version?`, { title: "File already exists", confirmLabel: "Replace" })
          if (replace) {
            const fd2 = new FormData(); fd2.append("file", file); fd2.append("replace", "true")
            const res2 = await fetch("/api/resumes", { method: "POST", body: fd2 })
            const data2 = await res2.json().catch(() => ({}))
            if (res2.ok && data2.file) {
              setUploaded(prev => prev.map(u => u.file.id === tempId ? { file: data2.file, status: "ready" } : u))
              router.refresh()
            } else {
              setUploaded(prev => prev.map(u => u.file.id === tempId ? { ...u, status: "error", errorMsg: data2.error ?? "Replace failed" } : u))
              setErr(data2.error ?? "Replace failed")
            }
          } else {
            setUploaded(prev => prev.map(u => u.file.id === tempId ? { file: data.file, status: "ready" } : u))
          }
        } else if (res.ok && data.file) {
          setUploaded(prev => prev.map(u => u.file.id === tempId ? { file: data.file, status: "ready" } : u))
          router.refresh()
        } else {
          setUploaded(prev => prev.map(u => u.file.id === tempId ? { ...u, status: "error", errorMsg: data.error ?? `HTTP ${res.status}` } : u))
          setErr(data.error ?? `Upload failed (HTTP ${res.status})`)
        }
      } catch (e) {
        setUploaded(prev => prev.map(u => u.file.id === tempId ? { ...u, status: "error", errorMsg: String(e) } : u))
        setErr(`Network error: ${String(e)}`)
      }
    }
  }

  // ── Delete / Move / Folder ─────────────────────────────────────────────────
  async function deleteChecked() {
    if (!checked.size) return
    const files = [...checked].filter(k => k.startsWith("f:")).map(k => k.slice(2))
    const folders = [...checked].filter(k => k.startsWith("d:")).map(k => k.slice(2))
    if (!files.length && !folders.length) { setChecked(new Set()); return }
    const label = [
      files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "",
      folders.length ? `${folders.length} folder${folders.length > 1 ? "s" : ""}` : "",
    ].filter(Boolean).join(" and ")
    if (!await confirm(`Delete ${label}? Folders are removed with everything inside them. This cannot be undone.`, { title: "Delete", confirmLabel: "Delete", destructive: true })) return
    try {
      const res = await fetch("/api/resumes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, folders }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(d.error ?? `Delete failed (HTTP ${res.status})`); return }
      setChecked(new Set())
      setNotice(`Deleted ${d.deleted ?? label}.`)
      router.refresh()
    } catch (e) { setErr(`Delete failed: ${String(e)}`) }
  }

  async function moveChecked() {
    if (!checked.size) return
    const filePaths = [...checked].filter(k => k.startsWith("f:")).map(k => k.slice(2))
    if (!filePaths.length) return
    const dest = await prompt("Move to folder (leave blank for root):", { title: "Move files", placeholder: "Folder name" })
    if (dest === null) return
    try {
      await Promise.all(filePaths.map(fp =>
        fetch("/api/resumes/move", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filepath: fp, targetFolder: dest.trim() }) })
      ))
      setChecked(new Set())
      router.refresh()
    } catch (e) { setErr(`Move failed: ${String(e)}`) }
  }

  async function createFolder() {
    const name = await prompt("New folder name:", { title: "New folder", placeholder: "Folder name" })
    if (!name?.trim()) return
    try {
      await fetch("/api/resumes/folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) })
      router.refresh()
    } catch (e) { setErr(`Folder error: ${String(e)}`) }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }} className="space-y-5">

      {/* Header */}
      <div className="anim-fade-up d-0 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Documents</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-soft)" }}>
            {allFiles.length > 0
              ? `${allFiles.length} resume${allFiles.length !== 1 ? "s" : ""} in library · Available for AI tailoring`
              : "Upload your resumes here — then tailor them to any job in seconds"}
          </p>
        </div>
        {onDone ? (
          <button onClick={onDone}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
            Tailor a Resume
          </button>
        ) : (
          <a href="/dashboard/resume"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ background: "var(--accent)", color: "#fff", textDecoration: "none" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
            Tailor a Resume
          </a>
        )}
      </div>

      {/* Upload zone */}
      <div className="anim-fade-up d-1">
        <label
          htmlFor="doc-upload"
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer select-none transition-all"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--border)",
            background: dragging ? "var(--accent-soft)" : "var(--surface)",
          }}
        >
          <input
            id="doc-upload"
            type="file"
            accept=".docx,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip"
            multiple
            className="sr-only"
            onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
          />
          <span style={{ color: dragging ? "var(--accent)" : "var(--text-soft)" }}>
            <CloudIcon />
          </span>
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--text)" }}>
              {dragging ? "Drop to upload" : "Drag & drop your resumes"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-soft)" }}>
              .docx files or a .zip bundle — folders are auto-extracted
            </p>
          </div>
          <span className="text-sm px-4 py-2 rounded-xl border font-semibold transition-colors"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}>
            Browse files
          </span>
        </label>
      </div>

      {/* Status messages */}
      {err && (
        <p className="text-sm rounded-xl px-4 py-2.5" style={{ color: "#dc2626", background: "rgba(220,38,38,0.08)" }}>
          ✗ {err}
        </p>
      )}
      {notice && (
        <p className="text-sm rounded-xl px-4 py-2.5" style={{ color: "var(--success)", background: "var(--success-soft)" }}>
          ✓ {notice}
        </p>
      )}

      {/* In-progress uploads */}
      {uploaded.filter(u => u.status !== "ready").length > 0 && (
        <div className="rounded-2xl border overflow-hidden anim-fade-up" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {uploaded.filter(u => u.status !== "ready").map(u => {
            const statusStyle = u.status === "scanning"
              ? { bg: "rgba(217,119,6,0.12)", color: "#d97706" }
              : { bg: "rgba(220,38,38,0.12)", color: "#dc2626" }
            return (
              <div key={u.file.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: statusStyle.bg, color: statusStyle.color }}>
                  {u.status === "scanning" ? <SpinIcon /> : <span className="text-[10px]">✗</span>}
                </div>
                <p className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text)" }}>{u.file.filename}</p>
                <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                  {u.status === "scanning" ? "Uploading…" : (u.errorMsg ?? "Error")}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Library */}
      {(allFiles.length > 0 || initialFolders.length > 0) && (
        <div className="rounded-2xl border overflow-hidden anim-fade-up d-2" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {/* Library toolbar */}
          <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
              Resume Library · {allFiles.length} file{allFiles.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1.5">
              {checked.size > 0 && (
                <>
                  <button onClick={moveChecked}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-txt)" }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path strokeLinecap="round" strokeLinejoin="round" d="M11 14h4m0 0l-2-2m2 2l-2 2" /></svg>
                    Move
                  </button>
                  <button onClick={deleteChecked}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete ({checked.size})
                  </button>
                </>
              )}
              <button onClick={createFolder}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{ color: "var(--text-soft)", background: "var(--surface)" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM12 11v4M10 13h4" /></svg>
                New Folder
              </button>
              <button onClick={() => router.refresh()} title="Refresh"
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: "var(--text-soft)", background: "var(--surface)" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>
          </div>

          {/* Tree */}
          <div className="p-3">
            <LibraryTree
              files={allFiles}
              folders={initialFolders}
              checked={checked}
              onToggle={toggleCheck}
            />
          </div>
        </div>
      )}

      {/* Empty state (no files at all) */}
      {allFiles.length === 0 && initialFolders.length === 0 && uploaded.filter(u => u.status === "scanning").length === 0 && (
        <div className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-16 text-center anim-fade-up d-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent-soft)" }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "var(--accent-txt)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--text)" }}>No resumes yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-soft)" }}>Drop a .docx or .zip above to get started</p>
          </div>
        </div>
      )}
    </div>
  )
}
