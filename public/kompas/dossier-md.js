/* The dossier the model reads is Markdown. An index may sit beside it. The document itself is not a JSON blob. */
(() => {
  function dossierMarkdown({ interviewer, difficulty, category, items }) {
    const title = `# Dossier · ${interviewer || "engineer"} · ${difficulty || "standard"} · ${category || "general"}`;
    const body = (items || []).map(it => {
      const say = (Array.isArray(it.a) ? it.a : [it.a]).map(s => String(s || "").trim()).filter(Boolean).join(" ");
      return `### ${String(it.q || "").trim()}\n\n**SAY THIS**\n\n${say}`;
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
