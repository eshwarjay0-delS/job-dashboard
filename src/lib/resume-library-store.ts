// Reads and writes what `resume-library.ts` decides: the tailored files in a person's Files, and the record of what
// each kind of job keeps asking for.
//
// ONE RECORD FOR EACH FOLDER (13 Oct 2026: "maintain separate repo with headlines. Not even in the same repo!!"). The
// record of a folder is `_library.json` INSIDE that folder (<email>/<kind of job>/_library.json), beside its files.
// Making or picking a resume of one kind reads and writes that one small file; nothing of another kind is touched, and
// two kinds saved at the same moment cannot overwrite each other. Files lists resumes only, so a record is never shown.
// The first version kept one record for the whole library at its top; it is split into the folders the first time it
// is met, and then removed.
//
// A FOLDER IS NAMED BY THE EMAIL AND NOTHING ELSE ("Just always only takes the emails"). A folder that was named with
// more than the address ("x@gmail.comlinkedin") is put back under the address: its files are moved, and its record is
// joined to the one already there.

import path from "path"
import { createHash } from "crypto"
import { readPath, readPathText, writePath, deletePath, existsPath, listFiles, movePath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { resumeEmails, rankResumeCategories, cleanEmail } from "@/lib/resumeOrganization"
import { extractJdKeywords, coveredJdKeywords } from "@/lib/keywords"
import { pdfText } from "@/lib/pdf-text"
import { categoryForJob, duplicatesIn, emptyLibrary, folderFor, isTailoredName, learnedOf, madeFor, mergeLibraries, recordRun, relabelEmail, shelfOnly, shelvesIn, supersededBy, tailoredFileName, validLibrary, NO_CATEGORY, type Learned, type Library, type SavedFile } from "@/lib/resume-library"

export const LIBRARY_FILE = "_library.json"

/** A path inside the person's library, as it is kept in the record: relative, with "/" between its parts. */
export const relOf = (userDir: string, abs: string): string => path.relative(userDir, abs).split(path.sep).join("/")
export const absOf = (userDir: string, rel: string): string => path.join(userDir, ...String(rel).split("/").filter(p => p && p !== "." && p !== ".."))
const inside = (dir: string, abs: string): boolean => path.resolve(abs).startsWith(path.resolve(dir) + path.sep)
const recordOf = (userDir: string, email: string, category: string): string => path.join(userDir, ...folderFor(email, category), LIBRARY_FILE)
const parse = (raw: string | null): Library => { try { return raw ? validLibrary(JSON.parse(raw)) : emptyLibrary() } catch { return emptyLibrary() } }

/** The first version's single record, split into its folders and removed. True when there was one. */
async function splitOldRecord(userDir: string): Promise<boolean> {
  const old = path.join(userDir, LIBRARY_FILE)
  const raw = await readPathText(old).catch(() => null)
  if (!raw) return false
  let library = parse(raw)
  // An email written with more than the address is put right on the way.
  for (const email of new Set([...library.files.map(f => f.email), ...Object.values(library.shelves).map(sh => sh.email)])) {
    const clean = email.includes("@") ? cleanEmail(email) : email
    if (clean && clean !== email) library = relabelEmail(library, email, clean)
  }
  for (const [email, category] of shelvesIn(library)) {
    const here = parse(await readPathText(recordOf(userDir, email, category)).catch(() => null))
    await writePath(recordOf(userDir, email, category), JSON.stringify(mergeLibraries(here, shelfOnly(library, email, category))))
  }
  await deletePath(old).catch(() => {})
  return true
}

/** The record of one folder: what this kind of job has taught, and the files saved in it. One small read. */
export async function readShelf(userDir: string, email: string, category: string): Promise<Library> {
  const raw = await readPathText(recordOf(userDir, email, category)).catch(() => null)
  if (raw) return parse(raw)
  // Not there: either nothing was saved for this kind yet, or the old single record has not been split.
  return (await splitOldRecord(userDir)) ? parse(await readPathText(recordOf(userDir, email, category)).catch(() => null)) : emptyLibrary()
}
async function writeShelf(userDir: string, library: Library, email: string, category: string): Promise<void> {
  await writePath(recordOf(userDir, email, category), JSON.stringify(shelfOnly(library, email, category)))
}

/**
 * A top folder named with more than an address ("x@gmail.comlinkedin") is put back under the address alone. Its files
 * are moved (a file already there is kept once), and its records are joined to the ones already there.
 */
async function mendEmailFolders(userDir: string, all: string[]): Promise<boolean> {
  const wrong = new Map<string, string>()
  for (const abs of all) {
    const top = relOf(userDir, abs).split("/")[0]
    if (!top.includes("@") || wrong.has(top)) continue
    const clean = cleanEmail(top)
    if (clean && clean !== top) wrong.set(top, clean)
  }
  if (!wrong.size) return false
  for (const abs of all) {
    const parts = relOf(userDir, abs).split("/")
    const right = wrong.get(parts[0])
    if (!right) continue
    const dest = absOf(userDir, [right, ...parts.slice(1)].join("/"))
    if (parts[parts.length - 1] === LIBRARY_FILE) {
      const moved = relabelEmail(parse(await readPathText(abs).catch(() => null)), parts[0], right)
      await writePath(dest, JSON.stringify(mergeLibraries(parse(await readPathText(dest).catch(() => null)), moved)))
      await deletePath(abs).catch(() => {})
    } else if (!(await existsPath(dest))) await movePath(abs, dest)
    // The same name is already under the email. Only a true copy is dropped; a file that reads differently is kept
    // beside it under a second name, so nothing the person put there is ever lost to the tidying.
    else if (await sameBytes(abs, dest)) await deletePath(abs).catch(() => {})
    else await movePath(abs, await freeName(dest))
  }
  return true
}
async function sameBytes(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([readPath(a).catch(() => null), readPath(b).catch(() => null)])
  return !!x && !!y && x.equals(y)
}
async function freeName(dest: string): Promise<string> {
  const ext = path.extname(dest), stem = dest.slice(0, dest.length - ext.length)
  for (let n = 2; n < 50; n++) { const next = `${stem} (${n})${ext}`; if (!(await existsPath(next))) return next }
  return `${stem} (${createHash("sha256").update(dest + ext).digest("hex").slice(0, 8)})${ext}`
}

/**
 * Put the library in order before it is shown: a folder named with more than the email goes back under the email, and
 * the first version's single record is split into the folders. Costs one listing when there is nothing to do.
 */
export async function mendLibrary(userDir: string): Promise<void> {
  const all = await listFiles(userDir).catch(() => [] as string[])
  const moved = await mendEmailFolders(userDir, all).catch(error => { console.error("[library] folders not mended", String(error).slice(0, 200)); return false })
  if (all.some(f => relOf(userDir, f) === LIBRARY_FILE)) await splitOldRecord(userDir).catch(() => false)
  // One job, one file: a folder that came to hold the same job twice is put right before it is shown.
  const now = moved ? await listFiles(userDir).catch(() => [] as string[]) : all
  await removeDuplicates(userDir, now).catch(error => console.error("[library] duplicates not removed", String(error).slice(0, 200)))
}

/** Every folder's record as one library, read from what is really there. */
export async function readLibrary(userDir: string): Promise<Library> {
  return (await readAll(userDir)).library
}
async function readAll(userDir: string): Promise<{ library: Library; all: string[] }> {
  let all = await listFiles(userDir).catch(() => [] as string[])
  let again = await mendEmailFolders(userDir, all).catch(error => { console.error("[library] folders not mended", String(error).slice(0, 200)); return false })
  if (all.some(f => relOf(userDir, f) === LIBRARY_FILE)) again = (await splitOldRecord(userDir)) || again
  if (again) all = await listFiles(userDir).catch(() => [] as string[])
  const records = all.filter(f => { const parts = relOf(userDir, f).split("/"); return parts.length === 3 && parts[2] === LIBRARY_FILE })
  const parts = await Promise.all(records.map(f => readPathText(f).then(parse, () => emptyLibrary())))
  return { library: parts.reduce(mergeLibraries, emptyLibrary()), all }
}

/**
 * The record, made to agree with what is really in Files. The person can delete or move a file there at any time: a
 * file that is gone leaves the record, and one that was moved is found again by its name (the name carries a hash of
 * what is in it, so it is the same file wherever it sits).
 */
export async function readLibraryChecked(userDir: string): Promise<Library> {
  const { library, all } = await readAll(userDir)
  if (!library.files.length) return library
  const there = all.filter(f => /\.docx$/i.test(f)).map(f => relOf(userDir, f))
  const have = new Set(there)
  const byName = new Map(there.map(rel => [rel.split("/").pop() as string, rel]))
  const touched = new Set<string>()
  const files = library.files.flatMap(f => {
    if (have.has(f.path)) return [f]
    touched.add(`${f.email}\n${f.category}`)
    const moved = byName.get(f.path.split("/").pop() as string)
    return moved && !library.files.some(o => o.path === moved) ? [{ ...f, path: moved }] : []
  })
  if (!touched.size) return library
  const next = { ...library, files }
  for (const key of touched) { const [email, category] = key.split("\n"); await writeShelf(userDir, next, email, category).catch(() => {}) }
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
  const before = await readShelf(opts.userDir, email_, category)
  const run = {
    path: relOf(opts.userDir, abs), email: email_, category, role: opts.role || "", company: opts.company || "", depth: opts.depth, from: opts.from,
    jd: opts.jd, asked, covers, points: opts.points, replaces: replaces ? relOf(opts.userDir, replaces) : undefined,
  }
  // One job, one file: a resume saved earlier for this same job in this folder is taken out as this one goes in.
  for (const rel of supersededBy(before, run)) {
    const old = absOf(opts.userDir, rel)
    if (old !== abs && inside(opts.userDir, old) && isTailoredName(path.basename(old))) await deletePath(old).catch(() => {})
  }
  const library = recordRun(before, run, opts.now ?? Date.now())
  await writeShelf(opts.userDir, library, email_, category)
  const learned = learnedOf(library, email_, category)
  return { abs, rel: relOf(opts.userDir, abs), email: email_, category, learned, counted: learned.jobs > learnedOf(before, email_, category).jobs }
}

/**
 * The resume already made for this job, when there is one and its file is still there. One small read. The bot sends
 * it again instead of making it again (owner, 13 Oct 2026: "you already know the outcome from the last time").
 */
export async function existingForJob(userDir: string, email: string, jd: string): Promise<{ abs: string; file: SavedFile } | null> {
  const category = categoryForJob(jd), email_ = folderFor(email, category)[0]
  const file = madeFor(await readShelf(userDir, email_, category), { email: email_, category, jd })
  if (!file) return null
  const abs = absOf(userDir, file.path)
  return inside(userDir, abs) && (await existsPath(abs)) ? { abs, file } : null
}

/**
 * Folders that hold the same job twice are put right: the newest file of a job stays, the older ones go, and the
 * record follows. `all` is one listing of the person's Files. Nothing is read unless a folder shows two files made
 * for a job under one visible name, so a tidy library costs nothing here.
 */
export async function removeDuplicates(userDir: string, all: string[]): Promise<number> {
  const seen = new Map<string, number>(), folders = new Set<string>()
  for (const abs of all) {
    const parts = relOf(userDir, abs).split("/")
    if (parts.length !== 3 || !isTailoredName(parts[2])) continue
    const shown = `${parts[0]}\n${parts[1]}\n${parts[2].replace(/__[a-f0-9]{16}(?=\.docx$)/i, "").toLowerCase()}`
    seen.set(shown, (seen.get(shown) || 0) + 1)
    if ((seen.get(shown) || 0) > 1 && !/^resume \(tailored\)\.docx$/i.test(parts[2].replace(/__[a-f0-9]{16}(?=\.docx$)/i, ""))) folders.add(`${parts[0]}\n${parts[1]}`)
  }
  let removed = 0
  for (const key of folders) {
    const [email, category] = key.split("\n")
    const library = await readShelf(userDir, email, category)
    const gone = duplicatesIn(library, email, category)
    if (!gone.length) continue
    for (const rel of gone) {
      const abs = absOf(userDir, rel)
      if (inside(userDir, abs) && isTailoredName(path.basename(abs))) { await deletePath(abs).catch(() => {}); removed++ }
    }
    await writeShelf(userDir, { ...library, files: library.files.filter(f => !gone.includes(f.path)) }, email, category)
  }
  return removed
}

/** Take a saved resume back out: the file and its line in the record. (It was saved, then could not be sent.) */
export async function forgetTailored(userDir: string, abs: string): Promise<void> {
  if (!inside(userDir, abs) || !isTailoredName(path.basename(abs))) return
  await deletePath(abs).catch(() => {})
  // The folder a file is in names its record: <email>/<kind of job>/<file>.
  const rel = relOf(userDir, abs), parts = rel.split("/")
  if (parts.length !== 3) return
  const library = await readShelf(userDir, parts[0], parts[1])
  if (!library.files.some(f => f.path === rel)) return
  await writeShelf(userDir, { ...library, files: library.files.filter(f => f.path !== rel) }, parts[0], parts[1])
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
