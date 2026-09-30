// Sample data for the job-mail hub screens (Today, Mail, Tracker fallback, Calendar, Workflows,
// Prep), carried over from the perfACT suite prototype. None of it is the user's: no screen that
// reads this file fetches anything yet, and every one of them shows a "Sample data" badge until its
// real source is connected, so it can never be mistaken for a live inbox or calendar.

export type Stage = "invite" | "rtr" | "rate" | "pending" | "applied" | "rejected" | "followup"

export const STAGE_LABEL: Record<Stage, string> = {
  invite: "Interview", rtr: "RTR", rate: "Rate", pending: "Pending",
  applied: "Applied", rejected: "Rejected", followup: "Follow-up",
}

export type Account = { id: string; email: string; label: string; connected: boolean }
export const accounts: Account[] = [
  { id: "a1", email: "jayeshwar24@gmail.com", label: "Primary", connected: true },
  { id: "a2", email: "eshwarjay05@gmail.com", label: "Contract / C2C", connected: true },
  { id: "a3", email: "eshwarjay06@gmail.com", label: "Campaigns", connected: true },
  { id: "a4", email: "jayeshwar44@gmail.com", label: "Full-time", connected: false },
]

export type Mail = {
  id: string; account: string; from: string; fromEmail: string; company: string; role: string
  subject: string; preview: string; at: string; stage: Stage; rate?: string; when?: string
  needsReply?: "availability" | "rtr" | "rate"
  /** The sentence that made the dashboard act on this mail, shown next to the action. */
  trigger?: string
}
export const mails: Mail[] = [
  { id: "m1", account: "a2", from: "Priya Raman", fromEmail: "priya@tekblu.us", company: "Fifth Third Bank", role: "CyberArk PAM Engineer", subject: "Interview — CyberArk PAM Engineer (Hybrid, Cincinnati)", preview: "The hiring manager would like 45 minutes with you this week. Could you share your availability for Thursday or Friday?", at: "9:42 AM", stage: "invite", needsReply: "availability", trigger: "Could you share your availability for Thursday or Friday?" },
  { id: "m2", account: "a2", from: "Saanvi K", fromEmail: "saanvi@cloudquestit.com", company: "Molina Healthcare", role: "IAM Engineer (C2C)", subject: "RTR — IAM Engineer, Long Beach CA", preview: "Please reply with the Right to Represent below so we can submit you to the client today.", at: "9:10 AM", stage: "rtr", needsReply: "rtr", trigger: "Please reply with the Right to Represent below" },
  { id: "m3", account: "a2", from: "Abinash Mishra", fromEmail: "abinash.mishra@1rpo.net", company: "Erie Insurance", role: "Senior PAM Consultant", subject: "Rate confirmation — Senior PAM Consultant", preview: "Client max is $68/hr on C2C. Can you confirm your rate and availability to start in two weeks?", at: "8:55 AM", stage: "rate", rate: "$68/hr C2C", needsReply: "rate", trigger: "Client max is $68/hr on C2C" },
  { id: "m4", account: "a1", from: "Talent Team", fromEmail: "careers@mastercard.com", company: "Mastercard", role: "Security Engineer II", subject: "Your application for Security Engineer II", preview: "Thank you for your interest. After careful review we have decided to move forward with other candidates.", at: "Yesterday", stage: "rejected", trigger: "we have decided to move forward with other candidates" },
  { id: "m5", account: "a1", from: "Jordan Lee", fromEmail: "jlee@labelbox.com", company: "Labelbox", role: "Lead Security Engineer", subject: "Next step: technical interview with the security team", preview: "Great speaking with you. The panel is set for Tuesday 6 Oct at 1:00 PM ET — calendar invite attached.", at: "Yesterday", stage: "invite", when: "Tue 6 Oct · 1:00 PM" },
  { id: "m6", account: "a4", from: "Recruiting", fromEmail: "no-reply@greenhouse.io", company: "Vanguard", role: "IAM Architect", subject: "Application received — IAM Architect", preview: "We've received your application and our team will review it shortly.", at: "Mon", stage: "applied" },
  { id: "m7", account: "a3", from: "Kevin Brooks", fromEmail: "kevin@insightglobal.com", company: "Humana", role: "PAM Engineer (W2)", subject: "Follow-up on your submission — Humana PAM", preview: "Just checking in — the client is still reviewing. I'll update you by Friday.", at: "Mon", stage: "pending" },
  { id: "m8", account: "a1", from: "Offers", fromEmail: "people@okta.com", company: "Okta", role: "Senior IAM Engineer", subject: "Unfortunately…", preview: "We appreciate the time you invested. We won't be moving forward at this time.", at: "Sun", stage: "rejected", trigger: "We won't be moving forward at this time" },
  { id: "m9", account: "a2", from: "Megha S", fromEmail: "megha@tekblu.com", company: "Cardinal Health", role: "Identity Security Engineer", subject: "Interview confirmed — Thu 1 Oct 11:00 AM", preview: "Confirmed with the client. Teams link inside. Panel: two engineers and the IAM manager.", at: "Sun", stage: "invite", when: "Thu 1 Oct · 11:00 AM" },
]

/** day = 0..6 for Mon 28 Sep .. Sun 4 Oct 2026; start/end in 24h hours, decimals allowed. */
export type Interview = { id: string; company: string; role: string; day: number; start: number; end: number; kind: "Phone" | "Video" | "Onsite" | "Panel"; account: string; with: string }
export const WEEK_START = new Date(2026, 8, 28)
export const interviews: Interview[] = [
  { id: "i3", company: "Humana", role: "PAM Engineer", day: 0, start: 10, end: 10.5, kind: "Phone", account: "a3", with: "Vendor screen" },
  { id: "i4", company: "Labelbox", role: "Lead Security Engineer", day: 1, start: 16, end: 17, kind: "Video", account: "a1", with: "Security team" },
  { id: "i5", company: "Erie Insurance", role: "Senior PAM Consultant", day: 2, start: 9.5, end: 12.5, kind: "Onsite", account: "a2", with: "Erie PA office · 3 rounds" },
  { id: "i1", company: "Cardinal Health", role: "Identity Security Engineer", day: 3, start: 11, end: 12, kind: "Panel", account: "a2", with: "IAM manager + 2 engineers" },
  { id: "i2", company: "Fifth Third Bank", role: "CyberArk PAM Engineer", day: 4, start: 14, end: 14.75, kind: "Video", account: "a2", with: "Hiring manager" },
]

export type SampleApp = { id: string; company: string; role: string; type: "Full-time" | "Contract"; applied: string; stage: Stage; last: string; rate?: string }
export const sampleApplications: SampleApp[] = [
  { id: "p1", company: "Fifth Third Bank", role: "CyberArk PAM Engineer", type: "Contract", applied: "Sep 22", stage: "invite", last: "Invite · today", rate: "$70/hr" },
  { id: "p2", company: "Cardinal Health", role: "Identity Security Engineer", type: "Contract", applied: "Sep 18", stage: "invite", last: "Panel Thu 1 Oct", rate: "$65/hr" },
  { id: "p3", company: "Molina Healthcare", role: "IAM Engineer", type: "Contract", applied: "Sep 29", stage: "rtr", last: "RTR requested", rate: "$62/hr" },
  { id: "p4", company: "Erie Insurance", role: "Senior PAM Consultant", type: "Contract", applied: "Sep 15", stage: "rate", last: "Rate confirm", rate: "$68/hr" },
  { id: "p5", company: "Labelbox", role: "Lead Security Engineer", type: "Full-time", applied: "Sep 10", stage: "invite", last: "Tech round Tue" },
  { id: "p6", company: "Humana", role: "PAM Engineer (W2)", type: "Contract", applied: "Sep 12", stage: "pending", last: "Client reviewing" },
  { id: "p7", company: "Vanguard", role: "IAM Architect", type: "Full-time", applied: "Sep 28", stage: "applied", last: "Received" },
  { id: "p8", company: "Mastercard", role: "Security Engineer II", type: "Full-time", applied: "Sep 02", stage: "rejected", last: "Auto-archived" },
  { id: "p9", company: "Okta", role: "Senior IAM Engineer", type: "Full-time", applied: "Aug 29", stage: "rejected", last: "Auto-archived" },
  { id: "p10", company: "Northern Trust", role: "PAM Lead", type: "Contract", applied: "Sep 24", stage: "followup", last: "Follow-up due Thu" },
]

export type Step = { id: string; title: string; trigger: string; days: string[]; time: string; mode: "approve" | "auto" }
export const postApplySteps: Step[] = [
  { id: "s1", title: "Thank-you + resume confirmation", trigger: "Right after applying", days: [], time: "Immediately", mode: "auto" },
  { id: "s2", title: "Share availability", trigger: "When a recruiter asks for times", days: [], time: "Within 1 hour", mode: "approve" },
  { id: "s3", title: "Send RTR back", trigger: "When an RTR arrives", days: [], time: "Within 30 min", mode: "approve" },
  { id: "s4", title: "Weekly follow-up", trigger: "No reply after submission", days: ["Mon", "Thu"], time: "10:00 AM", mode: "auto" },
  { id: "s5", title: "Rate confirmation", trigger: "When a rate is quoted", days: [], time: "Same day", mode: "approve" },
  { id: "s6", title: "Polite close on rejection", trigger: "When a rejection is detected", days: [], time: "Next morning", mode: "auto" },
]
export const postInterviewSteps: Step[] = [
  { id: "t1", title: "Thank-you note to the panel", trigger: "2 hours after the interview", days: [], time: "+2h", mode: "approve" },
  { id: "t2", title: "Recruiter debrief", trigger: "Same evening", days: [], time: "6:00 PM", mode: "auto" },
  { id: "t3", title: "Status check", trigger: "No reply after 3 business days", days: ["Tue", "Fri"], time: "11:00 AM", mode: "auto" },
  { id: "t4", title: "Decision follow-up", trigger: "One week after", days: ["Mon"], time: "9:30 AM", mode: "approve" },
]

/** Saved weekly availability: the reply is pre-filled from this and the user edits or approves. */
export const savedAvailability: Record<string, string[]> = {
  Mon: ["10:00", "14:00"], Tue: ["11:00", "15:30"], Wed: [], Thu: ["10:00", "11:30", "16:00"], Fri: ["13:00", "15:00"],
}
export const availabilitySlots = ["10:00", "11:00", "11:30", "13:00", "14:00", "15:00", "15:30", "16:00"]

export type PrepQ = { id: string; q: string; kind: "Behavioural" | "Technical" | "Onsite logistics"; tip: string }
export const prepQuestions: PrepQ[] = [
  { id: "q1", q: "Walk me through the CyberArk upgrade you led — what could have gone wrong?", kind: "Technical", tip: "Answer first: 12.6 → 13.2, one window. Then the risk you planned around: vault DR sync and PSM connectors." },
  { id: "q2", q: "Tell me about a time you disagreed with an application owner about access.", kind: "Behavioural", tip: "One person, one moment. Their reason was reasonable — say why — then what you changed." },
  { id: "q3", q: "How would you move us from self-hosted CyberArk to Privilege Cloud?", kind: "Technical", tip: "You haven't done it — say so plainly, then the order you'd do it in and what you'd test first." },
  { id: "q4", q: "This role is on-site three days from day one. Does that work for you?", kind: "Onsite logistics", tip: "Yes or no in the first word. Then one line on commute or relocation." },
  { id: "q5", q: "Why are you leaving your current role?", kind: "Behavioural", tip: "Forward-looking: the scope you want next. Never a complaint about the current team." },
  { id: "q6", q: "A CPM rotation fails overnight on 40 Linux servers. What do you check first?", kind: "Technical", tip: "Logs first: CPM trace for the platform, then the reconcile account, then connectivity." },
]

export const onsiteChecklist = [
  { id: "o1", label: "Route checked — leave 45 min early", done: true },
  { id: "o2", label: "Two printed copies of the tailored resume", done: true },
  { id: "o3", label: "ID for visitor badge", done: false },
  { id: "o4", label: "Names of all three panelists", done: false },
  { id: "o5", label: "Three questions for them, written down", done: false },
  { id: "o6", label: "Charged phone, water, a pen", done: true },
]

/** The live interview copilot is the perfACT deployment; MarketFit links to it rather than copying the engine. */
export const LIVE_COPILOT_URL = "https://perfact-ten.vercel.app"

export const accountOf = (id: string) => accounts.find((a) => a.id === id)
