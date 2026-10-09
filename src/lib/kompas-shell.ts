// Prevent a partial dashboard copy from losing Question Bank, review, or release updates.
// The deployed Perfact HTML and assets are the single Kompas release on both sites.
export function mountKompasHtml(html: string): string {
  if (!/<html[\s>]/i.test(html) || !html.includes('id="view-dashboard"')) throw new Error("Invalid Kompas shell")
  const shim = `<base href="/kompas/">
<script>
(function () {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, options) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
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
