// A reply written in Markdown, drawn as what it means: a table as a table, a list as a list, bold as bold.
//
// Reported on 13 Oct 2026: the MFit Agent answered with a Markdown table and the chat showed the pipes and dashes as
// they were typed, because a reply was put on the page as plain text. The suggestion was to use `marked`
// (github.com/markedjs/marked), and it is what reads the text here.
//
// HOW IT IS KEPT SAFE. `marked` is only asked what the text is made of (its lexer: "a table with these cells, a link to
// this address"). It is never asked for HTML, and nothing is put on the page as HTML. Each piece is made into a React
// element here, so whatever a reply holds is shown as text: "<script>" is the eight characters, not a script. A reply
// can repeat words from an email a stranger sent, so this matters. A link is a link only when it goes to http, https or
// mailto; a picture is shown as a link to it, never fetched. No file here uses JSX, so a test can run it as it is.

import { createElement as h, Fragment, memo, useMemo, type CSSProperties, type ReactNode } from "react"
// TEMPORARY: marked package breaks Turbopack build. Using simple fallback until resolved.
// import { marked } from "marked"
// import type { Token } from "marked"
type Token = any
const marked = {
  lexer: (text: string) => [{ type: "paragraph", text }],
}

const SAFE_LINK = /^(?:https?:\/\/|mailto:)/i
const MONO = "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)"
const cell: CSSProperties = { padding: "6px 10px", border: "1px solid var(--border)", verticalAlign: "top" }
const ENTITY: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " }
// The few codes the reader leaves in a piece it marks as already escaped.
const plain = (text: string, escaped?: boolean): string => (escaped ? text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_m, n: string) => ENTITY[n] ?? _m) : text)

type Piece = Token & { tokens?: Token[]; text?: string; escaped?: boolean; href?: string; depth?: number; lang?: string; ordered?: boolean; start?: number | ""; items?: Piece[]; task?: boolean; checked?: boolean; header?: Cell[]; rows?: Cell[][]; align?: Array<"left" | "right" | "center" | null> }
type Cell = { text: string; tokens: Token[] }

function inline(tokens: Token[] | undefined, key: string): ReactNode[] {
  return (tokens || []).map((token, i) => {
    const t = token as Piece, k = `${key}.${i}`
    switch (t.type) {
      case "strong": return h("strong", { key: k }, inline(t.tokens, k))
      case "em": return h("em", { key: k }, inline(t.tokens, k))
      case "del": return h("s", { key: k }, inline(t.tokens, k))
      case "codespan": return h("code", { key: k, style: { fontFamily: MONO, fontSize: "0.92em", padding: "1px 5px", borderRadius: 5, background: "var(--surface)", border: "1px solid var(--border)" } }, plain(t.text || "", true))
      case "br": return h("br", { key: k })
      case "link": {
        const inside = t.tokens?.length ? inline(t.tokens, k) : t.text || t.href || ""
        // Anything but a web or mail address ("javascript:", "data:") is shown as its words, not as something to press.
        return SAFE_LINK.test(t.href || "") ? h("a", { key: k, href: t.href, target: "_blank", rel: "noopener noreferrer", style: { color: "inherit", textDecoration: "underline", textUnderlineOffset: 3, overflowWrap: "anywhere" } }, inside) : h(Fragment, { key: k }, inside)
      }
      case "image": return SAFE_LINK.test(t.href || "") ? h("a", { key: k, href: t.href, target: "_blank", rel: "noopener noreferrer", style: { color: "inherit", textDecoration: "underline" } }, t.text || "picture") : h(Fragment, { key: k }, t.text || "")
      case "checkbox": return h(Fragment, { key: k }, t.checked ? "☑ " : "☐ ")
      // Raw HTML in a reply is shown as the characters that were typed.
      case "html": return h(Fragment, { key: k }, t.raw)
      case "text": return t.tokens?.length ? h(Fragment, { key: k }, inline(t.tokens, k)) : h(Fragment, { key: k }, plain(t.text || "", t.escaped))
      case "escape": return h(Fragment, { key: k }, plain(t.text || "", true))
      default: return h(Fragment, { key: k }, t.raw || "")
    }
  })
}

function blocks(tokens: Token[], key: string): ReactNode[] {
  const out: ReactNode[] = []
  tokens.forEach((token, i) => {
    const t = token as Piece, k = `${key}.${i}`
    const gap = out.length ? 8 : 0   // space above every block but the first
    switch (t.type) {
      case "space": case "def": return
      case "paragraph": out.push(h("p", { key: k, style: { margin: `${gap}px 0 0` } }, inline(t.tokens, k))); return
      case "text": out.push(h("p", { key: k, style: { margin: `${gap}px 0 0` } }, t.tokens?.length ? inline(t.tokens, k) : plain(t.text || "", t.escaped))); return
      case "heading": out.push(h((t.depth || 3) <= 2 ? "h3" : "h4", { key: k, style: { margin: `${out.length ? 12 : 0}px 0 0`, fontSize: (t.depth || 3) <= 2 ? "1.12em" : "1.03em", fontWeight: 700, lineHeight: 1.35, letterSpacing: 0 } }, inline(t.tokens, k))); return
      case "hr": out.push(h("hr", { key: k, style: { margin: `${gap + 2}px 0 0`, border: 0, borderTop: "1px solid var(--border)" } })); return
      case "blockquote": out.push(h("blockquote", { key: k, style: { margin: `${gap}px 0 0`, padding: "2px 0 2px 10px", borderLeft: "3px solid var(--border-strong)", color: "var(--text-muted)" } }, blocks(t.tokens || [], k))); return
      case "code": out.push(h("pre", { key: k, style: { margin: `${gap}px 0 0`, padding: "10px 12px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", overflowX: "auto", fontFamily: MONO, fontSize: "0.9em", lineHeight: 1.5, whiteSpace: "pre" } }, h("code", null, t.text || ""))); return
      case "list": out.push(h(t.ordered ? "ol" : "ul", { key: k, start: t.ordered && typeof t.start === "number" && t.start !== 1 ? t.start : undefined, // The numbers and the dots are asked for outright: the site's base styles take them off every list.
        style: { margin: `${gap}px 0 0`, paddingLeft: 22, listStyleType: t.ordered ? "decimal" : "disc" } },
        (t.items || []).map((item, n) => h("li", { key: `${k}.${n}`, style: { margin: "2px 0", display: "list-item", listStyleType: item.task ? "none" : undefined, marginLeft: item.task ? -18 : undefined } }, listItem(item.tokens || [], `${k}.${n}`))))); return
      case "table": {
        const align = (n: number): CSSProperties => ({ textAlign: t.align?.[n] || "left" })
        // A table is as wide as what is in it; in a narrow chat it scrolls sideways inside its own box, not the page.
        out.push(h("div", { key: k, style: { margin: `${gap}px 0 0`, overflowX: "auto", maxWidth: "100%" } },
          h("table", { style: { borderCollapse: "collapse", fontSize: "0.95em", lineHeight: 1.45 } },
            h("thead", null, h("tr", null, (t.header || []).map((c, n) => h("th", { key: n, scope: "col", style: { ...cell, ...align(n), fontWeight: 700, background: "var(--surface)" } }, inline(c.tokens, `${k}.h${n}`))))),
            h("tbody", null, (t.rows || []).map((row, r) => h("tr", { key: r }, row.map((c, n) => h("td", { key: n, style: { ...cell, ...align(n) } }, inline(c.tokens, `${k}.${r}.${n}`)))))))))
        return
      }
      case "html": out.push(h("p", { key: k, style: { margin: `${gap}px 0 0` } }, t.raw.trim())); return
      default: if (t.raw && t.raw.trim()) out.push(h("p", { key: k, style: { margin: `${gap}px 0 0` } }, t.raw.trim()))
    }
  })
  return out
}
// What stands in a list item: its own line, and any list inside it.
function listItem(tokens: Token[], key: string): ReactNode[] {
  return tokens.map((token, i) => {
    const t = token as Piece, k = `${key}.${i}`
    if (t.type === "text") return h(Fragment, { key: k }, t.tokens?.length ? inline(t.tokens, k) : plain(t.text || "", t.escaped))
    if (t.type === "checkbox") return h(Fragment, { key: k }, t.checked ? "☑ " : "☐ ")
    return h(Fragment, { key: k }, blocks([token], k))
  })
}

/** The text as React elements. Text that cannot be read as Markdown is shown as it is. */
export function renderMarkdown(text: string): ReactNode {
  const source = String(text || "")
  if (!source.trim()) return null
  try {
    return h("div", { style: { whiteSpace: "normal", overflowWrap: "anywhere", minWidth: 0 } }, blocks(marked.lexer(source, { gfm: true, breaks: true }), "m"))
  } catch {
    return h("div", { style: { whiteSpace: "pre-line" } }, source)
  }
}

/** A reply, drawn. It is read once for the same text, however often the chat around it is drawn again. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return useMemo(() => renderMarkdown(text), [text])
})
