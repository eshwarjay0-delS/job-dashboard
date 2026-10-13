// A recruiter's "please fill this in" table, read out of their mail and filled in from what the person has sent before.
//
// Asked on 13 Oct 2026, with a picture of a mail holding a ten-row table (Full Name, Contact No, Email ID, Date of
// Birth, Current Location, Relocation, Visa Status, Educational details, LinkedIn Id, SSN Last 4 Digit): "They want me
// to fill it up. And as a guy who wanted to fill it up, would go absolutely crazy because mobile formats wouldn't agree
// with that ... you take that in the actual format ... say the candidate ... hey, this person has requested this and
// here's the suggestions of filling that up. First, showcase [their mail] and ... on the bottom ... a suggestive reply,
// fill in the whole box with the heuristics, I mean the previous data that the candidate or user had kept on filling
// up ... for the same names."
//
// This file is the rules only (no network, no model, nothing stored): find the table in their words, find the answers
// the person has themselves typed in earlier replies FROM THE SAME INBOX (he keeps one candidate profile per inbox, and
// they are never mixed), and lay the reply out as plain "Label: value" lines, which read the same on a phone.
//
// WHAT IS NEVER FILLED IN, AND NEVER READ FROM OLD MAIL: a date of birth, any part of a Social Security number, a
// passport, licence, bank or card number. Those rows are left empty for the person to type, each time, themselves.

import { senderEmail, ownPart, dropFooter, tidy } from "./mail-reading.ts"

export type FieldKey = "name" | "phone" | "email" | "dob" | "location" | "relocation" | "visa" | "education" | "linkedin" | "ssn" | "passport" | "id_number" | "experience" | "rate" | "availability" | "employer" | "notice" | "skype" | "other"
export interface FormField { label: string; key: FieldKey; sensitive: boolean }
export interface Filled extends FormField { value: string; from: "" | "your profile" | "your earlier replies" | "this inbox" }

// What a row is asking for, by the words of its label. The order matters: the first that fits is taken.
const KINDS: Array<[FieldKey, RegExp]> = [
  ["ssn", /\bssn\b|social security/i],
  ["dob", /date of birth|\bd\.?o\.?b\b|birth ?date|\bbirthday\b/i],
  ["passport", /passport/i],
  ["id_number", /driver'?s? licen[sc]e|licen[sc]e (?:no|number)|\bdl (?:no|number)|bank account|routing number|card number|\bitin\b|\bpan (?:no|number)\b|aadha?ar/i],
  ["linkedin", /linked ?in(?: id| profile| url| link)?/i],
  ["email", /e-?mail(?: id| address)?/i],
  ["phone", /contact (?:no|number|#)|phone(?: no| number)?|mobile(?: no| number)?|cell(?: no| number)?/i],
  ["relocation", /relocat\w*/i],
  ["visa", /visa(?: status| type)?|work (?:authori[sz]ation|permit)|immigration status/i],
  ["education", /education(?:al)?(?: details| qualification)?|highest (?:degree|qualification)|\bdegree\b|university|qualification/i],
  ["experience", /(?:total|overall|relevant|years of)(?: it)? experience|experience \(?(?:in )?years/i],
  ["rate", /(?:expected |hourly |pay |bill )?rate\b|expected (?:salary|pay|compensation)|current (?:salary|ctc)|\bsalary\b/i],
  ["notice", /notice period/i],
  ["availability", /availability|available to (?:join|start)|start date|interview (?:slots?|timings?)|best time/i],
  ["employer", /current (?:employer|company)|employer (?:details|name)/i],
  ["skype", /skype|teams id|zoom id/i],
  ["location", /current location|present location|location|city(?: ?\/ ?state)?|\baddress\b/i],
  ["name", /(?:full|legal|candidate|consultant)(?:'s)? name|name \(?as (?:per|in)[^:)]*\)?|^\s*name\b/i],
]
const SENSITIVE = new Set<FieldKey>(["ssn", "dob", "passport", "id_number"])
export const isSensitive = (key: FieldKey): boolean => SENSITIVE.has(key)
const kindOf = (label: string): FieldKey => (KINDS.find(([, re]) => re.test(label)) || ["other"])[0] as FieldKey
const clean = (s: string): string => String(s || "").replace(/\s+/g, " ").replace(/^[\s*\u2022\-:.]+|[\s:*\-]+$/g, "").trim()

// One pattern that finds every label this file knows, wherever it stands in the text (a table often arrives as one
// long line: "Full Name: Contact No: Email ID: ..."). A label may carry a hint in brackets and a colon or two.
const ANY = new RegExp(`(?:${KINDS.map(([, re]) => re.source.replace(/\^\\s\*/g, "")).join("|")})(?:\\s*\\([^)\\n]{0,24}\\))?\\s*(?:last\\s*4\\s*digits?)?\\s*:{0,2}`, "gi")

type Found = { label: string; key: FieldKey; at: number; end: number; colon: boolean }
function labelsIn(text: string): Found[] {
  const out: Found[] = []
  for (const m of String(text || "").matchAll(ANY)) {
    const at = m.index ?? 0
    // A word inside a sentence is not a row: a label starts a line, follows a colon or another label, or is capitalised.
    const before = text.slice(Math.max(0, at - 1), at)
    if (before && /[A-Za-z0-9]/.test(before)) continue
    const label = clean(m[0])
    if (!label) continue
    // "linkedin.com/in/sam" and "email@x" are a value, not a row asking for one.
    if (/^[.@/][A-Za-z0-9]/.test(text.slice(at + m[0].length, at + m[0].length + 2))) continue
    out.push({ label, key: kindOf(m[0]), at, end: at + m[0].length, colon: /:\s*$/.test(m[0]) })
  }
  return out
}

/**
 * The form in a mail, as its rows in order, or [] when there is none. It is a form when four or more known details are
 * asked for and most of them have nothing written after them (a mail that GIVES details has values there).
 */
export function formIn(text: string): FormField[] {
  const body = String(text || "")
  // Rows on lines of their own: any short "Label:" line with nothing after it counts, known or not.
  const lines = body.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const rows = lines.filter(l => l.length <= 48 && /^[A-Za-z][A-Za-z0-9 /&().#'-]{1,44}:{1,2}$/.test(l) && !/^(?:hi|hello|dear|thanks|regards|note|from|to|sent|subject|cc)\b/i.test(l))
  const knownRows = rows.filter(l => kindOf(l) !== "other")
  if (knownRows.length >= 4) return unique(rows.map(l => { const key = kindOf(l); return { label: clean(l), key, sensitive: SENSITIVE.has(key) } }))
  // Or run together on one line: the known labels, where most have nothing between them.
  const found = labelsIn(body)
  if (found.length < 4) return []
  let empty = 0
  found.forEach((f, i) => { const next = found[i + 1]; const between = body.slice(f.end, next ? next.at : Math.min(body.length, f.end + 60)); if (clean(between.split("\n")[0] || "").length <= 2) empty++ })
  if (empty / found.length < 0.6) return []
  return unique(found.map(f => ({ label: f.label, key: f.key, sensitive: SENSITIVE.has(f.key) })))
}
function unique(fields: FormField[]): FormField[] {
  const seen = new Set<string>()
  return fields.filter(f => { const k = f.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 30)
}

export type Answers = Partial<Record<FieldKey, { value: string; at: number; times: number }>>

/**
 * What the person has themselves typed for each kind of detail, in replies sent from one inbox: the latest answer, and
 * how many times it was given. Never a date of birth, a Social Security number or any other identity number.
 */
export function answersFrom(threads: Array<{ messages: Array<{ from: string; bodyText?: string; internalDate?: string }> }>, inbox: string): Answers {
  const mine = String(inbox || "").toLowerCase()
  const out: Answers = {}
  for (const t of threads || []) for (const m of t.messages || []) {
    if (!mine || senderEmail(m.from) !== mine || !m.bodyText) continue
    const own = dropFooter(tidy(ownPart(m.bodyText))).text, at = Number(m.internalDate || 0)
    const found = labelsIn(own)
    found.forEach((f, i) => {
      // An answer is what he typed after "Label:". A word of a sentence ("my visa status is ...") is not a row.
      if (SENSITIVE.has(f.key) || f.key === "other" || !f.colon) return
      const next = found[i + 1]
      const raw = own.slice(f.end, next ? next.at : own.length).split("\n")[0] || ""
      const value = clean(raw).slice(0, 140)
      // "Y" is a whole answer to "Relocation (Y/N)"; anywhere else one letter, or "n/a", is no answer.
      if (!value || (f.key !== "relocation" && (value.length < 2 || /^(?:n\/?a|na|none|-+)$/i.test(value)))) return
      // Something that reads as an identity number is not kept under any label.
      if (/\b\d{3}-?\d{2}-?\d{4}\b/.test(value) && f.key !== "phone") return
      const had = out[f.key]
      if (!had) out[f.key] = { value, at, times: 1 }
      else { had.times += 1; if (at >= had.at) { had.value = value; had.at = at } }
    })
  }
  return out
}

export type ProfileFacts = { name?: string; phone?: string; location?: string; linkedin?: string; visa?: string; relocation?: boolean | null; title?: string }

/** The form with each row filled where an answer is known: his own earlier reply first, then his profile. */
export function fillForm(fields: FormField[], inbox: string, answers: Answers, profile: ProfileFacts = {}): Filled[] {
  const fromProfile: Partial<Record<FieldKey, string>> = {
    name: profile.name || "", phone: profile.phone || "", location: profile.location || "", linkedin: profile.linkedin || "", visa: profile.visa || "",
    relocation: profile.relocation === true ? "Yes" : profile.relocation === false ? "No" : "",
  }
  return fields.map(f => {
    if (f.sensitive) return { ...f, value: "", from: "" as const }
    const said = answers[f.key]?.value
    if (said) return { ...f, value: said, from: "your earlier replies" as const }
    if (f.key === "email" && inbox) return { ...f, value: inbox, from: "this inbox" as const }
    const known = fromProfile[f.key]
    return known ? { ...f, value: known, from: "your profile" as const } : { ...f, value: "", from: "" as const }
  })
}

/** The reply: the same rows in the same order as plain "Label: value" lines, which read the same on a phone. */
export function formReply(filled: Filled[], toName: string, myName: string): string {
  const first = String(toName || "").trim().split(/\s+/)[0] || ""
  const rows = filled.map(f => `${f.label}: ${f.value}`.trimEnd())
  return [`Hi${first ? ` ${first}` : ""},`, "", "Here are my details:", "", ...rows, "", "Thank you,", String(myName || "").trim()].join("\n").trimEnd()
}

/** One sentence for the person: what was asked, how much is filled, and what is theirs to type. */
export function formSummary(filled: Filled[], who: string): string {
  const n = filled.length, done = filled.filter(f => f.value).length
  const own = filled.filter(f => f.sensitive).map(f => f.label)
  const open = filled.filter(f => !f.value && !f.sensitive).length
  const name = String(who || "").trim().split(/\s+/)[0] || "They"
  return `${name} sent a form with ${n} details to fill in. I filled ${done} from what you have sent before.${open ? ` ${open} ${open === 1 ? "is" : "are"} still empty.` : ""}${own.length ? ` ${own.length === 1 ? "One is" : `${own.length} are`} yours to type each time (${own.join(", ")}): I never keep or fill those.` : ""}`
}
