// The twelve: one of the owner's colours for a company or a person, always the same one for the same name.
//
// The owner sent a palette of twelve as a picture on 8 Oct 2026 ("These colors are good asl") and, asked where it should go,
// said "DIY" on 12 Oct. The colours were read off the picture pan by pan and are tokens in globals.css (--jewel-1 to
// --jewel-12, each with the lettering that reads on it). They went to the one place the product has to tell many things
// apart that are neither good nor bad: the tile with a company's or a person's initials. Before this those tiles were eight
// near-identical ink greys, written out again in eight pages, and a dark square on the night.
//
// A jewel is never a signal. Good, bad and "needs you" keep their own colours (--success, --danger, --spot).
export const JEWELS = 12

/** 1 to 12, the same for the same name every time. A number picks by itself (a seed a page already has). */
export function jewelIndex(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return (Math.abs(Math.trunc(seed)) % JEWELS) + 1
  const s = String(seed || "?").trim().toLowerCase() || "?"
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % JEWELS) + 1
}

/** The fill and the lettering for a tile: `style={{ ...jewel(name) }}`. */
export function jewel(seed: string | number): { background: string; color: string } {
  const n = jewelIndex(seed)
  return { background: `var(--jewel-${n})`, color: `var(--jewel-${n}-ink)` }
}
