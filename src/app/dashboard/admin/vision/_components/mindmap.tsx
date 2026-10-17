"use client"

// Parses a vision markdown doc into a mind-map tree, then renders it as an
// interactive collapsible SVG. One source of truth: docs/*.md.

export type MindNode = { text: string; children: MindNode[] }
export type MindMap = { title: string; center: string; branches: MindNode[] }

// Sections that are meta/notes rather than vision structure — left out of the map.
const SKIP_SECTIONS = /what exists|non-goals|how it connects|standing rules|data foundation|form factor|owner's vision/i

function cleanMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(^|\s)\*(\S)/g, "$1$2")
    .trim()
}

export function parseMindMap(markdown: string): MindMap {
  const lines = markdown.split("\n")
  let title = ""
  let center = ""
  const branches: MindNode[] = []
  let current: MindNode | null = null
  let stack: MindNode[] = []
  let inOneLiner = false

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ")
    if (line.startsWith("# ")) { title = cleanMd(line.slice(2)); continue }
    if (/^##\s/.test(line)) {
      const h = cleanMd(line.replace(/^##\s+/, ""))
      if (/one-?liner/i.test(h)) { inOneLiner = true; current = null; continue }
      inOneLiner = false
      if (SKIP_SECTIONS.test(h)) { current = null; continue }
      current = { text: h, children: [] }
      branches.push(current)
      stack = [current]
      continue
    }
    if (/^###\s/.test(line) && current) {
      const node: MindNode = { text: cleanMd(line.replace(/^###\s+/, "")), children: [] }
      stack = [current]
      current.children.push(node)
      stack.push(node)
      continue
    }
    if (inOneLiner && line.trim() && !line.trim().startsWith("*")) {
      center = cleanMd(line.trim())
      inOneLiner = false
      continue
    }
    const m = line.match(/^(\s*)(?:-|\d+\.)\s+(.*)/)
    if (m && current) {
      const depth = Math.min(Math.floor(m[1].length / 2), 2)
      const node: MindNode = { text: cleanMd(m[2]), children: [] }
      while (stack.length > depth + 1) stack.pop()
      stack[stack.length - 1].children.push(node)
      stack.push(node)
    }
  }
  return { title, center, branches }
}

// ── Layout ────────────────────────────────────────────────────────────────

const NODE_W = 240
const X_STEP = 300
const LINE_H = 19
const PAD_Y = 12
const GAP = 14

function wrap(text: string, maxChars = 30): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur.trim()); cur = w }
    else cur = (cur + " " + w).trim()
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 5)
}

const nodeH = (text: string) => PAD_Y * 2 + wrap(text).length * LINE_H

type Placed = { node: MindNode; depth: number; x: number; y: number; h: number; kids: Placed[]; collapsed: boolean }

function layoutTree(node: MindNode, depth: number, y: number, collapsed: Set<string>, path: string): { placed: Placed; nextY: number } {
  const isCollapsed = collapsed.has(path)
  const kids: Placed[] = []
  let cursor = y
  if (!isCollapsed) {
    node.children.forEach((c, i) => {
      const r = layoutTree(c, depth + 1, cursor, collapsed, `${path}/${i}`)
      kids.push(r.placed)
      cursor = r.nextY
    })
  }
  const h = nodeH(node.text)
  const py = kids.length ? (y + cursor - GAP - h) / 2 : y
  const placed: Placed = { node, depth, x: 40 + depth * X_STEP, y: Math.max(py, y), h, kids, collapsed: isCollapsed }
  return { placed, nextY: (kids.length ? cursor : y + h) + GAP }
}

const PALETTE = ["#b3541e", "#2e6f5e", "#4a5fa5", "#8a4a9e", "#a5822f", "#2f7f8f", "#96422f"]

import { useMemo, useState } from "react"

export default function MindMap({ map }: { map: MindMap }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (path: string) =>
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(path)) n.delete(path); else n.add(path)
      return n
    })

  const { root, totalH, totalW } = useMemo(() => {
    const kids: Placed[] = []
    let cursor = 30
    map.branches.forEach((b, i) => {
      const r = layoutTree(b, 1, cursor, collapsed, `b${i}`)
      kids.push(r.placed)
      cursor = r.nextY
    })
    const h = nodeH(map.title)
    const totalH = Math.max(cursor + 20, 200)
    const root: Placed = {
      node: { text: map.title, children: [] }, depth: 0, x: 40, y: totalH / 2 - h / 2, h, kids, collapsed: false,
    }
    const maxX = 40 + 3 * X_STEP + NODE_W
    return { root, totalH, totalW: maxX + 40 }
  }, [map, collapsed])

  const renderNode = (p: Placed, color: string, isRoot = false): React.ReactNode => {
    const lines = wrap(p.node.text)
    const cx = p.x + NODE_W / 2
    return (
      <g key={`${p.x}-${p.y}-${p.node.text.slice(0, 12)}`}>
        {p.depth > 0 && (
          <line x1={p.x - (X_STEP - NODE_W)} y1={p.y + p.h / 2} x2={p.x} y2={p.y + p.h / 2}
            stroke={color} strokeWidth={2} opacity={0.55} />
        )}
        <rect x={p.x} y={p.y} width={NODE_W} height={p.h} rx={12}
          fill={isRoot ? color : "#ffffff"} stroke={color} strokeWidth={isRoot ? 0 : 2.5} />
        {lines.map((ln, i) => (
          <text key={i} x={cx} y={p.y + PAD_Y + 14 + i * LINE_H} textAnchor="middle"
            fontFamily="Verdana, sans-serif" fontSize={isRoot ? 16 : 13.5}
            fontWeight={isRoot || p.depth === 1 ? 700 : 400}
            fill={isRoot ? "#ffffff" : "#2b2620"}>
            {ln}
          </text>
        ))}
        {p.depth === 1 && p.node.children.length > 0 && (
          <g onClick={() => toggle(`b${map.branches.indexOf(p.node)}`)} style={{ cursor: "pointer" }}>
            <circle cx={p.x + NODE_W - 16} cy={p.y + 16} r={11} fill={color} />
            <text x={p.x + NODE_W - 16} y={p.y + 21} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff">
              {p.collapsed ? "+" : "–"}
            </text>
          </g>
        )}
        {p.kids.map(k => renderNode(k, color))}
      </g>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setCollapsed(new Set())}
          style={btnStyle}>Expand all</button>
        <button type="button"
          onClick={() => setCollapsed(new Set(map.branches.map((_, i) => `b${i}`)))}
          style={btnStyle}>Collapse all</button>
        <span style={{ fontSize: 13, color: "var(--text-muted)", alignSelf: "center", marginLeft: 4 }}>
          Click a pillar to fold it. {map.center}
        </span>
      </div>
      <div style={{ overflow: "auto", border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)" }}>
        <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} role="img" aria-label={`${map.title} mind map`}>
          {root.kids.map((k, i) => renderNode(k, PALETTE[i % PALETTE.length]))}
          {renderNode({ ...root, kids: [] }, "#1d1a13", true)}
        </svg>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  minHeight: 34, padding: "0 14px", fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer",
}
