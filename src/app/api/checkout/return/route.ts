// Where Razorpay sends a buyer back after paying. The payment is recorded only when its signature checks out.
import { NextRequest, NextResponse } from "next/server"
import { finishCheckout } from "@/lib/checkout"
import { blob } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const to = await finishCheckout({ query: request.nextUrl.searchParams, store: blob }).catch(() => "/plans?payment=unverified")
  return NextResponse.redirect(new URL(to, request.nextUrl.origin), 303)
}
