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
      // Kompas session transcription runs through MarketFit's voice pipeline, not the
      // copilot backend: word timestamps, the hallucination guard, vocabulary hints and
      // the language lock. The app's x-whisper-prompt becomes the pipeline's hint, merged
      // with MarketFit's own vocabulary and the words it learned from your corrections —
      // one shared ear across every Kompas endpoint.
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
      // The copilot's answer, re-delivered for a human listener (2026-10-11):
      // the technical substance stays exactly as the backend wrote it; only the
      // delivery is re-paced so the interviewer can stay with the speaker.
      // If the polish fails, the original answer goes through untouched.
      var reqQuestion = '';
      try {
        var reqBody = options && options.body ? options.body : (input instanceof Request ? null : null);
        if (typeof reqBody === 'string') reqQuestion = (JSON.parse(reqBody).question || '').slice(0, 500);
      } catch {}
      url.pathname = '/kompas' + url.pathname;
      const answered = input instanceof Request ? nativeFetch(new Request(url, input)) : nativeFetch(url, options);
      return answered.then(async (res) => {
        let data;
        try { data = await res.clone().json(); } catch { return res; }
        const text = data && typeof data.text === 'string' ? data.text.trim() : '';
        if (!text || data.degraded || data.noQuestion || data.busy) return res;
        try {
          const hr = await nativeFetch('/api/kompas/humanize', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, question: reqQuestion }),
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
    if (url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname === '/version.json' || url.pathname === '/release.json')) {
      url.pathname = '/kompas' + url.pathname;
      input = input instanceof Request ? new Request(url, input) : url;
    }
    return nativeFetch(input, options);
  };
})();
</script>`
  return html.replace(/<head([^>]*)>/i, `<head$1>\n${shim}`)
}
