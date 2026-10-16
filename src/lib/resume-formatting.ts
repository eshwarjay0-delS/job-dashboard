import JSZip from "jszip"

export const RESUME_FORMATS = [
  { id: "kristopher-master", label: "Kristopher Master", family: "Experienced", description: "Centered serif header, blue section rules, grouped technical skills, and complete work history" },
  { id: "jakes", label: "Jake's Resume", family: "Technical", description: "Compact serif type, centered identity, and ruled sections" },
  { id: "harvard", label: "Harvard College", family: "Professional", description: "Traditional serif layout with centered section titles" },
  { id: "yale-tech", label: "Yale Technical", family: "Technical", description: "Modern sans serif with blue section bars and a left aligned header" },
  { id: "mit", label: "MIT Career", family: "Professional", description: "Bold sans serif hierarchy with generous space between sections" },
  { id: "careeronestop", label: "CareerOneStop", family: "Professional", description: "Readable chronological layout with understated headings" },
  { id: "harvard-paragraph", label: "Harvard Paragraph", family: "Experienced", description: "Serif editorial style with unbulleted achievement paragraphs" },
  { id: "yale-general", label: "Yale General", family: "Professional", description: "Centered serif header with restrained blue section rules" },
  { id: "columbia", label: "Columbia Experienced", family: "Experienced", description: "Corporate style with a strong navy identity and section bars" },
  { id: "executive", label: "Executive Brief", family: "Experienced", description: "Large serif identity and spacious sections for leadership careers" },
  { id: "staff-engineer", label: "Staff Engineer", family: "Experienced", description: "Dense technical history with clear sans serif hierarchy" },
] as const

export type FormatId = typeof RESUME_FORMATS[number]["id"]
type Style = { marginY?: number; nameAccent?: string; headingSize?: number; font: string; size: number; nameSize: number; margin: number; line: number; gap: number; accent: string; align: "left" | "center"; headingAlign: "left" | "center"; heading: "rule" | "band" | "plain"; caps: boolean; bullets: boolean }
export const FORMAT_STYLES: Record<FormatId, Style> = {
  "kristopher-master": { font: "Times New Roman", size: 10, nameSize: 20, margin: .625, marginY: .5, line: 1, gap: 13, accent: "1F4E79", nameAccent: "222222", headingSize: 11, align: "center", headingAlign: "left", heading: "rule", caps: true, bullets: true },
  jakes: { font: "Times New Roman", size: 10.5, nameSize: 23, margin: .55, line: 1.15, gap: 9, accent: "202020", align: "center", headingAlign: "left", heading: "rule", caps: true, bullets: true },
  harvard: { font: "Times New Roman", size: 11, nameSize: 20, margin: .75, line: 1.2, gap: 12, accent: "202020", align: "center", headingAlign: "center", heading: "plain", caps: true, bullets: true },
  "yale-tech": { font: "Arial", size: 10.5, nameSize: 25, margin: .65, line: 1.2, gap: 10, accent: "193F66", align: "left", headingAlign: "left", heading: "band", caps: true, bullets: true },
  mit: { font: "Arial", size: 11, nameSize: 26, margin: .7, line: 1.2, gap: 15, accent: "292929", align: "left", headingAlign: "left", heading: "plain", caps: true, bullets: true },
  careeronestop: { font: "Calibri", size: 11, nameSize: 22, margin: .75, line: 1.25, gap: 12, accent: "333333", align: "left", headingAlign: "left", heading: "rule", caps: false, bullets: true },
  "harvard-paragraph": { font: "Georgia", size: 10.5, nameSize: 22, margin: .8, line: 1.3, gap: 13, accent: "34302B", align: "center", headingAlign: "left", heading: "plain", caps: false, bullets: false },
  "yale-general": { font: "Georgia", size: 10.5, nameSize: 23, margin: .7, line: 1.25, gap: 12, accent: "244666", align: "center", headingAlign: "left", heading: "rule", caps: false, bullets: true },
  columbia: { font: "Calibri", size: 11, nameSize: 28, margin: .7, line: 1.2, gap: 12, accent: "173653", align: "left", headingAlign: "left", heading: "band", caps: false, bullets: true },
  executive: { font: "Georgia", size: 11, nameSize: 30, margin: .8, line: 1.3, gap: 16, accent: "34302B", align: "left", headingAlign: "left", heading: "rule", caps: true, bullets: true },
  "staff-engineer": { font: "Arial", size: 10, nameSize: 24, margin: .55, line: 1.15, gap: 9, accent: "234E49", align: "left", headingAlign: "left", heading: "rule", caps: true, bullets: true },
}
export function validFormat(id: string): id is FormatId { return RESUME_FORMATS.some(t => t.id === id) }
// Never silently truncate a career history during formatting.
export function resumeLines(text: string): string[] { return text.replace(/\r/g, "").split("\n").map(s => s.trim()).filter(Boolean) }
const headings = /^(experience|professional experience|work experience|employment history|education|skills|technical skills|core technical skills|security engineering expertise|it experience|additional experience|selected projects & achievements|keywords|certification|projects|selected projects|certifications|summary|professional summary|professional profile|leadership|awards|publications|additional information|core competencies|career highlights|selected achievements|volunteer experience|research|languages)$/i
export function isHeading(line: string) { return headings.test(line.trim().replace(/:$/, "")) }
export function xmlEscape(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;") }
// What one line of a resume is. The formatter used to know four things (a name, a heading, a bullet, "the rest"), so a
// job line such as "Software Engineer | Northstar Labs | 2023 to Present" came out as an ordinary paragraph in every
// template: no weight on the title, the dates wherever the line happened to end. That is what made ten templates look like
// one page of plain text in ten fonts. A line with its dates is an "entry" (what it is on the left, when on the right),
// and a "Languages: Python, Go" line under a skills heading is a "skill" (its label carries weight).
// Nothing here rewrites a word: a line is only placed, never changed.
export type Block =
  | { kind: "name" | "contact" | "heading" | "bullet" | "body" | "subheading" | "tagline"; text: string }
  | { kind: "entry"; text: string; lead: string; rest: string; when: string }
  | { kind: "skill"; text: string; label: string; rest: string }

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.]?"
const POINT = `(?:${MONTH}[ ]+)?(?:19|20)[0-9]{2}|(?:0?[1-9]|1[0-2])/(?:19|20)[0-9]{2}`
const UNTIL = `(?:${POINT}|Present|Current|Now|Today|Ongoing)`
// The dates at the end of a line, and what separates them from the rest. A year that simply ends a sentence ("migrated the
// platform in 2021") has no separator before it and is left where it is.
const WHEN = new RegExp(`^(.*?)(?:[ ]*[|,(]|[ ]+[-\u2013\u2014]|[ ]{2,}|\t)[ ]*((?:${POINT})(?:[ ]*(?:-|\u2013|\u2014|to)[ ]*${UNTIL})?)[)]?$`, "i")
const SKILLS = /skill|competenc|technolog|tools|languages|certif|interests|proficienc/i
const LABEL = /^([A-Za-z][A-Za-z0-9 /&+.#-]{1,34}):[ ]+(.+)$/

/** An all-capitals line of two to five words with nothing but letters in it is a section title, whatever it says. */
function shouts(line: string) {
  const words = line.split(/[ ]+/)
  return line.length >= 6 && words.length >= 2 && words.length <= 5 && /^[A-Z][A-Z &/-]+$/.test(line)
}

function entryOf(line: string): Block | null {
  if (line.length > 120 || /[.;:]$/.test(line)) return null
  const found = WHEN.exec(line)
  if (!found) return null
  const what = found[1].replace(/[ ]*[|,(-]+[ ]*$/, "").trim()
  if (!what) return null
  // What carries the weight: the first part of a line the person divided with bars, or what comes before the first comma.
  const bar = what.indexOf(" | "), comma = what.indexOf(", ")
  const cut = bar > 0 ? bar : comma > 0 ? comma : -1
  return { kind: "entry", text: line, lead: cut > 0 ? what.slice(0, cut) : what, rest: cut > 0 ? what.slice(cut) : "", when: found[2].trim() }
}

export function resumeBlocks(text: string): Block[] {
  let inHeader = true, section = ""
  return resumeLines(text).map((line, i): Block => {
    if (i === 0) return { kind: "name", text: line }
    if (isHeading(line) || (!inHeader && shouts(line)) || (inHeader && shouts(line) && !/@|[0-9]/.test(line))) {
      inHeader = false; section = line
      return { kind: "heading", text: line.replace(/:$/, "") }
    }
    if (/^[\u2022\u25cf\u25aa\u25e6\u00b7*-]\s+/.test(line)) { inHeader = false; return { kind: "bullet", text: line.replace(/^[\u2022\u25cf\u25aa\u25e6\u00b7*-]\s+/, "") } }
    // Everything above the first section title is the person's own header: who they are and how to reach them.
    if (inHeader) return { kind: "contact", text: line }
    const entry = entryOf(line)
    if (entry) return entry
    const label = SKILLS.test(section) ? LABEL.exec(line) : null
    if (label) return { kind: "skill", text: line, label: label[1], rest: label[2] }
    return { kind: "body", text: line }
  })
}
/** Reference-style hierarchy; never imports content from the example candidate. */
export function formatBlocks(text: string, template: FormatId): Block[] {
  const original = resumeBlocks(text)
  if (template !== "kristopher-master") return original
  const out: Block[] = []
  let section = "", started = false
  for (const b of original) {
    // A source may place an all-caps professional title above an unlabelled summary.
    if (!started && b.kind === "heading" && /engineer|analyst|administrator|specialist|consultant|developer|architect/i.test(b.text)) {
      out.push({ kind: "tagline", text: b.text }); continue
    }
    if (b.kind === "heading") { section = b.text; started = true; out.push(b); continue }
    if (!started && b.kind === "contact" && !/@|\d{3}|linkedin|https?:/i.test(b.text) && b.text.length < 140) {
      out.push({ kind: "tagline", text: b.text }); continue
    }
    if (!started && b.kind === "body") { out.push({ kind: "heading", text: "PROFESSIONAL SUMMARY" }); section = "summary"; started = true }
    if (b.kind === "skill") {
      out.push({ kind: "subheading", text: b.label + ":" }, { kind: "bullet", text: b.rest }); continue
    }
    if (/skills|expertise|competencies/i.test(section) && b.kind === "body" && b.text.includes(":")) {
      const at = b.text.indexOf(":")
      if (at < 100) { out.push({ kind: "subheading", text: b.text.slice(0, at + 1) }, { kind: "bullet", text: b.text.slice(at + 1).trim() }); continue }
    }
    if (/experience/i.test(section) && b.kind === "body" && !/^[^:]{2,70}:/.test(b.text)) {
      out.push({ kind: "bullet", text: b.text }); continue
    }
    out.push(b)
  }
  return out
}
export function renderResumeHtml(text: string, template: FormatId) {
  const s = FORMAT_STYLES[template]
  let list = false
  let body = ""
  for (const block of formatBlocks(text, template)) {
    if (block.kind === "bullet" && s.bullets) {
      if (!list) { body += "<ul>"; list = true }
      body += `<li>${xmlEscape(block.text)}</li>`; continue
    }
    if (list) { body += "</ul>"; list = false }
    if (block.kind === "entry") {
      body += `<div class="entry"><span class="what"><b>${xmlEscape(block.lead)}</b>${xmlEscape(block.rest)}</span><span class="when">${xmlEscape(block.when)}</span></div>`
      continue
    }
    if (block.kind === "skill") { body += `<p class="skill"><b>${xmlEscape(block.label)}:</b> ${xmlEscape(block.rest)}</p>`; continue }
    const tag = block.kind === "name" ? "h1" : block.kind === "heading" ? "h2" : "p"
    body += `<${tag} class="${block.kind}">${xmlEscape(block.text)}</${tag}>`
  }
  if (list) body += "</ul>"
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Resume</title><style>
@page{size:letter;margin:${s.marginY ?? s.margin}in ${s.margin}in}*{box-sizing:border-box}html{background:#fff;color:#202020}body{font-family:'${s.font}',${s.font === "Arial" || s.font === "Calibri" ? "sans-serif" : "serif"};line-height:${s.line};font-size:${s.size}pt;width:8.5in;min-height:11in;padding:${s.marginY ?? s.margin}in ${s.margin}in;margin:0;background:white}h1{text-align:${s.align};font-size:${s.nameSize}pt;line-height:1.1;margin:0 0 7pt;color:#${s.nameAccent || s.accent};overflow-wrap:anywhere}h2{text-align:${s.headingAlign};text-transform:${s.caps ? "uppercase" : "none"};font-size:${s.headingSize ?? s.size + .5}pt;line-height:1.2;color:#${s.accent};${s.heading === "rule" ? `border-bottom:1px solid #${s.accent};padding-bottom:3pt;` : s.heading === "band" ? "background:#EDF1F5;padding:4pt 6pt;" : ""}margin:${s.gap}pt 0 5pt;break-after:avoid}p{margin:0 0 5pt;white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2}.contact{text-align:${s.align};font-size:${s.size - .5}pt}ul{margin:0 0 5pt;padding-left:14pt}li{padding-left:0;margin:0 0 4pt;overflow-wrap:anywhere;orphans:2;widows:2}.entry{display:flex;justify-content:space-between;align-items:baseline;gap:14pt;margin:5pt 0 2pt;break-after:avoid;break-inside:avoid}.entry .what{min-width:0;overflow-wrap:anywhere}.entry .when{flex:none;white-space:nowrap;text-align:right}.subheading{font-weight:bold;color:#${s.accent};margin:10pt 0 4pt;break-after:avoid}.tagline{text-align:${s.align};font-weight:bold;color:#${s.accent};break-after:avoid}.skill{margin:0 0 3pt}h2+.entry{margin-top:2pt}@media print{body{width:auto;min-height:0;padding:0}h1,h2{break-inside:avoid}}
</style></head><body data-template="${template}">${body}</body></html>`
}
export async function renderResumeDocx(text: string, template: FormatId): Promise<Buffer> {
  const s = FORMAT_STYLES[template]
  const wide = 12240 - 2 * Math.round(s.margin * 1440)
  const run = (words: string, o: { bold?: boolean; colour?: string; size?: number } = {}) =>
    `<w:r><w:rPr><w:rFonts w:ascii="${s.font}" w:hAnsi="${s.font}"/>${o.bold ? "<w:b/>" : ""}<w:color w:val="${o.colour || "202020"}"/><w:sz w:val="${(o.size ?? s.size) * 2}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(words)}</w:t></w:r>`
  const paragraphs = formatBlocks(text, template).map(block => {
    const heading = block.kind === "heading", name = block.kind === "name", contact = block.kind === "contact", entry = block.kind === "entry"
    const bullet = block.kind === "bullet" && s.bullets
    const size = name ? s.nameSize : heading ? (s.headingSize ?? s.size + .5) : contact ? (template === "kristopher-master" ? s.size : s.size - .5) : s.size
    const border = heading && s.heading === "rule" ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:color="${s.accent}"/></w:pBdr>` : ""
    const shade = heading && s.heading === "band" ? '<w:shd w:fill="EDF1F5"/>' : ""
    const align = name || contact || block.kind === "tagline" ? s.align : heading ? s.headingAlign : "left"
    // An entry keeps its dates at the right edge with a tab stop there, as the page does with a flexible row.
    const tabs = entry ? `<w:tabs><w:tab w:val="right" w:pos="${wide}"/></w:tabs>` : ""
    const runs = block.kind === "entry"
      ? run(block.lead, { bold: true }) + (block.rest ? run(block.rest) : "") + `<w:r><w:tab/></w:r>` + run(block.when)
      : block.kind === "skill"
        ? run(block.label + ":", { bold: true }) + run(" " + block.rest)
        : run(heading && s.caps ? block.text.toUpperCase() : block.text, { bold: name || heading || block.kind === "subheading" || block.kind === "tagline", colour: name ? s.nameAccent || s.accent : heading || block.kind === "subheading" || block.kind === "tagline" ? s.accent : undefined, size })
    return `<w:p><w:pPr>${heading || name || entry || block.kind === "subheading" || block.kind === "tagline" ? "<w:keepNext/>" : ""}<w:widowControl/>${tabs}<w:spacing w:before="${heading ? s.gap * 20 : block.kind === "subheading" ? 200 : entry ? 80 : 0}" w:after="${name ? 140 : bullet ? 80 : entry ? 40 : 100}" w:line="${Math.round(s.line * 240)}" w:lineRule="auto"/>${border}${shade}<w:jc w:val="${align}"/>${bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ""}</w:pPr>${runs}</w:p>`
  }).join("")
  const margin = Math.round(s.margin * 1440)
  const marginY = Math.round((s.marginY ?? s.margin) * 1440)
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="${marginY}" w:right="${margin}" w:bottom="${marginY}" w:left="${margin}"/></w:sectPr></w:body></w:document>`
  const zip = new JSZip()
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>')
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>')
  zip.file("word/numbering.xml", '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="280"/></w:tabs><w:ind w:left="280" w:hanging="280"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')
  zip.file("word/document.xml", document)
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
}
