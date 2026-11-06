/** How long to hold back after the first split draft is assembled.
 *
 * The first pass has to come back before a repair pass can raise the score.
 * Reserving 60 percent of a WhatsApp call, up to 150 seconds, assembled that
 * draft while role calls were still running. Those roles were then marked
 * incomplete, and WhatsApp sent the library file instead of a scored update.
 * Repair keeps at most 45 seconds, and never more than a quarter of the call.
 */
export function firstDraftRepairReserveMs(maxMs: number): number {
  const budget = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : 0
  return Math.min(45_000, Math.floor(budget * 0.25))
}
