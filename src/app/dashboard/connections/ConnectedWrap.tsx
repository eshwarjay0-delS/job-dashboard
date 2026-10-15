"use client"

/* ── Post-connect confirmation ────────────────────────────────────────────
   Light wrap-up after a successful connect. The reassurance lives up front
   in the pre-connect explainer; this just confirms and points at next steps. */

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
          <p>Your inbox is syncing now. Two quick next steps:</p>
        </div>
      </div>

      <ol className="wrap-steps">
        <li>
          <strong>Fill your reply profile.</strong>
          <span>One-time setup under this account — Smart Reply uses it to draft answers in your voice.</span>
        </li>
        <li>
          <strong>Open your inbox.</strong>
          <span>Your job emails are being sorted into RTRs, rates, interviews, and follow-ups.</span>
        </li>
      </ol>

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
