// ── Gmail Smart Reply templates ─────────────────────────────────────────────
// Deterministic, template-based suggestion chips (no LLM — PII stays local).
// Never invents profile values: a missing field renders as an empty string.

export interface SuggestMail {
  from: string
  fromEmail: string
  subject: string
  preview: string
  role: string
  company: string
  rate?: string
}

export interface ReplyChip {
  label: string
  subject: string
  body: string
}

type Profile = Record<string, string>

function field(p: Profile, key: string): string {
  return (p[key] || "").trim()
}

function firstNameOf(from: string): string {
  const first = (from || "").trim().split(/\s+/)[0]
  return first || "there"
}

function locationOf(p: Profile): string {
  const cityState = [field(p, "city"), field(p, "state")].filter(Boolean).join(", ")
  const zip = field(p, "zip")
  return [cityState, zip].filter(Boolean).join(" ")
}

function nameOf(p: Profile): string {
  return field(p, "full_name") || "Eshwar"
}

function replySubject(mail: SuggestMail): string {
  const base = mail.subject?.trim() || mail.role?.trim() || ""
  return base ? `Re: ${base}` : "Re:"
}

function declineBody(p: Profile, mail: SuggestMail): string {
  const first = firstNameOf(mail.from)
  const role = mail.role?.trim() || "this role"
  return (
    `Hi ${first},\n\n` +
    `Thanks for thinking of me for the ${role}. I'll have to pass this time — please keep me in mind for future roles.\n\n` +
    `Best regards,\n${nameOf(p)}`
  )
}

/** "$65/hr C2C" -> "$70/hr C2C"; returns "" when no number is found. */
function counterRate(rate: string): string {
  const m = rate.match(/\$?\s*([\d,]+(?:\.\d+)?)/)
  if (!m || !m[1]) return ""
  const num = parseFloat(m[1].replace(/,/g, ""))
  if (!Number.isFinite(num)) return ""
  const bumped = (num + 5).toString().replace(/\.0$/, "")
  return rate.replace(m[0], `$${bumped}`)
}

function rtrChips(p: Profile, mail: SuggestMail): ReplyChip[] {
  const first = firstNameOf(mail.from)
  const name = nameOf(p)
  const role = mail.role?.trim() || "this role"
  const loc = locationOf(p)
  const details =
    `Hi ${first},\n\n` +
    `Thanks for reaching out. Here are my details for the ${role}:\n\n` +
    `Full Name: ${field(p, "full_name")}\n` +
    `Email: ${field(p, "email")}\n` +
    `Phone: ${field(p, "phone")}\n` +
    `Location: ${loc}\n` +
    `Work Authorization: ${field(p, "work_auth")}\n` +
    `LinkedIn: ${field(p, "linkedin")}\n` +
    `Availability: ${field(p, "availability")}\n` +
    `Total Experience: ${field(p, "total_experience")}\n` +
    `Relevant Experience: ${field(p, "relevant_experience")}\n` +
    `Education: ${field(p, "education")}\n` +
    `SSN (last 4): ${field(p, "ssn_last4")}\n` +
    `DOB: ${field(p, "dob")}\n` +
    `Passport No: ${field(p, "passport_no")}\n` +
    `DL: ${[field(p, "dl_number"), field(p, "dl_state")].filter(Boolean).join(" ")}\n\n` +
    `Please let me know the next steps.\n\n` +
    `Best regards,\n${name}`
  const askRate =
    `Hi ${first},\n\n` +
    `I'm interested in the ${role}${mail.company ? ` at ${mail.company}` : ""} and I'm happy to be submitted. ` +
    `Could you please confirm the pay rate and work location before we proceed?\n\n` +
    `Best regards,\n${name}\n${field(p, "phone")}`
  return [
    { label: "Send my details", subject: replySubject(mail), body: details },
    { label: "Confirm & ask rate", subject: replySubject(mail), body: askRate },
    { label: "Decline politely", subject: replySubject(mail), body: declineBody(p, mail) },
  ]
}

function rateChips(p: Profile, mail: SuggestMail): ReplyChip[] {
  const first = firstNameOf(mail.from)
  const name = nameOf(p)
  const rate = (mail.rate || "").trim() || field(p, "rate_default")
  const role = mail.role?.trim() || "this role"
  const confirmLabel = rate ? `Confirm ${rate}` : "Confirm rate"
  const rateSuffix = /c2c/i.test(rate) ? "" : " on C2C"
  const confirm =
    `Hi ${first},\n\n` +
    `I confirm ${rate || "[rate]"}${rateSuffix} for the ${role}${mail.company ? ` with ${mail.company}` : ""}. Please proceed with the submission.\n\n` +
    `My details:\n` +
    `Full Name: ${field(p, "full_name")}\n` +
    `Phone: ${field(p, "phone")}\n` +
    `Email: ${field(p, "email")}\n` +
    `LinkedIn: ${field(p, "linkedin")}\n` +
    `Work Authorization: ${field(p, "work_auth")}\n` +
    `Current Location: ${locationOf(p)}\n` +
    `Availability: ${field(p, "availability")}\n\n` +
    `I will share the remaining details and documents once the interview is scheduled.\n\n` +
    `Regards,\n${name}`
  const bumped = counterRate(rate)
  const counter =
    `Hi ${first},\n\n` +
    `Thanks for the ${rate || "rate"} offer${mail.company ? ` for the ${role} at ${mail.company}` : ""}. ` +
    (bumped
      ? `Would ${bumped} work for the client? I'm ready to move quickly if we can meet there.\n\n`
      : `Is there any room to move up a little on the rate? I'm ready to move quickly.\n\n`) +
    `Regards,\n${name}`
  const askDetails =
    `Hi ${first},\n\n` +
    `Before I confirm the rate, could you please share the job description, work location (remote / hybrid / onsite), and contract duration for the ${role}?\n\n` +
    `Thanks,\n${name}`
  return [
    { label: confirmLabel, subject: replySubject(mail), body: confirm },
    { label: "Counter +$5", subject: replySubject(mail), body: counter },
    { label: "Ask for job details", subject: replySubject(mail), body: askDetails },
  ]
}

function interviewChips(p: Profile, mail: SuggestMail): ReplyChip[] {
  const first = firstNameOf(mail.from)
  const name = nameOf(p)
  const role = mail.role?.trim() || "this role"
  const avail = field(p, "interview_availability") || field(p, "availability")
  const share =
    `Hi ${first},\n\n` +
    `Thank you — I'd be glad to speak with the hiring team about the ${role}. ` +
    `My availability for interviews: ${avail}.\n` +
    `Happy to work around the panel if none of these suit.\n\n` +
    `Best regards,\n${name}\n${field(p, "phone")}`
  const confirmSlot =
    `Hi ${first},\n\n` +
    `That time works for me — please consider me confirmed for the ${role} interview. ` +
    `Kindly send the meeting invite${field(p, "email") ? ` to ${field(p, "email")}` : ""}.\n\n` +
    `Thanks,\n${name}`
  const askLink =
    `Hi ${first},\n\n` +
    `Thanks for scheduling. Could you please share the video meeting link for the ${role} interview? ` +
    `Also, is there anything I should prepare in advance?\n\n` +
    `Best,\n${name}`
  return [
    { label: "Share availability", subject: replySubject(mail), body: share },
    { label: "Confirm slot", subject: replySubject(mail), body: confirmSlot },
    { label: "Ask video link", subject: replySubject(mail), body: askLink },
  ]
}

function documentChips(p: Profile, mail: SuggestMail): ReplyChip[] {
  const first = firstNameOf(mail.from)
  const name = nameOf(p)
  const role = mail.role?.trim() || "this role"
  const send =
    `Hi ${first},\n\n` +
    `Here are my details for the ${role} submission:\n\n` +
    `Full Name: ${field(p, "full_name")}\n` +
    `Work Authorization: ${field(p, "work_auth")}\n` +
    `SSN (last 4): ${field(p, "ssn_last4")}\n` +
    `DOB: ${field(p, "dob")}\n` +
    `Passport No: ${field(p, "passport_no")}\n` +
    `DL: ${[field(p, "dl_number"), field(p, "dl_state")].filter(Boolean).join(" ")}\n\n` +
    `Please let me know if you need anything else.\n\n` +
    `Regards,\n${name}`
  const ask =
    `Hi ${first},\n\n` +
    `Could you please confirm exactly which documents you need for the ${role} submission? ` +
    `I prefer to share sensitive documents over a call once the interview is scheduled.\n\n` +
    `Thanks,\n${name}`
  return [
    { label: "Send documents", subject: replySubject(mail), body: send },
    { label: "Ask what's needed", subject: replySubject(mail), body: ask },
    { label: "Decline", subject: replySubject(mail), body: declineBody(p, mail) },
  ]
}

function interestChips(p: Profile, mail: SuggestMail): ReplyChip[] {
  const first = firstNameOf(mail.from)
  const name = nameOf(p)
  const role = mail.role?.trim() || "this role"
  const interested =
    `Hi ${first},\n\n` +
    `I'm interested in the ${role}${mail.company ? ` at ${mail.company}` : ""}. A quick summary of my background:\n\n` +
    `- ${field(p, "total_experience")} in IT, ${field(p, "relevant_experience")} in information security\n` +
    `- Work authorization: ${field(p, "work_auth")}\n` +
    `- Location: ${locationOf(p)}, availability: ${field(p, "availability")}\n` +
    `- LinkedIn: ${field(p, "linkedin")}\n\n` +
    `Please let me know the pay rate and next steps.\n\n` +
    `Best regards,\n${name}\n${field(p, "phone")}`
  const askRateLoc =
    `Hi ${first},\n\n` +
    `The ${role} looks interesting. Could you please share the pay rate, work location, and contract duration?\n\n` +
    `Thanks,\n${name}`
  return [
    { label: "I'm interested", subject: replySubject(mail), body: interested },
    { label: "Ask rate & location", subject: replySubject(mail), body: askRateLoc },
    { label: "Not a fit", subject: replySubject(mail), body: declineBody(p, mail) },
  ]
}

function followupChips(p: Profile, mail: SuggestMail): ReplyChip[] {
  const first = firstNameOf(mail.from)
  const role = mail.role?.trim() || "this role"
  const phone = field(p, "phone")
  const subject = `Follow-up: ${role}${mail.company ? ` — ${mail.company}` : ""}`
  const exact =
    `Hello ${first}, I hope your day was going well. ` +
    `I'm reaching out to follow up on our submission for the ${role} role. ` +
    `Everything went really well, and I'm pretty sure I had made an impression. ` +
    `I'm looking forward to the next update on our next steps on this submission. ` +
    `Do let me know once you have an update. Thank you. ` +
    `Any updates on this position that we have submitted. ` +
    `Please keep me informed at ${phone}. Regards, Eshwar`
  const bump =
    `Hi ${first},\n\n` +
    `Just checking in on our submission for the ${role}. Any update from the client yet?\n\n` +
    `Thanks,\nEshwar\n${phone}`
  const askCall =
    `Hi ${first},\n\n` +
    `Do you have a few minutes for a quick call about the ${role} submission? ` +
    `You can reach me at ${phone}.\n\n` +
    `Thanks,\nEshwar`
  return [
    { label: "Follow up", subject, body: exact },
    { label: "Short bump", subject, body: bump },
    { label: "Ask for a call", subject, body: askCall },
  ]
}

export function buildSuggestions(
  category: string,
  profile: Profile,
  mail: SuggestMail,
): { chips: ReplyChip[] } {
  const p: Profile = profile || {}
  switch (category) {
    case "RTR Request":
      return { chips: rtrChips(p, mail) }
    case "Rate Confirmation":
      return { chips: rateChips(p, mail) }
    case "Interview Request":
      return { chips: interviewChips(p, mail) }
    case "Document Request":
      return { chips: documentChips(p, mail) }
    case "Follow-up":
      return { chips: followupChips(p, mail) }
    case "Job Description":
    default:
      return { chips: interestChips(p, mail) }
  }
}
