// The plans a visitor can choose on /plans, and every price, in this one file.
//
// What it prevents: a price that nobody set appearing on a page. The owner sets prices (approved 23 Oct 2026, "add all",
// competitor ideas 15 to 17). Until he does, every price below is null and the page says "Price coming soon". The same goes
// for how much time a plan holds: null reads "Amount coming soon". Nothing here is a guess to be corrected later.
//
// The model, from the 23 Oct competitor study (docs/research/*-rea-2026-10-23.md, behaviour only):
//   - a free allowance that comes back every day, not a one-off trial;
//   - hour packs for someone with one interview coming, paid once, never renewing;
//   - weekly and monthly plans for a longer search;
//   - every plan is the whole product. Plans differ by volume (how much practice time), never by which features open.
//
// To set a price, replace `price: null` with `price: { amount: <the price>, currency: "INR" }`. UPI and PhonePe only take rupees,
// so a plan priced in dollars is paid by card. The checkout (src/lib/checkout.ts) refuses a plan whose price is still null.
//
// Note for the owner: the landing page's pricing section reads a different, older list (src/lib/plans.ts) with launch
// prices that were never confirmed. Which list the landing page should show is the owner's call; this file does not change it.

export type Currency = "INR" | "USD"
export type Price = { amount: number; currency: Currency }

export type PlanId = "free-daily" | "hour-pack" | "weekly" | "monthly"

export type CatalogPlan = {
  id: PlanId
  name: string
  /** Who this plan suits, in one plain sentence. */
  forWho: string
  /** What it costs. null means the owner has not set it yet. The free plan is free and has no price. */
  price: Price | null
  /** Practice time the plan holds, in minutes. null means the owner has not set it yet. */
  minutes: number | null
  /** What the price and the minutes are counted per. */
  per: "day" | "pack" | "week" | "month"
  /** A pack is paid once. Weekly and monthly plans renew until cancelled. */
  renews: boolean
}

export const PRICE_BLANK = "Price coming soon"
export const AMOUNT_BLANK = "Amount coming soon"

/** What every plan includes, the free one too. Only things the product already does. */
export const WHOLE_PRODUCT: string[] = [
  "Interview practice for the job you applied to",
  "Resumes fitted to each job, in your own Word layout",
  "Your recruiter inbox, in order",
  "Interviews tracked until you say how they ended",
  "The same account on the web and on WhatsApp",
]

export const PLAN_CATALOG: CatalogPlan[] = [
  {
    id: "free-daily", name: "Free every day",
    forWho: "Try it on a real question. The allowance comes back each day, and no card is asked for.",
    price: null, minutes: null, per: "day", renews: false,
  },
  {
    id: "hour-pack", name: "Hour pack",
    forWho: "For one interview coming up. Pay once; nothing renews.",
    price: null, minutes: null, per: "pack", renews: false,
  },
  {
    id: "weekly", name: "Weekly",
    forWho: "For a short, busy week of interviews.",
    price: null, minutes: null, per: "week", renews: true,
  },
  {
    id: "monthly", name: "Monthly",
    forWho: "For a longer job search with practice most days.",
    price: null, minutes: null, per: "month", renews: true,
  },
]

export function planById(id: unknown): CatalogPlan | null {
  return PLAN_CATALOG.find(plan => plan.id === id) ?? null
}

/** A price is usable only when the owner has set a positive, finite amount. */
export function isPriced(plan: CatalogPlan): plan is CatalogPlan & { price: Price } {
  return plan.price !== null && Number.isFinite(plan.price.amount) && plan.price.amount > 0
}

/** The free plan is never sold; the others are, once priced. */
export function isPaid(plan: CatalogPlan): boolean {
  return plan.id !== "free-daily"
}

const PER_WORD: Record<CatalogPlan["per"], string> = { day: "a day", pack: "once", week: "a week", month: "a month" }

export function priceLabel(plan: CatalogPlan): string {
  if (!isPaid(plan)) return "Free"
  if (!isPriced(plan)) return PRICE_BLANK
  const { amount, currency } = plan.price
  const text = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount)
  return `${text} ${PER_WORD[plan.per]}`
}

export function allowanceLabel(plan: CatalogPlan): string {
  const m = plan.minutes
  if (m === null || !Number.isFinite(m) || m <= 0) return AMOUNT_BLANK
  const time = m % 60 === 0 ? `${m / 60} ${m === 60 ? "hour" : "hours"}` : `${m} minutes`
  return plan.per === "pack" ? `${time} of practice` : `${time} of practice ${PER_WORD[plan.per]}`
}
