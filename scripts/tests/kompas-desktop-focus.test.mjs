import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const script = readFileSync(new URL('../../public/kompas/desktop-focus.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../public/kompas/desktop-focus.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8');
function setup(desktop = true) {
  const dom = new JSDOM(html, { url: 'https://example.test', runScripts: 'outside-only' });
  if (desktop) dom.window.kompasDesktop = {};
  dom.window.document.getElementById('view-copilot').classList.remove('hidden');
  dom.window.eval(script);
  return dom;
}
const tick = () => new Promise(r => setTimeout(r, 0));
test('focus is the desktop default: applied with the live view, and there is no Focus or Details button', async () => {
  const dom = setup(); const d = dom.window.document;
  assert.ok(d.documentElement.classList.contains('desktop-focus'));
  assert.equal(d.getElementById('desktopFocusBtn'), null);
  assert.equal(d.getElementById('desktopDetailsBtn'), null);
  let calls = 0; const start = d.getElementById('startBtn'); start.onclick = () => calls++;
  start.click(); assert.equal(calls, 1);   // the presentation layer never replaces existing controls
  d.getElementById('view-copilot').classList.add('hidden');
  await tick();
  assert.equal(d.documentElement.classList.contains('desktop-focus'), false);
  dom.window.close();
});
// Owner, 27 Oct 2026: "just like kompas desktop focus style everything in mfit kompas" - web gets the same focus view.
test('web gets the same focus presentation with the live view, and no injected buttons', () => {
  const dom = setup(false); const d = dom.window.document;
  assert.equal(d.documentElement.classList.contains('desktop-focus'), true);
  assert.equal(d.getElementById('desktopFocusBtn'), null);
  assert.equal(d.getElementById('desktopDetailsBtn'), null);
  dom.window.close();
});
test('focus mode hides nothing: every control stays on the action bar, on the same level', () => {
  const dom = setup(); const d = dom.window.document;
  const style = d.createElement('style'); style.textContent = css; d.head.append(style);
  const display = id => dom.window.getComputedStyle(d.getElementById(id)).display;
  for (const id of ['startBtn', 'answerBtn', 'autoBtn', 'follow', 'chatBtn', 'prevBtn', 'nextBtn', 'liveInterviewer', 'caption', 'textSizeN'])
    assert.notEqual(display(id), 'none', id + ' must stay on the bar');
  dom.window.close();
});
