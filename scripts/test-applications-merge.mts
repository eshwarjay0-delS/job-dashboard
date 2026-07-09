// Test for mergeGmailApplications (src/lib/applications.ts) — the fix for the
// "Sync Gmail reports N added, saves 0" bug found 2026-07-09 (see memory:
// project-gmail-connect). loadApplications/saveApplications only need
// `window` + `localStorage.getItem/setItem` to exist — a tiny in-memory stub
// is enough, no jsdom needed for pure data-layer logic like this.
//
// Run: node scripts/test-applications-merge.mts   (exit 0 = all pass)

const store = new Map<string, string>()
;(globalThis as unknown as { window: object }).window = {}
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const { loadApplications, mergeGmailApplications, APPLICATIONS_KEY } = await import("../src/lib/applications.ts")

const results: { name: string; pass: boolean; detail?: string }[] = []
function check(name: string, cond: boolean, detail = "") {
  results.push({ name, pass: cond, detail })
  console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${name}${cond || !detail ? "" : ` — ${detail}`}`)
}

// ── 1. Fresh sync into an empty tracker → both entries added ──────────────────
store.clear()
{
  const r = mergeGmailApplications([
    { id: "gmail_t1", company: "Stripe", role: "Security Engineer", location: "Remote", remote: true,
      salary: "", stage: "applied", appliedDate: "2026-07-01", notes: "Synced from Gmail · Application received",
      url: "", visa: "", priority: "low" },
    { id: "gmail_t2", company: "Datadog", role: "AppSec Engineer", location: "NYC", remote: false,
      salary: "", stage: "screening", appliedDate: "2026-07-02", notes: "Synced from Gmail · Recruiter call",
      url: "", visa: "", priority: "low" },
  ])
  check("first sync: both new threads added", r.added === 2 && r.updated === 0, JSON.stringify(r))
  check("tracker now has 2 entries", loadApplications().length === 2, String(loadApplications().length))
}

// ── 2. Re-sync the SAME thread with a LATER stage → updates in place, no dup ──
{
  const r = mergeGmailApplications([
    { id: "gmail_t1", company: "Stripe", role: "Security Engineer", location: "Remote", remote: true,
      salary: "", stage: "interview", appliedDate: "2026-07-01", notes: "Synced from Gmail · Interview scheduled",
      url: "", visa: "", priority: "mid" },
  ])
  const apps = loadApplications()
  check("re-sync with a later stage: 0 added, 1 updated (no duplicate row)", r.added === 0 && r.updated === 1, JSON.stringify(r))
  check("tracker still has exactly 2 entries (not 3)", apps.length === 2, String(apps.length))
  check("Stripe entry's stage actually moved to interview", apps.find(a => a.id === "gmail_t1")?.stage === "interview", apps.find(a => a.id === "gmail_t1")?.stage)
}

// ── 3. An OLDER/stale email for the same thread → must NOT downgrade the stage ─
{
  const r = mergeGmailApplications([
    { id: "gmail_t1", company: "Stripe", role: "Security Engineer", location: "Remote", remote: true,
      salary: "", stage: "applied", appliedDate: "2026-07-01", notes: "Synced from Gmail · Application received (re-parsed)",
      url: "", visa: "", priority: "low" },
  ])
  const stripe = loadApplications().find(a => a.id === "gmail_t1")
  check("stale 'applied' re-parse does not downgrade an interview back to applied", stripe?.stage === "interview", stripe?.stage)
  check("stale re-parse counts as neither added nor updated", r.added === 0 && r.updated === 0, JSON.stringify(r))
}

// ── 4. Rejection is terminal and DOES override a lower stage (e.g. a ghosted screening) ─
{
  const r = mergeGmailApplications([
    { id: "gmail_t2", company: "Datadog", role: "AppSec Engineer", location: "NYC", remote: false,
      salary: "", stage: "rejected", appliedDate: "2026-07-05", notes: "Synced from Gmail · Not moving forward",
      url: "", visa: "", priority: "low" },
  ])
  const dd = loadApplications().find(a => a.id === "gmail_t2")
  check("a later rejection DOES override an earlier screening stage", dd?.stage === "rejected", dd?.stage)
  check("rejection registers as an update", r.updated === 1, JSON.stringify(r))
}

// ── 5. A Gmail thread matching an ALREADY-manually-tracked company+role merges
//       into it (by name) instead of creating a second row for the same job ──
{
  const before = loadApplications()
  before.push({
    id: "manual_abc123", company: "Anthropic", role: "Security Analyst", location: "SF", remote: false,
    salary: "", stage: "applied", appliedDate: "2026-07-03", notes: "Applied via job board",
    url: "https://anthropic.com/careers/123", visa: "", priority: "high",
  })
  ;(globalThis as unknown as { localStorage: Storage }).localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(before))

  const r = mergeGmailApplications([
    { id: "gmail_t3", company: "Anthropic", role: "Security Analyst", location: "", remote: false,
      salary: "", stage: "interview", appliedDate: "2026-07-08", notes: "Synced from Gmail · Interview scheduled",
      url: "", visa: "", priority: "mid" },
  ])
  const apps = loadApplications()
  const anthropic = apps.filter(a => a.company === "Anthropic")
  check("gmail thread merges into the existing manually-tracked row, not a new one", anthropic.length === 1, String(anthropic.length))
  check("the manually-tracked row's original id is preserved (not overwritten)", anthropic[0]?.id === "manual_abc123", anthropic[0]?.id)
  check("its stage still moved forward to interview via the merge", anthropic[0]?.stage === "interview", anthropic[0]?.stage)
  check("registers as an update, not an add", r.added === 0 && r.updated === 1, JSON.stringify(r))
}

// ── 6. Unrecognized stage string → skipped, never crashes or corrupts the tracker ─
{
  const before = loadApplications().length
  const r = mergeGmailApplications([
    { id: "gmail_weird", company: "Weyland-Yutani", role: "??", location: "", remote: false,
      salary: "", stage: "some_unrecognized_stage", appliedDate: "2026-07-09", notes: "",
      url: "", visa: "", priority: "low" },
  ])
  check("unrecognized stage is skipped, not force-cast", r.added === 0 && r.updated === 0, JSON.stringify(r))
  check("tracker size unchanged after the skip", loadApplications().length === before, String(loadApplications().length))
}

// ═════════════════════════════════════════════════════════════════════════════
const failures = results.filter(r => !r.pass)
console.log(`\n━━ RESULT: ${results.length - failures.length}/${results.length} passed ━━`)
if (failures.length) {
  console.log("Failures:")
  for (const f of failures) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`)
}
process.exit(failures.length ? 1 : 0)
