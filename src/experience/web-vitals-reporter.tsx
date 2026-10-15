"use client"

import { usePathname } from "next/navigation"
import { useReportWebVitals } from "next/web-vitals"
import { useExperience } from "./experience-provider"

// The six the server keeps (src/app/api/telemetry/web-vitals/route.ts). Next.js also reports its own timings on every
// page move; the server dropped them, and sending them was most of the 31 requests counted in 10 seconds on the
// owner's session (14 Oct 2026).
const KEPT = new Set(["TTFB", "FCP", "LCP", "FID", "CLS", "INP"])

export function WebVitalsReporter() {
  const pathname = usePathname()
  const { tier, reducedMotion, saveData } = useExperience()

  useReportWebVitals(metric => {
    if (!KEPT.has(metric.name)) return
    const payload = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: "rating" in metric ? metric.rating : undefined,
      id: metric.id,
      route: pathname,
      experienceTier: tier,
      reducedMotion,
      saveData,
      at: Date.now(),
    })

    try {
      const blob = new Blob([payload], { type: "application/json" })
      if (navigator.sendBeacon("/api/telemetry/web-vitals", blob)) return
    } catch {}

    void fetch("/api/telemetry/web-vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {})
  })

  return null
}
