// MarketFit Extension — web-bridge.js
// Runs ONLY on the MarketFit web app itself (see manifest.json content_scripts
// matches) — never on ATS/job-board pages. Content scripts run in an isolated
// world and can't read the page's React/JS state directly, so the web app
// posts its Supabase session via window.postMessage and this script relays it
// to the background worker over the extension messaging API.
window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.origin !== window.location.origin) return
  const data = event.data
  if (!data || data.source !== "marketfit-web" || data.type !== "MF_AUTH") return
  chrome.runtime.sendMessage({ type: "MF_AUTH", session: data.session || null })
})

// ── Drain queued extension-submitted applications into the dashboard's own
// tracker ──────────────────────────────────────────────────────────────────
// content.js can't reach this page's localStorage from a different origin
// (e.g. boards.greenhouse.io) when it auto-submits an application there, so
// it queues the record in chrome.storage.local (extension-wide) instead. This
// script DOES run on this exact origin, so — same DOM/localStorage the page's
// own React code reads, isolated worlds only separate JS execution, not
// browser storage — merge the queue into jd_applications_v2 (the same shape
// the dashboard's other "track this application" actions already write) the
// moment the dashboard loads, then clear the queue so nothing double-adds.
try {
  chrome.storage.local.get(["pendingApplications"], (s) => {
    const pending = Array.isArray(s.pendingApplications) ? s.pendingApplications : []
    if (!pending.length) return
    try {
      const existing = JSON.parse(localStorage.getItem("jd_applications_v2") || "[]")
      const seen = new Set(existing.map((a) => a.id))
      const fresh = pending.filter((a) => !seen.has(a.id))
      if (fresh.length) {
        localStorage.setItem("jd_applications_v2", JSON.stringify([...fresh, ...existing]))
      }
    } catch { /* if this fails, leave the queue in place to retry on next load */ return }
    chrome.storage.local.set({ pendingApplications: [] })
  })
} catch { /* extension storage unavailable — nothing to drain */ }
