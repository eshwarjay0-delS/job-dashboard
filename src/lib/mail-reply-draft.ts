export type ReplyDraft = { to: string; cc: string; bcc: string; subject: string; body: string; files: {name:string;type:string;data:string}[] }
export const replyDraftKey = (user: string, account: string, thread: string) => {
  if (!user || !account || !thread) throw Error('A signed-in conversation is required.')
  return 'mfit:reply:v1:' + JSON.stringify([user, account.toLowerCase(), thread])
}
export function validReplyDraft(value: unknown): value is ReplyDraft {
  const d = value as ReplyDraft
  return !!d && ['to','cc','bcc','subject','body'].every(k => typeof d[k as keyof ReplyDraft] === 'string' && String(d[k as keyof ReplyDraft]).length <= 100000)
    && Array.isArray(d.files) && d.files.length <= 8 && d.files.every(f => f && typeof f.name === 'string' && typeof f.type === 'string' && typeof f.data === 'string')
    && d.files.reduce((n,f) => n+f.data.length,0) <= 3*1024*1024
}
export function readReplyDraft(storage: Pick<Storage,'getItem'>, key: string): ReplyDraft | null {
  const raw = storage.getItem(key)
  if (!raw) return null
  const d: unknown = JSON.parse(raw)
  if (!validReplyDraft(d)) throw Error('The saved reply could not be read. It has not been overwritten.')
  return d
}
export function saveReplyDraft(storage: Pick<Storage,'setItem'>, key: string, draft: ReplyDraft) {
  if (!validReplyDraft(draft)) throw Error('This reply is too large to save in this browser.')
  storage.setItem(key,JSON.stringify(draft))
}
