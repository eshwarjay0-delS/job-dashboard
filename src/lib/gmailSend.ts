import { getGoogleWorkspaceAccessToken } from "@/lib/googleWorkspace"

function encodeMessage(to: string, subject: string, body: string, workflowRunId?: string) {
  const headers = [
    "To: " + to,
    "Subject: " + subject.replace(/[\r\n]+/g, " "),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ]
  if (workflowRunId) headers.push("X-MarketFit-Workflow: " + workflowRunId)

  const mime = [...headers, "", body].join("\r\n")
  return Buffer.from(mime, "utf8").toString("base64url")
}

export async function sendGmailMessage(args: {
  userId: string
  accountId?: string | null
  to: string
  subject: string
  body: string
  workflowRunId?: string
}) {
  const token = await getGoogleWorkspaceAccessToken(args.userId, args.accountId || null)
  if (!token) throw new Error("Gmail is not connected.")

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encodeMessage(args.to, args.subject, args.body, args.workflowRunId),
    }),
    signal: AbortSignal.timeout(20000),
  })

  const sent = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(sent?.error?.message || "Gmail send failed.")
  }

  return {
    id: String(sent.id || ""),
    threadId: sent.threadId ? String(sent.threadId) : null,
  }
}
