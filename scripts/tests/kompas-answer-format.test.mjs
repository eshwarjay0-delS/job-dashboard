import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { test } from "node:test"

const app = await readFile(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const css = await readFile(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")

test("answer renderer removes fill-in placeholders instead of showing boxes", () => {
  assert.match(app, /function unbracket\(/)
  assert.match(app, /a measurable improvement/)
  assert.match(app, /the relevant tool/)
  assert.match(app, /the organization/)
  assert.match(app, /the project timeline/)
})

test("spoken answer format supports passages bullets headings bold and stress italics", () => {
  assert.match(app, /kind: "passage"/)
  assert.match(app, /kind: "bullet"/)
  assert.match(app, /kind: "head"/)
  assert.match(app, /document\.createElement\("strong"\)/)
  assert.match(app, /document\.createElement\("em"\)/)
})

test("bold emphasis is typographic, not a colored box", () => {
  assert.match(css, /\.a li strong,\.a strong \.w\{font-weight:800;color:var\(--ink\);background:transparent;padding:0;border-radius:0\}/)
  assert.match(css, /\.a li em\{font-style:italic;color:var\(--ink\);text-decoration:none\}/)
})
