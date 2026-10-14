// The plans, in one place. The landing page reads them; the checkout will read the same list when payments open.
//
// Set on 14 Oct 2026 from the pricing work in founder/pricing.md and the owner's ask the same day: "provide a
// subscription model ... I'm basically selling resume services plus formatting ... and interview prep services ...
// Parakeet was my direct competitor ... I need that $10 from them, half the amount of what they are paying". So:
//   - every paid plan is paid BEFORE the work is done (his rule: nothing out of pocket);
//   - what a plan costs to deliver is under 15% of its price, far inside his "keep at least half" line
//     (a tailored resume costs about 1 cent of AI, measured; an interview hour is estimated, not yet measured);
//   - nothing is unlimited, and a monthly plan says before it renews.
// These are LAUNCH prices for the owner to confirm. Nobody can pay yet: paid plans join a list until checkout opens.

export type Plan = {
  id: "free" | "pack" | "hunt" | "pro"
  name: string
  price: string
  per: string
  blurb: string
  features: string[]
  cta: string
  /** Free starts at sign-up; the rest join the list for that plan until payments open. */
  action: "signup" | "list"
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "free", name: "Free", price: "$0", per: "to start",
    blurb: "See it work on your own resume before you pay anything.",
    features: ["1 tailored resume, on a job you choose", "Your Files library, by email and kind of job", "Interview tracker with follow-up reminders", "No card asked for"],
    cta: "Get your free resume", action: "signup",
  },
  {
    id: "pack", name: "Resume Pack", price: "$15", per: "once",
    blurb: "For a job hunt. Pay once; nothing renews.",
    features: ["30 tailored resumes", "They never expire", "On WhatsApp and on the web", "Years and titles kept exactly as written"],
    cta: "Join the list", action: "list", highlight: true,
  },
  {
    id: "hunt", name: "Job Hunt", price: "$19", per: "a month",
    blurb: "For applying every day, with your recruiter mail in order.",
    features: ["Up to 100 tailored resumes a month", "Recruiter inbox: whose turn it is, right-to-represent and rate mails", "Interview follow-ups, written for you", "A reminder 3 days before it renews"],
    cta: "Join the list", action: "list",
  },
  {
    id: "pro", name: "Interview Pro", price: "$39", per: "a month",
    blurb: "Everything in Job Hunt, plus interview practice.",
    features: ["Everything in Job Hunt", "6 hours of interview practice a month", "Realistic questions for the job you applied to", "Cancel any time"],
    cta: "Join the list", action: "list",
  },
]
