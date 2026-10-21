"use client"

/**
 * The resume library as a Windows folder window (owner, 20 Oct 2026: "the My files section should be more of how our
 * folders system is designed in windows, the same type of navigation. Top level. And folders. The same when selecting the
 * resume in the apply section"). Back, Forward and Up buttons, an address bar of clickable folder names, a folder pane
 * on the left, and a details list (Name, Date modified, Type, Size) on the right; folders open on double click (one tap on
 * a phone) and Backspace goes up. The top level is each email, then its kind-of-job folders, then the resumes.
 *
 * Files carry their folder in `category` ("email / kind of job"), split on "/".
 * mode "browse": a checkbox on each row for bulk actions (keys "f:<filepath>", "d:<relpath>"), View and Download.
 * mode "pick": a click chooses a resume (Apply); the window opens at the folder of the one chosen.
 * `compact`: no folder pane (Apply, where room is short).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import "./folder-browser.css"

export interface FolderBrowserFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
  kind?: "docx" | "pdf"
}

type Node = { name: string; path: string[]; folders: Map<string, Node>; files: FolderBrowserFile[] }
type Row = { key: string; kind: "folder" | "file"; name: string; node?: Node; file?: FolderBrowserFile; at: number; bytes: number; type: string; where?: string }
type SortKey = "name" | "date" | "type" | "size"

const segments = (category: string): string[] => (category || "General").split("/").map(s => s.trim()).filter(Boolean)

function ensurePath(root: Node, parts: string[]): Node {
  let node = root
  for (const p of parts) {
    let child = node.folders.get(p)
    if (!child) { child = { name: p, path: [...node.path, p], folders: new Map(), files: [] }; node.folders.set(p, child) }
    node = child
  }
  return node
}

function buildTree(files: FolderBrowserFile[], folders: string[]): Node {
  const root: Node = { name: "", path: [], folders: new Map(), files: [] }
  for (const f of folders) ensurePath(root, f.split("/").map(s => s.trim()).filter(Boolean))
  for (const f of files) ensurePath(root, segments(f.category)).files.push(f)
  return root
}

const countFiles = (n: Node): number => { let c = n.files.length; n.folders.forEach(f => { c += countFiles(f) }); return c }
const newest = (n: Node): number => { let t = 0; n.files.forEach(f => { t = Math.max(t, Date.parse(f.uploadedAt) || 0) }); n.folders.forEach(f => { t = Math.max(t, newest(f)) }); return t }
const filesUnder = (n: Node): FolderBrowserFile[] => [...n.files, ...[...n.folders.values()].flatMap(filesUnder)]

const shownName = (name: string) => name.replace(/__[a-f0-9]{16}$/i, "").replace(/\s*\(tailored\)$/i, "")
const madeForJob = (name: string) => /\(tailored\)(?:__[a-f0-9]{16})?$/i.test(name)
const viewHref = (file: FolderBrowserFile) => file.kind === "pdf"
  ? `/api/resumes/download?filepath=${encodeURIComponent(file.filepath)}&name=${encodeURIComponent(shownName(file.filename))}&inline=1`
  : `/api/resumes/pdf?filepath=${encodeURIComponent(file.filepath)}&name=${encodeURIComponent(shownName(file.filename))}&autoprint=0`
const when = (t: number) => (t ? new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "")
/** "32.5 KB" as a number of bytes, to sort by. */
const bytesOf = (size: string): number => {
  const m = String(size || "").match(/([\d.]+)\s*(B|KB|MB|GB)/i)
  return m ? Number(m[1]) * ({ B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 } as Record<string, number>)[m[2].toUpperCase()] : 0
}

function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg className="mf-fx-icon mf-fx-folder" viewBox="0 0 24 24" aria-hidden>
      <path d={open ? "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v1H7.5a2 2 0 00-1.9 1.4L3 17.5z M5.6 11h15.4a1 1 0 01.95 1.3l-1.6 5.4a2 2 0 01-1.9 1.3H3.5z" : "M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"} fill="currentColor" />
    </svg>
  )
}
function FileIcon({ pdf }: { pdf?: boolean }) {
  return (
    <svg className={`mf-fx-icon mf-fx-file${pdf ? " is-pdf" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path strokeLinejoin="round" d="M14 2v6h6" />
    </svg>
  )
}
const Arrow = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>

export default function FolderBrowser(props: {
  files: FolderBrowserFile[]
  folders?: string[]
  mode: "browse" | "pick"
  selectedPath?: string
  onPick?: (f: FolderBrowserFile) => void
  checked?: Set<string>
  onToggle?: (key: string) => void
  /** Buttons for the command bar (New folder, Move, Delete ...). */
  toolbar?: ReactNode
  compact?: boolean
  /** Files dropped on the window. */
  onDropFiles?: (files: FileList) => void
  empty?: ReactNode
}) {
  const { files, folders = [], mode, selectedPath, onPick, checked, onToggle, toolbar, compact, onDropFiles, empty } = props
  const root = useMemo(() => buildTree(files, folders), [files, folders])
  const [path, setPath] = useState<string[]>([])
  const [history, setHistory] = useState<string[][]>([[]])
  const [at, setAt] = useState(0)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<{ key: SortKey; down: boolean }>({ key: "name", down: false })
  const [active, setActive] = useState("")
  const [shut, setShut] = useState<Set<string>>(new Set())
  const [over, setOver] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const coarse = useRef(false)
  useEffect(() => { coarse.current = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches }, [])

  // The folder the window shows, as far as it still exists (files change under it).
  let node = root
  const here: string[] = []
  for (const seg of path) { const next = node.folders.get(seg); if (!next) break; node = next; here.push(seg) }
  const atRoot = here.length === 0

  const go = useCallback((next: string[]) => {
    setPath(next); setQuery(""); setActive("")
    setHistory(h => [...h.slice(0, at + 1), next]); setAt(a => a + 1)
  }, [at])
  const back = () => { if (at > 0) { setAt(at - 1); setPath(history[at - 1]); setQuery(""); setActive("") } }
  const forward = () => { if (at < history.length - 1) { setAt(at + 1); setPath(history[at + 1]); setQuery(""); setActive("") } }
  const up = () => { if (!atRoot) go(here.slice(0, -1)) }

  // In pick mode the window opens at the folder of the resume chosen (and follows it when Apply chooses another).
  const lastPicked = useRef("")
  useEffect(() => {
    if (mode !== "pick" || !selectedPath || selectedPath === lastPicked.current) return
    const f = files.find(x => x.filepath === selectedPath)
    // Not listed yet (a resume just made is still being listed): tried again when the list changes.
    if (!f) return
    lastPicked.current = selectedPath
    const seg = segments(f.category)
    setPath(seg); setHistory(h => [...h.slice(0, at + 1), seg]); setAt(a => a + 1); setActive("f:" + f.filepath)
  }, [mode, selectedPath, files]) // eslint-disable-line react-hooks/exhaustive-deps

  // What the list shows: the folder's own items, or, when searching, every resume under it that matches.
  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fileRow = (f: FolderBrowserFile, where?: string): Row => ({ key: "f:" + f.filepath, kind: "file", name: shownName(f.filename), file: f, at: Date.parse(f.uploadedAt) || 0, bytes: bytesOf(f.size), type: f.kind === "pdf" ? "PDF document" : "Word document", where })
    let list: Row[]
    if (q) {
      list = filesUnder(node).filter(f => `${shownName(f.filename)} ${f.category}`.toLowerCase().includes(q)).map(f => fileRow(f, segments(f.category).join(" / ")))
    } else {
      list = [
        ...[...node.folders.values()].map((n): Row => ({ key: "d:" + n.path.join("/"), kind: "folder", name: n.name, node: n, at: newest(n), bytes: countFiles(n), type: "File folder" })),
        ...node.files.map(f => fileRow(f)),
      ]
    }
    const dir = sort.down ? -1 : 1
    const by = (a: Row, b: Row): number => sort.key === "date" ? (a.at - b.at) : sort.key === "size" ? (a.bytes - b.bytes) : sort.key === "type" ? a.type.localeCompare(b.type) : 0
    return list.sort((a, b) => (a.kind === b.kind ? (by(a, b) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })) * dir : a.kind === "folder" ? -1 : 1))
  }, [node, query, sort])

  const open = (r: Row) => {
    if (r.kind === "folder" && r.node) go(r.node.path)
    else if (r.file) {
      if (mode === "pick") onPick?.(r.file)
      else window.open(viewHref(r.file), "_blank", "noopener,noreferrer")
    }
  }
  const click = (r: Row) => {
    setActive(r.key)
    if (r.kind === "folder" && coarse.current) open(r)
    else if (r.kind === "file" && mode === "pick") onPick?.(r.file as FolderBrowserFile)
  }

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type === "search") return
    const i = rows.findIndex(r => r.key === active)
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(rows[Math.min(rows.length - 1, i + 1)]?.key || "") }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(rows[Math.max(0, i - 1)]?.key || "") }
    else if (e.key === "Enter" && rows[i]) { e.preventDefault(); open(rows[i]) }
    else if (e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) { e.preventDefault(); up() }
    else if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); back() }
    else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); forward() }
    else if (e.key === " " && mode === "browse" && rows[i] && onToggle) { e.preventDefault(); onToggle(rows[i].key) }
  }
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(active)}"]`)?.scrollIntoView({ block: "nearest" }) }, [active])

  const th = (key: SortKey, label: string, cls = "") => (
    <th scope="col" className={cls} aria-sort={sort.key === key ? (sort.down ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort(s => (s.key === key ? { key, down: !s.down } : { key, down: false }))}>
        {label}{sort.key === key ? <span aria-hidden>{sort.down ? " ▾" : " ▴"}</span> : null}
      </button>
    </th>
  )

  // The folder pane: the top level and the folders under it, any of them can be shut.
  const branch = (n: Node, depth: number): ReactNode => (
    [...n.folders.values()].map(c => {
      const key = c.path.join("/"), closed = shut.has(key), here_ = key === here.join("/")
      return (
        <li key={key} role="none">
          <div className={`mf-fx-treeitem${here_ ? " is-here" : ""}`} style={{ paddingLeft: 6 + depth * 14 }}>
            <button type="button" className="mf-fx-chev" aria-label={closed ? "Open folder list" : "Close folder list"} aria-expanded={!closed} disabled={c.folders.size === 0}
              onClick={() => setShut(s => { const x = new Set(s); if (x.has(key)) x.delete(key); else x.add(key); return x })}
              style={{ visibility: c.folders.size ? "visible" : "hidden" }}><Arrow d={closed ? "M9 6l6 6-6 6" : "M6 9l6 6 6-6"} /></button>
            <button type="button" role="treeitem" aria-selected={here_} className="mf-fx-treename" onClick={() => go(c.path)} title={c.name}>
              <FolderIcon open={here_} /><span>{c.name}</span><small>{countFiles(c)}</small>
            </button>
          </div>
          {!closed && c.folders.size > 0 && <ul role="group">{branch(c, depth + 1)}</ul>}
        </li>
      )
    })
  )

  const everyKey = rows.map(r => r.key)
  const allOn = !!checked && everyKey.length > 0 && everyKey.every(k => checked.has(k))
  const items = rows.length
  const pickedHere = mode === "pick" ? rows.find(r => r.file?.filepath === selectedPath) : undefined

  return (
    <div className={`mf-fx${compact ? " is-compact" : ""}${over ? " is-over" : ""}`}
      onDragOver={onDropFiles ? e => { e.preventDefault(); setOver(true) } : undefined}
      onDragLeave={onDropFiles ? () => setOver(false) : undefined}
      onDrop={onDropFiles ? e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files) } : undefined}>
      {toolbar && <div className="mf-fx-command">{toolbar}</div>}
      <div className="mf-fx-bar">
        <div className="mf-fx-navbtns">
          <button type="button" className="mf-fx-navbtn" onClick={back} disabled={at === 0} aria-label="Back" title="Back (Alt+Left)"><Arrow d="M15 6l-6 6 6 6" /></button>
          <button type="button" className="mf-fx-navbtn" onClick={forward} disabled={at >= history.length - 1} aria-label="Forward" title="Forward (Alt+Right)"><Arrow d="M9 6l6 6-6 6" /></button>
          <button type="button" className="mf-fx-navbtn" onClick={up} disabled={atRoot} aria-label="Up one folder" title="Up (Backspace)"><Arrow d="M6 15l6-6 6 6" /></button>
        </div>
        <nav className="mf-fx-address" aria-label="Where you are">
          <button type="button" className={`mf-fx-crumb${atRoot ? " is-last" : ""}`} onClick={() => go([])}><FolderIcon />My files</button>
          {here.map((seg, i) => (
            <span key={i} className="mf-fx-crumbs">
              <span className="mf-fx-sep" aria-hidden>›</span>
              <button type="button" className={`mf-fx-crumb${i === here.length - 1 ? " is-last" : ""}`} onClick={() => go(here.slice(0, i + 1))} title={seg}>{seg}</button>
            </span>
          ))}
        </nav>
        <input type="search" className="mf-fx-search" value={query} onChange={e => setQuery(e.target.value)} placeholder={atRoot ? "Search My files" : `Search ${here[here.length - 1]}`} aria-label="Search this folder" />
      </div>

      <div className="mf-fx-body">
        {!compact && (
          <ul className="mf-fx-tree" role="tree" aria-label="Folders">
            <li role="none"><div className={`mf-fx-treeitem${atRoot ? " is-here" : ""}`} style={{ paddingLeft: 6 }}>
              <span className="mf-fx-chev" style={{ visibility: "hidden" }} />
              <button type="button" role="treeitem" aria-selected={atRoot} className="mf-fx-treename" onClick={() => go([])}><FolderIcon open={atRoot} /><span>My files</span><small>{files.length}</small></button>
            </div></li>
            {branch(root, 1)}
          </ul>
        )}
        <div className="mf-fx-list" ref={listRef} tabIndex={0} onKeyDown={keys} aria-label="Files and folders">
          {rows.length === 0 ? (
            <div className="mf-fx-empty">{query ? `Nothing here matches "${query}".` : (empty ?? "This folder is empty.")}</div>
          ) : (
            <table className="mf-fx-table">
              <thead>
                <tr>
                  {mode === "browse" && onToggle && <th scope="col" className="mf-fx-check"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => { everyKey.forEach(k => { if ((!!checked?.has(k)) === allOn) onToggle(k) }) }} /></th>}
                  {th("name", "Name")}{th("date", "Date modified", "mf-fx-col-date")}{th("type", "Type", "mf-fx-col-type")}{th("size", "Size", "mf-fx-col-size")}
                  {mode === "browse" && <th scope="col" className="mf-fx-col-act"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const on = !!checked?.has(r.key), cur = active === r.key, chosen = mode === "pick" && r.file?.filepath === selectedPath
                  return (
                    <tr key={r.key} data-key={r.key} aria-selected={cur || chosen || on} className={`${cur ? "is-active " : ""}${chosen ? "is-chosen " : ""}${on ? "is-checked" : ""}`}
                      onClick={() => click(r)} onDoubleClick={() => open(r)}>
                      {mode === "browse" && onToggle && <td className="mf-fx-check"><input type="checkbox" aria-label={`Select ${r.name}`} checked={on} onClick={e => e.stopPropagation()} onChange={() => onToggle(r.key)} /></td>}
                      <td className="mf-fx-name">
                        {r.kind === "folder" ? <FolderIcon /> : <FileIcon pdf={r.file?.kind === "pdf"} />}
                        <span className="mf-fx-label">{r.name}</span>
                        {chosen && <span className="mf-fx-badge is-chosen">Selected</span>}
                        {r.file && madeForJob(r.file.filename) && <span className="mf-fx-badge">Made for a job</span>}
                        {r.where && <small className="mf-fx-where">{r.where}</small>}
                      </td>
                      <td className="mf-fx-col-date">{when(r.at)}</td>
                      <td className="mf-fx-col-type">{r.type}</td>
                      <td className="mf-fx-col-size">{r.kind === "folder" ? `${r.bytes} resume${r.bytes === 1 ? "" : "s"}` : r.file?.size}</td>
                      {mode === "browse" && (
                        <td className="mf-fx-col-act">
                          {r.file?.filepath && <>
                            <a href={viewHref(r.file)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Look at this resume">View</a>
                            <a href={`/api/resumes/download?filepath=${encodeURIComponent(r.file.filepath)}&name=${encodeURIComponent(shownName(r.file.filename))}`} download onClick={e => e.stopPropagation()} title="Download" aria-label={`Download ${r.name}`}>↓</a>
                          </>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="mf-fx-status" role="status">
        {items} item{items === 1 ? "" : "s"}
        {checked && checked.size > 0 ? ` · ${checked.size} selected` : ""}
        {pickedHere ? ` · ${pickedHere.name} selected` : ""}
        <span className="mf-fx-hint">Double-click a folder to open it · Backspace goes up</span>
      </div>
    </div>
  )
}
