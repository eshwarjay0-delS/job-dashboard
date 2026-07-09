// MarketFit Extension — Background Service Worker

import { listenForWebAuth, getToken } from './auth.js'

// Pick up the session the web app's web-bridge.js relays after login/logout —
// stores it in chrome.storage.local so GET_PROFILE below can authenticate.
listenForWebAuth()

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PING") {
    sendResponse({ ok: true })
  }

  // Content script needs the user's profile to autofill directly from the page.
  // The service worker (not the page) holds host_permissions for the app origin,
  // so it does the cross-origin fetch and relays the profile back.
  // Optional msg.filepath (a library/uploaded resume) or msg.token (a popup-
  // tailored output, served from the tailored-output dir) re-extracts
  // title/skills/years_experience straight from that specific resume's text (see
  // /api/profile's filepath/token modes) — used when the sidebar has a resume
  // selected, so those fields reflect whichever variant the user picked. Contact
  // fields (name/email/phone/linkedin/etc.) are NOT taken from this path —
  // sidebar.js merges them back in from the constant account profile, since a
  // candidate's contact info shouldn't change depending on which resume file
  // happens to be selected, only their resume-specific talking points should.
  if (msg.type === "GET_PROFILE") {
    chrome.storage.sync.get(["appUrl"], async (s) => {
      const appUrl = (s.appUrl || "https://marketfit.app").replace(/\/$/, "")
      try {
        // Authenticate as the signed-in user when we have their session (set by
        // web-bridge.js after login) — otherwise fetch unauthenticated, same as
        // before, which still works for the local-dev / no-login fallback.
        // (This is the user's AUTH session token — unrelated to msg.token above,
        // which identifies a specific tailored resume file.)
        const authToken = await getToken()
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {}
        const url = msg.filepath
          ? `${appUrl}/api/profile?filepath=${encodeURIComponent(msg.filepath)}`
          : msg.token
            ? `${appUrl}/api/profile?token=${encodeURIComponent(msg.token)}`
            : `${appUrl}/api/profile`
        const res = await fetch(url, { headers })
        const data = await res.json().catch(() => ({}))
        sendResponse({ profile: data.profile || null })
      } catch {
        sendResponse({ profile: null })
      }
    })
    return true // async
  }

  // Sidebar needs the user's resume list to populate its picker. Same reason as
  // GET_PROFILE above: the page (e.g. greenhouse.io) can't cross-origin fetch our
  // app's API — only the service worker (host_permissions) can. sidebar.js used to
  // fetch() this directly from the content-script context, which the browser
  // silently blocked (no CORS headers on the response) — it always fell back to an
  // empty list ("No resumes uploaded yet") even when the account had resumes.
  if (msg.type === "GET_USER_RESUMES") {
    chrome.storage.sync.get(["appUrl"], async (s) => {
      const appUrl = (s.appUrl || "https://marketfit.app").replace(/\/$/, "")
      try {
        const token = await getToken()
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(appUrl + "/api/user-resumes", { headers })
        const data = await res.json().catch(() => ({}))
        sendResponse({ files: Array.isArray(data.files) ? data.files : [] })
      } catch {
        sendResponse({ files: [] })
      }
    })
    return true // async
  }

  // Sidebar's H1B badge and match-score pill — same CORS reason as above. Neither
  // needs auth (both are in PUBLIC_API_PREFIXES server-side), just the
  // host_permissions-holding context to reach across origins at all.
  if (msg.type === "GET_H1B") {
    chrome.storage.sync.get(["appUrl"], async (s) => {
      const appUrl = (s.appUrl || "https://marketfit.app").replace(/\/$/, "")
      try {
        const res = await fetch(`${appUrl}/api/h1b?company=${encodeURIComponent(msg.company || "")}`)
        const data = res.ok ? await res.json().catch(() => null) : null
        sendResponse({ data })
      } catch {
        sendResponse({ data: null })
      }
    })
    return true // async
  }

  if (msg.type === "GET_MATCH_SCORE") {
    chrome.storage.sync.get(["appUrl"], async (s) => {
      const appUrl = (s.appUrl || "https://marketfit.app").replace(/\/$/, "")
      try {
        const res = await fetch(`${appUrl}/api/match-score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.body || {}),
        })
        const data = res.ok ? await res.json().catch(() => null) : null
        sendResponse({ data })
      } catch {
        sendResponse({ data: null })
      }
    })
    return true // async
  }

  // Content script needs the resume .docx bytes to attach to a form's file input.
  // The page it runs on (e.g. greenhouse.io) can't fetch our localhost origin, but
  // the service worker holds host_permissions for it. We fetch and return the bytes
  // base64-encoded (chrome messaging is JSON-only, so binary must be encoded).
  if (msg.type === "GET_RESUME") {
    ;(async () => {
      try {
        const res = await fetch(msg.url)
        if (!res.ok) { sendResponse({ ok: false, error: "HTTP " + res.status }); return }
        const buf = new Uint8Array(await res.arrayBuffer())
        // Chunk the byte→char conversion so we don't blow the call-stack on big files.
        let binary = ""
        const CHUNK = 0x8000
        for (let i = 0; i < buf.length; i += CHUNK) {
          binary += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK))
        }
        sendResponse({
          ok: true,
          b64: btoa(binary),
          type: res.headers.get("content-type") || "application/octet-stream",
        })
      } catch (e) {
        sendResponse({ ok: false, error: String(e) })
      }
    })()
    return true // async
  }

  // Forward JD scrape request to the active tab's content script
  if (msg.type === "GET_JD") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab || !tab.id) { sendResponse({ jd: "" }); return }
      chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_JD" }, (res) => {
        if (chrome.runtime.lastError) { sendResponse({ jd: "" }); return }
        sendResponse({ jd: res?.jd || "" })
      })
    })
    return true // async
  }

  // Content script floating button clicked → save JD to session storage for popup to pick up
  if (msg.type === "SAVE_JD") {
    chrome.storage.session.set({ pendingJd: msg.jd })
  }

  // Open extension popup (triggered from content script floating button).
  // Programmatic popup open isn't allowed without a direct toolbar gesture, so we
  // persist whether the user is on an application page; the popup reads this on load
  // to decide which tab to land on (Quick Fill on a form, Tailor on a listing).
  if (msg.type === "OPEN_POPUP") {
    chrome.storage.session.set({ onAppPage: !!msg.onAppPage })
    // Nudge the toolbar icon so the user notices the extension is ready to act.
    // openPopup() returns a Promise — a bare try/catch only catches a *synchronous*
    // throw, so a rejection (no active/focused window, no direct user gesture on
    // this Chrome build, etc.) was going uncaught and showing up in
    // chrome://extensions → Errors as "Could not find an active browser window".
    try {
      const result = chrome.action.openPopup?.()
      if (result && typeof result.catch === "function") result.catch(() => { /* requires gesture on some builds */ })
    } catch { /* requires gesture on some builds */ }
  }
})

// When the extension is installed, seed the app URL.
// Default: production URL. Local dev can override via the popup's Settings field.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.storage.sync.set({ appUrl: "https://marketfit.app" })
  }
})

// Also update the fallback string used at runtime so existing installs that
// never opened Settings also pick up the production URL (they'll have no stored
// value if they installed before this change).
//
// Background GET_PROFILE fallback is already updated in the onMessage handler above:
// the default fallback `|| "http://localhost:3000"` is left as the dev escape hatch;
// production users will always have the stored URL from the install hook above.
