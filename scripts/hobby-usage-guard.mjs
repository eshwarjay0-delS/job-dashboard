#!/usr/bin/env node
/**
 * Weekly Hobby usage guard. One health hit, plus an optional Vercel usage read.
 * Never scrapes product APIs. Missing usage credentials are not a failure.
 *
 * Env:
 *   HEALTH_URL          default https://job-dashboard-fawn.vercel.app/api/health
 *   VERCEL_TOKEN        or KOMPAS_VERCEL_API_TOKEN
 *   VERCEL_TEAM_ID      or KOMPAS_VERCEL_TEAM_ID
 *   FOT_WARN_BYTES      default 5 GiB (half of Hobby 10 GB)
 *   CPU_WARN_HOURS      default 2 (half of Hobby 4 CPU-hours)
 */
const HEALTH_URL = process.env.HEALTH_URL || "https://job-dashboard-fawn.vercel.app/api/health"
const TOKEN = process.env.VERCEL_TOKEN || process.env.KOMPAS_VERCEL_API_TOKEN || ""
const TEAM = process.env.VERCEL_TEAM_ID || process.env.KOMPAS_VERCEL_TEAM_ID || ""
const FOT_WARN = Number(process.env.FOT_WARN_BYTES) || 5 * 1024 * 1024 * 1024
const CPU_WARN_MS = (Number(process.env.CPU_WARN_HOURS) || 2) * 3600 * 1000

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickUsage(obj, keys) {
  if (!obj || typeof obj !== "object") return null
  for (const key of keys) {
    const found = num(obj[key])
    if (found != null) return found
    if (obj[key] && typeof obj[key] === "object") {
      const nested = num(obj[key].value ?? obj[key].total ?? obj[key].amount ?? obj[key].used)
      if (nested != null) return nested
    }
  }
  return null
}

function walk(obj, pred, path = "") {
  const hits = []
  if (!obj || typeof obj !== "object") return hits
  if (pred(obj, path)) hits.push(obj)
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") hits.push(...walk(v, pred, path + "." + k))
  }
  return hits
}

async function checkHealth() {
  const res = await fetch(HEALTH_URL, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000) })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* not json */ }
  if (res.status !== 200 || !body || body.ok !== true) {
    throw new Error(`health check failed: ${res.status} ${text.slice(0, 200)}`)
  }
  console.log(`health ok: ${HEALTH_URL}`)
}

async function vercelGet(path) {
  const url = new URL(path, "https://api.vercel.com")
  if (TEAM && !url.searchParams.has("teamId")) url.searchParams.set("teamId", TEAM)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(10_000) })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = { raw: text } }
  return { status: res.status, body }
}

async function checkUsage() {
  if (!TOKEN) {
    console.log("usage skipped: no VERCEL_TOKEN / KOMPAS_VERCEL_API_TOKEN")
    return
  }
  const attempts = [
    "/v2/usage",
    "/v1/usage",
    TEAM ? `/v1/teams/${TEAM}/usage` : null,
  ].filter(Boolean)

  let last = null
  for (const path of attempts) {
    const result = await vercelGet(path)
    last = result
    if (result.status === 200 && result.body && typeof result.body === "object") {
      const fot = pickUsage(result.body, [
        "fot", "fastOriginTransfer", "fastOriginTransferBytes", "originTransfer",
        "totalFastOriginTransfer",
      ]) ?? (() => {
        const nodes = walk(result.body, (o) => /fot|origin.?transfer/i.test(JSON.stringify(Object.keys(o))))
        for (const n of nodes) {
          const v = pickUsage(n, ["fot", "bytes", "total", "value", "amount", "used"])
          if (v != null) return v
        }
        return null
      })()
      const cpuMs = pickUsage(result.body, [
        "activeCpu", "activeCpuMs", "cpuMs", "durationMs",
      ])
      const cpuHours = pickUsage(result.body, ["activeCpuHours", "cpuHours"])
      const cpu = cpuMs != null ? cpuMs : (cpuHours != null ? cpuHours * 3600 * 1000 : null)

      console.log(`usage endpoint ${path} status 200`)
      if (fot != null) console.log(`fast origin transfer bytes: ${fot}`)
      if (cpu != null) console.log(`active cpu ms: ${cpu}`)
      if (fot == null && cpu == null) {
        console.log("usage payload had no recognizable FOT or CPU fields; not failing the guard")
        return
      }
      const over = []
      if (fot != null && fot >= FOT_WARN) over.push(`FOT ${fot} bytes is at or above the warning line ${FOT_WARN}`)
      if (cpu != null && cpu >= CPU_WARN_MS) over.push(`Active CPU ${cpu} ms is at or above the warning line ${CPU_WARN_MS}`)
      if (over.length) throw new Error(over.join("; "))
      console.log("usage under warning lines")
      return
    }
    if (result.status === 402 || result.status === 403 || result.status === 404) {
      console.log(`usage endpoint ${path} returned ${result.status}; Hobby may not expose this metric. Not failing.`)
      return
    }
  }
  console.log(`usage API unavailable (${last && last.status}); not failing the guard`)
}

const mode = process.argv.includes("--health-only") ? "health" : "all"
try {
  await checkHealth()
  if (mode !== "health") await checkUsage()
} catch (err) {
  console.error(String(err && err.message ? err.message : err))
  process.exit(1)
}
