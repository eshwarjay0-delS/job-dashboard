"use client"

/* ── What-to-expect screen shown BEFORE Google's OAuth consent ──────────────
   Google shows an "unverified app" warning for new apps. Without context that
   screen scares people off. This modal prepares them: what they'll see, what
   to tap, and why each permission is needed. Nothing here changes the OAuth
   flow itself — "Continue to Google" just proceeds to the normal start URL. */

export default function GoogleConsentExplainer({
  onContinue,
  onCancel,
}: {
  onContinue: () => void
  onCancel: () => void
}) {
  return (
    <div className="consent-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-modal-title">
      <div className="consent-modal">
        <h2 id="consent-modal-title">One heads-up before Google</h2>
        <p className="consent-lead">
          MarketFit is new, so Google hasn&rsquo;t verified it yet. On the next
          screen Google will warn that <em>&ldquo;this app hasn&rsquo;t been
          verified&rdquo;</em>. That&rsquo;s normal and expected — every new app
          shows it until Google completes review.
        </p>

        <div className="consent-steps">
          <div className="consent-step">
            <span className="consent-num">1</span>
            <span>On Google&rsquo;s warning screen, tap <strong>Advanced</strong>.</span>
          </div>
          <div className="consent-step">
            <span className="consent-num">2</span>
            <span>Tap <strong>Go to mfit (unsafe)</strong> to continue.</span>
          </div>
          <div className="consent-step">
            <span className="consent-num">3</span>
            <span>Review the permissions below, then tap <strong>Continue</strong>.</span>
          </div>
        </div>

        <div className="consent-perms">
          <div><strong>Read your Gmail</strong><span>Finds job emails, recruiter replies, and interview invites.</span></div>
          <div><strong>Send email as you</strong><span>Only ever used when <em>you</em> tap approve on a reply — nothing sends on its own.</span></div>
          <div><strong>Read your Calendar</strong><span>Spots interview and recruiting events.</span></div>
        </div>

        <p className="consent-fine">
          Your mail stays in your Google account. You can disconnect any account
          from this page at any time, which revokes MarketFit&rsquo;s access.
        </p>

        <div className="consent-actions">
          <button className="btn-outline" onClick={onCancel}>Not now</button>
          <button className="btn-accent" onClick={onContinue}>Continue to Google</button>
        </div>
      </div>
    </div>
  )
}
