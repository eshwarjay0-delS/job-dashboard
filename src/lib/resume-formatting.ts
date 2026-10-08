import JSZip from "jszip"

export const RESUME_FORMATS = [
  { id: "jakes", label: "Jake's Resume", family: "Technical", description: "Compact technical layout" },
  { id: "harvard", label: "Harvard College", family: "Professional", description: "Traditional academic career format" },
  { id: "yale-tech", label: "Yale Technical", family: "Technical", description: "Structured skills and engineering experience" },
  { id: "mit", label: "MIT Career", family: "Professional", description: "Clear career progression" },
  { id: "careeronestop", label: "CareerOneStop", family: "Professional", description: "Straightforward chronological format" },
  { id: "harvard-paragraph", label: "Harvard Paragraph", family: "Experienced", description: "Narrative focused professional layout" },
  { id: "yale-general", label: "Yale General", family: "Professional", description: "Conventional clean structure" },
  { id: "columbia", label: "Columbia Experienced", family: "Experienced", description: "Balanced corporate career history" },
] as const

export type FormatId = typeof RESUME_FORMATS[number]["id"]
export function validFormat(id: string): id is FormatId { return RESUME_FORMATS.some(t => t.id === id) }
export function resumeLines(text: string): string[] { return text.replace(/\r/g, "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 450) }
const headings = /^(experience|professional experience|work experience|education|skills|technical skills|projects|certifications|summary|professional summary|leadership|awards|publications|additional information|core competencies|career highlights)$/i
export function isHeading(line: string) { return headings.test(line.trim()) }
export function xmlEscape(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;") }
export function renderResumeHtml(text: string, template: FormatId) {
  const lines = resumeLines(text)
  const accent = template === "columbia" ? "#173653" : "#222"
  const body = lines.map((line, i) => {
    const tag = i === 0 ? "h1" : isHeading(line) ? "h2" : "p"
    return `<${tag}>${xmlEscape(line)}</${tag}>`
  }).join("")
  return `<!doctype html><html><head><meta charset="utf-8"><title>Resume</title><style>@page{size:letter;margin:0.72in}body{font-family:Georgia,'Times New Roman',serif;color:#202020;line-height:1.35;font-size:10.5pt;max-width:7.2in;margin:auto}h1{text-align:center;font-size:18pt;margin:0 0 9pt;color:${accent}}h2{font-family:Arial,sans-serif;text-transform:uppercase;font-size:10.5pt;letter-spacing:.055em;border-bottom:1px solid ${accent};padding-bottom:3pt;margin:13pt 0 5pt;break-after:avoid}p{margin:0 0 5pt;white-space:pre-wrap;overflow-wrap:anywhere} @media print{body{max-width:none}}</style></head><body>${body}</body></html>`
}
export async function renderResumeDocx(text: string, template: FormatId): Promise<Buffer> {
  const lines = resumeLines(text)
  const paragraphs = lines.map((line, i) => {
    const bold = i === 0 || isHeading(line)
    const size = i === 0 ? 32 : isHeading(line) ? 22 : 21
    const border = isHeading(line) ? '<w:pBdr><w:bottom w:val="single" w:sz="5" w:color="444444"/></w:pBdr>' : ""
    const align = i === 0 ? '<w:jc w:val="center"/>' : ""
    return `<w:p><w:pPr><w:spacing w:after="${isHeading(line) ? 100 : 65}"/>${border}${align}</w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`
  }).join("")
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1000" w:right="950" w:bottom="1000" w:left="950"/></w:sectPr></w:body></w:document>`
  const zip = new JSZip()
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file("word/document.xml", document)
  zip.file("docProps/app.xml", '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"/>')
  zip.file("docProps/core.xml", '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>')
  void template
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
}
