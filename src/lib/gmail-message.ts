import { randomBytes } from "node:crypto"
export type MailAttachment = { name: string; type: string; data: string }
export function recipients(value: unknown): string[] {
  if (typeof value !== "string" || /[\r\n]/.test(value)) throw new Error("Enter valid email addresses separated by commas.")
  const items = value.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  if (items.length > 30 || items.some(s => !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(s))) throw new Error("Enter valid email addresses separated by commas.")
  return [...new Set(items)]
}
export function attachments(value: unknown): MailAttachment[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 8) throw new Error("Attach up to eight files, at most 2 MB combined.")
  let bytes = 0
  return value.map(a => {
    if (!a || typeof a.name !== "string" || !a.name || a.name.length > 180 || /[\r\n\x00]/.test(a.name) || typeof a.data !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.data)) throw new Error("Invalid attachment.")
    bytes += Buffer.from(a.data, "base64").length
    if (bytes > 2 * 1024 * 1024) throw new Error("Attachments must total 2 MB or less.")
    return { name:a.name, type:typeof a.type === "string" && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(a.type) ? a.type : "application/octet-stream", data:a.data }
  })
}
const encoded = (s: string) => `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`
export function encodeGmailMessage(input: { from: string; to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; attachments: MailAttachment[]; replyTo?: string }) {
  const boundary = `mfit_${randomBytes(16).toString("hex")}`
  const headers = [`From: ${input.from}`, `To: ${input.to.join(", ")}`, ...(input.cc.length ? [`Cc: ${input.cc.join(", ")}`] : []), ...(input.bcc.length ? [`Bcc: ${input.bcc.join(", ")}`] : []), `Subject: ${encoded(input.subject.replace(/[\r\n]/g," "))}`, "MIME-Version: 1.0", ...(input.replyTo && /^<[^<>\r\n]+>$/.test(input.replyTo) ? [`In-Reply-To: ${input.replyTo}`, `References: ${input.replyTo}`] : [])]
  const part = ['Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(input.body).toString('base64').match(/.{1,76}/g)?.join('\r\n') || '']
  const mime = input.attachments.length ? [...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, ...part, ...input.attachments.flatMap(a => [`--${boundary}`, `Content-Type: ${a.type}`, `Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(a.name).replace(/'/g,'%27')}`, 'Content-Transfer-Encoding: base64', '', a.data.match(/.{1,76}/g)?.join('\r\n') || '']), `--${boundary}--`].join('\r\n') : [...headers,...part].join('\r\n')
  return Buffer.from(mime).toString('base64url')
}
