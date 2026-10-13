// Reads and writes what `resume-library.ts` decides: the tailored files in a person's Files, and the record of what
// each kind of job keeps asking for. The record is `_library.json` at the top of the person's library; Files lists
// resumes only, so it is never shown as one.
//
// Two resumes saved for the same person in the same second would both read the record and the later write would win,
// losing the first one's counts (the file itself is still saved). The bot answers one message at a time per number, so
// this is left as it is.

import path from "path"
import { createHash } from "crypto"
import { readPath, readPathText, writePath, deletePath, existsPath, listFiles } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { resumeEmails, rankResumeCategories } from "@/lib/resumeOrganization"
import { extractJdKeywords, coveredJdKeywords } from "@/lib/keywords"
import { pdfText } from "@/lib/pdf-text"
import { categoryForJob, emptyLibrary, folderFor, isTailoredName, learnedOf, recordRun, tailoredFileName, validLibrary, NO_CATEGORY, type Learned, type Library } from "@/lib/resume-library"

export const LIBRARY_FILE = "_library.json"

/** A path inside the person's library, as it is kept in the record: relative, with "/" between its parts. */
export const relOf = (userDir: string, abs: string): string => path.relative(userDir, abs).split(path.sep).join("/")
export const absOf = (userDir: string, rel: string): string => path.join(userDir, ...String(rel).split("/").filter(p => p && p !== "." && p !== ".."))
const inside = (dir: string, abs: string): boolean => path.resolve(abs).startsWith(path.resolve(dir) + path.sep)

export async function readLibrary(userDir: string): Promise<Library> {
  try {
    const raw = await readPathText(path.join(userDir, LIBRARY_FILE))
    return raw ? validLibrary(JSON.parse(raw)) : emptyLibrary()
  } catch { return emptyLibrary() }
}
async function writeLibrary(userDir: string, library: Library): Promise<void> {
  await writePath(path.join(userDir, LIBRARY_FILE), JSON.stringify(library))
}

/**
 * The record, made to agree with what is really in Files. The person can delete or move a file there at any time: a
 * file that is gone leaves the record, and one that was moved is found again by its name (the name carries a hash of
 * what is in it, so it is the same file wherever it sits).
 */
export async function readLibraryChecked(userDir: string): Promise<Library> {
  const library = await readLibrary(userDir)
  if (!library.files.length) return library
  const there = (await listFiles(userDir).catch(() => [] as string[])).filter(f => /\.docx$/i.test(f)).map(f => relOf(userDir, f))
  const have = new Set(there)
  const byName = new Map(there.map(rel => [rel.split("/").pop() as string, rel]))
  let changed = false
  const files = library.files.flatMap(f => {
    if (have.has(f.path)) return [f]
    changed = true
    const moved = byName.get(f.path.split("/").pop() as string)
    return moved && !library.files.some(o => o.path === moved) ? [{ ...f, path: moved }] : []
  })
  if (!changed) return library
  const next = { ...library, files }
  await writeLibrary(userDir, next).catch(() => {})
  return next
}

/** `counted` is true when this was a job of its kind not seen before (not the same job made again, not a change to it). */
export type SavedTailored = { abs: string; rel: string; email: string; category: string; learned: Learned; counted: boolean }

/**
 * Keep one tailored resume in the person's Files, in the folder for its kind of job, and count what the job asked for.
 * `asked`/`covers`/`points` come from the tailoring when there was one; for a resume made earlier they are read from
 * the job description and the file.
 */
export async function saveTailored(opts: {
  userDir: string; bytes: Buffer; jd: string; role?: string; company?: string; depth: number; from?: string
  asked?: string[]; covers?: string[]; points?: { text: string }[]; replaces?: string; now?: number
}): Promise<SavedTailored> {
  const plain = await extractText(opts.bytes)
  const emails = resumeEmails(plain)
  const email = emails.length === 1 ? emails[0] : ""
  const category = categoryForJob(opts.jd)
  const asked = opts.asked?.length ? opts.asked : extractJdKeywords(opts.jd)
  const covers = opts.covers?.length ? opts.covers : [...coveredJdKeywords(plain, asked)]
  const hash = createHash("sha256").update(opts.bytes).digest("hex").slice(0, 16)
  const abs = path.join(opts.userDir, ...folderFor(email, category), tailoredFileName({ role: opts.role, company: opts.company }, hash))
  if (!inside(opts.userDir, abs)) throw new Error("The file would be saved outside the library.")
  await writePath(abs, opts.bytes)

  // A change the person asked for takes the place of the file it changed: one job, one file, the newest.
  const replaces = opts.replaces && opts.replaces !== abs && inside(opts.userDir, opts.replaces) && isTailoredName(path.basename(opts.replaces)) ? opts.replaces : ""
  if (replaces) await deletePath(replaces).catch(() => {})

  const email_ = folderFor(email, category)[0]
  const before = await readLibrary(opts.userDir)
  const library = recordRun(before, {
    path: relOf(opts.userDir, abs), email: email_, category, role: opts.role || "", company: opts.company || "", depth: opts.depth, from: opts.from,
    jd: opts.jd, asked, covers, points: opts.points, replaces: replaces ? relOf(opts.userDir, replaces) : undefined,
  }, opts.now ?? Date.now())
  await writeLibrary(opts.userDir, library)
  const learned = learnedOf(library, email_, category)
  return { abs, rel: relOf(opts.userDir, abs), email: email_, category, learned, counted: learned.jobs > learnedOf(before, email_, category).jobs }
}

/** Take a saved resume back out: the file and its line in the record. (It was saved, then could not be sent.) */
export async function forgetTailored(userDir: string, abs: string): Promise<void> {
  if (!inside(userDir, abs) || !isTailoredName(path.basename(abs))) return
  await deletePath(abs).catch(() => {})
  const library = await readLibrary(userDir)
  const rel = relOf(userDir, abs)
  if (!library.files.some(f => f.path === rel)) return
  await writeLibrary(userDir, { ...library, files: library.files.filter(f => f.path !== rel) })
}

/**
 * Keep a file the person sent (a Word file or a PDF) in Files: under the email written on it, in the folder for the kind
 * of work it shows. A PDF whose words cannot be read is still kept; it goes by its name alone.
 */
export async function saveUpload(opts: { userDir: string; bytes: Buffer; filename: string; kind: "docx" | "pdf" }): Promise<{ abs: string; folder: string; name: string; read: boolean; existed: boolean }> {
  const plain = opts.kind === "pdf" ? await pdfText(opts.bytes) : await extractText(opts.bytes).catch(() => "")
  const base = path.posix.basename(String(opts.filename || "").replace(/\\/g, "/")).replace(/\.(docx|pdf)$/i, "").replace(/[^A-Za-z0-9._ ()-]/g, "_").replace(/^[. ]+/, "").slice(0, 150) || "Resume"
  const emails = resumeEmails(plain)
  const top = rankResumeCategories(plain, base)[0]
  const parts = folderFor(emails.length === 1 ? emails[0] : "", top && top.score ? top.category : NO_CATEGORY)
  const hash = createHash("sha256").update(opts.bytes).digest("hex").slice(0, 16)
  const abs = path.join(opts.userDir, ...parts, `${base.replace(/__[a-f0-9]{16}$/i, "")}__${hash}.${opts.kind}`)
  if (!inside(opts.userDir, abs)) throw new Error("The file would be saved outside the library.")
  // The name carries a hash of what is in the file, so the same file sent again is the same path: it is not written twice.
  const existed = await existsPath(abs)
  if (!existed) await writePath(abs, opts.bytes)
  return { abs, folder: parts.join(" / "), name: base, read: !!plain.trim(), existed }
}

/** The bytes of a saved file, only when it is inside this person's library. */
export async function readSaved(userDir: string, abs: string): Promise<Buffer | null> {
  return inside(userDir, abs) ? readPath(abs) : null
}
