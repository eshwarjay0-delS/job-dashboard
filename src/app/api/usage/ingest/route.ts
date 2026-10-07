import { NextRequest, NextResponse } from "next/server"
import { recordLlmCall } from "@/lib/llmLedger"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"
import { MAX_REPORT_BYTES, ingestKey, readReport, reportIsSigned } from "@/lib/usageIngest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/usage/ingest — Kompas reports the model calls it made, and they are filed in the one ledger the admin page reads.
// Server to server: no cookie, no CORS. A report must be signed (src/lib/usageIngest.ts says with what, and why that key);
// counts and labels only, every field checked before anything is stored.
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(`usage-ingest:${clientIp(request)}`, { max: 600, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too many reports." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec ?? 60) } })

  const key = ingestKey()
  if (!key) return NextResponse.json({ error: "This deployment cannot check a report's signature: it has neither USAGE_INGEST_SECRET nor a Groq key to derive one from." }, { status: 503 })

  const body = await request.text()
  if (body.length > MAX_REPORT_BYTES) return NextResponse.json({ error: "Report too large." }, { status: 413 })
  // One answer for every way a signature can be wrong, so a caller learns nothing from the difference.
  if (!reportIsSigned(body, request.headers.get("x-usage-signature"), key)) return NextResponse.json({ error: "Not accepted." }, { status: 401 })

  const report = readReport(body, Date.now())
  if (!report.ok) return NextResponse.json({ error: "Not accepted.", because: report.because }, { status: 400 })

  const kept = (await Promise.all(report.calls.map(recordLlmCall))).filter(Boolean).length
  return NextResponse.json({ ok: kept === report.calls.length, kept, received: report.calls.length }, { status: kept === report.calls.length ? 200 : 500 })
}
