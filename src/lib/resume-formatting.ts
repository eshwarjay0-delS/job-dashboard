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
  { id: "executive", label: "Executive Leadership", family: "Experienced", description: "Prominent leadership profile and impact" },
  { id: "senior-engineer", label: "Senior Engineering", family: "Experienced", description: "Dense technical experience with clear hierarchy" },
  { id: "consulting", label: "Consulting Principal", family: "Experienced", description: "Refined consulting career presentation" },
] as const

export type FormatId = typeof RESUME_FORMATS[number]["id"]
export function validFormat(id: string): id is FormatId { return RESUME_FORMATS.some(t => t.id === id) }
export function resumeLines(text: string): string[] { return text.replace(/\r/g, "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 450) }
const headings = /^(experience|professional experience|work experience|education|skills|technical skills|projects|certifications|summary|professional summary|leadership|awards|publications|additional information|core competencies|career highlights)$/i
export function isHeading(line: string) { return headings.test(line.trim()) }
export function xmlEscape(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;") }
const STYLES: Record<FormatId, {font:string; accent:string; nameAlign:string; nameSize:number; headingSize:number; rule:string; spacing:number; uppercase:boolean; bodySize:number; headerBackground?:string; headingBackground?:string}> = {
  jakes: {font:"Arial, sans-serif",accent:"#161616",nameAlign:"center",nameSize:21,headingSize:11,rule:"2px solid",spacing:10,uppercase:true,bodySize:10},
  harvard: {font:"Georgia, serif",accent:"#222",nameAlign:"center",nameSize:20,headingSize:10,rule:"1px solid",spacing:15,uppercase:true,bodySize:10.5},
  "yale-tech": {font:"Arial, sans-serif",accent:"#163c59",nameAlign:"left",nameSize:25,headingSize:11,rule:"2px solid",spacing:12,uppercase:true,bodySize:10},
  mit: {font:"Helvetica, Arial, sans-serif",accent:"#8a1f24",nameAlign:"left",nameSize:24,headingSize:12,rule:"1px solid",spacing:16,uppercase:false,bodySize:10.5},
  careeronestop: {font:"Calibri, Arial, sans-serif",accent:"#305b70",nameAlign:"left",nameSize:23,headingSize:12,rule:"none",spacing:16,uppercase:false,bodySize:11,headingBackground:"#eaf0f3"},
  "harvard-paragraph": {font:"Georgia, serif",accent:"#303030",nameAlign:"center",nameSize:19,headingSize:11,rule:"1px solid",spacing:20,uppercase:true,bodySize:11},
  "yale-general": {font:"Times New Roman, serif",accent:"#242424",nameAlign:"center",nameSize:22,headingSize:12,rule:"none",spacing:14,uppercase:true,bodySize:10.5},
  columbia: {font:"Arial, sans-serif",accent:"#173653",nameAlign:"left",nameSize:25,headingSize:11,rule:"2px solid",spacing:16,uppercase:true,bodySize:10.5},
  executive: {font:"Georgia, serif",accent:"#334b53",nameAlign:"left",nameSize:28,headingSize:12,rule:"none",spacing:22,uppercase:true,bodySize:11.5,headerBackground:"#e9eff0"},
  "senior-engineer": {font:"Consolas, 'Courier New', monospace",accent:"#225e5b",nameAlign:"left",nameSize:22,headingSize:11,rule:"2px solid",spacing:10,uppercase:true,bodySize:9.5,headingBackground:"#e8f2f0"},
  consulting: {font:"Cambria, Georgia, serif",accent:"#665038",nameAlign:"center",nameSize:23,headingSize:12,rule:"1px solid",spacing:19,uppercase:false,bodySize:11}
}
export function renderResumeHtml(text: string, template: FormatId) {
  const style = STYLES[template]
  const lines = resumeLines(text)
  const body = lines.map((line, i) => {
    const tag = i === 0 ? "h1" : isHeading(line) ? "h2" : "p"
    return `<${tag}>${xmlEscape(line)}</${tag}>`
  }).join("")
  return `<!doctype html><html><head><meta charset="utf-8"><title>Resume</title><style>@page{size:letter;margin:.72in}*{box-sizing:border-box}body{font-family:${style.font};color:#202020;line-height:1.35;font-size:${style.bodySize}pt;max-width:7.2in;margin:auto}h1{text-align:${style.nameAlign};font-size:${style.nameSize}pt;margin:0 0 10pt;color:${style.accent};padding:8pt 0;background:${style.headerBackground||"transparent"}}h2{font-family:${style.font};text-transform:${style.uppercase?"uppercase":"none"};font-size:${style.headingSize}pt;letter-spacing:.04em;border-bottom:${style.rule} ${style.accent};background:${style.headingBackground||"transparent"};color:${style.accent};padding:3pt 2pt;margin:${style.spacing}pt 0 6pt;break-after:avoid}p{margin:0 0 5pt;white-space:pre-wrap;overflow-wrap:anywhere}h1+p{text-align:${style.nameAlign};margin-bottom:14pt}@media print{body{max-width:none}}</style></head><body>${body}</body></html>`
}
export async function renderResumeDocx(text: string, template: FormatId): Promise<Buffer> {
  const lines = resumeLines(text)
  const style = STYLES[template]
  const paragraphs = lines.map((line, i) => {
    const bold = i === 0 || isHeading(line)
    const size = Math.round((i === 0 ? style.nameSize : isHeading(line) ? style.headingSize : style.bodySize) * 2)
    const border = isHeading(line) && style.rule !== "none" ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:color="${style.accent.slice(1)}"/></w:pBdr>` : ""
    const align = i === 0 || i === 1 ? `<w:jc w:val="${style.nameAlign}"/>` : ""
    const font = style.font.split(",")[0].replace(/\x27/g,"").trim()
    return `<w:p><w:pPr><w:spacing w:before="${isHeading(line) ? style.spacing * 12 : 0}" w:after="${isHeading(line) ? 90 : 65}"/>${border}${align}</w:pPr><w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:rFonts w:ascii="${xmlEscape(font)}" w:hAnsi="${xmlEscape(font)}"/><w:color w:val="${i === 0 || isHeading(line) ? style.accent.slice(1) : "202020"}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`
  }).join("")
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1000" w:right="950" w:bottom="1000" w:left="950"/></w:sectPr></w:body></w:document>`
  const zip = new JSZip()
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file("word/document.xml", document)
  zip.file("docProps/app.xml", '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"/>')
  zip.file("docProps/core.xml", '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>')
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
}
