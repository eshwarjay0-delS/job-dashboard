import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import {
  refreshAccessToken, listDraftsForAllowlist, getThreadFull, headerValue,
  parseAddresses, messageText, stripQuoted, GmailAuthError, GmailApiError,
  type GmailMessage,
} from "@/lib/auto-reply/gmail"
import { selectRecipients, matchesDomainTerm, type SelectionInput } from "@/lib/auto-reply/recruiter"
import { runTailor } from "@/lib/tailor"
import { blob } from "@/lib/storage"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"

export const runtime = "nodejs"
// Must match /api/tailor's override. NOTE: vercel.json sets 30s for
// "src/app/api/**"; a route-segment export is what raises this one.
export const maxDuration = 60

// Leave headroom under maxDuration so the run can always close its own row
// rather than being killed mid-tick and leaving the lock held.
const BUDGET_MS = 45_000

interface Settings {
  user_id: string
  enabled: boolean
  autonomy: string
  dry_run: boolean
  kill_switch: boolean
  self_email: string | null
  sender_allowlist: string[]
  freemail_domains: string[]
  lookback_days: number
  min_age_days: number
  cc_middleman: boolean
  base_resume_filepath: string | null
  max_tailors_per_run: number
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  // Length check first — timingSafeEqual throws on a length mismatch.
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/** Cron-secret auth, else a logged-in user acting on their own account. */
async function resolveCaller(request: NextRequest, bodyUserId?: string): Promise<
  { ok: true; userId: string; trigger: "cron" | "ui" } | { ok: false; status: number; error: string }
> {
  const secret = process.env.AUTO_REPLY_CRON_SECRET
  const provided = request.headers.get("x-auto-reply-secret")
  if (provided) {
    if (!secret || secret.length < 32) {
      return { ok: false, status: 500, error: "AUTO_REPLY_CRON_SECRET is unset or too short on this deployment." }
    }
    if (!timingSafeEqual(provided, secret)) {
      return { ok: false, status: 401, error: "Bad cron secret." }
    }
    if (!bodyUserId) return { ok: false, status: 400, error: "userId is required for a cron-triggered tick." }
    return { ok: true, userId: bodyUserId, trigger: "cron" }
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, status: 401, error: "Not signed in." }
  return { ok: true, userId: data.user.id, trigger: "ui" }
}

export async function POST(request: NextRequest) {
  const started = Date.now()
  const body = (await request.json().catch(() => ({}))) as { userId?: string; dryRun?: boolean; githubRun?: string }

  if (!serviceClientAvailable()) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role is not configured (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Refusing to run rather than silently finding nothing." },
      { status: 500 },
    )
  }

  const caller = await resolveCaller(request, body.userId)
  if (!caller.ok) return NextResponse.json({ ok: false, error: caller.error }, { status: caller.status })
  const userId = caller.userId

  const db = createServiceClient()

  // ── Settings (create a safe default row on first run) ─────────────────────
  let settings: Settings | null = null
  {
    const { data } = await db.from("auto_reply_settings").select("*").eq("user_id", userId).maybeSingle()
    if (data) settings = data as Settings
    else {
      const { data: created } = await db
        .from("auto_reply_settings")
        .insert({ user_id: userId })   // defaults: disabled, supervised, dry_run
        .select("*")
        .maybeSingle()
      settings = (created as Settings) || null
    }
  }
  if (!settings) {
    return NextResponse.json({ ok: false, error: "Could not read or create auto_reply_settings — has supabase/auto_reply_schema.sql been run?" }, { status: 500 })
  }

  if (settings.kill_switch) {
    return NextResponse.json({ ok: false, halted: true, haltReason: "kill_switch", error: "Kill switch is on." }, { status: 423 })
  }
  // A cron tick respects `enabled`; a human pressing "Run now" may always scan,
  // because this milestone cannot send anything.
  if (!settings.enabled && caller.trigger === "cron") {
    return NextResponse.json({ ok: false, halted: true, haltReason: "disabled", error: "Loop is disabled." }, { status: 423 })
  }

  // ── Reclaim stale runs, then claim this one ───────────────────────────────
  await db
    .from("auto_reply_run")
    .update({ finished_at: new Date().toISOString(), halted: true, halt_reason: "lease_expired" })
    .eq("user_id", userId)
    .is("finished_at", null)
    .lt("started_at", new Date(Date.now() - 10 * 60_000).toISOString())

  const { data: run, error: runErr } = await db
    .from("auto_reply_run")
    .insert({ user_id: userId, trigger: caller.trigger, github_run: body.githubRun ?? null, dry_run: true })
    .select("id")
    .maybeSingle()

  if (runErr || !run) {
    // 23505 on auto_reply_run_active_uniq = another tick is live. Not an error.
    const code = (runErr as { code?: string } | null)?.code
    if (code === "23505") {
      return NextResponse.json({ ok: false, error: "Another tick is already running." }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: `Could not start a run: ${runErr?.message || "unknown"}` }, { status: 500 })
  }
  const runId = (run as { id: string }).id

  // `patch` goes to the auto_reply_run ROW and must contain only real columns;
  // `extra` is response-only. They used to be one object, and two call sites
  // passed `error` — which is not a column — so PostgREST rejected the entire
  // UPDATE (PGRST204) and finished_at stayed NULL. The discarded result meant
  // that failed silently, leaving a halted loop indistinguishable from a clean
  // empty scan on the board.
  const finish = async (
    patch: Record<string, unknown>,
    http = 200,
    extra: Record<string, unknown> = {},
  ) => {
    const { error: finErr } = await db.from("auto_reply_run")
      .update({ finished_at: new Date().toISOString(), duration_ms: Date.now() - started, ...patch })
      .eq("id", runId)
    if (finErr) {
      // Loud, because this is exactly the schema-drift class of bug that hides.
      console.error("[auto-reply] FAILED to finalize run", runId, finErr.message, Object.keys(patch))
    }
    return NextResponse.json(
      { ok: http === 200, runId, usedMs: Date.now() - started, ...patch, ...extra },
      { status: http },
    )
  }

  // ── Gmail access token (no session here — always via the stored refresh token)
  let accessToken: string
  try {
    const { data: profile } = await db
      .from("profiles").select("gmail_refresh_token").eq("id", userId).maybeSingle()
    const rt = (profile as { gmail_refresh_token?: string } | null)?.gmail_refresh_token
    if (!rt) {
      return finish({ halted: true, halt_reason: "gmail_not_connected" }, 200)
    }
    accessToken = await refreshAccessToken(rt)
  } catch (e) {
    const code = e instanceof GmailAuthError ? e.code : "token_error"
    await db.from("auto_reply_event").insert({
      user_id: userId, run_id: runId, actor: "loop", kind: "halt",
      rationale: String((e as Error).message), payload: { code },
    })
    if (code === "invalid_grant" || code === "invalid_client") {
      await db.from("auto_reply_settings")
        .update({ kill_switch: true, kill_reason: code, killed_at: new Date().toISOString() })
        .eq("user_id", userId)
    }
    return finish({ halted: true, halt_reason: code }, 200, { error: String((e as Error).message) })
  }

  const self = (settings.self_email || "").toLowerCase()
  const allowlist = settings.sender_allowlist || []
  const freemail = settings.freemail_domains || []

  let discovered = 0
  let advanced = 0
  let failed = 0

  try {
    // Age BAND, e.g. 3..7 days: skip drafts still fresh enough that the
    // recruiter may be mid-conversation, and skip anything stale.
    const drafts = await listDraftsForAllowlist(
      accessToken, allowlist, settings.lookback_days, settings.min_age_days ?? 0,
    )

    for (const d of drafts) {
      if (Date.now() - started > BUDGET_MS) break

      const draftId = d.id
      const msg = d.message
      const threadId = msg?.threadId
      if (!draftId || !threadId) continue

      // Re-check the allowlist ourselves — the Gmail `q` filter is only a
      // narrowing optimisation and its address matching is undocumented.
      const draftTo = [...parseAddresses(headerValue(msg, "To")), ...parseAddresses(headerValue(msg, "Cc"))]
      if (!draftTo.some((a) => matchesDomainTerm(a, allowlist))) continue

      discovered++

      const idem = crypto.createHash("sha256").update(`${userId}|${threadId}|${draftId}`).digest("hex")

      // One job per draft, forever.
      const { data: existing } = await db
        .from("auto_reply_job").select("id, state").eq("idempotency_key", idem).maybeSingle()

      let jobId = (existing as { id: string } | null)?.id ?? null
      const existingState = (existing as { state: string } | null)?.state
      // Leave alone anything already past selection. Discovery used to rewrite
      // state unconditionally, so a job this loop had TAILORED was knocked back
      // to 'recruiter_resolved' on the very next tick — and then never
      // re-tailored, because the tailor query only picks up tailor_token IS NULL.
      // The prepared resume silently fell out of the "Ready to send" bucket.
      // 'skipped' is deliberately NOT frozen: every skip_reason written here is a
      // transient condition (thread not yet showing an allowlisted sender, JD too
      // short at the time), so freezing it would make a recoverable state
      // permanent. 'rejected'/'cancelled' are user/terminal decisions, and the
      // three work states must not be knocked backwards.
      if (existingState && ["rejected", "cancelled", "tailoring", "tailored", "awaiting_approval"].includes(existingState)) continue

      // ── Read the thread and locate the recruiter's own message ───────────
      let thread: { messages: GmailMessage[] }
      try {
        thread = await getThreadFull(accessToken, threadId)
      } catch (e) {
        failed++
        if (jobId) {
          await db.from("auto_reply_job")
            .update({ last_error: String((e as Error).message), updated_at: new Date().toISOString() })
            .eq("id", jobId)
        }
        if (e instanceof GmailApiError && (e.status === 429 || e.reason.includes("ateLimit"))) break
        continue
      }

      // The source message is the newest one FROM an allowlisted middleman.
      const fromMiddleman = (thread.messages || []).filter((m) =>
        parseAddresses(headerValue(m, "From")).some((a) => matchesDomainTerm(a, allowlist)),
      )
      const source = fromMiddleman.length ? fromMiddleman[fromMiddleman.length - 1] : null

      const baseRow = {
        user_id: userId,
        gmail_thread_id: threadId,
        gmail_draft_id: draftId,
        idempotency_key: idem,
        subject: headerValue(source || msg, "Subject").slice(0, 400),
        updated_at: new Date().toISOString(),
      }

      if (!source) {
        const row = { ...baseRow, middleman_email: draftTo.find((a) => matchesDomainTerm(a, allowlist)) || "unknown", state: "skipped", skip_reason: "no message from an allowlisted sender in this thread" }
        const { data: up } = await db.from("auto_reply_job").upsert(row, { onConflict: "idempotency_key" }).select("id").maybeSingle()
        jobId = (up as { id: string } | null)?.id ?? jobId
        advanced++
        continue
      }

      const middleman = parseAddresses(headerValue(source, "From")).find((a) => matchesDomainTerm(a, allowlist)) || ""
      const header = {
        from: parseAddresses(headerValue(source, "From")),
        to: parseAddresses(headerValue(source, "To")),
        cc: parseAddresses(headerValue(source, "Cc")),
      }

      const jdRaw = stripQuoted(messageText(source))
      const input: SelectionInput = {
        header, self, allowlist, freemail,
        ccMiddleman: settings.cc_middleman === true,   // default false: recruiter only
      }
      const sel = selectRecipients(input)

      const row = {
        ...baseRow,
        middleman_email: middleman,
        middleman_name: (headerValue(source, "From").split("<")[0] || "").replace(/"/g, "").trim().slice(0, 120) || null,
        jd_text: jdRaw.slice(0, 20000),
        role_title: null as string | null,
        thread_to: header.to,
        thread_cc: header.cc,
        recruiter_to: sel.ok ? sel.to : [],
        recruiter_cc: sel.ok ? sel.cc : [],
        recruiter_source: sel.ok ? sel.source : null,
        recruiter_rationale: sel.rationale,
        recruiter_candidates: sel.candidates,
        state: !jdRaw ? "skipped" : sel.ok ? "recruiter_resolved" : "needs_human",
        skip_reason: !jdRaw ? "no readable job description in the recruiter's message" : null,
        halt_code: sel.ok ? null : sel.haltCode ?? null,
        // Deliberately NOT clearing last_error here: discovery re-runs on every
        // tick, and nulling it wiped the tailor-failure message before anyone
        // could read it on the board.
      }

      const { data: up, error: upErr } = await db
        .from("auto_reply_job").upsert(row, { onConflict: "idempotency_key" }).select("id").maybeSingle()
      if (upErr) {
        failed++
        console.error("[auto-reply] job upsert failed", { threadId, message: upErr.message })
        await db.from("auto_reply_event").insert({
          user_id: userId, run_id: runId, actor: "loop", kind: "error",
          rationale: `job upsert failed for thread ${threadId}: ${upErr.message}`,
        })
        continue
      }
      jobId = (up as { id: string } | null)?.id ?? jobId
      advanced++

      await db.from("auto_reply_event").insert({
        user_id: userId, job_id: jobId, run_id: runId, actor: "loop", kind: "decision",
        to_state: row.state, decision: "recruiter_selected",
        chosen: { to: row.recruiter_to, cc: row.recruiter_cc },
        rejected: sel.candidates.filter((c) => !c.selected),
        rationale: sel.rationale,
      })

      // Learning store: record that these addresses were seen / proposed.
      for (const c of sel.candidates) {
        const dom = c.address.split("@")[1] || ""
        await db.from("auto_reply_recruiter_stat").upsert({
          user_id: userId, address: c.address, domain: dom,
          via_middleman_domain: middleman.split("@")[1] || null,
          is_freemail: c.klass === "freemail", is_middleman: c.klass === "middleman",
          last_seen: new Date().toISOString(),
        }, { onConflict: "user_id,address" })
      }
    }
  } catch (e) {
    return finish({ discovered, advanced, failed, halted: true, halt_reason: "unhandled" }, 200, { error: String((e as Error).message) })
  }

  // ── M3: tailor a resume for prepared jobs (NO Gmail write) ────────────────
  // Deferred until discovery is done, and skipped entirely on a tick that spent
  // its time discovering: one runTailor can eat 30-50s of a 60s function, so a
  // busy tick defers tailoring to the next one. Once discovery goes quiet,
  // tailoring gets the whole window. Self-balancing, no scheduling needed.
  let tailored = 0
  let tailorNote: string | null = null
  const TAILOR_START_CUTOFF_MS = 12_000
  // maxDuration is 60s; leave a margin so the run can still close its own row.
  const TICK_HARD_MS = 55_000
  // Observed runTailor cost, incl. the model ladder. A second tailor only starts
  // if this much wall-clock remains — in practice that means one per tick.
  const TAILOR_NEEDS_MS = 40_000
  const maxTailors = settings.max_tailors_per_run ?? 1

  if (maxTailors > 0 && Date.now() - started <= TAILOR_START_CUTOFF_MS) {
    const keys = resolveKeys()
    if (!settings.base_resume_filepath) {
      // Never auto-match from here. An unauthenticated caller resolves to the
      // "demo" user inside /api/tailor, so auto-match would rank against the
      // wrong library entirely. An explicit base path is mandatory.
      tailorNote = "no base_resume_filepath set — pick a base resume before the loop can tailor"
    } else if (!hasAnyKey(keys)) {
      tailorNote = "no LLM key on this deployment (ANTHROPIC_API_KEY / OPENROUTER / GEMINI / GROQ)"
    } else {
      // Loud warning rather than silent data loss: on Vercel without R2, blob
      // writes land in /tmp on ONE lambda instance, so the .docx this tick
      // creates may 404 when a later request tries to read it back.
      // Mirror makeBlob()'s selection exactly (src/lib/storage.ts): R2 is used
      // only when ALL FOUR vars are set. Checking R2_BUCKET alone would call a
      // half-configured deployment "safe".
      const r2Configured = !!(process.env.R2_BUCKET && process.env.R2_ACCOUNT_ID
        && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)
      if (process.env.VERCEL && !r2Configured) {
        tailorNote = "WARNING: on Vercel without a complete R2 config — tailored files go to per-instance /tmp and a later request may not be able to read them back. Set R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY."
      }

      // AR-C3: reclaim jobs stranded in 'tailoring' by a killed tick. The
      // function can only live 60s, so anything older than 5 minutes is dead —
      // without this they are invisible forever (the pending query below only
      // looks at 'recruiter_resolved').
      const staleCutoff = new Date(Date.now() - 5 * 60_000).toISOString()
      const { data: stale } = await db.from("auto_reply_job")
        .select("id, attempts").eq("user_id", userId).eq("state", "tailoring").lt("updated_at", staleCutoff)
      for (const st of (stale || []) as Array<{ id: string; attempts: number | null }>) {
        // A killed function never reaches the catch, so this is the ONLY place a
        // death can be counted. Without incrementing here, a job that reliably
        // kills the tick retries forever and eats the single tailor slot.
        const n = (st.attempts ?? 0) + 1
        await db.from("auto_reply_job").update({
          state: n >= 4 ? "needs_human" : "recruiter_resolved",
          attempts: n,
          halt_code: n >= 4 ? "tailor_kills_tick" : null,
          last_error: `tick died mid-tailor (attempt ${n})${n >= 4 ? " — giving up, needs a human" : "; will retry"}`,
          next_attempt_at: new Date(Date.now() + Math.min(60, 5 * 2 ** n) * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", st.id)
      }
      const { data: pending, error: pendErr } = await db
        .from("auto_reply_job")
        .select("id, jd_text, subject, attempts")
        .eq("user_id", userId)
        .eq("state", "recruiter_resolved")
        .is("tailor_token", null)
        .lt("attempts", 4)                       // give up after 4 tries
        .lte("next_attempt_at", new Date().toISOString())  // honour the backoff
        .order("updated_at", { ascending: true })
        .limit(maxTailors)
      if (pendErr) {
        // Without this the stage no-ops and the run still reports success — the
        // exact shape of failure this loop is supposed to make impossible.
        console.error("[auto-reply] pending-tailor query failed", pendErr.message)
        tailorNote = `could not read pending jobs: ${pendErr.message}`
      }

      for (const j of (pending || []) as Array<{ id: string; jd_text: string | null; subject: string | null; attempts: number | null }>) {
        // Require enough headroom to FINISH a tailor, not merely to start one.
        // The earlier version reused the stage-entry predicate, so it was always
        // false here and never actually gated anything.
        if (Date.now() - started > TICK_HARD_MS - TAILOR_NEEDS_MS) break
        if (!j.jd_text || j.jd_text.trim().length < 200) {
          await db.from("auto_reply_job")
            .update({ state: "skipped", skip_reason: "job description too short to tailor against", updated_at: new Date().toISOString() })
            .eq("id", j.id)
          continue
        }
        await db.from("auto_reply_job").update({ state: "tailoring", updated_at: new Date().toISOString() }).eq("id", j.id)
        try {
          const result = await runTailor({
            jd: j.jd_text,
            keys,
            // The containment check only needs the path to sit under the shared
            // base. Using the per-user dir would reject the extension-uploaded
            // library, which lives under ".../user-resumes/demo/".
            userResumeDir: USER_RESUMES_BASE,
            givenPath: settings.base_resume_filepath,
            mode: "full",
          })
          // The token is only meaningful if the bytes are actually retrievable.
          // Recording one we cannot read back is worse than failing: the pending
          // query skips jobs that have a token, so the job would never be
          // retried and the board would offer a download that 404s.
          const readable = await blob.exists(`tailored/${result.token}.docx`).catch(() => false)
          if (!readable) {
            throw new Error("tailored file was not readable immediately after generation — storage is not durable here (configure R2 on Vercel)")
          }
          await db.from("auto_reply_job").update({
            state: "tailored",
            tailor_token: result.token,
            tailor_filename: result.matched?.filename ?? null,
            tailor_score: typeof result.score === "number" ? Math.round(result.score) : null,
            tailor_base_path: settings.base_resume_filepath,
            tailor_keywords: result.keyword_analysis ?? null,
            tailored_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          }).eq("id", j.id)
          await db.from("auto_reply_event").insert({
            user_id: userId, job_id: j.id, run_id: runId, actor: "loop", kind: "decision",
            to_state: "tailored", decision: "resume_tailored",
            chosen: { token: result.token, score: result.score, filename: result.matched?.filename },
            rationale: `Tailored from ${result.matched?.filename ?? "base resume"} — match ${Math.round(result.score ?? 0)}.`,
          })
          tailored++
        } catch (e) {
          failed++
          // Back to recruiter_resolved so the next tick retries; the job is not
          // lost, and a persistent failure surfaces via last_error on the board.
          const nextAttempts = (j.attempts ?? 0) + 1
          const exhausted = nextAttempts >= 4
          await db.from("auto_reply_job").update({
            // Exhausted retries must land somewhere a human sees. Left in
            // 'recruiter_resolved' the job is invisible: filtered out of the
            // pending query, but never shown as needing attention either.
            state: exhausted ? "needs_human" : "recruiter_resolved",
            halt_code: exhausted ? "tailor_failed" : null,
            last_error: `tailor failed (attempt ${nextAttempts}): ${String((e as Error).message)}`,
            attempts: nextAttempts,
            // Exponential-ish backoff so a persistently failing job stops
            // consuming the one tailor slot every single tick.
            next_attempt_at: new Date(Date.now() + Math.min(60, 5 * 2 ** nextAttempts) * 60_000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", j.id)
        }
      }
    }
  } else if (maxTailors > 0) {
    tailorNote = "skipped this tick — discovery used the time budget; will tailor on the next tick"
  }

  return finish({ discovered, advanced, tailored, failed, tailor_note: tailorNote, halted: false })
}
