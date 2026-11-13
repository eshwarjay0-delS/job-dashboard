// The Windows shell loads the live Kompas page. The side panel and the brain
// ride that page. Private mode is setContentProtection on the same window.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const main = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")
const preload = readFileSync(new URL("../../legacy/perfact/desktop/preload.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const aside = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/answer-aside.css", import.meta.url), "utf8")

test("the desktop window loads the live web Kompas page, not a copy baked into the exe", () => {
  assert.match(main, /const MARKETFIT_API_ORIGIN = "https:\/\/job-dashboard-fawn\.vercel\.app"/)
  assert.match(main, /const ORIGIN = "kompas:\/\/app"/)
  assert.match(main, /activeSite === "marketfit" \? "\/kompas\/index\.html"/)
  assert.match(main, /activeSite === "marketfit" \? MARKETFIT_API_ORIGIN/)
  assert.match(main, /wc\.loadURL\(ORIGIN \+ appPathFor\(\)\)/)
  assert.match(main, /ses\.protocol\.handle\("kompas", serve\)/)
  assert.match(main, /net\.fetch\(targetOrigin\(\) \+ rel \+ url\.search/)
  assert.match(main, /cache: "no-store"/)
  assert.match(html, /answer-aside\.js/)
  assert.match(html, /answer-aside\.css/)
  assert.match(aside, /function perceive\(/)
  assert.doesNotMatch(main, /answer-aside\.js|kompasBrain/)
})

test("private mode is setContentProtection on the same window, and the panel stays inside it", () => {
  assert.match(main, /function applyProtection\(\)/)
  assert.match(main, /w\.setContentProtection\(hidden\)/)
  assert.match(main, /applyProtection\(\);\s*\n\s*const wc = win\.webContents/)
  assert.match(preload, /document\.documentElement\.classList\.add\("kd"\)/)
  assert.match(preload, /classList\.toggle\("kd-private", !!s\.isPrivate\)/)
  assert.match(preload, /onPrivate: \(fn\) => \{ ipcRenderer\.on\("kompas:private"/)
  assert.match(aside, /kompasDesktop\.onPrivate\(applyPrivate\)/)
  assert.match(aside, /classList\.toggle\("kd-private", !!on\)/)
  assert.match(css, /html\.kd\.kd-private #view-copilot #answerAside/)
  assert.doesNotMatch(aside, /BrowserWindow|window\.open|setContentProtection/)
  assert.doesNotMatch(main, /new BrowserWindow\([\s\S]{0,400}answerAside/)
})
