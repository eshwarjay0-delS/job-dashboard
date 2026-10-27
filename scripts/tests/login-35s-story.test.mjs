import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"

const file = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8")
const login = file("src/app/login/page.tsx")
const story = file("src/app/login/marketfit-login-story.tsx")
const styles = file("src/app/login/marketfit-login-story.module.css")

test("visual concept media is shipped as a playable local file", () => {
  const stat = statSync(new URL("../../public/media/marketfit-visual-concept-35s.mp4", import.meta.url))
  assert.ok(stat.size > 100_000, "Video asset is missing or truncated")
  assert.ok(stat.size < 1_500_000, "Video must stay lightweight for login")
  assert.match(story, /const VIDEO_URL = "\/media\/marketfit-visual-concept-35s\.mp4"/)
  assert.doesNotMatch(story, /https?:\/\//)
})

test("the current opening remains before the 35s film", () => {
  assert.match(story, /<MarketFitJourney \/>/)
  assert.match(story, /INTRO_MS = 6500/)
  assert.match(story, /window\.setTimeout\(\(\) => setFilmRequested\(true\), INTRO_MS\)/)
  assert.match(story, /onEnded=/)
  assert.match(login, /<MarketFitLoginStory \/>/)
})

test("mobile has click-to-play access without autoplay covering sign-in", () => {
  assert.match(login, /<MarketFitLoginStory compact \/>/)
  assert.match(story, /<details className=\{styles\.mobileDetails\}>/)
  assert.match(story, /<video className=\{styles\.mobileVideo\}[^>]*controls[^>]*preload="none"/)
})

test("desktop preserves muted inline autoplay, reduced motion and error fallback", () => {
  assert.match(story, /autoPlay/)
  assert.match(story, /muted=\{!soundEnabled\}/)
  assert.match(story, /playsInline/)
  assert.match(story, /prefers-reduced-motion: reduce/)
  assert.match(story, /onError=\{\(\) => \{ setFilmPlaying\(false\); setFilmFailed\(true\); setFilmRequested\(false\) \}\}/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
})
