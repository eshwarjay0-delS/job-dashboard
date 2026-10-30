// The dossier as a printable page (dossier-blueprint upgrade step 3, print-CSS route for the demo). Markdown in,
// self-contained HTML out; headless Chrome or the browser's Print turns it into the PDF. Every figure passes the
// dossierBlueprint gate (kompasGuards.allowedNumbers underneath) and contact details are left out before render.
import { gateFigures, holesIn, stripContact, stripLogistics } from "./dossierBlueprint.ts"

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const inline = (t: string) => esc(t)
  .replace(/\[ ___ ([^\]]*)\]/g, '<mark class="hole">[ ___ $1]</mark>')
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")

export function markdownToHtml(md: string): string {
  const out: string[] = []
  const lines = md.split("\n")
  let list: "ul" | "ol" | null = null
  let table: string[][] | null = null
  const close = () => {
    if (list) { out.push(`</${list}>`); list = null }
    if (table) {
      const [head, ...rows] = table
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`)
      table = null
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^\|/.test(line)) {
      if (list) { out.push(`</${list}>`); list = null }
      if (/^\|[\s:|-]+\|$/.test(line)) continue
      ;(table ||= []).push(line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
      continue
    }
    if (table) close()
    let m
    if (line === "<<<PAGEBREAK>>>") { close(); out.push('<div class="pb"></div>'); continue }
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue }
    if ((m = /^\s*[-•*]\s+(.*)$/.exec(line))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul" } out.push(`<li>${inline(m[1])}</li>`); continue }
    if ((m = /^\s*\d+\.\s+(.*)$/.exec(line))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol" } out.push(`<li>${inline(m[1])}</li>`); continue }
    if ((m = /^>\s?(.*)$/.exec(line))) { close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue }
    if (!line.trim()) { close(); continue }
    close(); out.push(`<p>${inline(line)}</p>`)
  }
  close()
  return out.join("\n")
}

const CSS = `@page{size:Letter;margin:0.8in 0.85in}body{font:11pt/1.5 Georgia,serif;color:#1d1d1f}
h1{font:600 22pt/1.2 Helvetica,Arial,sans-serif;margin:0 0 .3em}h2{font:600 15pt Helvetica,Arial,sans-serif;border-bottom:1px solid #bbb;padding-bottom:3px;margin-top:1.4em;break-after:avoid}
h3{font:600 12pt Helvetica,Arial,sans-serif;margin:1.1em 0 .3em;break-after:avoid}h4{font:600 10.5pt Helvetica,Arial,sans-serif;margin:.8em 0 .2em;color:#444}
table{border-collapse:collapse;width:100%;font-size:9.5pt;margin:.6em 0}th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:top;text-align:left}th{background:#f1f1f1}
blockquote{margin:.5em 0;padding:.3em .8em;border-left:3px solid #6a7fa8;background:#f6f8fb;font-style:italic}
mark.hole{background:#ffe3e3;color:#a10000;font-weight:600}.pb{break-after:page}code{font-size:9.5pt}
.footer{font:8pt Helvetica,Arial,sans-serif;color:#777;margin-top:2em}`

/** The print page: gated, contact-free, holes highlighted. */
export function dossierHtml(opts: { title: string; md: string; sources: string[] }): { html: string; blocked: number; blockedList: string[]; holes: string[] } {
  const gated = gateFigures(stripLogistics(stripContact(opts.md)), opts.sources)
  const body = markdownToHtml(gated.text)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title><style>${CSS}</style></head><body>${body}</body></html>`
  return { html, blocked: gated.blocked.length, blockedList: gated.blocked, holes: holesIn(gated.text) }
}
