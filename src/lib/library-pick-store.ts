// Reads what `library-pick.ts` decides on: the emails a person's resumes carry, the number each email keeps, and the
// resumes of one email with what is known of how each was made. Used by the WhatsApp bot and by
// POST /api/resumes/library-pick.
//
// WHOSE A RESUME IS comes from the email written IN the file (kept in the keyword index beside its keywords), never
// from the name of the folder it sits in. So a resume that was never put into an email folder (uploaded on the
// dashboard, a ZIP not yet organised) is still found, and one moved into the wrong folder by hand is never taken for
// that folder's person.

import { blob, readPath } from "@/lib/storage"
import { ensureIndex, extractKeywords } from "@/lib/keywords"
import { extractText } from "@/lib/docx"
import { resumeEmails } from "@/lib/resumeOrganization"
import { isTailoredName } from "@/lib/resume-library"
import { readShelf, relOf } from "@/lib/resume-library-store"
import { numberEmails, rankFor, type Candidate, type Ranked } from "@/lib/library-pick"

type Index = Awaited<ReturnType<typeof ensureIndex>>
export type Resumes = { index: Index; counts: Record<string, number> }

/** The one email a resume carries, or "" when it has none or several. */
const emailOf = (entry: { emails?: string[] }): string => (Array.isArray(entry.emails) && entry.emails.length === 1 ? entry.emails[0] : "")

/** A person's Word resumes, and how many carry each email. One listing and one small read when nothing changed. */
export async function libraryOf(userDir: string): Promise<Resumes> {
  const index = await ensureIndex(userDir)
  const counts: Record<string, number> = {}
  for (const entry of Object.values(index)) { const email = emailOf(entry); if (email) counts[email] = (counts[email] || 0) + 1 }
  return { index, counts }
}

const orderKey = (userId: string) => `library/email-order/${String(userId).replace(/[^A-Za-z0-9_-]/g, "_")}.json`

/**
 * The emails as they are numbered for this account: slots[n - 1] is email number n, "" where it holds nothing now.
 * An email keeps its number for good, so the numbering is kept (`keep`), and only ever added to. `sure` is false when
 * the kept numbering could not be read: a number sent with a job description is then not trusted, and the bot asks.
 */
export async function numberedEmails(userId: string, counts: Record<string, number>, keptEmail = "", keep = true): Promise<{ slots: string[]; sure: boolean }> {
  let order: string[] = [], sure = true
  try {
    const raw = await blob.getText(orderKey(userId))
    const held = raw ? JSON.parse(raw) : []
    order = Array.isArray(held) ? held.filter(e => typeof e === "string") : []
  } catch { sure = false }
  const next = numberEmails(order, counts, keptEmail)
  // Never written over when it could not be read: the numbers people learned would be lost.
  if (sure && keep && next.order.join("\n") !== order.join("\n")) { try { await blob.put(orderKey(userId), JSON.stringify(next.order)) } catch { sure = false } }
  return { slots: next.slots, sure }
}

/** "SOC Analyst - Kestrel (tailored)__8d3ee8f75ca12ad6" as a person would say it. */
const sayName = (filename: string): string => String(filename || "").replace(/\.docx$/i, "").replace(/__[a-f0-9]{16}$/i, "").replace(/\s*\(tailored\)\s*$/i, "").trim().slice(0, 60)

/** Every resume that carries this email. A file made for a job gets its depth from its folder's record: one small read a folder. */
export async function candidatesFor(userDir: string, email: string, index: Index): Promise<Candidate[]> {
  const mine = Object.entries(index).flatMap(([abs, entry]) => (emailOf(entry) === email ? [{ abs, rel: relOf(userDir, abs), entry }] : []))
  const tailored = mine.filter(m => isTailoredName(m.rel.split("/").pop() || ""))
  // The record of a file made for a job is in the folder it was saved in: <email>/<kind of job>/_library.json.
  const folders = [...new Set(tailored.map(m => m.rel.split("/")).filter(parts => parts.length === 3).map(parts => `${parts[0]}\n${parts[1]}`))]
  const made = new Map<string, { depth: number; at: number; job: string }>()
  await Promise.all(folders.map(async key => {
    const [top, folder] = key.split("\n")
    const shelf = await readShelf(userDir, top, folder).catch(() => null)
    for (const f of shelf?.files || []) made.set(f.path, { depth: f.depth, at: f.at, job: f.job })
  }))
  return mine.map(({ abs, rel, entry }) => {
    const parts = rel.split("/"), known = made.get(rel)
    // A file made for a job that no record knows is not built on: how it was made cannot be told.
    const depth: 0 | 1 | 2 = !isTailoredName(parts[parts.length - 1]) ? 0 : known && known.depth !== 2 ? 1 : 2
    // The folder as a person would say it: the kind of job, without the email in front of it.
    const folder = parts.slice(parts[0].includes("@") ? 1 : 0, -1).join(" / ")
    return { path: abs, email, folder, name: sayName(entry.filename || parts[parts.length - 1]), depth, keywords: entry.keywords || [], at: known?.at || Date.parse(entry.updatedAt || "") || 0, ...(known?.job ? { job: known.job } : {}) }
  })
}

/** The resume a number sent and the bot kept, as one more place a job of its email can start. */
export async function keptCandidate(file: { path: string; email: string; name: string; at: number }): Promise<Candidate | null> {
  if (!file.path || !file.email.includes("@")) return null
  const bytes = await readPath(file.path).catch(() => null)
  if (!bytes) return null
  const text = await extractText(bytes).catch(() => "")
  return { path: file.path, email: file.email, folder: "", name: file.name, depth: 0, keywords: extractKeywords(text), at: file.at || 0, kept: true }
}

export type Closest = {
  pick: Ranked | null
  /** Resumes of this email a job may start from, and those left out because they were built on a saved resume already. */
  usable: number
  builtOnAlready: number
  /** Files that turned out to carry another email (or none) when they were opened, and files that could not be opened. */
  wrongEmail: number
  unread: number
}

const MOST_OPENED = 8

/**
 * The closest resume of one email for this job. The file is opened and its email read once more before it is used, so
 * nothing goes out under another person's name even if the index is behind what is in Files.
 */
export async function closestFor(userDir: string, email: string, jd: string, kept: Candidate | null, index: Index, notJob = ""): Promise<Closest> {
  // `notJob`: when a job is being made afresh, the resume made for that same job before is not what it starts from.
  const candidates = (await candidatesFor(userDir, email, index)).filter(c => !notJob || c.job !== notJob)
  if (kept && kept.email === email) candidates.push(kept)
  const { ranked, builtOnAlready } = rankFor(candidates, email, extractKeywords(jd))
  let wrongEmail = 0, unread = 0
  for (const one of ranked) {
    if (one.candidate.kept) return { pick: one, usable: ranked.length, builtOnAlready, wrongEmail, unread }
    if (wrongEmail + unread >= MOST_OPENED) break
    const bytes = await readPath(one.candidate.path).catch(() => null)
    if (!bytes) { unread++; continue }
    const emails = resumeEmails(await extractText(bytes).catch(() => ""))
    if (emails.length === 1 && emails[0] === email) return { pick: one, usable: ranked.length, builtOnAlready, wrongEmail, unread }
    wrongEmail++
  }
  return { pick: null, usable: ranked.length, builtOnAlready, wrongEmail, unread }
}
