// Offline gold eval. CI or `npm run eval:gold` only. Never imported by the app.
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const RUBRIC_VERSION = "geval-gold-v1"
export const EVAL_MODEL = process.env.KOMPAS_EVAL_MODEL || "openai/gpt-oss-20b"
const JD = "Splunk ES, CrowdStrike Falcon, Defender, Qualys, ServiceNow, NIST CSF"
const CACHE = join(dirname(fileURLToPath(import.meta.url)), "../data/kompas-eval-cache.json")
const GOLD_PATH = join(dirname(fileURLToPath(import.meta.url)), "fixtures/brain-gold-answers.md")

const RUBRIC = `Score this interview answer on four axes, each an integer from 1 to 5.
relevance: the answer addresses the question that was asked.
realism: a candidate could say this out loud from the resume, with no invented incident.
length fit: the answer sits in the stated word band.
tone: first person, direct, no preamble and no definition opener.
Reply with JSON only: {"relevance":1,"realism":1,"lengthFit":1,"tone":1}`

export function goldWordCount(text) {
  return (String(text || "").match(/[A-Za-z0-9][A-Za-z0-9'’+-]*/g) || []).length
}

export function loadGold(markdown) {
  const src = String(markdown || "")
  const resume = [...src.matchAll(/^- ["“]([^"”]+)["”]/gm)].map((m) => m[1]).join("\n")
  const items = []
  for (const block of src.split(/\n## /).slice(1)) {
    const head = block.split("\n")[0] || ""
    const id = (head.match(/^([a-j])\./) || [])[1]
    if (!id) continue
    const question = head.replace(/^[a-j]\.\s*/, "").trim()
    const band = block.match(/band\s+(\d+)\s*-\s*(\d+)/i)
    const quote = [...block.matchAll(/^>\s?(.*)$/gm)].map((m) => m[1].trim()).join(" ").trim()
    if (!quote) continue
    items.push({
      id,
      question,
      band: band ? [Number(band[1]), Number(band[2])] : [0, 0],
      answer: quote,
      words: goldWordCount(quote),
    })
  }
  return { jd: JD, resume, items }
}

export function answerHash(question, answer) {
  return createHash("sha256").update(`${RUBRIC_VERSION}\n${EVAL_MODEL}\n${question}\n${answer}`).digest("hex")
}

export function lengthFit(words, band) {
  const lo = band[0]
  const hi = band[1]
  if (words >= lo && words <= hi) return 5
  const dist = words < lo ? lo - words : words - hi
  const span = Math.max(1, hi - lo)
  if (dist <= span * 0.25) return 4
  if (dist <= span * 0.5) return 3
  if (dist <= span) return 2
  return 1
}

const CLAIM_STOP = new Set("i the a an and but for with from this that when where what how why who you your our not honestly once first then so if having client role senior".split(" "))

export function claimFaithfulness(answer, resume, jd, question) {
  const bag = `${resume}\n${jd}\n${question}`.toLowerCase()
  const allowed = new Set((bag.match(/\d[\d,]*/g) || []).map((n) => n.replace(/,/g, "")))
  const misses = []
  for (const sentence of String(answer || "").split(/(?<=[.!?])\s+/)) {
    const nums = sentence.match(/\d[\d,]*/g) || []
    for (const n of nums) if (!allowed.has(n.replace(/,/g, ""))) misses.push(sentence.slice(0, 80))
    const later = sentence.replace(/^\W*\S+\s+/, " ")
    const names = [...(later.match(/\b[A-Z][A-Za-z0-9+.#-]{2,}/g) || []), ...(sentence.match(/\b[A-Z]{2,}\b/g) || [])]
    for (const name of names) {
      const token = name.replace(/\.+$/g, "").toLowerCase()
      if (!token || CLAIM_STOP.has(token)) continue
      if (!bag.includes(token)) misses.push(token)
    }
  }
  const unique = [...new Set(misses)]
  const score = unique.length === 0 ? 5 : unique.length === 1 ? 4 : unique.length === 2 ? 3 : unique.length === 3 ? 2 : 1
  return { score, misses: unique }
}

export function readCache(path = CACHE) {
  try { return JSON.parse(readFileSync(path, "utf8")) } catch { return {} }
}

export function writeCache(cache, path = CACHE) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cache, null, 2))
}

function loadKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim()
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    const hit = env.match(/^OPENROUTER_API_KEY=(.*)$/m)
    return hit ? hit[1].trim().replace(/^["']|["']$/g, "") : ""
  } catch { return "" }
}

async function modelScores(row, key) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: EVAL_MODEL,
      temperature: 0,
      max_tokens: 200,
      messages: [
        { role: "system", content: RUBRIC },
        { role: "user", content: `Question: ${row.question}\nBand: ${row.band[0]}-${row.band[1]} words\nResume:\n${row.resume.slice(0, 4000)}\n\nAnswer:\n${row.answer}` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`openrouter ${res.status}`)
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content || ""
  const json = raw.match(/\{[\s\S]*\}/)
  if (!json) throw new Error("no rubric json")
  const parsed = JSON.parse(json[0])
  return {
    relevance: clamp(parsed.relevance),
    realism: clamp(parsed.realism),
    lengthFit: clamp(parsed.lengthFit),
    tone: clamp(parsed.tone),
  }
}

function clamp(n) {
  const v = Math.round(Number(n))
  return v >= 1 && v <= 5 ? v : 0
}

async function main() {
  const gold = loadGold(readFileSync(GOLD_PATH, "utf8"))
  const key = loadKey()
  const cache = readCache()
  const rows = []
  for (const item of gold.items) {
    const localLength = lengthFit(item.words, item.band)
    const faith = claimFaithfulness(item.answer, gold.resume, gold.jd, item.question)
    const hash = answerHash(item.question, item.answer)
    let rubric = cache[hash] || null
    if (!rubric && key) {
      try {
        rubric = await modelScores({ ...item, resume: gold.resume }, key)
        cache[hash] = rubric
        writeCache(cache)
      } catch { rubric = null }
    }
    rows.push({ id: item.id, words: item.words, lengthFit: localLength, faithfulness: faith.score, misses: faith.misses.length, rubric })
  }
  const avg = (keyName) => {
    const vals = rows.map((r) => r[keyName]).filter((n) => typeof n === "number")
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "n/a"
  }
  const rubricAvg = (axis) => {
    const vals = rows.map((r) => r.rubric && r.rubric[axis]).filter((n) => n)
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "skipped"
  }
  console.log(JSON.stringify({
    items: rows.length,
    model: key ? EVAL_MODEL : "none",
    lengthFit: avg("lengthFit"),
    faithfulness: avg("faithfulness"),
    relevance: rubricAvg("relevance"),
    realism: rubricAvg("realism"),
    tone: rubricAvg("tone"),
    rows,
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
