"use client"

/* ── What-to-expect screen shown BEFORE Google's OAuth consent ──────────────
   Google shows an "unverified app" warning for new apps. Without context that
   screen scares people off. This modal does two jobs up front: reassure them
   about what MarketFit does with access, then prepare them for Google's
   warning screen — what they'll see and what to tap. */

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
        <h2 id="consent-modal-title">Before you connect</h2>
        <p className="consent-lead">
          Here&rsquo;s the full picture, so there are no surprises.
        </p>

        <div className="consent-perms">
          <div><strong>What MarketFit does</strong><span>Reads your job emails and sorts them — RTRs, rate confirmations, interviews, follow-ups. Drafts replies in your voice with Smart Reply. Watches for trouble in the background, like duplicate submissions or conflicting RTRs, and tells you before it costs you.</span></div>
          <div><strong>What it never does</strong><span>Sends nothing without your explicit tap. Your mail stays in your Google account — MarketFit only reads what you allow. Disconnect any account from the connections page at any time and access is revoked immediately.</span></div>
        </div>

        <div className="consent-perms">
          <div><strong>Read your Gmail</strong><span>Finds job emails, recruiter replies, and interview invites.</span></div>
          <div><strong>Send email as you</strong><span>Only ever used when <em>you</em> tap approve on a reply — nothing sends on its own.</span></div>
          <div><strong>Read your Calendar</strong><span>Spots interview and recruiting events.</span></div>
        </div>

        <p className="consent-lead" style={{ marginBottom: 12 }}>
          <strong>One heads-up:</strong> MarketFit is new, so Google hasn&rsquo;t
          verified it yet. Google will warn that <em>&ldquo;this app hasn&rsquo;t
          been verified&rdquo;</em> — that&rsquo;s normal for every new app.
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
            <span>Review the permissions, then tap <strong>Continue</strong>.</span>
          </div>
        </div>

        <div className="consent-actions">
          <button className="btn-outline" onClick={onCancel}>Not now</button>
          <button className="btn-accent" onClick={onContinue}>Continue to Google</button>
        </div>
      </div>
    </div>
  )
}
