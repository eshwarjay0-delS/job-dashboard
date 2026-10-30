// The job-post terms gate (owner, 29 Oct 2026: "If it is mentioned in JD ... it is our responsibility to include it in
// the updated resume everytime"). On: a job-post term the writer put in an experience bullet sends that bullet back to the
// source text and the term goes onto the skills line, labelled in the WhatsApp reply. A resume whose skills are locked or
// that has no skills section is sent unchanged in that respect, with the terms listed in the reply. The round-trip guard
// (name, contact details, dates) is the send check. Off (JD_TERMS_ALWAYS_ON_SKILLS=0|false|off): the old refusal.
export function jdTermsGateOn(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.JD_TERMS_ALWAYS_ON_SKILLS ?? "").trim().toLowerCase()
  return !(v === "0" || v === "false" || v === "off" || v === "no")
}

export type JdTermsUnplacedReason = "skills_locked" | "no_skills_section"

/** One reply line for job-post terms that could not be written into the file. Empty when there are none. */
export function unplacedTermsLine(terms: string[] | undefined, reason: JdTermsUnplacedReason | undefined): string {
  const list = (terms || []).filter(Boolean)
  if (!list.length || !reason) return ""
  const why = reason === "skills_locked" ? "you asked me not to edit your skills" : "your resume has no skills section"
  const shown = list.slice(0, 10).join(", ") + (list.length > 10 ? ` and ${list.length - 10} more` : "")
  return `Not added to the file because ${why}: ${shown}. Add any you can speak to.`
}
