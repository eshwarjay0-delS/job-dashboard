// Authenticated cron endpoint; the webhook module owns the shared recovery worker.
export { GET } from "../webhook/route"
export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"
