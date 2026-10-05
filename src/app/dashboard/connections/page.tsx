import type { Metadata } from "next"
import ConnectionsClient from "./ConnectionsClient"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Connections" }

export default function ConnectionsPage() {
  return <ConnectionsClient />
}
