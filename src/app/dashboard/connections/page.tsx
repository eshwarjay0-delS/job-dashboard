import type { Metadata } from "next"
import Link from "next/link"
import { authenticatedUser } from "@/lib/authBoundary"
import { isResumeOnlyAccount } from "@/lib/resumeOnlyEntitlement"
import { waStatus, waDisplayNumber } from "@/lib/whatsapp"
import ConnectionsClient from "./ConnectionsClient"
import LinkCard from "../whatsapp/link-card"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Connections" }

// Resume-only users get a WhatsApp-only Connections page. Gmail and Kompas remain outside their workspace.
export default async function ConnectionsPage() {
  const user = await authenticatedUser()
  const resumeOnly = await isResumeOnlyAccount(user)
  if (!resumeOnly) return <ConnectionsClient />

  const status = await waStatus()
  const digits = status.state === "ok" ? await waDisplayNumber() : ""
  const live = status.state === "ok" && digits.length >= 8
  return (
    <div className="mf-home" style={{ maxWidth: 820, margin: "0 auto" }}>
      <header className="mf-home-heading">
        <h1>Connections</h1>
        <p>Connect WhatsApp to tailor resumes from a job description. You do not need to connect Gmail.</p>
      </header>
      <section aria-label="WhatsApp resume tailoring" style={{
        display: "flex", flexDirection: "column", gap: 12, background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 16, padding: 24,
      }}>
        <h2 style={{ fontSize: 21, margin: 0 }}>WhatsApp</h2>
        <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Link your number to this MarketFit account. For each request, send a Word resume and a job description in either order.
          The tailored document is sent back over WhatsApp without being added to your Files.
        </p>
        {live ? (
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="btn-accent"
             style={{ alignSelf: "flex-start", minHeight: 44, padding: "0 18px", textDecoration: "none" }}>
            Message MarketFit on WhatsApp
          </a>
        ) : (
          <p role="status" style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {status.state === "test_number"
              ? "WhatsApp currently uses a test sender and can only message approved test recipients."
              : status.state === "not_configured"
                ? "WhatsApp is not configured yet."
                : "WhatsApp provider access could not be verified. Please try again later."}
          </p>
        )}
        <LinkCard bot={live ? digits : ""} />
      </section>
      <p style={{ marginTop: 16 }}><Link href="/dashboard/resume">Back to resume tailoring</Link></p>
    </div>
  )
}
