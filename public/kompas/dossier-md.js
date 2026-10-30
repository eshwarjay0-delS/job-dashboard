/* The dossier the model reads is Markdown. An index may sit beside it. The document itself is not a JSON blob. */
(() => {
  // Blueprint extras (optional): three angles, a three-rung follow-up ladder, a failure prompt. An item without
  // them renders exactly as before.
  function blueprintExtras(it) {
    const t = v => String(v || "").replace(/\s+/g, " ").trim();
    const out = [];
    if (it && t(it.opener)) out.push(`**OPENER**\n\n${t(it.opener)}`);
    const g = it && it.angles;
    if (g && t(g.direct) && t(g.architect) && t(g.brownfield)) {
      out.push(`**Angle A · direct**\n\n${t(g.direct)}`, `**Angle B · architect**\n\n${t(g.architect)}`, `**Angle C · brownfield**\n\n${t(g.brownfield)}`);
    }
    const ladder = Array.isArray(it && it.ladder) ? it.ladder.map(t).filter(Boolean).slice(0, 3) : [];
    if (ladder.length) out.push(`**FOLLOW-UP LADDER**\n\n${ladder.map((q, i) => `${i + 1}. ${q}`).join("\n")}`);
    if (it && t(it.failure)) out.push(`**FAILURE PROMPT**\n\n${t(it.failure)}`);
    return out.length ? `\n\n${out.join("\n\n")}` : "";
  }

  function dossierMarkdown({ interviewer, difficulty, category, items }) {
    const title = `# Dossier · ${interviewer || "engineer"} · ${difficulty || "standard"} · ${category || "general"}`;
    const body = (items || []).map(it => {
      const say = (Array.isArray(it.a) ? it.a : [it.a]).map(s => String(s || "").trim()).filter(Boolean).join(" ");
      return `### ${String(it.q || "").trim()}\n\n**SAY THIS**\n\n${say}${blueprintExtras(it)}`;
    }).filter(block => /### \S/.test(block) && /\*\*SAY THIS\*\*\n\n\S/.test(block)).join("\n\n");
    return `${title}\n\n${body}\n`;
  }

  function itemsFromMarkdown(md) {
    const items = [];
    for (const part of String(md || "").split(/^###\s+/m).slice(1)) {
      const nl = part.indexOf("\n");
      const q = (nl < 0 ? part : part.slice(0, nl)).replace(/\s+/g, " ").trim();
      let body = nl < 0 ? "" : part.slice(nl + 1);
      body = body.replace(/\*\*SAY THIS\*\*/gi, " ").replace(/\s+/g, " ").trim();
      if (q && body) items.push({ q: q.slice(0, 400), a: [body.slice(0, 4000)] });
    }
    return items;
  }

  globalThis.KompasDossierMd = { dossierMarkdown, itemsFromMarkdown };
})();
