"use client"

import { useState } from "react"
import type { ResumeFile } from "./page"

interface TreeNode { name: string; folders: Map<string, TreeNode>; files: ResumeFile[] }

function ensurePath(root: TreeNode, parts: string[]): TreeNode {
  let node = root
  for (const part of parts) {
    let child = node.folders.get(part)
    if (!child) { child = { name: part, folders: new Map(), files: [] }; node.folders.set(part, child) }
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
  let c = n.files.length
  n.folders.forEach(f => { c += countFiles(f) })
  return c
}

// Checked keys: a file is "f:<filepath>", a folder is "d:<relative path>".
interface Ctx {
  activeId: string | null
  onSelect: (f: ResumeFile) => void
  checked: Set<string>
  onToggle: (key: string) => void
}

function Chevron({ open }: { open: boolean }) {
  return <svg className="w-3 h-3 transition-transform" style={{ transform: open ? "rotate(90deg)" : "" }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
}
function FolderIcon() {
  return <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" /></svg>
}
function FileIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"
      style={{ color: active ? "var(--accent)" : "var(--border-strong)" }}>
      <path strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path strokeLinejoin="round" d="M14 2v6h6" />
    </svg>
  )
}
function Check({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={on ? "Deselect" : "Select"}
      style={{
        display: "flex", width: 16, height: 16, flexShrink: 0,
        alignItems: "center", justifyContent: "center",
        borderRadius: 4, border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
        background: on ? "var(--accent)" : "var(--surface)",
        transition: "all var(--t-fast)",
      }}
    >
      {on && <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={3.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
    </button>
  )
}

function FileRow({ file, depth, active, ctx }: { file: ResumeFile; depth: number; active: boolean; ctx: Ctx }) {
  const key = "f:" + file.filepath
  return (
    <div
      className="flex items-center gap-2 rounded-lg py-1.5 pr-2"
      style={{
        paddingLeft: 8 + depth * 16,
        background: active ? "var(--accent-soft)" : "transparent",
        border: `1px solid ${active ? "var(--accent-border)" : "transparent"}`,
        transition: "all var(--t-fast)",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)" }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      <Check on={ctx.checked.has(key)} onClick={() => ctx.onToggle(key)} />
      <div onClick={() => ctx.onSelect(file)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5" title="Click to use this resume for tailoring">
        <FileIcon active={active} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13,
          fontWeight: active ? 600 : 400, color: active ? "var(--accent-txt)" : "var(--text-muted)" }}>
          {file.filename}
        </span>
        {active && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", padding: "1px 6px",
            background: "var(--accent-soft)", borderRadius: 99, border: "1px solid var(--accent-border)" }}>
            active
          </span>
        )}
      </div>
    </div>
  )
}

function FolderRow({ node, depth, relpath, ctx }: { node: TreeNode; depth: number; relpath: string; ctx: Ctx }) {
  const [open, setOpen] = useState(true)
  const key = "d:" + relpath

  // Map top-level folder names to palette colors
  const FOLDER_COLORS: Record<string, string> = {
    C2C: "var(--cat-out)", GC: "var(--cat-int)", H1B: "var(--cat-fol)",
    CYBER: "var(--cat-ass)", AI: "var(--cat-out)", DevOps: "var(--cat-rtr)",
    FSD: "var(--cat-int)", Python: "var(--cat-ass)", GRC: "var(--cat-fol)",
    APPSEC: "var(--cat-reply)",
  }
  const folderColor = FOLDER_COLORS[node.name] ?? "var(--cat-rtr)"

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg py-1.5 pr-2"
        style={{ paddingLeft: 8 + depth * 16, transition: "background var(--t-fast)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
      >
        <Check on={ctx.checked.has(key)} onClick={() => ctx.onToggle(key)} />
        <button onClick={() => setOpen(o => !o)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span style={{ color: "var(--text-soft)" }}><Chevron open={open} /></span>
          <FolderIcon />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontSize: 13, fontWeight: 600, color: depth === 0 ? folderColor : "var(--text)" }}>
            {node.name}
          </span>
          <span style={{ borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 600,
            background: "var(--surface-2)", color: "var(--text-soft)",
            border: "1px solid var(--border)" }}>
            {countFiles(node)}
          </span>
        </button>
      </div>
      {open && (
        <div>
          {[...node.folders.values()].map(c => <FolderRow key={c.name} node={c} depth={depth + 1} relpath={`${relpath}/${c.name}`} ctx={ctx} />)}
          {node.files.map(f => <FileRow key={f.id} file={f} depth={depth + 1} active={ctx.activeId === f.id} ctx={ctx} />)}
        </div>
      )}
    </div>
  )
}

export default function LibraryTree({
  files, folders = [], activeId, onSelect, checked, onToggle,
}: {
  files: ResumeFile[]
  folders?: string[]
  activeId: string | null
  onSelect: (f: ResumeFile) => void
  checked: Set<string>
  onToggle: (key: string) => void
}) {
  const root = buildTree(files, folders)
  const ctx: Ctx = { activeId, onSelect, checked, onToggle }
  return (
    <div className="space-y-0.5">
      {[...root.folders.values()].map(c => <FolderRow key={c.name} node={c} depth={0} relpath={c.name} ctx={ctx} />)}
      {root.files.map(f => <FileRow key={f.id} file={f} depth={0} active={activeId === f.id} ctx={ctx} />)}
    </div>
  )
}
