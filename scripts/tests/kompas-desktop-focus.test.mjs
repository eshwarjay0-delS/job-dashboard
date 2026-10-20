import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const script = readFileSync(new URL('../../public/kompas/desktop-focus.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8');
function setup(desktop = true, stored) {
  const dom = new JSDOM(html, { url: 'https://example.test', runScripts: 'outside-only' });
  if (desktop) dom.window.kompasDesktop = {};
  if (stored) dom.window.localStorage.setItem('kompas.desktopFocus', stored);
  dom.window.document.getElementById('view-copilot').classList.remove('hidden');
  dom.window.eval(script);
  return dom;
}
test('desktop focus defaults on; Details expands without replacing existing controls', () => {
  const dom = setup(); const d = dom.window.document;
  let calls = 0; const start = d.getElementById('startBtn'); start.onclick = () => calls++;
  assert.ok(d.documentElement.classList.contains('desktop-focus'));
  d.getElementById('desktopDetailsBtn').click();
  assert.equal(d.getElementById('desktopDetailsBtn').getAttribute('aria-expanded'), 'true');
  assert.ok(d.documentElement.classList.contains('desktop-details'));
  start.click(); assert.equal(calls, 1);
  dom.window.eval(script);
  assert.equal(d.querySelectorAll('#desktopFocusBtn').length, 1);
  dom.window.close();
});
test('focus preference persists and exit clears presentation mode', async () => {
  const dom = setup(); const d = dom.window.document;
  d.getElementById('desktopFocusBtn').click();
  assert.equal(dom.window.localStorage.getItem('kompas.desktopFocus'), 'off');
  assert.equal(d.documentElement.classList.contains('desktop-focus'), false);
  d.getElementById('desktopFocusBtn').click();
  d.getElementById('view-copilot').classList.add('hidden');
  await Promise.resolve();
  assert.equal(d.documentElement.classList.contains('desktop-focus'), false);
  dom.window.close();
});
test('web experience and saved opt-out remain unchanged', () => {
  const web = setup(false); assert.equal(web.window.document.getElementById('desktopFocusBtn'), null); web.window.close();
  const desktop = setup(true, 'off');
  assert.equal(desktop.window.document.documentElement.classList.contains('desktop-focus'), false);
  desktop.window.close();
});
test('focus hides secondary controls but exposes active modes and all controls in Details', () => {
  const dom = setup(); const d = dom.window.document;
  const style = d.createElement('style');
  style.textContent = readFileSync(new URL('../../public/kompas/desktop-focus.css', import.meta.url), 'utf8');
  d.head.append(style);
  const display = id => dom.window.getComputedStyle(d.getElementById(id)).display;
  assert.equal(display('autoBtn'), 'none');
  assert.equal(display('follow'), 'none');
  for (const id of ['startBtn', 'answerBtn', 'micBtn', 'sysBtn', 'chatBtn', 'status']) assert.notEqual(display(id), 'none');
  d.getElementById('autoBtn').setAttribute('aria-pressed', 'true');
  d.getElementById('followBtn').setAttribute('aria-pressed', 'true');
  assert.notEqual(display('autoBtn'), 'none'); assert.notEqual(display('follow'), 'none');
  d.getElementById('desktopDetailsBtn').click();
  assert.notEqual(display('textSizeN'), 'none');
  dom.window.close();
});
