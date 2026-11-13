import { NextRequest, NextResponse } from "next/server"
import { OWNER_SKIP_COOKIE, OWNER_SKIP_VALUE, ownerSkipCookieOptions, ownerSkipLocation } from "@/lib/authDisabled"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Backup for the login card. Sets the synthetic-owner session cookie and
// opens /dashboard even when owner mode was turned off.
function enterOwner(request: NextRequest) {
  const response = NextResponse.redirect(ownerSkipLocation(request.url), 307)
  response.cookies.set(OWNER_SKIP_COOKIE, OWNER_SKIP_VALUE, ownerSkipCookieOptions())
  return response
}

export function GET(request: NextRequest) {
  return enterOwner(request)
}

export function POST(request: NextRequest) {
  return enterOwner(request)
}
