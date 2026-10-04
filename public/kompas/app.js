
/* ---- Q&A cards ---- */
function lines(answer) { return (Array.isArray(answer) ? answer : String(answer || "").split(/\n+/)).map(l => String(l).replace(/^[-•*\s]+/, "").trim()).filter(Boolean); }
// Answers are always complete sentences: an old dossier answer's "[the tool you used]" is
// folded into plain words, never shown as a fill-in box.
function unbracket(s) {
  // Only fill-in PLACEHOLDERS are folded away ("[the EDR product you used]" -> "the EDR product",
  // "[blank]" / "[the reduction and timeline]" -> dropped). Real bracket content — "[Event ID 4625]",
  // "logs[idx]", "[::1]", "[a-z]" — is left exactly as written, and nothing else is touched.
  const isPlaceholder = (x) => /\b(you|your)\b/i.test(x) || /^(the|a|an|some|specific|insert|fill|replace)\s/i.test(x)
    || /^\s*(blank|tbd|tba|n\/?a|x|n|metric|number|percent(age)?|date|year|company|employer|tool|name|value|amount|timeframe|duration|result|impact)\s*$/i.test(x)
    || /^[a-z]+(?:\s+[a-z]+){1,8}$/.test(x.trim());
  const naturalFallback = (inner) => {
    const x = inner.toLowerCase();
    if (/percent|metric|number|reduction|increase|improvement|result|impact/.test(x)) return "a measurable improvement";
    if (/tool|platform|product|technology/.test(x)) return "the relevant tool";
    if (/company|employer|organization|client/.test(x)) return "the organization";
    if (/date|year|timeframe|duration|timeline/.test(x)) return "the project timeline";
    if (/team|people|engineers|stakeholders/.test(x)) return "the team";
    if (/name|person|manager|leader/.test(x)) return "the person involved";
    return "";
  };
  let hit = false;
  const out = String(s || "").replace(/\[([^\]\n]{1,90})\]/g, (m, inner) => {
    if (!isPlaceholder(inner)) return m;
    hit = true;
    const fallback = naturalFallback(inner);
    if (fallback) return fallback;
    if (!/\b(you|your)\b/i.test(inner)) return "";
    const t = inner.replace(/\s+(that |which |who )?(you|your)\b.*$/i, "").replace(/^(your|the)\s+/i, "the ").trim();
    return t.split(/\s+/).length >= 2 && !/^(how|what|when|why|where)\b/i.test(t) ? t : "";
  });
  if (!hit) return out;
  return out.replace(/\bby\s*%/g, "significantly").replace(/(^|\s)%/g, "$1")
    .replace(/[,;]\s*([.!?;:])/g, "$1").replace(/ +([,.;:!?])(?=\s|$)/g, "$1").replace(/ {2,}/g, " ");
}
// `__keyword__` = main keyword · *italic* = the word to stress out loud · (pause) = stop and breathe
function inline(li, text) {
  // `__keyword__` is the live emphasis mark (asterisks were stripped or shown raw). `**` still accepted.
  for (const part of unbracket(text).split(/(`[^`\n]{1,120}`|__[^_\n]{1,80}__|\*\*[^*\n]{1,80}\*\*|\*[^*\s][^*\n]{0,80}\*|==[^=\n]{1,80}==|\((?:pause|beat)\))/i)) {
    if (!part) continue;
    let el = null;
    if (/^`[^`]+`$/.test(part)) { el = document.createElement("code"); el.textContent = part.slice(1, -1); }
    else if (/^__[^_].*__$/.test(part) || /^\*\*[^*]+\*\*$/.test(part)) {
      el = document.createElement("strong");
      el.textContent = part.replace(/^__|__$/g, "").replace(/^\*\*|\*\*$/g, "");
    }
    else if (/^==[^=].*==$/.test(part)) { el = document.createElement("strong"); el.textContent = part.slice(2, -2); }
    else if (/^\*[^*]+\*$/.test(part)) { el = document.createElement("em"); el.textContent = part.slice(1, -1); }
    else if (/^\((pause|beat)\)$/i.test(part)) { el = document.createElement("span"); el.className = "pause"; el.textContent = "pause"; }
    li.append(el || document.createTextNode(part));
  }
}
// Passage lines (no bullet) render as prose, "- " lines as bullets, "## " lines as section heads.
function answerLines(answer) {
  if (Array.isArray(answer)) return answer.map(t => ({ t: String(t).trim().replace(/^(?:[-•]|\*(?!\*))\s*/, "").trim(), kind: "bullet" })).filter(x => x.t);
  // ``` fences hold code: kept whole (blank lines and indentation intact), even while still streaming
  const out = []; let code = null, prose = [];
  const flush = () => { if (prose.length) out.push(...proseLines(prose.join("\n"))); prose = []; };
  for (const raw of String(answer || "").split("\n")) {
    if (/^\s*```/.test(raw)) {
      if (code) { out.push({ t: code.lines.join("\n"), kind: "code", lang: code.lang }); code = null; }
      else { flush(); code = { lang: raw.replace(/^\s*```/, "").trim(), lines: [] }; }
      continue;
    }
    if (code) code.lines.push(raw); else prose.push(raw);
  }
  flush();
  if (code) out.push({ t: code.lines.join("\n"), kind: "code", lang: code.lang });
  return out;
}
function proseLines(text) {
  return String(text || "").replace(/\*{4,}/g, "").replace(/\*\*\s+\*\*/g, " ").split(/\n+/).map(l => l.trim())
    .filter(l => l && !/^(EXPERIENCE|DESIGN|INTRODUCTION|DRILL-DOWN|SIMPLE|CONSOLIDATED)\b[A-Z /&-]*:?$/.test(l) && !/^<[A-Z][^>]*>$/.test(l))   // never show a template label
    .map(l => {
    const h = l.match(/^#{1,3}\s*(.+)$/);
    if (h) return { t: h[1].replace(/\*\*/g, "").replace(/__/g, "").trim(), kind: "head" };
    const b = l.match(/^(?:(?:[-•]|\*(?!\*)|\d+[.)])\s+)+(.*)$/);      // "- - text" too
    if (b) return { t: b[1], kind: "bullet" };
    if (/^\((pause|beat)\)\.?$/i.test(l)) return { t: l, kind: "pauseline" };
    return { t: l, kind: "passage" };
  });
}
function renderCard() {
  const c = cards[idx]; if (!c) return;
  $("question").textContent = c.question;
  $("question").title = c.heard || "";
  // The answer never scrolls itself: it opens on its first line and stays wherever YOU scrolled,
  // even while a long answer streams in below.
  const ul = $("answer"), keep = ul.scrollTop;
  ul.innerHTML = "";
  answerLines(c.answer).forEach(({ t, kind, lang }) => {
    const li = document.createElement("li");
    if (kind === "code") {
      li.className = "codeblock"; const pre = document.createElement("pre"), code = document.createElement("code");
      if (lang) pre.dataset.lang = lang; code.textContent = t; pre.append(code); li.append(pre); ul.append(li); return;
    }
    if (kind === "head") li.className = "qhead";
    else if (kind === "passage") li.className = "passage";
    else if (kind === "pauseline") li.className = "pauseline";
    inline(li, t);
    ul.append(li);
  });