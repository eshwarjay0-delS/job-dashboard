// The library a person's tailored resumes build up, one job at a time.
//
// Asked on 13 Oct 2026: every resume made over WhatsApp is to be kept in Files, in a folder named for the kind of job
// ("SIEM and Incident Response"), so the next one is easier: the person does not send the starting resume again, the
// folder already holds a resume of that kind to start from, and what the jobs of that kind keep asking for is known.
// "You see the frequency of three to four times those keywords and points are being repeated. You attach those points
// and keep it in. And the less frequency ones, you can keep on replacing them."
//
// This file is the rules only: no storage, no network, no model. It decides the folder and the name, keeps the count of
// what each kind of job asks for, keeps the lines that were written more than once, lets the rare ones be replaced, and
// picks the saved resume to start the next one from. `resume-library-store.ts` reads and writes what this decides.

import { rankResumeCategories } from "./resumeOrganization.ts"

/** A file made for one job carries this in its name, so nothing mistakes it for a resume the person wrote. */
export const TAILORED_MARK = "(tailored)"
/** Asked for by this many jobs of a kind, a word or a line is "common" and is kept for good. */
export const COMMON_AT = 3
export const MOST_RARE_WORDS = 60
export const MOST_COMMON_POINTS = 40
export const MOST_RARE_POINTS = 30
export const MOST_FILES = 400
export const MOST_JOBS = 300
const MOST_JOBS_ON_A_POINT = 12
export const NO_EMAIL = "Needs email review"
export const NO_CATEGORY = "General Security"

/** Is this the name of a file made for one job? It may still carry its hash and ".docx". */
export function isTailoredName(name: string): boolean {
  return /\(tailored\)(?:__[a-f0-9]{16})?(?:\.docx)?$/i.test(String(name || "").trim())
}

// Only what a folder or a file name may hold on every system the library is kept on.
const tidyName = (s: string, most: number): string => String(s || "").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9._ ()-]+/g, " ").replace(/\s+/g, " ").replace(/^[ .]+|[ .]+$/g, "").slice(0, most).trim()

/** "Security Analyst - Northpier (tailored)__<hash>.docx": what it is for, said in the name. */
export function tailoredFileName(job: { role?: string; company?: string }, hash16: string): string {
  const role = tidyName(job.role || "", 60), company = tidyName(job.company || "", 40)
  const title = [role, company].filter(Boolean).join(" - ") || "Resume"
  const hash = /^[a-f0-9]{16}$/.test(hash16) ? hash16 : "0".repeat(16)
  return `${title} ${TAILORED_MARK}__${hash}.docx`
}

/** The folder a job's resume goes in: the kind of job, read from its title first and then the description. */
export function categoryForJob(jd: string, role = ""): string {
  // The title is said twice and put first: the words at the top of a text count for more, and a description is full of
  // words from other kinds of work ("you will work with the cloud team").
  const top = rankResumeCategories(`${role}\n${role}\n${jd}`, role)[0]
  return top && top.score ? top.category : NO_CATEGORY
}

export const folderFor = (email: string, category: string): string[] => [email || NO_EMAIL, category || NO_CATEGORY]

/** One saved resume. `path` is kept relative to the person's library, with "/" between its parts. */
export type SavedFile = { path: string; email: string; category: string; role: string; company: string; at: number; depth: number; job: string; covers: string[]; from?: string }
/** A line written for a job, and the jobs it was written for again. */
export type Point = { text: string; words: string[]; jobs: string[]; first: number; last: number }
/** What is known about one kind of job for one person: the jobs seen, what they asked for, the lines that answered them. */
export type Shelf = { email: string; category: string; jobs: string[]; words: Record<string, { n: number; last: number }>; points: Point[] }
export type Library = { version: 1; files: SavedFile[]; shelves: Record<string, Shelf> }

export const emptyLibrary = (): Library => ({ version: 1, files: [], shelves: {} })
export const shelfKey = (email: string, category: string): string => `${email || NO_EMAIL} / ${category || NO_CATEGORY}`

/** The same job description gives the same key, however its spaces and capitals came through. */
export function jobKeyOf(jd: string): string {
  const text = String(jd || "").toLowerCase().replace(/\s+/g, " ").trim()
  let a = 0x811c9dc5, b = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x85ebca6b) + 0x9e3779b9
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}${text.length.toString(36)}`
}

const lower = (s: string): string => String(s || "").toLowerCase()
const isWordChar = (c: string | undefined): boolean => !!c && /[a-z0-9]/.test(c)
/** Is the word in the text as a word of its own? "ot" is not in "robot"; "c++" and "att&ck" are found as written. */
export function saysWord(text: string, word: string): boolean {
  const hay = lower(text), needle = lower(word).trim()
  if (!needle) return false
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
    const before = hay[at - 1], after = hay[at + needle.length]
    if ((!isWordChar(needle[0]) || !isWordChar(before)) && (!isWordChar(needle[needle.length - 1]) || !isWordChar(after))) return true
  }
  return false
}

const SMALL = new Set("the and for with from that this into over under across using used use via per our your their its was were are has have had will can all any each more most than then also such while within including through during".split(" "))
const wordsOf = (text: string): Set<string> => new Set(lower(text).replace(/[^a-z0-9+#&/.-]+/g, " ").split(" ").map(w => w.replace(/^[.-]+|[.-]+$/g, "")).filter(w => w.length > 2 && !SMALL.has(w)))
/** Two lines say the same thing when most of their words are shared. */
export function alike(a: string, b: string): boolean {
  const x = wordsOf(a), y = wordsOf(b)
  if (x.size < 4 || y.size < 4) return lower(a).trim() === lower(b).trim()
  let both = 0
  for (const w of x) if (y.has(w)) both++
  return both / (x.size + y.size - both) >= 0.6
}

const cleanLine = (s: string): string => String(s || "").replace(/\s+/g, " ").trim()
const uniqueWords = (list: unknown): string[] => [...new Set((Array.isArray(list) ? list : []).filter(w => typeof w === "string" || typeof w === "number").map(w => lower(String(w)).trim()).filter(w => w && w.length <= 60))]

/** The lines a tailoring wrote into the experience part: these are the "points" worth keeping. */
export function pointsOf(diff: { section: string; after: string }[] | undefined): { text: string }[] {
  return (diff || []).filter(d => /^experience/i.test(d.section || "")).map(d => ({ text: cleanLine(d.after) })).filter(p => p.text.length >= 30)
}

export type Run = {
  path: string; email: string; category: string; role: string; company: string
  /** 1: made from a resume the person wrote. 2: made from a saved resume that was itself made for a job. */
  depth: number
  from?: string
  jd: string
  /** What the job asked for, and which of it the saved file shows. */
  asked: string[]; covers: string[]
  points?: { text: string }[]
  /** The saved file this one takes the place of: a change the person asked for to the same resume. */
  replaces?: string
}

/** The library after one more resume is saved. Nothing is changed in the library handed in. */
export function recordRun(library: Library, run: Run, now: number): Library {
  const next: Library = JSON.parse(JSON.stringify(library && library.version === 1 ? library : emptyLibrary()))
  const asked = uniqueWords(run.asked), covers = uniqueWords(run.covers).filter(w => asked.includes(w) || !asked.length)
  const job = jobKeyOf(run.jd)

  next.files = next.files.filter(f => f.path !== run.path && f.path !== run.replaces)
  next.files.push({ path: run.path, email: run.email, category: run.category, role: cleanLine(run.role).slice(0, 120), company: cleanLine(run.company).slice(0, 80), at: now, depth: run.depth >= 2 ? 2 : 1, job, covers, ...(run.from ? { from: run.from } : {}) })
  if (next.files.length > MOST_FILES) next.files = next.files.sort((a, b) => a.at - b.at).slice(-MOST_FILES)

  const key = shelfKey(run.email, run.category)
  const shelf: Shelf = next.shelves[key] || { email: run.email, category: run.category, jobs: [], words: {}, points: [] }
  // A job counts once, however many times its resume is made again or changed.
  const seen = shelf.jobs.includes(job)
  if (!seen) shelf.jobs = [...shelf.jobs, job].slice(-MOST_JOBS)
  for (const word of asked) {
    const had = shelf.words[word]
    shelf.words[word] = { n: (had?.n || 0) + (seen ? 0 : 1) || 1, last: now }
  }
  for (const point of run.points || []) {
    const text = cleanLine(point.text)
    if (text.length < 30) continue
    const words = asked.filter(w => saysWord(text, w))
    const same = shelf.points.find(p => alike(p.text, text))
    if (same) {
      // The newest wording is the one kept: it is the one that was last sent out.
      same.text = text; same.last = now
      same.words = [...new Set([...same.words, ...words])].slice(0, 24)
      if (!same.jobs.includes(job)) same.jobs = [...same.jobs, job].slice(-MOST_JOBS_ON_A_POINT)
    } else shelf.points.push({ text: text.slice(0, 600), words: words.slice(0, 24), jobs: [job], first: now, last: now })
  }

  // What keeps coming back stays. What came once or twice is kept only while it is recent: the newest take its place.
  const rare = Object.entries(shelf.words).filter(([, w]) => w.n < COMMON_AT).sort((a, b) => b[1].last - a[1].last || a[0].localeCompare(b[0]))
  for (const [word] of rare.slice(MOST_RARE_WORDS)) delete shelf.words[word]
  const often = shelf.points.filter(p => p.jobs.length >= COMMON_AT).sort((a, b) => b.jobs.length - a.jobs.length || b.last - a.last).slice(0, MOST_COMMON_POINTS)
  const seldom = shelf.points.filter(p => p.jobs.length < COMMON_AT).sort((a, b) => b.last - a.last).slice(0, MOST_RARE_POINTS)
  shelf.points = [...often, ...seldom]
  next.shelves[key] = shelf
  return next
}

export type Learned = { email: string; category: string; jobs: number; files: number; common: { word: string; jobs: number }[]; recent: string[]; points: { text: string; jobs: number; words: string[] }[] }

/** What one kind of job has taught so far, in the order a person would want it read. */
export function learnedOf(library: Library, email: string, category: string): Learned {
  const shelf = library.shelves[shelfKey(email, category)]
  const files = library.files.filter(f => f.email === email && f.category === category).length
  if (!shelf) return { email, category, jobs: 0, files, common: [], recent: [], points: [] }
  const words = Object.entries(shelf.words)
  return {
    email, category, jobs: shelf.jobs.length, files,
    common: words.filter(([, w]) => w.n >= COMMON_AT).sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([word, w]) => ({ word, jobs: w.n })),
    recent: words.filter(([, w]) => w.n < COMMON_AT).sort((a, b) => b[1].last - a[1].last || a[0].localeCompare(b[0])).slice(0, 12).map(([word]) => word),
    points: shelf.points.filter(p => p.jobs.length >= COMMON_AT).map(p => ({ text: p.text, jobs: p.jobs.length, words: p.words })),
  }
}

/** Every kind of job in the library, the one with the most jobs first. */
export function learnedAll(library: Library): Learned[] {
  return Object.values(library.shelves).map(s => learnedOf(library, s.email, s.category)).sort((a, b) => b.jobs - a.jobs || a.category.localeCompare(b.category))
}

/**
 * The saved resume to start the next one from: of the same person and the same kind of job, the one that already shows
 * the most of what this job asks for. Only a resume made straight from one the person wrote is used (depth 1), so a
 * resume is never built on a copy of a copy: each pass rewrites lines, and a third pass on the same lines drifts from
 * what the person did.
 */
export function pickBase(library: Library, want: { email: string; category: string; asked: string[] }): { file: SavedFile; shows: number; of: number } | null {
  const asked = uniqueWords(want.asked)
  const fits = library.files.filter(f => f.depth === 1 && f.email === want.email && f.category === want.category)
  if (!fits.length) return null
  const scored = fits.map(file => ({ file, shows: asked.filter(w => file.covers.includes(w)).length, of: asked.length }))
  scored.sort((a, b) => b.shows - a.shows || b.file.at - a.file.at)
  return scored[0]
}

/** A library read back from storage, with anything it should not hold left out. */
export function validLibrary(raw: unknown): Library {
  const src = raw as Partial<Library> | null
  if (!src || typeof src !== "object" || src.version !== 1) return emptyLibrary()
  const text = (v: unknown, most: number): string => (typeof v === "string" ? v.slice(0, most) : "")
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  const files: SavedFile[] = (Array.isArray(src.files) ? src.files : []).filter(f => f && typeof f.path === "string" && f.path && !f.path.includes("..") && !/^[\\/]|^[a-z]:/i.test(f.path)).slice(-MOST_FILES).map(f => ({
    path: text(f.path, 400), email: text(f.email, 120), category: text(f.category, 80), role: text(f.role, 120), company: text(f.company, 80), at: num(f.at), depth: f.depth === 2 ? 2 : 1, job: text(f.job, 40), covers: uniqueWords(f.covers).slice(0, 200), ...(typeof f.from === "string" && f.from ? { from: text(f.from, 200) } : {}),
  }))
  const shelves: Record<string, Shelf> = {}
  for (const s of Object.values(src.shelves && typeof src.shelves === "object" ? src.shelves : {})) {
    if (!s || typeof s !== "object") continue
    const words: Shelf["words"] = {}
    for (const [word, w] of Object.entries(s.words && typeof s.words === "object" ? s.words : {})) if (word && word.length <= 60 && w && num(w.n) > 0) words[lower(word)] = { n: Math.floor(num(w.n)), last: num(w.last) }
    const points: Point[] = (Array.isArray(s.points) ? s.points : []).filter(p => p && typeof p.text === "string" && p.text.trim()).slice(0, MOST_COMMON_POINTS + MOST_RARE_POINTS).map(p => ({ text: text(p.text, 600), words: uniqueWords(p.words).slice(0, 24), jobs: (Array.isArray(p.jobs) ? p.jobs : []).filter(j => typeof j === "string").slice(-MOST_JOBS_ON_A_POINT), first: num(p.first), last: num(p.last) }))
    const email = text(s.email, 120), category = text(s.category, 80)
    shelves[shelfKey(email, category)] = { email, category, jobs: (Array.isArray(s.jobs) ? s.jobs : []).filter(j => typeof j === "string").slice(-MOST_JOBS), words, points }
  }
  return { version: 1, files, shelves }
}

/** The one line the bot adds under a resume once a kind of job has been seen often enough to say something true. */
export function learnedLine(learned: Learned): string {
  if (learned.jobs < COMMON_AT || !learned.common.length) return ""
  return `Asked for by ${COMMON_AT} or more of your ${learned.jobs} ${learned.category} jobs: ${learned.common.slice(0, 8).map(c => c.word).join(", ")}`
}
