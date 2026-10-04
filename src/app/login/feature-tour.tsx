"use client"

import { useEffect, useState } from "react"

const SLIDES = [
  {
    eyebrow: "Identity",
    title: "One account powers every surface.",
    body: "Google sign-in creates the MarketFit identity. Your verified phone, WhatsApp, Gmail + Calendar connection, extension and subscription all resolve back to that same account.",
    kind: "identity",
  },
  {
    eyebrow: "Resume pipeline",
    title: "Your resume moves through one visible pipeline.",
    body: "MarketFit reads the job description, finds the strongest evidence in your profile, tailors the resume, scores the result and returns the finished document without creating a second identity.",
    kind: "resume",
  },
  {
    eyebrow: "Kompas",
    title: "A live interview becomes a question-to-answer loop.",
    body: "Kompas captures the session context you choose to provide, recognizes the question, retrieves the relevant evidence and produces the answer while keeping the transcript and session history reachable on the same screen.",
    kind: "kompas",
  },
  {
    eyebrow: "Connected channels",
    title: "Email, Calendar, WhatsApp and the extension share context.",
    body: "Each channel authenticates separately, then its activity is attributed to the same MarketFit user. That is how actions from different surfaces can stay consistent instead of becoming separate silos.",
    kind: "channels",
  },
  {
    eyebrow: "Usage + access",
    title: "Access follows the account, not a browser tab.",
    body: "Usage is metered against the subscription, verified channels resolve to the same ledger, and the account can keep up to two active device slots. After sign-in, setup asks only for the essentials before the workspace opens.",
    kind: "usage",
  },
] as const

function MechanicVisual({ kind }: { kind: typeof SLIDES[number]["kind"] }) {
  if (kind === "identity") {
    return (
      <div className="mf-tour-visual mf-tour-identity" aria-hidden="true">
        <div className="mf-tour-node mf-tour-node--root">MF</div>
        <div className="mf-tour-orbit mf-tour-orbit--one"><span>Google</span></div>
        <div className="mf-tour-orbit mf-tour-orbit--two"><span>Phone</span></div>
        <div className="mf-tour-orbit mf-tour-orbit--three"><span>WhatsApp</span></div>
        <div className="mf-tour-orbit mf-tour-orbit--four"><span>Extension</span></div>
      </div>
    )
  }

  if (kind === "resume") {
    return (
      <div className="mf-tour-visual mf-tour-pipeline" aria-hidden="true">
        <div className="mf-tour-doc">Resume</div>
        <span className="mf-tour-arrow">→</span>
        <div className="mf-tour-api">Match API<div className="mf-tour-mini-bars"><i/><i/><i/></div></div>
        <span className="mf-tour-arrow">→</span>
        <div className="mf-tour-score"><b>96</b><small>fit score</small></div>
      </div>
    )
  }

  if (kind === "kompas") {
    return (
      <div className="mf-tour-visual mf-tour-kompas" aria-hidden="true">
        <div className="mf-tour-wave">{Array.from({ length: 9 }).map((_, i) => <i key={i} />)}</div>
        <div className="mf-tour-question">Question</div>
        <div className="mf-tour-thread"><span>evidence</span><span>context</span><span>answer</span></div>
        <div className="mf-tour-answer"><i/><i/><i/><i/></div>
      </div>
    )
  }

  if (kind === "channels") {
    return (
      <div className="mf-tour-visual mf-tour-channels" aria-hidden="true">
        <div className="mf-tour-channel-stack">
          <span>Gmail</span><span>Calendar</span><span>WhatsApp</span><span>Extension</span>
        </div>
        <div className="mf-tour-flow-line"><i/></div>
        <div className="mf-tour-profile-card"><b>MarketFit user</b><small>one context record</small></div>
      </div>
    )
  }

  return (
    <div className="mf-tour-visual mf-tour-usage" aria-hidden="true">
      <div className="mf-tour-devices"><span>Device 1</span><span>Device 2</span></div>
      <div className="mf-tour-meter"><i/><b>shared usage ledger</b></div>
      <div className="mf-tour-lock">✓ verified channels</div>
    </div>
  )
}

export default function FeatureTour({ onContinue }: { onContinue: () => void }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    try {
      const completed = window.localStorage.getItem("marketfit_intro_seen_v1") === "1"
      const dismissed = window.sessionStorage.getItem("marketfit_intro_dismissed_v1") === "1"
      if (!completed && !dismissed) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [])

  function close() {
    try { window.sessionStorage.setItem("marketfit_intro_dismissed_v1", "1") } catch {}
    setOpen(false)
  }

  function finish() {
    try { window.localStorage.setItem("marketfit_intro_seen_v1", "1") } catch {}
    onContinue()
  }

  if (!open) {
    return (
      <button type="button" className="mf-tour-reopen" onClick={() => { setIndex(0); setOpen(true) }}>
        See how MarketFit works
      </button>
    )
  }

  const slide = SLIDES[index]
  const last = index === SLIDES.length - 1

  return (
    <div className="mf-tour-backdrop" role="presentation">
      <section className="mf-tour-sheet" role="dialog" aria-modal="true" aria-labelledby="mf-tour-title">
        <button type="button" className="mf-tour-close" onClick={close} aria-label="Close introduction">×</button>
        <div className="mf-tour-copy" key={slide.kind}>
          <div className="mf-tour-eyebrow">{slide.eyebrow}</div>
          <h2 id="mf-tour-title">{slide.title}</h2>
          <MechanicVisual kind={slide.kind} />
          <p>{slide.body}</p>
        </div>
        <div className="mf-tour-footer">
          <div className="mf-tour-dots" aria-label={"Step " + (index + 1) + " of " + SLIDES.length}>
            {SLIDES.map((item, i) => (
              <button
                type="button"
                key={item.kind}
                className={i === index ? "is-active" : ""}
                aria-label={"Go to step " + (i + 1)}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <div className="mf-tour-actions">
            {index > 0 && <button type="button" className="mf-tour-secondary" onClick={() => setIndex(i => i - 1)}>Back</button>}
            <button
              type="button"
              className="mf-tour-primary"
              onClick={() => last ? finish() : setIndex(i => i + 1)}
            >
              {last ? "Continue with Google" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
