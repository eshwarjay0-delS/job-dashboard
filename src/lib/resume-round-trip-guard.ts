// Round-trip guard (v2, 2026-10-29): the name, contact details and dates in the source resume must survive
// unchanged in the exported resume. Used as the WhatsApp send check. Unicode dashes, phone extensions and NFC names handled.
import JSZip from 'jszip'

const MON = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s|,;()<>]+|\b(?:linkedin\.com|github\.com|gitlab\.com)\/[^\s|,;()<>]+/gi
// phones: 10-15 digits with common separators, optional +country, optional extension (ext. 27 / x27 / #27)
const PHONE = /(?<![\w/-])((?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4})(?:\s*(?:ext\.?|extension|x|#)\s*(\d{1,6}))?(?![\w/-])/gi
// Unicode dashes (hyphen, NB hyphen, figure, en, em, minus) read as '-', so en-dash phones and ranges are seen.
const DASH = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g
const DATE = new RegExp(
  `\\b(?:${MON})\\.?\\s+\\d{4}\\b` +           // Jan 2020
  `|\\b(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2}\\b` + // 01/2020
  `|\\b(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])\\b` +    // 2020-01
  `|\\b(?:19|20)\\d{2}\\b` +                      // 2019
  `|\\b(?:present|current|now)\\b`, 'gi')

function normDate(d: string): string {
  const s = d.toLowerCase().replace(/\./g, '')
  let m: RegExpMatchArray | null
  if ((m = s.match(/^([a-z]+)\s+(\d{4})$/))) return `${m[2]}-${String(MONTHS.indexOf(m[1].slice(0, 3)) + 1).padStart(2, '0')}`
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return `${m[2]}-${m[1].padStart(2, '0')}`
  if (/^(present|current|now)$/.test(s)) return 'present'
  return s
}
const normUrl = (u: string) => u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/.]+$/, '')
const normDigits = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; }

export type ResumeFacts = { name: string, emails: string[], phones: string[], urls: string[], dates: string[] }
export type RoundTripResult = { ok: boolean, problems: string[] }

export function extractFacts(text: string | null | undefined): ResumeFacts {
  const raw = String(text ?? '').normalize('NFC')
  // name is compared exactly (after NFC + whitespace), so a hyphen -> en dash change in a name still fails
  const name = (raw.split(/\r?\n/).find(l => l.trim()) ?? '').trim().replace(/\s+/g, ' ')
  const t = raw.replace(DASH, '-')
  const emails = (t.match(EMAIL) ?? []).map(e => e.toLowerCase())
  const noEmail = t.replace(EMAIL, ' ')
  const urls = (noEmail.match(URL_RE) ?? []).map(normUrl)
  const noUrl = noEmail.replace(URL_RE, ' ')
  const phones = [...noUrl.matchAll(PHONE)].map(m => ({ d: normDigits(m[1]), x: m[2] }))
    .filter(p => p.d.length >= 10 && p.d.length <= 15).map(p => p.x ? `${p.d}x${p.x}` : p.d)
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
  const xml = await file.async('string')
  return xml
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>|<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{2,}/g, '\n').trim() + '\n'
}
