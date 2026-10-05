"use client"

import { usePathname } from "next/navigation"
import { useReportWebVitals } from "next/web-vitals"
import { useExperience } from "./experience-provider"

export function WebVitalsReporter() {
  const pathname = usePathname()
  const { tier, reducedMotion, saveData } = useExperience()

  useReportWebVitals(metric => {
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
