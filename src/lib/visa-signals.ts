// Visa signals on an Apply listing (competitor idea 5, seen at Jobright and LazyApply; owner, 23 Oct 2026: "add all").
// MFit candidates are staffing candidates on GC, H1B and C2C (CLAUDE.md), so the mistakes this prevents are:
// - a candidate submitted to a posting whose own words rule them out ("USC only", "no H1B", "W2 only"), which wastes
//   the submission and can cost the candidate with that client;
// - a guess shown as a fact. Every signal names where it came from: the posting's own words, or MFit's hand-kept list
//   of known H1B filers (src/lib/h1b.ts), which is not DOL records. A filter only hides postings that rule a candidate
//   out; it never promises that a posting will take them, and the page says so (VISA_CAVEAT).
// "No sponsorship" alone does not hide a posting from the H1B filter: an H1B consultant on C2C through their own
// employer often still qualifies. It is shown as a caution instead, so the person asks rather than being filtered out.
import { listedSponsor } from './h1b.ts'
import { contractTypes } from './contract-jobs.ts'

export type VisaFilter = 'Any' | 'H1B' | 'C2C' | 'GC'
export const VISA_FILTERS: VisaFilter[] = ['Any', 'H1B', 'C2C', 'GC']
export const VISA_CAVEAT = 'Visa filters read the posting’s own words and MFit’s short list of known H1B filers (not DOL records). They hide postings that rule you out. A filter is a starting point, not a guarantee: confirm with the recruiter before you submit.'

export type VisaSignals = {
  h1b: 'yes' | 'no' | null
  c2c: 'yes' | 'no' | null
  gc: 'yes' | 'no' | null
  /** The posting says it will not sponsor: a caution for H1B, not a rule-out. */
  noSponsorship: boolean
  /** The employer is on MFit's list of known H1B filers. */
  sponsorList: boolean
  /** Plain labels, each saying where it came from. */
  badges: string[]
}

// One spelling for each term, so "H-1B", "U.S. citizens", "green card" and "corp-to-corp" are read the same way.
function plain(text: string): string {
  return ` ${text.toLowerCase()} `
    .replace(/<[^>]+>/g, ' ')
    .replace(/h[-\s]?1[-\s]?b/g, 'h1b')
    .replace(/\bu\.?\s?s\.?\s+citizen(?:s|ship)?\b/g, 'usc')
    .replace(/\bus\s+citizen(?:s|ship)?\b/g, 'usc')
    .replace(/\bcitizens?\s+only\b/g, 'usc only')
    .replace(/\bgreen[-\s]?cards?\b|\bpermanent\s+residents?\b/g, 'gc')
    .replace(/corp[-\s]?to[-\s]?corp/g, 'c2c')
    .replace(/\bw[-\s]?2\b/g, 'w2')
    .replace(/\s+/g, ' ')
}

export function visaSignals(job: { title?: string; company?: string; description?: string; contractTypes?: string[] }): VisaSignals {
  const t = plain(`${job.title || ''}\n${job.description || ''}`)
  const clearance = /\b(?:security|secret|top secret|ts\/sci|ts|public trust)\s+clearance\b|\bclearance\s+(?:is\s+)?required\b|\bts\/sci\b/.test(t)
  const citizensOnly = /\busc\s*(?:only|required)\b|\bmust\s+be\s+(?:a\s+|an\s+)?usc\b|\bonly\s+usc\b(?!\s*(?:\/|or|and|,|&)\s*gc)/.test(t)
  const uscGcOnly = /\b(?:usc|gc)\s*(?:\/|or|and|,|&)\s*(?:usc|gc)(?:\s*holders)?\s*(?:only|required)\b|\bonly\s+(?:usc|gc)\s*(?:\/|or|and|,|&)\s*(?:usc|gc)\b/.test(t)
  const h1bNo = /\bno\s+h1bs?\b|\bh1bs?\s+(?:not|isn'?t|aren'?t)\s+(?:accepted|considered|eligible)\b|\b(?:not|cannot|can'?t|unable to)\s+(?:accept|consider)\s+h1b/.test(t)
  const h1bYes = /\bh1bs?\s+(?:transfer|candidates|holders|ok|okay|welcome|accepted|fine|considered|eligible)\b|\b(?:visa\s+)?sponsorship\s+(?:is\s+)?(?:available|provided|offered)\b|\b(?:will|we|can)\s+sponsor\b/.test(t)
  const noSponsorship = /\bno\s+(?:visa\s+)?sponsorship\b|\b(?:not|unable to|cannot|can'?t|will not|won'?t|do not|does not)\s+(?:be\s+able\s+to\s+)?(?:provide\s+|offer\s+)?(?:visa\s+)?sponsor|\bwithout\s+(?:visa\s+)?sponsorship\b/.test(t)
  const gcNamed = /\bgc\b/.test(t) && !/\bno\s+gcs?\b|\bnot?\s+(?:accept(?:ing)?\s+)?gcs?\b/.test(t)
  const c2cNo = /\bw2\s+only\b|\bonly\s+w2\b|\bno\s+c2c\b|\bnot?\s+(?:open\s+to\s+)?c2c\b|\bno\s+third[-\s]part(?:y|ies)\b/.test(t)
  const c2cYes = !c2cNo && ((job.contractTypes || []).includes('C2C') || contractTypes(t).includes('C2C'))
  const sponsorList = listedSponsor(job.company || '')

  const h1b: VisaSignals['h1b'] = h1bNo || uscGcOnly || citizensOnly || clearance ? 'no' : h1bYes ? 'yes' : null
  const gc: VisaSignals['gc'] = gcNamed ? 'yes' : citizensOnly || clearance ? 'no' : null
  const c2c: VisaSignals['c2c'] = c2cNo ? 'no' : c2cYes ? 'yes' : null

  const badges: string[] = []
  if (h1b === 'yes') badges.push('Posting: H1B ok')
  if (h1bNo || uscGcOnly) badges.push('Posting: no H1B')
  if (noSponsorship && h1b !== 'no') badges.push('Posting: no sponsorship (ask if C2C via your employer works)')
  if (sponsorList) badges.push('Known H1B filer (MFit list)')
  if (gc === 'yes') badges.push('Posting: GC ok')
  if (citizensOnly) badges.push('Posting: US citizens only')
  if (clearance) badges.push('Posting: clearance required')
  if (c2c === 'yes') badges.push('Posting: C2C ok')
  if (c2c === 'no') badges.push('Posting: W2 only')
  return { h1b, c2c, gc, noSponsorship, sponsorList, badges }
}

/** A posting is hidden only when its own words rule the candidate out. */
export function visaAllows(filter: VisaFilter, s: VisaSignals): boolean {
  if (filter === 'H1B') return s.h1b !== 'no'
  if (filter === 'C2C') return s.c2c !== 'no'
  if (filter === 'GC') return s.gc !== 'no'
  return true
}
