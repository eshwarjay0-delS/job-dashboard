// Prevent a partial dashboard copy from losing Question Bank, review, or release updates.
// The deployed Perfact HTML and assets are the single Kompas release on both sites.
export function mountKompasHtml(html: string): string {
  if (!/<html[\s>]/i.test(html) || !html.includes('id="view-dashboard"')) throw new Error("Invalid Kompas shell")
  const shim = `<base href="/kompas/">
<script>
(function () {
  const nativeFetch = window.fetch.bind(window);
  function withHeaders(input, options) {
    const headers = new Headers();
    const seed = input instanceof Request ? input.headers : (options && options.headers);
    if (seed instanceof Headers) seed.forEach((v, k) => headers.set(k, v));
    else if (Array.isArray(seed)) seed.forEach(([k, v]) => headers.set(k, v));
    else if (seed) Object.entries(seed).forEach(([k, v]) => headers.set(k, String(v)));
    return headers;
  }
  window.fetch = function (input, options) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin === location.origin && url.pathname === '/api/transcribe') {
      // Kompas session transcription runs through MarketFit's voice pipeline:
      // word timestamps, the hallucination guard, vocabulary hints and the
      // language lock. The app's x-whisper-prompt becomes the pipeline's hint,
      // merged with MarketFit's own vocabulary and the words it learned from
      // your corrections — one shared ear across every Kompas endpoint.
      // (2026-10-14, perfACT sunset: the old /kompas/api/transcribe proxy is
      // gone; the desktop app uses this pipeline too.)
      url.pathname = '/api/kompas/speech';
      const headers = withHeaders(input, options);
      const prompt = headers.get('x-whisper-prompt');
      try {
        const mfHint = (localStorage.getItem('mf_flow_hint') || '').trim();
        const mfLearned = JSON.parse(localStorage.getItem('mf_flow_learned') || '[]');
        const learned = Array.isArray(mfLearned) ? mfLearned.filter(w => typeof w === 'string').slice(-40) : [];
        const merged = [prompt ? decodeURIComponent(prompt).replace(/^Vocabulary:\s*/i, '') : '', mfHint, learned.join(', ')]
          .map(s => (s || '').trim()).filter(Boolean).join(', ').slice(0, 550);
        if (merged) headers.set('x-speech-hint', encodeURIComponent('Vocabulary: ' + merged));
        const mfLang = (localStorage.getItem('mf_flow_lang') || '').trim().toLowerCase();
        if (/^[a-z]{2}$/.test(mfLang)) headers.set('x-speech-lang', mfLang);
      } catch { if (prompt && !headers.get('x-speech-hint')) headers.set('x-speech-hint', prompt); }
      headers.set('x-speech-for', 'transcribe');
      headers.set('x-kompas-app', '1');
      if (input instanceof Request) {
        input = new Request(url, {
          method: input.method, headers: headers, body: input.body, mode: input.mode,
          credentials: input.credentials, cache: input.cache, redirect: input.redirect,
          referrer: input.referrer, integrity: input.integrity, keepalive: input.keepalive,
          signal: input.signal, ...(input.body ? { duplex: 'half' } : {}),
        });
        return nativeFetch(input);
      }
      return nativeFetch(url, Object.assign({}, options, { headers: headers }));
    }
    if (url.origin === location.origin && url.pathname === '/api/answer') {
      // MarketFit's native session answer engine (2026-10-14): sessions run on
      // OpenRouter, max priority — no more Groq free-tier rate limits mid-session.
      // The engine generates the answer already balanced for a human listener
      // and grounded in the speaker's dossier, so the humanize pass is skipped.
      url.pathname = '/api/kompas/answer';
      const answered = input instanceof Request ? nativeFetch(new Request(url, input)) : nativeFetch(url, options);
      return answered.then(async (res) => {
        // SSE answers stream straight through — never clone/buffer them, or the
        // first words would wait for the whole answer (2026-10-14).
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('event-stream')) return res;
        let data;
        try { data = await res.clone().json(); } catch { return res; }
        if (data && (data.polished || (data.meta && data.meta.engine === 'marketfit'))) return res;
        const text = data && typeof data.text === 'string' ? data.text.trim() : '';
        if (!text || data.degraded || data.noQuestion || data.busy) return res;
        try {
          var reqQuestion = '', reqRole = '';
          try {
            var reqBody = options && options.body ? options.body : null;
            if (typeof reqBody === 'string') {
              var parsed = JSON.parse(reqBody);
              reqQuestion = (parsed.question || '').slice(0, 500);
              reqRole = ((parsed.config && parsed.config.interviewer) || '').slice(0, 40);
            }
          } catch {}
          const hr = await nativeFetch('/api/kompas/humanize', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, question: reqQuestion, role: reqRole }),
          });
          if (!hr.ok) return res;
          const polished = await hr.json();
          if (polished && typeof polished.text === 'string' && polished.text.trim()) {
            data.text = polished.text;
            return new Response(JSON.stringify(data), { status: res.status, headers: res.headers });
          }
        } catch {}
        return res;
      });
    }
    if (url.origin === location.origin && (url.pathname === '/api/guide' || url.pathname === '/api/questions')) {
      // Question Bank prep runs on MarketFit's native endpoints (2026-10-14,
      // perfACT sunset): /api/guide → /api/kompas/guide, /api/questions → /api/kompas/questions.
      url.pathname = url.pathname === '/api/guide' ? '/api/kompas/guide' : '/api/kompas/questions';
      input = input instanceof Request ? new Request(url, input) : url;
      return nativeFetch(input, options);
    }
    // The build check reads Kompas's own stamp, written beside index.html in the same change. The root
    // /version.json was a second copy kept by hand; on 23 Oct it lagged a release, so every session showed
    // "Update ready" and a reload never cleared it.
    if (url.origin === location.origin && url.pathname === '/version.json') {
      url.pathname = '/kompas/version.json';
      input = input instanceof Request ? new Request(url, input) : url;
      return nativeFetch(input, options);
    }
    if (url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname === '/version.json' || url.pathname === '/release.json')) {
      if (!url.pathname.startsWith('/api/kompas/')) {
        // Self-hosted since 2026-10-14 (perfACT sunset): the remaining /api/*
        // calls are served by MarketFit's native /api/kompas/* endpoints.
        // Anything without a native equivalent passes through untouched.
        const native = {
          '/api/capabilities': '/api/kompas/capabilities',
          '/api/persona': '/api/kompas/persona',
          '/api/prep': '/api/kompas/prep',
          '/api/screen': '/api/kompas/screen',
          '/api/section': '/api/kompas/section',
          // Two perfACT features still invoked by the frontend after the
          // sunset: answer-level persistence and spoken-answer feedback.
          '/api/levels': '/api/kompas/levels',
          '/api/feedback': '/api/kompas/feedback',
          '/api/pace': '/api/kompas/pace',
          '/api/score': '/api/kompas/score',
          '/api/review': '/api/kompas/review',
          '/api/practice': '/api/kompas/practice',
          '/api/lexicon': '/api/kompas/lexicon',
        }[url.pathname];
        if (native) {
          url.pathname = native;
          input = input instanceof Request ? new Request(url, input) : url;
        }
      }
    }
    return nativeFetch(input, options);
  };

  // Desktop installer: the copilot's own "Download Kompas.exe" link 404s because the
  // executable was never published to /downloads. Route it to MarketFit's installer
  // page instead: it tries the kompas:// protocol first and offers the published
  // installer (KOMPAS_DESKTOP_URL) when one exists.
  function fixDesktopDownload() {
    document.querySelectorAll('a[href$="/downloads/Kompas.exe"], a[href$="Kompas.exe"]').forEach(function (a) {
      if (a.getAttribute("data-mf-fixed")) return;
      a.setAttribute("data-mf-fixed", "1");
      a.removeAttribute("download");
      a.setAttribute("href", "/downloads/kompas");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fixDesktopDownload);
  else fixDesktopDownload();
  new MutationObserver(fixDesktopDownload).observe(document.documentElement, { childList: true, subtree: true });

  // Gel points pill: right after the Kompas title, "X interviews · Y resumes left".
  // Refreshed when the header appears and every two minutes after.
  function paintCredits() {
    const title = document.getElementById('ovTitle');
    if (!title || document.getElementById('mfCredits')) return;
    const pill = document.createElement('span');
    pill.id = 'mfCredits';
    pill.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:10px;font-size:11.5px;font-weight:700;color:var(--text-muted,#8a8578);background:var(--surface-2,rgba(0,0,0,0.06));border:1px solid var(--border,rgba(0,0,0,0.12));border-radius:999px;padding:4px 11px;white-space:nowrap;';
    pill.textContent = '…';
    title.after(pill);
    const load = () => nativeFetch('/api/kompas/credits', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j && j.ok) pill.textContent = '◉ ' + j.interviews + ' interviews · ' + j.resumes + ' resumes left';
      })
      .catch(() => {});
    load();
    setInterval(load, 120000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintCredits);
  else paintCredits();
  new MutationObserver(paintCredits).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`
  return html.replace(/<head([^>]*)>/i, `<head$1>\n${shim}`)
}
