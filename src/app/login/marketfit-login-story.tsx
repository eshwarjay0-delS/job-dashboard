"use client"

import { useEffect, useState } from "react"
import MarketFitJourney from "./marketfit-journey"
import styles from "./marketfit-login-story.module.css"

// Source-owned local media keeps login functional without third-party video services.
// The 35-second film begins only after the existing animated journey has introduced MarketFit.
const VIDEO_URL = "/media/marketfit-visual-concept-35s.mp4"
const INTRO_MS = 6500

export default function MarketFitLoginStory({ compact = false }: { compact?: boolean }) {
  const [reduceMotion, setReduceMotion] = useState(true)
  const [filmRequested, setFilmRequested] = useState(false)
  const [filmPlaying, setFilmPlaying] = useState(false)
  const [filmFailed, setFilmFailed] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    // Mobile deliberately keeps its small animation and offers a click-to-play story
    // so people can sign in without a full-screen film or unexpected audio.
    if (compact || reduceMotion || filmFailed || filmRequested) return
    const id = window.setTimeout(() => setFilmRequested(true), INTRO_MS)
    return () => window.clearTimeout(id)
  }, [compact, reduceMotion, filmFailed, filmRequested])

  if (compact) {
    return (
      <div className={styles.mobile}>
        <MarketFitJourney compact />
        <details className={styles.mobileDetails}>
          <summary className={styles.mobileSummary}>Watch the MarketFit story <span>35 seconds</span></summary>
          <video className={styles.mobileVideo} src={VIDEO_URL} controls playsInline preload="none" aria-label="MarketFit 35-second visual concept story">
            Your browser does not support HTML5 video.
          </video>
        </details>
      </div>
    )
  }

  return (
    <div className={styles.stage}>
      <div className={filmPlaying ? styles.introHidden : styles.introVisible} aria-hidden={filmPlaying}>
        <MarketFitJourney />
      </div>
      {filmRequested && !reduceMotion && !filmFailed && (
        <>
          <video
            className={filmPlaying ? styles.filmPlaying : styles.filmWaiting}
            src={VIDEO_URL}
            autoPlay
            muted={!soundEnabled}
            playsInline
            preload="auto"
            onPlaying={() => setFilmPlaying(true)}
            onEnded={() => { setFilmPlaying(false); setFilmRequested(false) }}
            onError={() => { setFilmPlaying(false); setFilmFailed(true); setFilmRequested(false) }}
            aria-label="MarketFit 35-second visual concept film"
          />
          {filmPlaying && (
            <button
              type="button"
              className={styles.soundControl}
              aria-label={soundEnabled ? "Mute MarketFit film" : "Unmute MarketFit film"}
              onClick={() => setSoundEnabled(current => !current)}
            >
              {soundEnabled ? "Sound on" : "Sound off"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
