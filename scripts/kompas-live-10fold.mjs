// Live Kompas 10-fold against the page at /dashboard/kompas.
// That page fetches POST /api/answer. The shell rewrites it to POST /api/kompas/answer
// before the network call. Screen analyze sends screenImage on that same answer call
// (the older capture button uses POST /api/screen, rewritten to /api/kompas/screen).
// Clarifiers are POST /api/kompas/aside from answer-aside.js.
//
// One interview id is sent on every answer. This script does not POST
// /api/kompas/account-sessions, so it does not create a session row per call.
// Sequential, about one call every 2s after the previous one finishes.
// Reads the Houston Fortinet resume the answer default uses. No secrets are printed.
//
//   node scripts/kompas-live-10fold.mjs
//   node scripts/kompas-live-10fold.mjs --base https://marketfit-app.vercel.app --runs 10 --gap 2000
//   node scripts/kompas-live-10fold.mjs --runs 1 --question 1
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const RESUME = readFileSync(join(root, "src/lib/kompas-houston-resume.txt"), "utf8")
const SESSION_ID = "s-kompas-10fold-houston"

const QUESTIONS = [
  { id: 1, gap: false, scope: false, q: "Tell me about yourself." },
  { id: 2, gap: false, scope: false, q: "How have you deployed FortiGate VMs in AWS?" },
  { id: 3, gap: false, scope: false, q: "Walk me through migrating 21 Cisco FTDs across 6 AWS regions." },
  { id: 4, gap: false, scope: false, q: "Design a GWLB plus FortiGate inspection VPC." },
  { id: 5, gap: false, scope: false, q: "Active/Active vs Active/Passive FortiGate HA in AWS?" },
  { id: 6, gap: false, scope: false, q: "How do you use FortiManager and FortiAnalyzer?" },
  { id: 7, gap: true, scope: false, q: "Tell me about a cutover that went wrong." },
  { id: 8, gap: true, scope: false, q: "How much Terraform have you written?" },
  { id: 9, gap: true, scope: false, q: "Have you run workloads on Graviton?" },
  { id: 10, gap: false, scope: true, q: "You led that migration yourself, right?" },
]

const FACTS = [
  ["fortigate", /fortigate/i],
  ["active-active", /active\/active/i],
  ["active-passive", /active\/passive/i],
  ["gwlb", /gateway load balancer|\bgwlb\b/i],
  ["tgw", /transit gateway/i],
  ["ftd", /cisco ftd|\bftd\b/i],
  ["six-regions", /six aws regions|\b6 aws regions/i],
  ["fortimanager", /fortimanager/i],
  ["fortianalyzer", /fortianalyzer/i],
  ["nerc", /nerc cip/i],
  ["zero-downtime", /zero[- ]downtime/i],
  ["team", /team effort|broader team|cross-functional/i],
  ["years", /9\+|nine years|9 years/i],
]

const EMPLOYERS = ["Cigna", "Citi", "McKesson", "Molina", "Valero", "Saint Louis", "Northern Trust", "Wells Fargo"]
const TOOLS = ["Dragos", "Qualys", "Splunk", "CrowdStrike", "Burp", "CyberArk", "Sentinel", "Wiz", "Zscaler", "Fortify", "Snyk", "OSCP", "Terraform", "Graviton", "Ansible", "Kubernetes", "Palo Alto", "Check Point", "CloudFormation"]
const BRIDGE = /have not|has not|haven't|not on (?:my |the )?resume|will not invent|less direct hands-on|do not have|did not|never (?:used|run|written|wrote)|does not name an outage|question names/i
const YES_LEAD = /^\s*(?:yes\b|yeah\b|yep\b|i personally led|i led that myself|i did lead|i led it myself)\b/i

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function words(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean)
}

function invented(question, answer) {
  const hits = []
  const sentences = String(answer || "").split(/(?<=[.!?])\s+/).filter(Boolean)
  const bag = `${RESUME}\n${question}`.toLowerCase()
  for (const sentence of sentences) {
    if (BRIDGE.test(sentence)) continue
    for (const name of EMPLOYERS) {
      if (new RegExp(`\\b${name}\\b`, "i").test(sentence) && !bag.includes(name.toLowerCase())) hits.push(`employer:${name}`)
    }
    for (const tool of TOOLS) {
      if (new RegExp(`\\b${tool}\\b`, "i").test(sentence) && !bag.includes(tool.toLowerCase())) hits.push(`tool:${tool}`)
    }
    for (const match of sentence.matchAll(/\b\d+(?:\.\d+)?\b/g)) {
      if (!bag.includes(match[0])) hits.push(`number:${match[0]}`)
    }
    if (/\b(?:sev-?1|data loss|hours of downtime|we had an outage|the cutover failed)\b/i.test(sentence) && !/\b(?:sev-?1|data loss|hours of downtime)\b/i.test(RESUME)) hits.push("incident")
  }
  return [...new Set(hits)]
}

function bridgeOk(row, answer) {
  if (!row.gap) return true
  return BRIDGE.test(answer) || /team effort|failover testing|will not invent/i.test(answer)
}

function scopeOk(row, answer) {
  if (!row.scope) return true
  if (YES_LEAD.test(answer)) return false
  return /team effort|did not take that on alone|not (?:take|taken) that on alone|part I can speak to/i.test(answer)
}

function factSet(answer) {
  return FACTS.filter(([, re]) => re.test(answer)).map(([id]) => id)
}

function percentile(nums, p) {
  const sorted = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[i]
}

function bodyFor(question) {
  return {
    stream: true,
    client: "kompas-10fold",
    sessionId: SESSION_ID,
    consolidated: true,
    pinned: true,
    question,
    derived: question,
    config: {
      resume: RESUME,
      role: "Fortinet AWS Cloud Networking Engineer",
      company: "",
      jd: "",
      documents: "",
      instructions: "",
      language: "en",
      mode: "technical",
      interviewer: "engineer",
      level: "engineer",
      difficulty: "standard",
      format: "full_script",
      length: "long",
      tone: "simple",
      star: false,
    },
    prep: {},
    history: [],
  }
}

async function ask(base, question) {
  const started = Date.now()
  let status = 0
  let ttfb = null
  let firstToken = null
  let text = ""
  let error = ""
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 70000)
  try {
    const res = await fetch(new URL("/api/kompas/answer", base), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(bodyFor(question)),
      signal: ctl.signal,
    })
    status = res.status
    const reader = res.body?.getReader()
    if (!reader) {
      const raw = await res.text()
      ttfb = Date.now() - started
      try {
        const data = JSON.parse(raw)
        text = String(data.text || "")
        if (text) firstToken = ttfb
        error = data.error || data.code || ""
      } catch {
        error = raw.slice(0, 180)
      }
      return { status, ttfb, firstToken, total: Date.now() - started, text, error }
    }
    const dec = new TextDecoder()
    let buf = ""
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (ttfb == null) ttfb = Date.now() - started
      buf += dec.decode(chunk.value, { stream: true })
      let i
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i).trim()
        buf = buf.slice(i + 2)
        if (!frame.startsWith("data:")) continue
        let ev
        try { ev = JSON.parse(frame.slice(5)) } catch { continue }
        if (ev.type === "delta" && ev.text) {
          if (firstToken == null) firstToken = Date.now() - started
          text += ev.text
        } else if (ev.type === "replace" && typeof ev.text === "string") {
          if (ev.text && firstToken == null) firstToken = Date.now() - started
          text = ev.text
        } else if (ev.type === "done") {
          if (!text && typeof ev.text === "string") text = ev.text
          if (ev.unavailable || ev.busy) error = ev.code || ev.error || "unavailable"
          if (ev.fallback) error = ""
        }
      }
    }
  } catch (e) {
    error = e.name === "AbortError" ? "timeout" : String(e.message || e).slice(0, 180)
  } finally {
    clearTimeout(timer)
  }
  return { status, ttfb, firstToken, total: Date.now() - started, text: text.replace(/\s+/g, " ").trim(), error }
}

function summarize(rows) {
  const by = new Map()
  for (const row of rows) {
    if (!by.has(row.id)) by.set(row.id, [])
    by.get(row.id).push(row)
  }
  const questions = []
  for (const [id, list] of by) {
    const delivered = list.filter((row) => row.delivered)
    const sets = delivered.map((row) => new Set(row.facts))
    let inter = null
    const union = new Set()
    for (const set of sets) {
      inter = inter == null ? new Set(set) : new Set([...inter].filter((fact) => set.has(fact)))
      for (const fact of set) union.add(fact)
    }
    const overlap = union.size ? (inter ? inter.size : 0) / union.size : delivered.length ? 1 : 0
    const yes = list.some((row) => row.scope === false && QUESTIONS.find((q) => q.id === id)?.scope)
    const team = delivered.some((row) => /team effort|did not take that on alone/i.test(row.text))
    const led = delivered.some((row) => YES_LEAD.test(row.text))
    questions.push({
      id,
      n: list.length,
      delivered: delivered.length,
      deliveryPct: Math.round((delivered.length / list.length) * 1000) / 10,
      p50First: percentile(list.map((row) => row.firstToken), 50),
      p95First: percentile(list.map((row) => row.firstToken), 95),
      p50Total: percentile(list.map((row) => row.total), 50),
      p95Total: percentile(list.map((row) => row.total), 95),
      inBand: list.filter((row) => row.inBand).length,
      inBandPct: Math.round((list.filter((row) => row.inBand).length / list.length) * 1000) / 10,
      invented: list.reduce((n, row) => n + row.invented.length, 0),
      bridges: list.filter((row) => row.bridge).length,
      bridgeMiss: list.filter((row) => !row.bridge).length,
      scopeMiss: list.filter((row) => !row.scope).length,
      overlap: Math.round(overlap * 1000) / 1000,
      sharedFacts: inter ? [...inter] : [],
      contradiction: Boolean(yes && team && led),
    })
  }
  const all = {
    n: rows.length,
    delivered: rows.filter((row) => row.delivered).length,
    deliveryPct: rows.length ? Math.round((rows.filter((row) => row.delivered).length / rows.length) * 1000) / 10 : 0,
    p50First: percentile(rows.map((row) => row.firstToken), 50),
    p95First: percentile(rows.map((row) => row.firstToken), 95),
    p50Total: percentile(rows.map((row) => row.total), 50),
    p95Total: percentile(rows.map((row) => row.total), 95),
    inBand: rows.filter((row) => row.inBand).length,
    inBandPct: rows.length ? Math.round((rows.filter((row) => row.inBand).length / rows.length) * 1000) / 10 : 0,
    invented: rows.reduce((n, row) => n + row.invented.length, 0),
    bridgeMiss: rows.filter((row) => !row.bridge).length,
    scopeMiss: rows.filter((row) => !row.scope).length,
  }
  return { questions, all }
}

const base = arg("--base", process.env.KOMPAS_BASE || "https://marketfit-app.vercel.app")
const runs = Number(arg("--runs", "10"))
const gap = Number(arg("--gap", "2000"))
const only = arg("--question", "")
const out = arg("--out", join(root, "tmp-kompas-10fold.json"))
const selected = only ? QUESTIONS.filter((row) => String(row.id) === only) : QUESTIONS

const rows = []
for (let run = 1; run <= runs; run++) {
  for (const row of selected) {
    const result = await ask(base, row.q)
    const count = words(result.text).length
    const claims = invented(row.q, result.text)
    const record = {
      id: row.id,
      run,
      status: result.status,
      delivered: count >= 20 && result.status === 200,
      ttfb: result.ttfb,
      firstToken: result.firstToken,
      total: result.total,
      words: count,
      inBand: count >= 120 && count <= 180,
      invented: claims,
      bridge: bridgeOk(row, result.text),
      scope: scopeOk(row, result.text),
      facts: factSet(result.text),
      error: result.error,
      text: result.text,
    }
    rows.push(record)
    console.error(`q${row.id} r${run} status=${record.status} words=${count} delivered=${record.delivered} band=${record.inBand} invented=${claims.length} first=${record.firstToken} total=${record.total} ${record.error}`)
    await new Promise((resolve) => setTimeout(resolve, gap))
  }
}

const summary = summarize(rows)
const payload = { base, runs, gap, at: new Date().toISOString(), summary, rows }
writeFileSync(out, JSON.stringify(payload, null, 2))
console.log(JSON.stringify(summary, null, 2))
