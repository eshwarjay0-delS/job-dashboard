import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Sync — uses the Google OAuth provider_token stored in the Supabase
// session to query the Gmail REST API. No external packages needed.
//
// Flow:
//   1. Client calls GET /api/gmail-sync to get status (connected? token valid?)
//   2. Client calls POST /api/gmail-sync to run the sync
//   3. Server reads provider_token from Supabase session, queries Gmail API,
//      parses threads into Application records, returns JSON.
// ─────────────────────────────────────────────────────────────────────────────

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

// Query that covers all job-related email patterns
function buildQuery(days: number) {
  const after = new Date()
  after.setDate(after.getDate() - days)
  // Gmail date format: YYYY/MM/DD
  const afterStr = after.toISOString().split("T")[0].replace(/-/g, "/")
  return [
    "(subject:(application received) OR",
    "subject:(application submitted) OR",
    "subject:(thank you for applying) OR",
    "subject:(we received your application) OR",
    "subject:(your application) OR",
    "subject:(interview) OR",
    "subject:(offer letter) OR",
    "subject:(unfortunately) OR",
    "subject:(not moving forward) OR",
    "subject:(recruiter) OR",
    "subject:(screening call) OR",
    "subject:(next steps))",
    `after:${afterStr}`,
  ].join(" ")
}

// ── Gmail REST API helpers ────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

async function gmailGet(path: string, accessToken: string) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${res.statusText}`)
  return res.json()
}

// ── Email → Application parser ────────────────────────────────────────────────

type Stage = "applied" | "screening" | "interview" | "technical" | "offer" | "rejected"

interface ParsedApplication {
  id: string
  company: string
  role: string
  location: string
  remote: boolean
  salary: string
  stage: Stage
  appliedDate: string
  notes: string
  url: string
  visa: string
  priority: "high" | "mid" | "low"
  source: "gmail"
  gmailThreadId: string
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ""
}

function parseThread(thread: {
  id: string
  messages: Array<{
    payload: {
      headers: Array<{ name: string; value: string }>
    }
    snippet: string
  }>
}): ParsedApplication | null {
  const firstMsg = thread.messages[0]
  if (!firstMsg) return null

  const headers = firstMsg.payload.headers
  const subject = getHeader(headers, "Subject")
  const from    = getHeader(headers, "From")
  const date    = getHeader(headers, "Date")
  const snippet = firstMsg.snippet || ""

  // ── Extract company ───────────────────────────────────────────────────────
  let company = ""

  // Try display name first: "Talent Team at Stripe <jobs@stripe.com>"
  const nameMatch = from.match(/^"?([^"<@]+?)"?\s*</i)
  if (nameMatch) {
    let name = nameMatch[1].trim()
    // Strip generic names
    name = name.replace(/\b(talent|recruiting|recruiter|careers|jobs|hr|notifications|no-?reply|team)\b/gi, "").trim()
    if (name.length > 1 && name.length < 40) company = name
  }

  // Fall back to domain
  if (!company) {
    const domainMatch = from.match(/@([\w-]+)\.(com|io|ai|co|net|org|tech)/i)
    if (domainMatch) {
      company = domainMatch[1]
        .replace(/-/g, " ")
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    }
  }

  if (!company || company.length < 2) return null

  // ── Extract role ──────────────────────────────────────────────────────────
  let role = ""
  const rolePatterns = [
    /(?:application|apply)(?:ing)? (?:for|to)(?: the)? (.{5,70?})(?:\s*[-–|@]|\s*at\s|\s*position|$)/i,
    /your (.{5,60?}) (?:application|position|role|opportunity)/i,
    /interview.*?for(?: the)? (.{5,60?})(?:\s*[-–|@]|$)/i,
    /(?:re|regarding):?\s+(.{5,70?}) (?:application|interview|opportunity)/i,
    /(?:offer|congratulations)[^.]*?(?:for|as)(?: a| an)? (.{5,60?})(?:\s*[-–|@]|$)/i,
    /(.{5,70?}) (?:position|role|opening|job)/i,
  ]
  for (const re of rolePatterns) {
    const m = subject.match(re)
    if (m && m[1] && m[1].length < 80) {
      role = m[1].replace(/\s+/g, " ").trim()
      break
    }
  }
  // Last resort: use truncated subject
  if (!role || role.length < 3) {
    role = subject
      .replace(/^(re:|fwd:|fw:|your\s+)/gi, "")
      .split(/[-–|@]/)[0]
      .trim()
      .slice(0, 60)
  }

  // ── Detect stage ──────────────────────────────────────────────────────────
  const text = `${subject} ${snippet}`.toLowerCase()
  let stage: Stage = "applied"

  if (/offer letter|pleased to offer|formal offer|accept.*offer/i.test(text)) {
    stage = "offer"
  } else if (/unfortunately|not (?:moving forward|selected|chosen)|other candidates|position.*filled|keep.*mind/i.test(text)) {
    stage = "rejected"
  } else if (/technical (?:screen|interview|assessment|challenge)|coding|take.?home|hackerrank|codility|leetcode/i.test(text)) {
    stage = "technical"
  } else if (/interview|schedule.*(?:call|meet|video)|zoom|teams|google meet|meet with|video call/i.test(text)) {
    stage = "interview"
  } else if (/screening|phone screen|recruiter|initial call|next steps|reach out/i.test(text)) {
    stage = "screening"
  }

  // ── Parse date ────────────────────────────────────────────────────────────
  let appliedDate = new Date().toISOString().split("T")[0]
  try {
    const d = new Date(date)
    if (!isNaN(d.getTime())) {
      appliedDate = d.toISOString().split("T")[0]
    }
  } catch { /* use today */ }

  return {
    id: `gmail_${thread.id}`,
    company: company.slice(0, 60),
    role: role.slice(0, 80),
    location: "",
    remote: /remote/i.test(text),
    salary: "",
    stage,
    appliedDate,
    notes: `Synced from Gmail · ${subject.slice(0, 120)}`,
    url: "",
    visa: "",
    priority: stage === "offer" ? "high" : stage === "interview" || stage === "technical" ? "mid" : "low",
    source: "gmail",
    gmailThreadId: thread.id,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail-sync — returns connection status
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ connected: false, reason: "not_logged_in" })
    }

    // Check if we have a valid access token with Gmail scope
    const token = session.provider_token
    if (!token) {
      // Check if we have a stored refresh token
      const { data: profile } = await supabase
        .from("profiles")
        .select("gmail_refresh_token, gmail_connected_at")
        .eq("id", session.user.id)
        .maybeSingle()

      if (profile?.gmail_refresh_token) {
        return NextResponse.json({
          connected: true,
          via: "refresh_token",
          connectedAt: profile.gmail_connected_at,
        })
      }

      return NextResponse.json({ connected: false, reason: "no_gmail_token" })
    }

    // Quick token validity check
    try {
      const profile = await gmailGet("/profile", token)
      return NextResponse.json({
        connected: true,
        via: "provider_token",
        email: profile.emailAddress,
        totalMessages: profile.messagesTotal,
      })
    } catch {
      return NextResponse.json({ connected: false, reason: "token_invalid" })
    }
  } catch (err) {
    return NextResponse.json({ connected: false, reason: String(err) })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/gmail-sync — runs sync, returns application records
// Body: { days?: number, max?: number }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    // Cap inputs — prevent a user from triggering thousands of Gmail API calls
    const days = Math.min(Math.max(Number(body.days) || 90, 1), 365)
    const max  = Math.min(Math.max(Number(body.max)  || 50, 1), 100)

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 })
    }

    // 3 syncs per hour per user — each sync can make 10+ Gmail API calls
    const rl = checkRateLimit(`gmail-sync:${session.user.id}`, { max: 3, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many sync requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    // Resolve access token — prefer live provider_token, fall back to refresh
    let accessToken = session.provider_token || null

    if (!accessToken) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("gmail_refresh_token")
        .eq("id", session.user.id)
        .maybeSingle()

      if (profile?.gmail_refresh_token) {
        accessToken = await refreshAccessToken(profile.gmail_refresh_token)
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Gmail not connected. Please connect Gmail first." },
        { status: 403 }
      )
    }

    // ── Step 1: Search threads ─────────────────────────────────────────────
    const query = buildQuery(days)
    const searchResult = await gmailGet(
      `/threads?q=${encodeURIComponent(query)}&maxResults=${max}`,
      accessToken
    )

    const threadStubs: Array<{ id: string; snippet: string }> = searchResult.threads || []

    if (threadStubs.length === 0) {
      return NextResponse.json({ ok: true, count: 0, applications: [] })
    }

    // ── Step 2: Fetch metadata for each thread (parallel, batched) ─────────
    const BATCH = 10
    const parsed: ParsedApplication[] = []

    for (let i = 0; i < threadStubs.length; i += BATCH) {
      const slice = threadStubs.slice(i, i + BATCH)
      const threads = await Promise.allSettled(
        slice.map(t =>
          gmailGet(
            `/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            accessToken!
          )
        )
      )

      for (const result of threads) {
        if (result.status === "fulfilled") {
          const app = parseThread(result.value)
          if (app) parsed.push(app)
        }
      }
    }

    // ── Step 3: Deduplicate by company+role ────────────────────────────────
    const seen = new Set<string>()
    const deduped = parsed.filter(a => {
      const key = `${a.company.toLowerCase().slice(0,20)}:${a.role.toLowerCase().slice(0, 25)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Sort newest first
    deduped.sort((a, b) => b.appliedDate.localeCompare(a.appliedDate))

    return NextResponse.json({
      ok: true,
      count: deduped.length,
      skipped: parsed.length - deduped.length,
      applications: deduped,
    })
  } catch (err) {
    console.error("Gmail sync error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
