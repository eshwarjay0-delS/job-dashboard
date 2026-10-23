// Checkout for a paid plan, switched off until the owner adds the Razorpay keys. The rules live in src/lib/checkout.ts.
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { checkoutStatus, startCheckout } from "@/lib/checkout"
import { PLAN_CATALOG, isPaid, isPriced } from "@/lib/plan-catalog"
import { hashUserId } from "@/lib/sttLedger"
import { blob } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// GET /api/checkout: is checkout on, and which plans can be bought. Setting names only, never values.
export async function GET() {
  const status = checkoutStatus()
  const plans = PLAN_CATALOG.filter(isPaid).map(plan => ({ id: plan.id, buyable: status.enabled && isPriced(plan) }))
  return NextResponse.json({ ...status, plans }, { headers: NO_STORE })
}

// POST /api/checkout { planId }: a Razorpay payment page address for a signed-in buyer, or a plain reason why not.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  // Off means off: nothing about the buyer is looked up while there is no payment account.
  const user = checkoutStatus().enabled ? await authenticatedUser(request) : null
  const reply = await startCheckout({
    body,
    userRef: user ? hashUserId(user.id) : null,
    origin: process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin,
    fetchImpl: (url, init) => fetch(url, init),
    store: blob,
  })
  return NextResponse.json(reply.body, { status: reply.status, headers: NO_STORE })
}
