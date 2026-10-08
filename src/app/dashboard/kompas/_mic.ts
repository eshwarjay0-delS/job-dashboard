"use client"

// The microphone is allowed by a header that only these two pages are served with (next.config.js). A page reached through an
// in-app link is drawn without a new document, so it keeps the headers of the page before it, and those forbid the
// microphone: the browser then refuses with the same error as a person who pressed "Block", and the page would tell them to
// fix a setting that is not wrong. So when this document is not allowed the microphone, it is loaded once more, properly.
// The sidebar links here with a plain link for the same reason; this is the net under it.

import { useEffect } from "react"

export function useOwnDocument(): void {
  useEffect(() => {
    try {
      const policy = (document as unknown as { featurePolicy?: { allowsFeature(name: string): boolean } }).featurePolicy
      if (!policy || policy.allowsFeature("microphone")) { sessionStorage.removeItem("mf_mic_reload"); return }
      // Once per page, so a browser that still says no cannot loop.
      if (sessionStorage.getItem("mf_mic_reload") === location.pathname) return
      sessionStorage.setItem("mf_mic_reload", location.pathname)
      location.reload()
    } catch { /* no policy to ask, or no storage: the page carries on */ }
  }, [])
}
