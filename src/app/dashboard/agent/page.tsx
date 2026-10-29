import AgentChat from "./AgentChat"

export const metadata = {
  title: "Chief — MarketFit",
  description: "The live chat. The Chief listens here, answers here, and keeps the open work.",
}

export default function AgentPage() {
  return (
    <main style={{ padding: "28px 24px", maxWidth: 1040 }}>
      <AgentChat />
    </main>
  )
}
