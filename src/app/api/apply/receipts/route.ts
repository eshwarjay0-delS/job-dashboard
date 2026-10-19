import { NextRequest, NextResponse } from "next/server"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"

// Apply receipts: submission proof for every apply (Tsenta /trace borrow).
// GET: list user's receipts. POST: record a new receipt.
export async function GET(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  // TODO: read from mfit_apply_receipts when migration is run
  return NextResponse.json({ ok: true, receipts: [] }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  let body: {
    jobId?: string; jobTitle?: string; company?: string; portalUrl?: string;
    atsPlatform?: string; fieldsFilled?: { field: string; value: string }[];
    screenshotUrl?: string; status?: "submitted" | "review_pending" | "failed"; error?: string
  }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) }
  if (!body.jobId || !body.portalUrl)
    return NextResponse.json({ error: "jobId and portalUrl are required." }, { status: 400 })
  // TODO: insert into mfit_apply_receipts when migration is run
  const receipt = {
    id: `rcpt_${Date.now()}`,
    userId,
    jobId: body.jobId,
    jobTitle: body.jobTitle || null,
    company: body.company || null,
    portalUrl: body.portalUrl,
    atsPlatform: body.atsPlatform || null,
    submittedAt: new Date().toISOString(),
    fieldsFilled: body.fieldsFilled || [],
    screenshotUrl: body.screenshotUrl || null,
    status: body.status || "submitted",
    error: body.error || null,
  }
  return NextResponse.json({ ok: true, receipt }, { headers: { "Cache-Control": "no-store" } })
}
