import AgentChat from "./AgentChat"

export const metadata = {
  title: "MFit Agent — MarketFit",
  description: "Your job-hunt strategist: chain analysis, watchdog alerts, and follow-up drafts.",
}

export default function AgentPage() {
  return (
    <main style={{ padding: "28px 24px", maxWidth: 1040 }}>
      <AgentChat />
    </main>
  )
}
