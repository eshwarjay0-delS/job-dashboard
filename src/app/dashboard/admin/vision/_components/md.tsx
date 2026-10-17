"use client"

// Minimal markdown renderer for the vision docs (no dependency).
// Handles: ## / ### headings, - and 1. lists (nested), **bold**, *italic*,
// `code`, | tables |, paragraphs, ---.

import type { ReactNode } from "react"

function inline(s: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith("**")) parts.push(<strong key={`${keyPrefix}-${k++}`}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith("*")) parts.push(<em key={`${keyPrefix}-${k++}`}>{t.slice(1, -1)}</em>)
    else if (t.startsWith("`")) parts.push(<code key={`${keyPrefix}-${k++}`} style={{ fontFamily: "var(--font-mono)", fontSize: "0.92em", background: "var(--surface-2)", padding: "1px 5px", borderRadius: 5 }}>{t.slice(1, -1)}</code>)
    else {
      const lm = t.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (lm) parts.push(<a key={`${keyPrefix}-${k++}`} href={lm[2]} style={{ color: "var(--accent)" }}>{lm[1]}</a>)
      else parts.push(t)
    }
    last = m.index + t.length
  }
  if (last < s.length) parts.push(s.slice(last))
  return parts
}

const P: React.CSSProperties = { fontSize: 15, lineHeight: 1.65, color: "var(--text)", margin: "0 0 12px", maxWidth: 760 }
const H2: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "30px 0 10px", letterSpacing: "-0.01em" }
const H3: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: "var(--text)", margin: "20px 0 8px" }

function Table({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows
  return (
    <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 14, minWidth: 560 }}>
        <thead>
          <tr>{head.map((c, i) => (
            <th key={i} style={{ textAlign: "left", padding: "8px 12px", borderBottom: "2px solid var(--border-strong)", color: "var(--text)", whiteSpace: "nowrap" }}>{inline(c, `h${i}`)}</th>
          ))}</tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (
              <td key={j} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", verticalAlign: "top" }}>{inline(c, `b${i}-${j}`)}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function List({ items }: { items: { depth: number; text: string }[] }) {
  const render = (list: { depth: number; text: string }[], d: number, start: number): { el: ReactNode; next: number } => {
    const els: ReactNode[] = []
    let i = start
    while (i < list.length && list[i].depth >= d) {
      if (list[i].depth > d) {
        const r = render(list, list[i].depth, i)
        els.push(<ul key={`n${i}`} style={{ margin: "4px 0 8px", paddingLeft: 22 }}>{r.el}</ul>)
        i = r.next
      } else {
        els.push(<li key={`l${i}`} style={{ ...P, margin: "0 0 6px" }}>{inline(list[i].text, `li${i}`)}</li>)
        i++
      }
    }
    return { el: <>{els}</>, next: i }
  }
  return <ul style={{ margin: "0 0 12px", paddingLeft: 22 }}>{render(items, items[0]?.depth ?? 0, 0).el}</ul>
}

export default function VisionMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n")
  const out: ReactNode[] = []
  let i = 0
  let k = 0
  const key = () => `v${k++}`

  while (i < lines.length) {
    const line = lines[i]
    if (/^#{1}\s/.test(line)) { i++; continue } // title shown by the page
    if (/^#{2}\s/.test(line)) { out.push(<h2 key={key()} style={H2}>{inline(line.replace(/^#{2}\s+/, ""), key())}</h2>); i++; continue }
    if (/^#{3}\s/.test(line)) { out.push(<h3 key={key()} style={H3}>{inline(line.replace(/^#{3}\s+/, ""), key())}</h3>); i++; continue }
    if (/^\s*---\s*$/.test(line)) { out.push(<hr key={key()} style={{ border: 0, borderTop: "1px solid var(--border)", margin: "24px 0" }} />); i++; continue }
    if (/^\|.*\|\s*$/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split("|").map(c => c.trim())
        if (!cells.every(c => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      if (rows.length) out.push(<Table key={key()} rows={rows} />)
      continue
    }
    const lm = line.match(/^(\s*)(?:-|\d+\.)\s+(.*)/)
    if (lm) {
      const items: { depth: number; text: string }[] = []
      while (i < lines.length) {
        const m2 = lines[i].match(/^(\s*)(?:-|\d+\.)\s+(.*)/)
        if (!m2) break
        items.push({ depth: Math.floor(m2[1].replace(/\t/g, "  ").length / 2), text: m2[2] })
        i++
      }
      out.push(<List key={key()} items={items} />)
      continue
    }
    if (line.trim()) {
      let para = line.trim()
      i++
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|(\s*)(-|\\d+\.)\s+\||\s*---)/.test(lines[i])) {
        para += " " + lines[i].trim()
        i++
      }
      if (/^\*.*\*$/.test(para) && para.length < 160) {
        out.push(<p key={key()} style={{ ...P, color: "var(--text-soft)", fontStyle: "italic" }}>{inline(para.replace(/^\*|\*$/g, ""), key())}</p>)
      } else {
        out.push(<p key={key()} style={P}>{inline(para, key())}</p>)
      }
      continue
    }
    i++
  }
  return <>{out}</>
}
