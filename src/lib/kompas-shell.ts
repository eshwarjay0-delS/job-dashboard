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
      // the language lock. The app's x-whisper-prompt becomes the pipeline's hint.
      url.pathname = '/api/kompas/speech';
      const headers = withHeaders(input, options);
      const prompt = headers.get('x-whisper-prompt');
      if (prompt && !headers.get('x-speech-hint')) headers.set('x-speech-hint', prompt);
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
