// Resume tailoring guards shared by runTailor and the website route (blueprint 2026-10-30, section 4).
// Import-free on purpose (only node's crypto), so scripts/tests load it with a plain transpile and a fake store.
// Every switch defaults ON; set it to 0 / false / off / no to restore the earlier behaviour.
import { createHash } from "crypto"

function switchOn(name: string): boolean {
  const v = String(globalThis.process?.env?.[name] ?? "").trim().toLowerCase()
  return !(v === "0" || v === "false" || v === "off" || v === "no")
}

/** TAILOR_CACHE_SKIP_REFUSED: a stored run the delivery checks refuse is not replayed; the next request redraws it. */
export const cacheSkipRefusedOn = () => switchOn("TAILOR_CACHE_SKIP_REFUSED")
/** TAILOR_WEB_ROUND_TRIP: the website runs the same name/contact/dates round-trip check as WhatsApp before handing a file over. */
export const webRoundTripOn = () => switchOn("TAILOR_WEB_ROUND_TRIP")
/** TAILOR_WEB_SHARED_CLAIM: one website run per identical request across server instances (WhatsApp's putIfAbsent claim). */
export const webSharedClaimOn = () => switchOn("TAILOR_WEB_SHARED_CLAIM")

type Replayable = {
  quality_blockers?: string[]
  unverified_added_keywords?: string[]
}
/** A stored result that would be refused again (blockers or unverified job-post claims). Replaying it only repeats the refusal. */
export function refusedForReplay(r: Replayable): boolean {
  return !!(r.quality_blockers || []).filter(Boolean).length || !!(r.unverified_added_keywords || []).filter(Boolean).length
}

export type ClaimStore = {
  putIfAbsent(key: string, value: string): Promise<boolean>
  getText(key: string): Promise<string | null | undefined>
  put(key: string, value: string): Promise<unknown>
  delete(key: string): Promise<unknown>
}
/** Same lease as WhatsApp's job claim: a run is never longer than the five-minute function ceiling. */
export const CLAIM_LEASE_MS = 300_000

/** The claim name for one website request. Only hashes leave this function: no resume, JD or user id is stored in it. */
export function webClaimKey(userId: string, jd: string, body: Record<string, unknown>): string {
  const sig = [
    userId, jd.trim(), String(body.filepath || ""), body.noCache ? "fresh" : "any", body.onePage ? "1page" : "full",
    body.mode === "quick" ? "q" : "f", JSON.stringify(body.sections ?? null), JSON.stringify(body.immediatePrefs ?? null), String(body.llmHeavy ?? ""),
  ].join("::")
  return `tailor/web-claims/${createHash("sha1").update(sig).digest("hex").slice(0, 24)}`
}

const heldAt = (text: string | null | undefined): number => {
  try { const at = Number((JSON.parse(text || "{}") as { at?: unknown }).at); return Number.isFinite(at) ? at : 0 } catch { return 0 }
}

/** "ok": this request owns the run. "held": another instance is making it. "off": storage trouble, never blocks a run. */
export async function takeClaim(store: ClaimStore, key: string, token: string, now = Date.now): Promise<"ok" | "held" | "off"> {
  try {
    if (await store.putIfAbsent(key, JSON.stringify({ at: now(), token }))) return "ok"
    const at = heldAt(await store.getText(key).catch(() => null))
    if (at && now() - at < CLAIM_LEASE_MS) return "held"
    // An interrupted run left its claim behind: take it over so a retry is never ignored.
    await store.put(key, JSON.stringify({ at: now(), token }))
    return "ok"
  } catch {
    return "off"
  }
}

/** Wait for the other instance's run to finish (claim released or stale). false: still running after `maxMs`. */
export async function waitForClaim(store: ClaimStore, key: string, maxMs: number, stepMs = 2000, now = Date.now,
  sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))): Promise<boolean> {
  const until = now() + maxMs
  for (;;) {
    const text = await store.getText(key).catch(() => null)
    if (!text) return true
    const at = heldAt(text)
    if (!at || now() - at >= CLAIM_LEASE_MS) return true
    if (now() >= until) return false
    await sleep(stepMs)
  }
}

/** Release only our own claim. */
export async function releaseClaim(store: ClaimStore, key: string, token: string): Promise<void> {
  try {
    const held = JSON.parse((await store.getText(key).catch(() => null)) || "{}") as { token?: string }
    if (held.token === token) await store.delete(key)
  } catch { /* the lease expires on its own */ }
}
