export type TrackedSender = { account: string; email: string; name: string; at: number }
export function validTracked(value: unknown): value is TrackedSender {
 const x=value as TrackedSender
 return !!x && typeof x.account === "string" && typeof x.email === "string" && [x.account,x.email].every(s=>s.length<200 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) && typeof x.name === "string" && x.name.length<=160 && Number.isFinite(x.at)
}
export function trackedBy(rules: TrackedSender[], account: string, email: string) { return rules.some(r=>r.account===account.toLowerCase() && r.email===email.toLowerCase()) }
