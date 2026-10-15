// A reply written in Markdown is drawn as what it means (13 Oct 2026). Reported by a user: the MFit Agent answered with
// a Markdown table and the chat showed the pipes and dashes, because a reply was put on the page as plain text. The
// suggestion was `marked`. These hold that a table, a list and bold are drawn, and that nothing a reply holds can
// become markup or a link that runs something: a reply may repeat words from a stranger's email.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderMarkdown } from '../../src/lib/markdown.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const html = (text) => renderToStaticMarkup(renderMarkdown(text))
const count = (s, re) => (s.match(re) || []).length

test('a table is drawn as a table, with its columns set as written', () => {
  const out = html('Here is where each one stands:\n\n| Company | Role | Stage |\n|:--|:--|--:|\n| Northpier | Security Analyst | **Interview** |\n| Brightline | IAM Engineer | Submitted |')
  assert.equal(count(out, /<table/g), 1)
  assert.equal(count(out, /<th /g), 3)
  assert.equal(count(out, /<tr>/g), 3)
  assert.match(out, /<th scope="col" style="[^"]*text-align:right[^"]*">Stage<\/th>/)
  assert.match(out, /<td style="[^"]*text-align:right[^"]*"><strong>Interview<\/strong><\/td>/)
  assert.match(out, /<p style="margin:0px 0 0">Here is where each one stands:<\/p>/)
  const shown = out.replace(/<[^>]+>/g, ' ')          // what a person reads: the page without its tags
  assert.ok(!shown.includes('|') && !shown.includes('--'), 'no pipes and dashes left on the page')
  // In a narrow chat a wide table scrolls inside its own box.
  assert.match(out, /<div style="[^"]*overflow-x:auto[^"]*"><table/)
})

test('lists, headings, bold, code and line breaks are drawn', () => {
  const out = html('## Next steps\n\n1. Send your **updated resume**\n2. Confirm the *rate*\n   - $62/hr on C2C\n\n- [x] RTR signed\n- [ ] Interview booked\n\nUse `from:dana` in search.\n\n```\nline one\n  line two\n```\n\n> They will come back.\n\nfirst line\nsecond line')
  assert.match(out, /<h3 [^>]*>Next steps<\/h3>/)
  assert.match(out, /<ol [^>]*><li [^>]*>Send your <strong>updated resume<\/strong><\/li><li [^>]*>Confirm the <em>rate<\/em><ul/)
  assert.match(out, /☑ RTR signed/); assert.match(out, /☐ Interview booked/)
  // The numbers and the dots are asked for outright: the site's base styles take them off every list (seen in the chat:
  // "1. Send Mara ..." was drawn with no 1).
  assert.match(out, /<ol style="[^"]*list-style-type:decimal/); assert.match(out, /<ul style="[^"]*list-style-type:disc/)
  assert.match(out, /<code style="[^"]*">from:dana<\/code>/)
  assert.match(out, /<pre [^>]*><code>line one\n {2}line two<\/code><\/pre>/)
  assert.match(out, /<blockquote [^>]*><p [^>]*>They will come back\.<\/p><\/blockquote>/)
  assert.match(out, /first line<br\/>second line/)
})

test('nothing in a reply becomes markup: what looks like HTML is shown as the characters typed', () => {
  const nasty = 'Hello <script>alert(1)</script> and <img src=x onerror="alert(2)"> done\n\n<div onclick="x()">block</div>\n\n<iframe src="https://evil.example"></iframe>'
  const out = html(nasty)
  // No such tag, and no real tag that carries a handler. (The words "onerror=" are on the page: as words.)
  assert.equal(count(out, /<script|<img|<iframe|<div onclick/g), 0)
  assert.equal(count(out, /<[a-z][^>]*\son[a-z]+=/gi), 0)
  assert.deepEqual([...new Set((out.match(/<([a-z0-9]+)/gi) || []).map(t => t.slice(1)))].sort(), ['div', 'p'], 'the only tags on the page are the ones this file makes')
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(out, /&lt;img src=x onerror=&quot;alert\(2\)&quot;&gt;/)
  assert.match(out, /&lt;iframe/)
  // In a table cell and inside a link's words too.
  const cells = html('| a |\n|---|\n| <b onmouseover="x()">hi</b> |\n\n[<img src=x onerror=y>](https://ok.example)')
  assert.equal(count(cells, /<b |<img/g), 0)
})

test('a link is a link only to a web or mail address, and a picture is never fetched', () => {
  const out = html('[site](https://northpier.example/jobs) [mail](mailto:dana@northpier.example) [bad](javascript:alert(1)) [worse](data:text/html,<script>1</script>) [vb](vbscript:x) ![logo](https://img.example/a.png) <https://auto.example>')
  assert.match(out, /<a href="https:\/\/northpier\.example\/jobs" target="_blank" rel="noopener noreferrer"[^>]*>site<\/a>/)
  assert.match(out, /<a href="mailto:dana@northpier\.example"/)
  assert.equal(count(out, /href="/g), 4, 'the web link, the mail link, the picture as a link, and the bare address')
  assert.ok(!/href="(?:javascript|data|vbscript):/i.test(out))
  assert.match(out, />bad<|bad /); assert.ok(out.includes('bad') && out.includes('worse'), 'the words of an unsafe link are still shown')
  assert.equal(count(out, /<img/g), 0)
  assert.match(out, /<a href="https:\/\/img\.example\/a\.png"[^>]*>logo<\/a>/)
})

test('plain text stays plain, and empty or odd text does not break the chat', () => {
  assert.equal(html('Just a sentence.'), '<div style="white-space:normal;overflow-wrap:anywhere;min-width:0"><p style="margin:0px 0 0">Just a sentence.</p></div>')
  assert.equal(renderMarkdown(''), null)
  assert.equal(renderMarkdown('   \n '), null)
  assert.match(html('AT&T pays 5 < 6 & "more"'), /AT&amp;T pays 5 &lt; 6 &amp; &quot;more&quot;/)
  for (const odd of ['|', '| a |', '```', '****', '[](', '> ', '1.', '- ', '#', '\\', '<', '&amp;lt;', '| a | b |\n|---|', 'x'.repeat(20000), '*'.repeat(2000), '['.repeat(2000), ('| a ').repeat(500)]) assert.doesNotThrow(() => html(odd), odd.slice(0, 20))
  const t0 = performance.now()
  html(('| a | b | c |\n|---|---|---|\n' + '| 1 | 2 | 3 |\n'.repeat(300) + '\n').repeat(3) + '**bold** '.repeat(2000))
  assert.ok(performance.now() - t0 < 1500, 'a long reply is drawn in ' + Math.round(performance.now() - t0) + ' ms')
})

test('both chat windows draw the agent\'s reply this way, and what the person typed as typed', () => {
  for (const file of ['src/app/dashboard/_components/floating-agent.tsx', 'src/app/dashboard/agent/AgentChat.tsx']) {
    const src = read(file)
    assert.ok(src.includes('import { Markdown } from "@/lib/markdown"'), file)
    assert.ok(src.includes('{m.role === "assistant" ? <Markdown text={m.content} /> : m.content}'), file)
  }
  const lib = read('src/lib/markdown.ts')
  assert.ok(!/dangerouslySetInnerHTML|innerHTML|marked\.parse\(|marked\(/.test(lib), 'the reader is asked what the text is made of, never for HTML')
  assert.ok(lib.includes('marked.lexer(source, { gfm: true, breaks: true })'))
  assert.equal(JSON.parse(read('package.json')).dependencies.marked, '18.1.1')
})
