import type { Metadata } from "next"
import { waStatus, waDisplayNumber } from "@/lib/whatsapp"
import { Card, Meta } from "../_suite/ui"
import PageIntro from "../_components/page-intro"

// Credentials alone do not establish provider access. Probe the sender before offering chat.
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "WhatsApp" }

const STEPS = [
  "Send the job post as a message.",
  "Send your resume as a Word file (.docx).",
  "MarketFit sends your resume back, fitted to that job.",
  "Want a change? Swipe to reply to that resume and say what to change.",
]

export default async function WhatsAppPage() {
  const status = await waStatus()
  const digits = status.state === "ok" ? await waDisplayNumber() : ""
  const live = status.state === "ok" && digits.length >= 8

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <PageIntro page="/dashboard/whatsapp"
        action={live ? { label: "Open WhatsApp", href: `https://wa.me/${digits}`, external: true } : { label: "How it works", href: "#how" }} />

      <Card id="how" style={{ scrollMarginTop: 24, display: "flex", flexDirection: "column" }}>
        <Meta>How it works</Meta>
        <ol className="mf-steps" style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--text)", marginTop: 12 }}>
          {STEPS.map((s, i) => (
            <li key={i} className="mf-step">
              <span className="mf-step-dot" aria-hidden>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {live ? (
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="btn-accent"
            style={{ minHeight: 46, padding: "0 22px", fontSize: 15, textDecoration: "none", marginTop: 16, alignSelf: "flex-start" }}>
            Message MarketFit on WhatsApp
          </a>
        ) : (
          <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)" }}>
            {status.state === "test_number" ? "WhatsApp is using a test number and is only available to approved test recipients." : status.state === "not_configured" ? "WhatsApp is not configured yet." : "WhatsApp provider access could not be verified. Please try again later."}
          </p>
        )}
      </Card>
    </div>
  )
}
