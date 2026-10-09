import JSZip from "jszip"

export const RESUME_FORMATS = [
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
type Style = { font: string; size: number; nameSize: number; margin: number; line: number; gap: number; accent: string; align: "left" | "center"; headingAlign: "left" | "center"; heading: "rule" | "band" | "plain"; caps: boolean; bullets: boolean }
export const FORMAT_STYLES: Record<FormatId, Style> = {
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
const headings = /^(experience|professional experience|work experience|employment history|education|skills|technical skills|projects|selected projects|certifications|summary|professional summary|professional profile|leadership|awards|publications|additional information|core competencies|career highlights|selected achievements|volunteer experience|research|languages)$/i
export function isHeading(line: string) { return headings.test(line.trim().replace(/:$/, "")) }
export function xmlEscape(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;") }
type Block = { kind: "name" | "contact" | "heading" | "bullet" | "body"; text: string }
export function resumeBlocks(text: string): Block[] {
  let inHeader = true
  return resumeLines(text).map((line, i) => {
    if (i === 0) return { kind: "name", text: line }
    if (isHeading(line)) { inHeader = false; return { kind: "heading", text: line.replace(/:$/, "") } }
    if (/^[•●▪◦*-]\s+/.test(line)) { inHeader = false; return { kind: "bullet", text: line.replace(/^[•●▪◦*-]\s+/, "") } }
    // Only clear contact lines belong to the identity header; unstructured content stays body text.
    return { kind: inHeader && /@|https?:|linkedin\.|github\.|\+?\d[\d ()-]{7,}/i.test(line) ? "contact" : "body", text: line }
  })
}
export function renderResumeHtml(text: string, template: FormatId) {
  const s = FORMAT_STYLES[template]
  let list = false
  let body = ""
  for (const block of resumeBlocks(text)) {
    if (block.kind === "bullet" && s.bullets) {
      if (!list) { body += "<ul>"; list = true }
      body += `<li>${xmlEscape(block.text)}</li>`; continue
    }
    if (list) { body += "</ul>"; list = false }
    const tag = block.kind === "name" ? "h1" : block.kind === "heading" ? "h2" : "p"
    body += `<${tag} class="${block.kind}">${xmlEscape(block.text)}</${tag}>`
  }
  if (list) body += "</ul>"
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Resume</title><style>
@page{size:letter;margin:${s.margin}in}*{box-sizing:border-box}html{background:#fff;color:#202020}body{font-family:'${s.font}',${s.font === "Arial" || s.font === "Calibri" ? "sans-serif" : "serif"};line-height:${s.line};font-size:${s.size}pt;width:8.5in;min-height:11in;padding:${s.margin}in;margin:0;background:white}h1{text-align:${s.align};font-size:${s.nameSize}pt;line-height:1.1;margin:0 0 7pt;color:#${s.accent};overflow-wrap:anywhere}h2{text-align:${s.headingAlign};text-transform:${s.caps ? "uppercase" : "none"};font-size:${s.size + .5}pt;line-height:1.2;color:#${s.accent};${s.heading === "rule" ? `border-bottom:1px solid #${s.accent};padding-bottom:3pt;` : s.heading === "band" ? "background:#EDF1F5;padding:4pt 6pt;" : ""}margin:${s.gap}pt 0 5pt;break-after:avoid}p{margin:0 0 5pt;white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2}.contact{text-align:${s.align};font-size:${s.size - .5}pt}ul{margin:0 0 5pt;padding-left:14pt}li{padding-left:0;margin:0 0 4pt;overflow-wrap:anywhere;orphans:2;widows:2}@media print{body{width:auto;min-height:0;padding:0}h1,h2{break-inside:avoid}}
</style></head><body data-template="${template}">${body}</body></html>`
}
export async function renderResumeDocx(text: string, template: FormatId): Promise<Buffer> {
  const s = FORMAT_STYLES[template]
  const paragraphs = resumeBlocks(text).map(block => {
    const heading = block.kind === "heading", name = block.kind === "name", contact = block.kind === "contact"
    const bullet = block.kind === "bullet" && s.bullets
    const size = name ? s.nameSize : heading ? s.size + .5 : contact ? s.size - .5 : s.size
    const border = heading && s.heading === "rule" ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:color="${s.accent}"/></w:pBdr>` : ""
    const shade = heading && s.heading === "band" ? '<w:shd w:fill="EDF1F5"/>' : ""
    const align = name || contact ? s.align : heading ? s.headingAlign : "left"
    const content = heading && s.caps ? block.text.toUpperCase() : block.text
    return `<w:p><w:pPr>${heading || name ? "<w:keepNext/>" : ""}<w:widowControl/><w:spacing w:before="${heading ? s.gap * 20 : 0}" w:after="${name ? 140 : bullet ? 80 : 100}" w:line="${Math.round(s.line * 240)}" w:lineRule="auto"/>${border}${shade}<w:jc w:val="${align}"/>${bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ""}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="${s.font}" w:hAnsi="${s.font}"/>${name || heading ? "<w:b/>" : ""}<w:color w:val="${name || heading ? s.accent : "202020"}"/><w:sz w:val="${size * 2}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(content)}</w:t></w:r></w:p>`
  }).join("")
  const margin = Math.round(s.margin * 1440)
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}"/></w:sectPr></w:body></w:document>`
  const zip = new JSZip()
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>')
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>')
  zip.file("word/numbering.xml", '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="280"/></w:tabs><w:ind w:left="280" w:hanging="280"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')
  zip.file("word/document.xml", document)
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
}
