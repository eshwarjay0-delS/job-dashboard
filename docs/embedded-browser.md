# Embedded Browser: In-App Apply Route Design

**Status:** Design (2026-10-18)
**Owner directive:** "Tsenta's approach is based on that. If we wanna automate job applications for user. That's the only route." (Oct 17)
**Principle:** We host the apply flow on OUR website. We are a Jobright/Tsenta competitor, never their client.

## Decision 1: Desktop browser integration

**Choice: Electron `BrowserView` with persistent `session`.**

| Option | Verdict |
|---|---|
| Electron BrowserView | ✅ **Chosen.** Persistent session, cookie jar, full Chromium. `session.fromPartition('persist:apply-<userId>')` gives per-user isolation. |
| iframe | ❌ Job sites block iframes (X-Frame-Options). No way around it. |
| New tab (current) | ⚠️ Fine for manual apply, cannot automate. This is what we have now. |
| Server-side Playwright | ✅ **Phase 2.** The auto-apply worker (`~/workspace/apply-worker/`) already prototypes this. Needs direct-internet host (VM proxy blocks it). |

Phase 1 (now): Electron BrowserView — user browses portal in-app, logs in, session persists like Chrome.
Phase 2 (when host ready): Server-side warm workers — Tsenta's actual procedure (already REA'd).

## Decision 2: Per-user session boundaries

```
session.fromPartition(`persist:apply-${userId}`)
```

- Each user gets an isolated cookie jar. No cross-user leakage.
- Session persists across app restarts (like Chrome).
- Clear-data control in settings: "Forget all portal logins."
- NEVER: shared session, in-memory only (loses logins), or proxying passwords through our server.

## Decision 3: Stored answers and preference profile

A per-user "apply profile" — reusable answers for common ATS fields:

```ts
interface ApplyProfile {
  userId: string
  // Identity (from resume — never typed by hand twice)
  fullName, email, phone, location, linkedin, github, portfolio
  // Work authorization (asked once, reused)
  workAuth: "US Citizen" | "GC Holder" | "H1B" | ...
  visaSponsorship: boolean
  // Preferences (the "reusable preference profile")
  willingToRelocate: boolean
  remoteOnly: boolean
  minRate?: number
  // EEO (stored, never auto-submitted without review)
  gender?, race?, veteranStatus?, disability?
}
```

- Stored in Supabase, per-user, encrypted at rest.
- The bookmarklet (`public/autofill-bookmarklet.js`) already pulls from `/api/profile` — same shape.
- **Review gate:** Before ANY submission, user sees exactly what will be sent. Tsenta's `/resume-submit` pattern.

## Decision 4: Submission receipts

Every apply generates a receipt (Tsenta's `/applications/{id}/trace` borrow):

```ts
interface ApplyReceipt {
  id: string
  userId: string
  jobId: string
  portalUrl: string
  atsPlatform: string  // greenhouse, workday, etc.
  submittedAt: string
  fieldsFilled: { field: string; value: string }[]  // what we sent
  screenshotUrl?: string  // confirmation page
  status: "submitted" | "review_pending" | "failed"
}
```

- Stored in `mfit_apply_receipts` (new table, same migration pattern as crawl).
- User sees: "Applied to [Job] via [Portal] at [Time]. [View receipt]"
- Failed applies show exactly which field failed — no silent drops.

## What this is NOT

- Not a password manager. We never see or store portal passwords. The browser session holds them, like Chrome.
- Not auto-submit without consent. Every submission goes through the review gate. The user taps "Submit" — we just fill the form.
- Not cross-origin magic. The BrowserView IS a real Chromium — no iframe limitations.

## Implementation phases

**Phase 1: In-app browsing (Electron)**
1. Add `BrowserView` to desktop shell (`~/workspace/perfact-desktop/main.js`)
2. "Open portal" opens BrowserView instead of external tab (platform-aware)
3. Per-user session partitions
4. Receipt table + UI

**Phase 2: Auto-apply (server-side)**
1. Deploy apply-worker to direct-internet host
2. Warm browser pool per Tsenta procedure
3. ATS field maps (we have 91; need iCIMS/Taleo from real forms)
4. Gmail OTP reading for ATS account creation
5. Review gate UI → submit → receipt

## Next

1. Scaffold `mfit_apply_receipts` table migration
2. Define `ApplyProfile` API (`/api/apply/profile`)
3. Wire receipt generation into "Mark as submitted" flow
