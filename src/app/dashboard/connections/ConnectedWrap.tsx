"use client"

/* ── Post-connect wrap card ───────────────────────────────────────────────
   Replaces the flat "X is now connected" line with a moment that keeps the
   person involved and informed: what just happened, what MarketFit is doing
   with the access, and the exact next steps. */

export default function ConnectedWrap({
  email,
  canAddMore,
  onAddAnother,
}: {
  email: string | null
  canAddMore: boolean
  onAddAnother: () => void
}) {
  return (
    <div className="wrap-card">
      <div className="wrap-hero">
        <span className="wrap-check" aria-hidden="true">✓</span>
        <div>
          <h3>{email ? `${email} is connected` : "Google account connected"}</h3>
          <p>You&rsquo;re in. Here&rsquo;s what happens now.</p>
        </div>
      </div>

      <ol className="wrap-steps">
        <li>
          <strong>Your inbox is syncing.</strong>
          <span>MarketFit reads your job emails and sorts them — RTRs, rate confirmations, interviews, follow-ups.</span>
        </li>
        <li>
          <strong>Fill your reply profile.</strong>
          <span>One-time setup under this account. Smart Reply uses it to draft answers in your voice — nothing ever sends without your tap.</span>
        </li>
        <li>
          <strong>The watchdog is on.</strong>
          <span>MarketFit watches for trouble in the background: duplicate submissions, conflicting RTRs, silent vendors — and tells you before it costs you.</span>
        </li>
      </ol>

      <p className="wrap-fine">
        Your mail stays in your Google account. Disconnect anytime from this page and access is revoked immediately.
      </p>

      <div className="wrap-actions">
        <a className="btn-accent" href="/dashboard/mail">Open your inbox</a>
        {canAddMore && (
          <button className="btn-outline" onClick={onAddAnother}>
            Add another account
          </button>
        )}
      </div>
    </div>
  )
}
