/**
 * Resume layout normaliser (r3, 29 Oct 2026). Our own code. Turns a one-paragraph resume, a markdown table, or
 * "Role | Employer | Years" lines into the "### Role, Employer (Years)" + one-line-per-bullet shape the rest of
 * Kompas already reads. Pure. Failsafe: a resume that needs none of this, or any error, comes back unchanged.
 */
const SENT = /(?<=[.!?])\s+(?=[A-Z])/
const ROLE_AT = /^(.{3,70}?) at ([A-Z][^()]{1,50}?) \((\d{4}[^)]*)\)\.?$/
const VERB = /\b(?:\w+ed|led|ran|built|wrote|made|drove|grew|won|set|kept|took|owned|own|lead|manage|build)\b/i

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
}

export function normalizeResumeLayout(resume: string | null | undefined): string {
  const text = typeof resume === "string" ? resume : ""
  if (!text) return ""
  try {
    const lines = text.split("\n")
    const out: string[] = []
    let changed = false
    let heading = ""
    const head = (h: string) => { if (h && h !== heading) { out.push(`### ${h}`); heading = h } }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const t = line.trim()
      // markdown table: divider and header rows dropped; a row's last cell is the bullet, the others its role heading
      if (/^\|.*\|$/.test(t)) {
        const c = cells(t)
        const next = (lines[i + 1] || "").trim()
        if (c.every((x) => /^:?-{2,}:?$|^$/.test(x))) { changed = true; continue }
        if (/^\|[\s:|-]+\|$/.test(next) && /-{2,}/.test(next)) { changed = true; continue }
        const body = c[c.length - 1]
        if (c.length >= 2 && body.split(/\s+/).length >= 4) {
          const [role, employer, years] = c.slice(0, -1)
          head([role, employer].filter(Boolean).join(", ") + (years && /\d{4}/.test(years) ? ` (${years})` : ""))
          out.push(`- ${body}`); changed = true; continue
        }
        out.push(line); continue
      }
      // r4: unusual role lines. "Role — Employer — Jan '21–Present", "Role · Employer · 05/2017 – 12/2020" and
      // "Role, Employer (Summer 2022 – current)" become role headings; a first line "Name | City" with no date is the
      // name, and a lone all-caps section word ("EXPERIENCE", "WORK") is a section heading. Only plain lines (no bullet
      // or #) of at most 20 words with a date are touched; anything else is left for the rules below.
      if (!/^\s*[-*•#]/.test(line) && t) {
        const dated = /\b(?:19|20)\d{2}\b|'\d{2}\b|\b(?:present|current|now)\b/i.test(t)
        const short = t.split(/\s+/).length <= 20
        const firstText = !out.some((l) => l.trim())
        if (firstText && / \| /.test(t) && !dated && t.split(/\s+/).length <= 8) { out.push(`# ${t}`); changed = true; continue }
        if (/^[A-Z][A-Z &]{2,30}$/.test(t) && t.split(/\s+/).length <= 3) { out.push(`## ${t.charAt(0) + t.slice(1).toLowerCase()}`); changed = true; continue }
        if (dated && short && !/^\s*(?:\w+ed|led|ran|built|wrote|made|owned)\b/i.test(t)) {
          const bits = t.split(/\s+[\u2014\u00b7]\s+|\s+[\u2013-]\s+(?=[A-Z][^\d]*[\u2014\u00b7\u2013-])/).map((b) => b.trim()).filter(Boolean)
          if (bits.length === 3 && /\d|present|current|now/i.test(bits[2])) { head(`${bits[0]}, ${bits[1]} (${bits[2]})`); changed = true; continue }
          if (/^[^()]{3,80}, [^()]{2,60} \([^()]*(?:\d{4}|'\d{2}|present|current|now)[^()]*\)$/i.test(t) && !/[.!?]$/.test(t)) { head(t); changed = true; continue }
        }
      }
      // "Role | Employer | Years" on its own line (no bullet body)
      if (!/^\s*[-*•#]/.test(line) && / \| /.test(t) && t.split(/\s+/).length <= 14) {
        const [role, employer, years] = t.split(/\s+\|\s+/)
        if (role && employer) { head(`${role}, ${employer}` + (years && /\d{4}/.test(years) ? ` (${years})` : "")); changed = true; continue }
      }
      // one long paragraph: a sentence per line; "Role at Employer (Years)." becomes a heading; a leading name line is dropped
      const sentences = t.split(SENT)
      if (!/^#/.test(t) && t.split(/\s+/).length > 45 && sentences.length >= 3) {
        sentences.forEach((s, j) => {
          const r = s.match(ROLE_AT)
          if (r) { head(`${r[1]}, ${r[2]} (${r[3]})`); return }
          if (j === 0 && out.length === 0 && /^[A-Z][a-z]+ [A-Z][a-z]+,/.test(s) && !VERB.test(s)) { out.push(`# ${s.replace(/[.\s]+$/, "")}`); return }
          out.push(`- ${s}`)
        })
        changed = true; continue
      }
      out.push(line)
    }
    const result = out.join("\n")
    return changed && result.trim() ? result : text
  } catch {
    return text
  }
}
