/* Stops a level switch from writing an anchor that is already being written, and stops the two anchors of one
   question from telling two different stories.
   Live trial, 5 Oct 2026: switching to Director while the background Director write was still out started a
   second model call for the same anchor, which breaks diamond rules 1 and 10 (one write; a repeat is the cache).
   The same trial showed Engineer and Director telling two stories (EDR against identity governance): the second
   anchor was sent the story ledger the first anchor had already advanced, so the server deliberately picked a
   different project, bottleneck and angle. */
(() => {
  const slots = (card) => card._flight || (card._flight = {});
  const pending = (card, anchor) => (card && card._flight && card._flight[anchor]) || null;

  // The write already out for this card and anchor is the answer to a second ask. write() runs at most once at a time.
  function once(card, anchor, write) {
    const s = slots(card);
    if (s[anchor]) return s[anchor];
    const p = Promise.resolve().then(write).finally(() => { if (s[anchor] === p) delete s[anchor]; });
    s[anchor] = p;
    return p;
  }
  // A streamed write that is not a single promise holds the slot itself and releases it when the stream ends.
  function hold(card, anchor) {
    const s = slots(card);
    let done;
    const p = new Promise(r => { done = r; });
    s[anchor] = p;
    return () => { if (s[anchor] === p) delete s[anchor]; done(); };
  }
  // A level switch: what is stored paints at once; a write already out is waited for; only then is one write started.
  async function show(card, anchor, { paint, write }) {
    if (paint()) return "cached";
    const out = pending(card, anchor);
    if (out) {
      try { await out; } catch {}
      if (paint()) return "waited";
    }
    await once(card, anchor, write);
    return paint() ? "written" : "failed";
  }

  // The ledger as it stood before this question's first anchor. Both anchors are written from it, so the server
  // chooses the same project, bottleneck and angle for both.
  function ledgerFor(card, question, ledger) {
    const q = String(question || "");
    if (!card._ledgerAt || card._ledgerAt.q !== q) card._ledgerAt = { q, ledger: JSON.parse(JSON.stringify(ledger || {})) };
    return card._ledgerAt.ledger;
  }
  // The other anchor, already written for the same question, goes last in history so the answer route treats this
  // write as the same story at another depth. What went wrong on it goes first, because history keeps 900 characters.
  // An answer that missed the question is not passed on: only the note is, so the miss is not copied.
  function siblingHistory(card, anchor, base, note) {
    const other = anchor === "engineer" ? "director" : "engineer";
    const a = card.anchors && card.anchors[other];
    const list = Array.isArray(base) ? base.slice() : [];
    if (!a || !a.prose) return list;
    const found = (card.critic && card.critic[other]) || [];
    const missed = found.some(f => f && f.id === "mismatch");
    const body = missed ? note : [note, a.prose].filter(Boolean).join("\n");
    if (!body) return list;
    list.push({ q: String(card.anchorQ || card.question || "").slice(0, 240), a: body.slice(0, 900) });
    return list.slice(-3);
  }

  globalThis.KompasFlight = { once, hold, show, pending, ledgerFor, siblingHistory };
})();
