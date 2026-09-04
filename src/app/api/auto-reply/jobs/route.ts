import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"

// Sort order for the board: anything needing a human comes first, then the
// prepared ones, then the noise.
const STATE_RANK: Record<string, number> = {
  needs_human: 0,
  awaiting_approval: 1,
  tailored: 2,            // ready to send by hand — the most actionable state in M3
  recruiter_resolved: 3,
  tailoring: 4,
  jd_extracted: 5,
  discovered: 6,
  skipped: 7,
  rejected: 8,
  cancelled: 9,
}

interface JobRow {
  id: string
  state: string
  gmail_thread_id: string
  gmail_draft_id: string
  subject: string | null
  middleman_email: string | null
  middleman_name: string | null
  role_title: string | null
  jd_location: string | null
  jd_remote: boolean | null
  jd_skills: string[] | null
  jd_text: string | null
  thread_to: string[] | null
  thread_cc: string[] | null
  recruiter_to: string[] | null
  recruiter_cc: string[] | null
  recruiter_source: string | null
  recruiter_rationale: string | null
  recruiter_candidates: unknown
  skip_reason: string | null
  last_error: string | null
  halt_code: string | null
  updated_at: string
  tailor_token: string | null
  tailor_filename: string | null
  tailor_score: number | null
  tailored_at: string | null
  tailor_keywords: unknown
}

export async function GET(request: NextRequest) {
  if (!serviceClientAvailable()) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role is not configured on this deployment." },
      { status: 500 },
    )
  }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 })
  const userId = auth.user.id

  const db = createServiceClient()
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1), 200)

  const [{ data: settings }, { data: runs }, { data: jobs }, { data: allStates }] = await Promise.all([
    db.from("auto_reply_settings").select("*").eq("user_id", userId).maybeSingle(),
    db.from("auto_reply_run").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(1),
    db.from("auto_reply_job").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(limit),
    // Counts come from EVERY row, not the page. Computing them over the
    // truncated page hid the backlog — the oldest untouched jobs are exactly
    // the ones that fall off a 50-row updated_at window.
    db.from("auto_reply_job").select("state").eq("user_id", userId),
  ])

  const rows = (jobs || []) as JobRow[]
  rows.sort((a, b) => {
    const r = (STATE_RANK[a.state] ?? 9) - (STATE_RANK[b.state] ?? 9)
    if (r !== 0) return r
    return (b.updated_at || "").localeCompare(a.updated_at || "")
  })

  const lastRunRow = (runs || [])[0] as
    | { id: string; started_at: string; finished_at: string | null; discovered: number; advanced: number; failed: number; halted: boolean; halt_reason: string | null; tailored: number | null; tailor_note: string | null }
    | undefined

  const s = settings as {
    enabled?: boolean; autonomy?: string; dry_run?: boolean; kill_switch?: boolean
    sender_allowlist?: string[]; self_email?: string | null
  } | null

  const every = ((allStates || []) as Array<{ state: string }>).map((r) => r.state)
  const countOf = (...states: string[]) => every.filter((st) => states.includes(st)).length
  const counts = {
    needsHuman: countOf("needs_human", "awaiting_approval"),
    resolved: countOf("recruiter_resolved", "tailoring"),
    tailored: countOf("tailored"),
    skipped: countOf("skipped", "rejected", "cancelled"),
    total: every.length,
    // So the board can say "showing 50 of 214" instead of quietly truncating.
    shown: rows.length,
    truncated: every.length > rows.length,
  }

  return NextResponse.json({
    ok: true,
    // This milestone is read-only by construction: there is no send code path
    // and the Gmail scope in use is gmail.readonly.
    readOnly: true,
    settings: {
      enabled: s?.enabled ?? false,
      autonomy: s?.autonomy ?? "supervised",
      dryRun: s?.dry_run ?? true,
      killSwitch: s?.kill_switch ?? false,
      senderAllowlist: s?.sender_allowlist ?? ["tekblu", "cloudquestit"],
      selfEmail: s?.self_email ?? null,
    },
    lastRun: lastRunRow
      ? {
          id: lastRunRow.id,
          startedAt: lastRunRow.started_at,
          finishedAt: lastRunRow.finished_at,
          discovered: lastRunRow.discovered,
          advanced: lastRunRow.advanced,
          failed: lastRunRow.failed,
          halted: lastRunRow.halted,
          haltReason: lastRunRow.halt_reason,
          tailored: lastRunRow.tailored ?? 0,
          // The loop's deliberate fail-loud channel (e.g. the R2 durability
          // warning). It was written to the run row and read by nothing.
          tailorNote: lastRunRow.tailor_note ?? null,
          ageMinutes: Math.round((Date.now() - new Date(lastRunRow.started_at).getTime()) / 60000),
        }
      : null,
    counts,
    jobs: rows.map((r) => ({
      id: r.id,
      state: r.state,
      threadId: r.gmail_thread_id,
      subject: r.subject || "(no subject)",
      middlemanEmail: r.middleman_email || "",
      middlemanName: r.middleman_name || "",
      roleTitle: r.role_title || "",
      jdLocation: r.jd_location || "",
      jdRemote: !!r.jd_remote,
      jdSkills: r.jd_skills || [],
      jdExcerpt: (r.jd_text || "").slice(0, 600),
      threadTo: r.thread_to || [],
      threadCc: r.thread_cc || [],
      recruiterTo: r.recruiter_to || [],
      recruiterCc: r.recruiter_cc || [],
      recruiterSource: r.recruiter_source,
      recruiterRationale: r.recruiter_rationale || "",
      recruiterCandidates: Array.isArray(r.recruiter_candidates) ? r.recruiter_candidates : [],
      skipReason: r.skip_reason,
      lastError: r.last_error,
      haltCode: r.halt_code,
      updatedAt: r.updated_at,
      // Tailoring (M3). The file URLs are capability links: /api/tailor/file
      // authenticates by token only, so treat them as secrets-in-a-URL and do
      // not log or share them.
      tailorToken: r.tailor_token,
      tailorFilename: r.tailor_filename,
      tailorScore: r.tailor_score,
      tailoredAt: r.tailored_at,
      tailorKeywords: r.tailor_keywords ?? null,
      resumeDownloadUrl: r.tailor_token
        ? `/api/tailor/file?token=${encodeURIComponent(r.tailor_token)}&fmt=docx&name=${encodeURIComponent(r.tailor_filename || "Resume")}`
        : null,
      resumePreviewUrl: r.tailor_token
        ? `/api/tailor/file?token=${encodeURIComponent(r.tailor_token)}&fmt=preview&name=${encodeURIComponent(r.tailor_filename || "Resume")}`
        : null,
    })),
    nextCursor: null,
  })
}
