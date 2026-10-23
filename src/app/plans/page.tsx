// The Plans page (public). Every plan and price comes from src/lib/plan-catalog.ts; a price the owner has not set reads
// "Price coming soon". Whether a plan can be bought comes from src/lib/checkout.ts, which stays off until the owner adds
// a Razorpay account's keys to the deployment. Approved 23 Oct 2026 ("add all", competitor ideas 15 and 16).

import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import PublicPage from "@/components/PublicPage"
import { checkoutStatus } from "@/lib/checkout"
import { POINTS_PER_INTERVIEW, POINTS_PER_RESUME } from "@/lib/creditsLedger"
import { AMOUNT_BLANK, PLAN_CATALOG, PRICE_BLANK, WHOLE_PRODUCT, allowanceLabel, isPaid, isPriced, priceLabel, type CatalogPlan } from "@/lib/plan-catalog"
import { BuyButton } from "./buy-button"

export const metadata: Metadata = {
  title: "Plans",
  description: "A free daily allowance, hour packs for one interview, and weekly and monthly plans. Every plan is the whole product.",
}

const card = "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"

const RETURN_NOTES: Record<string, string> = {
  received: "Payment received. Your hours are added once the owner confirms it; you do not need to pay again.",
  "not-paid": "The payment was not completed, so nothing was charged.",
  unverified: "We could not confirm that payment. If money left your account, keep the UPI reference and contact us.",
  off: "Payments are not switched on yet, so nothing was charged.",
}

function renewLine(plan: CatalogPlan): string {
  if (plan.per === "day") return "Comes back every day."
  if (!plan.renews) return "Paid once. Nothing renews."
  return `Renews each ${plan.per} until you cancel.`
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const payment = (await searchParams).payment
  const note = typeof payment === "string" ? RETURN_NOTES[payment] : undefined
  const checkout = checkoutStatus()
  const anyBlank = PLAN_CATALOG.some(plan => (isPaid(plan) && !isPriced(plan)) || plan.minutes === null)
  const resumesPerHour = Math.round(POINTS_PER_INTERVIEW / POINTS_PER_RESUME)

  return (
    <PublicPage eyebrow="Plans" title="Every plan is the whole product" lede="Plans differ only by how much practice time they hold. Nothing is locked behind a bigger plan.">
      {note && <p role="status" className={`${card} mt-8 px-5 py-4 text-[15px] text-[var(--text)]`}>{note}</p>}

      {anyBlank && (
        <p className="mt-8 max-w-2xl text-[15px] leading-[1.6] text-[var(--text-muted)]">
          Prices and amounts are still being set. Where you see &ldquo;{PRICE_BLANK}&rdquo; or &ldquo;{AMOUNT_BLANK}&rdquo;, that number has not been decided yet.
        </p>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {PLAN_CATALOG.map(plan => {
          const price = priceLabel(plan)
          return (
            <section key={plan.id} aria-labelledby={`plan-${plan.id}`} className={`${card} flex flex-col p-6`}>
              <h2 id={`plan-${plan.id}`} className="text-[16px] font-bold text-[var(--text)]">{plan.name}</h2>
              <p className={`mt-4 font-bold tracking-[-0.02em] ${price === PRICE_BLANK ? "text-[20px] text-[var(--text-soft)]" : "text-[30px] text-[var(--text)]"}`}>{price}</p>
              <p className="mt-2 text-[14.5px] font-semibold text-[var(--text)]">{allowanceLabel(plan)}</p>
              <p className="mt-3 flex-1 text-[14.5px] leading-[1.55] text-[var(--text-muted)]">{plan.forWho}</p>
              <p className="mt-4 text-[13.5px] text-[var(--text-soft)]">{renewLine(plan)}</p>
              <div className="mt-6">
                {isPaid(plan)
                  ? <BuyButton planId={plan.id} buyable={checkout.enabled && isPriced(plan)} />
                  : <Link href="/login?next=/dashboard" className="flex h-11 w-full items-center justify-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] text-[15px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--text-soft)]">Start free</Link>}
              </div>
            </section>
          )
        })}
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="whole-product" className={`${card} p-6`}>
          <h2 id="whole-product" className="text-[18px] font-bold text-[var(--text)]">Included in every plan, the free one too</h2>
          <ul className="mt-4 space-y-2.5">
            {WHOLE_PRODUCT.map(item => (
              <li key={item} className="flex gap-2.5 text-[15px] leading-[1.5] text-[var(--text)]"><Check size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent)]" />{item}</li>
            ))}
          </ul>
          <p className="mt-5 text-[14.5px] leading-[1.6] text-[var(--text-muted)]">
            Practice time and resumes come from one balance: one hour of practice uses the same as {resumesPerHour} tailored resumes.
          </p>
        </section>

        <section aria-labelledby="paying" className={`${card} p-6`}>
          <h2 id="paying" className="text-[18px] font-bold text-[var(--text)]">Paying</h2>
          {checkout.enabled ? (
            <p className="mt-4 text-[15px] leading-[1.6] text-[var(--text-muted)]">
              You pay on {checkout.provider}&rsquo;s secure page, by UPI (PhonePe and other UPI apps) for plans priced in rupees. We never see your bank or card details.
            </p>
          ) : (
            <p className="mt-4 text-[15px] leading-[1.6] text-[var(--text-muted)]">
              Payments are not switched on yet. Nothing can be charged until a payment account is connected. When it is, you will be able to pay by UPI, including PhonePe, on {checkout.provider}&rsquo;s secure page.
            </p>
          )}
          <p className="mt-4 text-[14.5px] leading-[1.6] text-[var(--text-muted)]">
            Kompas is for practice and for conversations where AI help is allowed. <Link href="/responsible-use" className="font-semibold text-[var(--accent)]">Read responsible use</Link>.
          </p>
        </section>
      </div>
    </PublicPage>
  )
}
