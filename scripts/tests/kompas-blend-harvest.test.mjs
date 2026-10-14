import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const page = readFileSync(path.join(root, "src/app/dashboard/kompas/move/page.tsx"), "utf8")

test("blend gathers perfACT session answers and live log events", () => {
  assert.match(page, /o\.answers/)
  assert.match(page, /key\.startsWith\("perfact\.log\."\)/)
  assert.match(page, /Array\.isArray\(v\).*collectAnswer/s)
  assert.match(page, /row\.t !== "answer"/)
})

test("blend retains alternate answers, speaking pauses and original Question Bank text", () => {
  assert.match(page, /row\.text/)
  assert.match(page, /row\.text \?\? row\.question \?\? row\.q/)
  assert.match(page, /t\.q\.toLowerCase\(\).*t\.a\.toLowerCase/s)
  assert.match(page, /mf_flow_learned/)
  assert.match(page, /setSelectedFile\(file\)/)
  assert.doesNotMatch(page, /\(onFile as unknown as/)
})
