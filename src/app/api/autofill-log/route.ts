import { NextRequest, NextResponse } from "next/server"
import { blob } from "@/lib/storage"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/autofill-log — Extension autofill telemetry
//
// Called by the extension after each autoFillForm() pass so we can see:
//   - which ATS frameworks are actually being encountered in the wild
//   - per-ATS fill success rates (fieldsFilledCount vs attentionFieldCount)
//   - which attention fields are commonly missed
//
// This data drives prioritization of future per-ATS adapter fixes (TODO A4).
// Body: {
//   ats: string           — detected ATS ("greenhouse", "workday", "generic", …)
//   fieldsFilledCount: number
//   attentionFieldCount: number
//   attentionFields: string[]   — ["sponsorship question", "visa status", …]
//   pageHostname: string        — hostname only, not full URL (privacy)
// }
// Rate-limit: 60 requests/hour per IP (one fill-pass at a time; 60 is generous)
// Auth: public endpoint (extension content script has no session cookie on ATS pages)
// ─────────────────────────────────────────────────────────────────────────────

const LOG_KEY = "autofill_log.jsonl"

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`autofill-log:${clientIp(request)}`, { max: 60, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    // Telemetry — don't block the extension on rate limit; just drop the log silently
    return NextResponse.json({ ok: true })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const entry = {
      ts:                  new Date().toISOString(),
      ats:                 String(body.ats || "unknown").slice(0, 40),
      fieldsFilledCount:   Number(body.fieldsFilledCount) || 0,
      attentionFieldCount: Number(body.attentionFieldCount) || 0,
      attentionFields:     Array.isArray(body.attentionFields)
                             ? body.attentionFields.slice(0, 10).map((f: unknown) => String(f).slice(0, 60))
                             : [],
      // Hostname only — don't log full URLs (could contain PII in query params)
      pageHostname: String(body.pageHostname || "").replace(/[^a-z0-9.\-]/gi, "").slice(0, 80),
    }

    await blob.put(LOG_KEY, ((await blob.getText(LOG_KEY)) || "") + JSON.stringify(entry) + "\n")

    return NextResponse.json({ ok: true })
  } catch {
    // Never fail the extension caller — telemetry is best-effort
    return NextResponse.json({ ok: true })
  }
}
