"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDialogs } from "@/components/ui/dialog-provider"
import FolderBrowser from "@/components/FolderBrowser"

// Resume-library entry shape. This view was folded into the resume hub, so its
// sibling ./page is now a redirect and no longer exports this type — keep it local.
interface ResumeFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
  /** A PDF is kept and can be downloaded; only a Word file can be tailored. */
  kind?: "docx" | "pdf"
}


function SpinIcon() {
  return <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
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
  const [organizing, setOrganizing] = useState(false)
  const [preloaded, setPreloaded] = useState<ResumeFile[]>(initialFiles)
  useEffect(() => { setPreloaded(initialFiles) }, [initialFiles])

  const [uploaded, setUploaded] = useState<UploadedEntry[]>([])

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

  async function organizeLibrary() {
    setOrganizing(true)
    setErr("")
    try {
      const response = await fetch("/api/resumes/organize", { method: "POST" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Organization failed")
      setNotice(`Organized ${result.kept} resumes into ${result.foldersPerEmail} folders per email. Removed ${result.removed} duplicate or lower matching versions.${result.unassigned ? ` ${result.unassigned} need an email review.` : ""}`)
      setUploaded([])
      setChecked(new Set())
      router.refresh()
    } catch (error) { setErr(error instanceof Error ? error.message : "Organization failed") }
    finally { setOrganizing(false) }
  }
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
        await organizeLibrary()
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
    const accepted = [...files].filter(f => /\.(docx|pdf|zip)$/i.test(f.name))
    if (!accepted.length) { setErr("Add a Word file (.docx), a PDF, or a .zip of them."); return }
    setErr(""); setNotice("")

    for (const file of accepted) {
      if (/\.zip$/i.test(file.name)) { await uploadZip(file); continue }
      const tempId = `tmp_${Date.now()}_${Math.random()}`
      const tempEntry: UploadedEntry = {
        file: { id: tempId, filename: file.name.replace(/\.(docx|pdf)$/i, ""), filepath: "", category: "Uploaded", size: `${(file.size/1024).toFixed(0)} KB`, uploadedAt: new Date().toISOString(), kind: /\.pdf$/i.test(file.name) ? "pdf" : "docx" },
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
          // A PDF: the PDF itself is listed, and so is the Word copy made from its words when they could be read.
          const added: UploadedEntry[] = data.pdf && data.converted && data.pdfFile ? [{ file: data.pdfFile, status: "ready" }, { file: data.file, status: "ready" }] : [{ file: data.file, status: "ready" }]
          setUploaded(prev => prev.flatMap(u => (u.file.id === tempId ? added : [u])))
          if (data.pdf) setNotice(data.converted ? "Your PDF is kept, and a Word copy was made from its words so it can be tailored: same words, a plain layout." : "Your PDF is kept. Its words could not be read (it may be a scan), so it cannot be tailored; add a Word file for that.")
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

  // The window is the page: Back, Forward, Up and an address bar, the folders on the left, the resumes on the right, and
  // what can be done here in the command bar above it (owner, 20 Oct 2026: "more of how our folders system is designed in windows").
  const hasAny = allFiles.length > 0 || initialFolders.length > 0
  return (
    <div className="space-y-4">
      <input id="doc-upload" type="file" multiple className="sr-only" aria-label="Add resume files"
        accept=".docx,.pdf,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/zip"
        onChange={e => { handleFiles(e.target.files); e.target.value = "" }} />

      {onDone && (
        <div className="flex justify-end">
          <button type="button" onClick={onDone} className="btn-outline" style={{ minHeight: 44, padding: "0 18px", fontSize: 15 }}>Back to tailoring</button>
        </div>
      )}

      {err && <p className="text-sm rounded-xl px-4 py-2.5" role="alert" style={{ color: "var(--text)", background: "var(--danger-soft)" }}>{err}</p>}
      {notice && <p className="text-sm rounded-xl px-4 py-2.5" role="status" style={{ color: "var(--success)", background: "var(--success-soft)" }}>{notice}</p>}

      {/* Uploads in progress */}
      {uploaded.filter(u => u.status !== "ready").length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {uploaded.filter(u => u.status !== "ready").map(u => (
            <div key={u.file.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                {u.status === "scanning" ? <SpinIcon /> : <span className="text-[10px]">✗</span>}
              </div>
              <p className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text)" }}>{u.file.filename}</p>
              <span className="text-xs" style={{ color: "var(--text-soft)" }}>{u.status === "scanning" ? "Uploading…" : (u.errorMsg ?? "Error")}</span>
            </div>
          ))}
        </div>
      )}

      <FolderBrowser
        files={allFiles}
        folders={initialFolders}
        mode="browse"
        checked={checked}
        onToggle={toggleCheck}
        onDropFiles={handleFiles}
        empty={hasAny ? undefined : (
          <div className="space-y-2">
            <p style={{ fontSize: 15, color: "var(--text)", margin: 0, fontWeight: 600 }}>No resume files yet.</p>
            <p style={{ margin: 0 }}>Drop Word files, PDFs or a .zip with folders inside here, or press Add a resume file at the top. A PDF is kept as it is, and a Word copy is made from its words so it can be tailored.</p>
          </div>
        )}
        toolbar={
          <>
            <button type="button" className="btn-outline" onClick={createFolder}>New folder</button>
            {allFiles.length > 0 && (
              <button type="button" className="btn-outline" onClick={organizeLibrary} disabled={organizing}
                title="Puts each resume under the email written in it, in folders by kind of job, and removes copies.">
                {organizing ? "Organizing…" : "Organize by email"}
              </button>
            )}
            {checked.size > 0 && (
              <>
                <button type="button" className="btn-outline" onClick={moveChecked}>Move</button>
                <button type="button" className="btn-outline" onClick={deleteChecked} style={{ color: "var(--danger)" }}>Delete ({checked.size})</button>
              </>
            )}
            <button type="button" className="btn-ghost" onClick={() => router.refresh()} style={{ marginLeft: "auto" }}>Refresh</button>
          </>
        }
      />
    </div>
  )
}
