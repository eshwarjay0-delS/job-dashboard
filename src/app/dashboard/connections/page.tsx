import type { Metadata } from "next"
import { waConfigured } from "@/lib/whatsapp"
import ConnectionsClient from "./ConnectionsClient"

// Only a yes/no crosses to the browser. Whether the bot is wired is read from the server's own
// configuration at request time, so the row cannot claim Connected on a deployment without it.
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Connections" }

export default function ConnectionsPage() {
  return <ConnectionsClient whatsappWired={waConfigured()} />
}
