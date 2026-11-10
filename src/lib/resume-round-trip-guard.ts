// Round-trip guard (v2, 2026-10-29): the name, contact details and dates in the source resume must survive
// unchanged in the exported resume. Used as the WhatsApp send check. Unicode dashes, phone extensions and NFC names handled.
import JSZip from 'jszip'

const MON = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s|<>]+|\b(?:linkedin\.com|github\.com|gitlab\.com)\/[^\s|<>]+/gi
const DOCX_LINK_START = "\u001eDOCX_LINK:"
const DOCX_LINK_END = "\u001f"
const DOCX_LINK_RE = /\u001eDOCX_LINK:([^\u001f]*)\u001f/g
// phones: 10-15 digits with common separators, optional +country, optional extension (ext. 27 / x27 / #27)
const PHONE = /(?<![\w/-])((?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4})(?:\s*(?:ext\.?|extension|x|#)\s*(\d{1,6}))?(?![\w/-])/gi
// Unicode dashes (hyphen, NB hyphen, figure, en, em, minus) read as '-', so en-dash phones and ranges are seen.
const DASH = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g
// Incidental standalone years in prose are not employment dates.
// Preserve month/year and year-range employment dates.
const DATE = new RegExp(
  `\\b(?:${MON})\\.?\\s+\\d{4}\\b` +           // Jan 2020
  `|\\b(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2}\\b` + // 01/2020
  `|\\b(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])\\b` +    // 2020-01
  `|\\b(?:19|20)\\d{2}\\s*[-–—]\\s*(?:(?:19|20)\\d{2}|present|current)\\b` + // employment year ranges
  '', 'gi')

function normDate(d: string): string {
  const s = d.toLowerCase().replace(/\./g, '')
  let m: RegExpMatchArray | null
  if ((m = s.match(/^([a-z]+)\s+(\d{4})$/))) return `${m[2]}-${String(MONTHS.indexOf(m[1].slice(0, 3)) + 1).padStart(2, '0')}`
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return `${m[2]}-${m[1].padStart(2, '0')}`
  // Formatting-only changes to employment year ranges must not look like date mutations.
  // A changed year still fails the multiset comparison.
  if ((m = s.match(/^((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|current)$/))) {
    return `${m[1]}-${m[2] === 'current' ? 'present' : m[2]}`
  }
  if (/^(present|current|now)$/.test(s)) return 'present'
  return s
}
function visibleUrlToken(value: string): string {
  let clean = value.trim().replace(/[.,]+$/g, '')
  while (clean.endsWith(')') &&
    (clean.match(/\)/g)?.length ?? 0) > (clean.match(/\(/g)?.length ?? 0)) {
    clean = clean.slice(0, -1)
  }
  return clean
}
function normUrl(value: string, visibleText = false): string {
  // Explicit DOCX relationship targets are compared exactly; only visible text
  // drops sentence punctuation that is not part of the clickable target.
  const clean = visibleText ? visibleUrlToken(value) : value.trim()
  const match = clean.match(/^(?:(https?):\/\/)?([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i)
  if (!match) return clean
  const [, rawScheme, rawAuthority, rawPath = '', rawQuery = '', rawFragment = ''] = match
  const at = rawAuthority.lastIndexOf('@')
  const userInfo = at >= 0 ? rawAuthority.slice(0, at + 1) : ''
  const hostAndPort = at >= 0 ? rawAuthority.slice(at + 1) : rawAuthority
  let hostname = hostAndPort
  let port = ''
  if (hostAndPort.startsWith('[')) {
    const close = hostAndPort.indexOf(']')
    if (close >= 0) {
      hostname = hostAndPort.slice(0, close + 1)
      port = hostAndPort.slice(close + 1)
    }
  } else {
    const colon = hostAndPort.lastIndexOf(':')
    if (colon > 0 && /^\d+$/.test(hostAndPort.slice(colon + 1))) {
      hostname = hostAndPort.slice(0, colon)
      port = hostAndPort.slice(colon)
    }
  }
  hostname = hostname.replace(/^www\./i, '').toLowerCase()
  const scheme = rawScheme ? rawScheme.toLowerCase() + '://' : ''
  // A slash on the origin root is equivalent; a trailing slash on a path is not.
  const pathname = rawPath === '/' ? '' : rawPath
  return scheme + userInfo + hostname + port + pathname + rawQuery + rawFragment
}
const normDigits = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; }

export type ResumeFacts = { name: string, emails: string[], phones: string[], urls: string[], dates: string[] }
export type RoundTripResult = { ok: boolean, problems: string[] }

export function extractFacts(text: string | null | undefined): ResumeFacts {
  const raw = String(text ?? '').normalize('NFC')
  const linkTargets = [...raw.matchAll(DOCX_LINK_RE)].map(match => {
    try { return decodeURIComponent(match[1]) } catch { return match[1] }
  })
  const visible = raw.replace(DOCX_LINK_RE, ' ')
  // name is compared exactly (after NFC + whitespace), so a hyphen -> en dash change in a name still fails
  const rawFirstLine = (visible.split(/\r?\n/).find(l => l.trim()) ?? '').trim()
  const firstLine = rawFirstLine.replace(/\s+/g, ' ')
  // Mammoth and Word can place the title in another run, after a tab, or in
  // the same paragraph after a visible separator. Keep only a clear 2-5-token
  // name prefix; if it is ambiguous, retain the full-line strict comparison.
  const namePattern = /^(?:[\p{L}][\p{L}'’.-]*\s+){1,4}[\p{L}][\p{L}'’.-]*$/u
  const cells = rawFirstLine.split(/\t+/).map(cell => cell.trim().split(/\s+[|•·—–-]\s+/)[0].trim()).filter(Boolean)
  let tabPrefix = ''
  for (const cell of cells) {
    tabPrefix = [tabPrefix, cell].filter(Boolean).join(' ').replace(/\s+/g, ' ')
    if (namePattern.test(tabPrefix)) break
  }
  const prefix = rawFirstLine.includes('\t') ? tabPrefix : firstLine.split(/\s+[|•·—–-]\s+/)[0].trim()
  const name = namePattern.test(prefix) ? prefix : firstLine
  const t = visible.replace(DASH, '-')
  const emailText = linkTargets.length ? t + '\n' + linkTargets.join('\n') : t
  const emails = (emailText.match(EMAIL) ?? []).map(e => e.toLowerCase())
  const noEmail = t.replace(EMAIL, ' ')
  const urls = [
    ...(noEmail.match(URL_RE) ?? []).map(url => normUrl(url, true)),
    ...linkTargets.map(target => normUrl(target)),
  ]
  const noUrl = noEmail.replace(URL_RE, ' ')
  const phones = [...noUrl.matchAll(PHONE)].map(m => ({ d: normDigits(m[1]), x: m[2] }))
    .filter(p => p.d.length >= 10 && p.d.length <= 15).map(p => p.x ? p.d + 'x' + p.x : p.d)
  const noPhone = noUrl.replace(PHONE, ' ')
  const dates = (noPhone.match(DATE) ?? []).map(normDate)
  return { name, emails, phones, urls, dates }
}

// multiset diff: items in a not matched in b
function missing(a: string[], b: string[]): string[] { const c = new Map<string, number>(); for (const x of b) c.set(x, (c.get(x) ?? 0) + 1)
  const out: string[] = []; for (const x of a) { const n = c.get(x) ?? 0; if (n) c.set(x, n - 1); else out.push(x); } return out; }

export function checkRoundTrip(sourceText: string, exportedText: string): RoundTripResult {
  const s = extractFacts(sourceText), e = extractFacts(exportedText), problems: string[] = []
  if (!s.name) problems.push('source has no name line')
  else if (s.name !== e.name) problems.push(`name changed: "${s.name}" -> "${e.name}"`)
  for (const k of ['emails', 'phones', 'urls', 'dates'] as const) {
    for (const x of missing(s[k], e[k])) problems.push(`${k.slice(0, -1)} missing/changed in export: ${x}`);
    for (const x of missing(e[k], s[k])) problems.push(`${k.slice(0, -1)} added in export: ${x}`);
  }
  return { ok: problems.length === 0, problems }
}

// Plain text of a .docx (the real exported file, not the in-memory object), one paragraph per line.
export async function docxText(docx: Buffer | Uint8Array | ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(docx)
  const file = zip.file('word/document.xml')
  if (!file) throw new Error('not a .docx: word/document.xml missing')
  // Include header/footer text as well as the body: Word may store contact details there.
  // Keep the body first so the name-line heuristic still sees the resume heading.
  const parts = ['word/document.xml', ...Object.keys(zip.files)
    .filter(p => /^word\/(?:header|footer)\d+\.xml$/i.test(p)).sort()]
  const textParts = await Promise.all(parts.map(async p => {
    const xml = await zip.file(p)!.async('string')
    return xml
      .replace(/<w:tab\s*\/>/g, '\t').replace(/<w:br\s*\/>|<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
      .replace(/\n{2,}/g, '\n').trim()
  }))
  return textParts.filter(Boolean).join('\n') + '\n'
}


// Identity extraction for the actual DOCX being sent. Mammoth's extractRawText omits
// Word headers/footers and returns hyperlink display text without external relationship
// targets. Read the body plus only referenced header/footer parts, and append external
// hyperlink targets so a visible label cannot hide a changed profile URL.
type DocxRelationship = { target: string; type: string; external: boolean }

function xmlAttribute(attributes: string, name: string): string {
  const match = attributes.match(new RegExp("(?:^|\\s)" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"))
  return match ? match[2] : ""
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_all, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_all, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&")
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function relationshipFileFor(part: string): string {
  const slash = part.lastIndexOf("/")
  return part.slice(0, slash + 1) + "_rels/" + part.slice(slash + 1) + ".rels"
}

function resolveRelationshipTarget(sourcePart: string, target: string): string {
  const absolute = target.startsWith("/")
  const segments = absolute ? [] : sourcePart.split("/").slice(0, -1)
  for (const segment of target.replace(/^\/+/, "").split("/")) {
    if (!segment || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return segments.join("/")
}

async function readDocxRelationships(zip: JSZip, part: string): Promise<Map<string, DocxRelationship>> {
  const file = zip.file(relationshipFileFor(part))
  if (!file) return new Map()
  const xml = await file.async("string")
  const relationships = new Map<string, DocxRelationship>()
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
    const attributes = match[1]
    const id = xmlAttribute(attributes, "Id")
    const target = xmlAttribute(attributes, "Target")
    const type = xmlAttribute(attributes, "Type")
    if (!id || !target || !type) continue
    relationships.set(id, {
      target: decodeXmlEntities(target),
      type,
      external: /^external$/i.test(xmlAttribute(attributes, "TargetMode")),
    })
  }
  return relationships
}

async function docxPartIdentityText(zip: JSZip, part: string): Promise<string> {
  const file = zip.file(part)
  if (!file) return ""
  const xml = await file.async("string")
  const relationships = await readDocxRelationships(zip, part)
  const linkTargets: string[] = []
  const withTargets = xml.replace(/<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink>/gi, (_all, attributes: string, inner: string) => {
    const id = xmlAttribute(attributes, "r:id")
    const relation = relationships.get(id)
    if (relation && relation.external && /\/hyperlink$/i.test(relation.type)) linkTargets.push(relation.target)
    return inner
  })
  const visibleText = decodeXmlEntities(withTargets
    .replace(/<w:tab\b[^>]*\/?\s*>/gi, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/\n{2,}/g, "\n")
    .trim()
  const markers = linkTargets.map(target => DOCX_LINK_START + encodeURIComponent(target) + DOCX_LINK_END)
  return [visibleText, ...markers].filter(Boolean).join("\n")
}

export async function docxIdentityText(docx: Buffer | Uint8Array | ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(docx)
  const documentPart = "word/document.xml"
  const documentFile = zip.file(documentPart)
  if (!documentFile) throw new Error("not a .docx: word/document.xml missing")
  const documentXml = await documentFile.async("string")
  const documentRelationships = await readDocxRelationships(zip, documentPart)
  const referencedParts = new Set<string>([documentPart])

  // Include only headers/footers actually referenced by a section. Old unused parts in a
  // template must not create false positives just because they remain inside the ZIP.
  for (const match of documentXml.matchAll(/<w:(?:header|footer)Reference\b([^>]*)\/?\s*>/gi)) {
    const id = xmlAttribute(match[1], "r:id")
    const relation = documentRelationships.get(id)
    if (!relation || relation.external || !/\/(?:header|footer)$/i.test(relation.type)) continue
    const part = resolveRelationshipTarget(documentPart, relation.target)
    if (/^word\/(?:header|footer)\d+\.xml$/i.test(part) && zip.file(part)) referencedParts.add(part)
  }

  const parts = [documentPart, ...[...referencedParts].filter(part => part !== documentPart).sort()]
  const textParts = await Promise.all(parts.map(part => docxPartIdentityText(zip, part)))
  return textParts.filter(Boolean).join("\n") + "\n"
}
