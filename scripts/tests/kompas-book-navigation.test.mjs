import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const appJs = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8');

test('prev/next toggles live on the action bar, not as corner buttons over the card', () => {
  const bar = html.slice(html.indexOf('bar-actions'), html.indexOf('live-mid'));
  assert.ok(bar.includes('id="prevBtn"'), 'Prev is a bar pill');
  assert.ok(bar.includes('id="nextBtn"'), 'Next is a bar pill');
  assert.ok(!html.includes('class="nav'), 'no absolute-positioned corner nav buttons remain');
  assert.equal((html.match(/id="prevBtn"/g) || []).length, 1);
  assert.equal((html.match(/id="nextBtn"/g) || []).length, 1);
  assert.ok(appJs.includes('$("prevBtn").onclick'), 'prev handler wired');
  assert.ok(appJs.includes('$("nextBtn").onclick'), 'next handler wired');
});

test('flipping between cards never rewrites a stored answer (pages of a book)', () => {
  const dom = new JSDOM('<input id="manualInput"><div id="question"></div><ul id="answer"></ul><div id="card"></div>');
  const fullA = '## The short version\nUse a parameterized query for the lookup.\n```sql\nSELECT * FROM t WHERE id = ?\n```\n- First point worth reading aloud\n- Second point worth reading aloud';
  const fullB = 'A different generated answer, long enough to be a real response page of the book.';
  const cardA = { question: 'Question A', answer: fullA };
  const cardB = { question: 'Question B', answer: fullB, streaming: true };
  const context = { window: {}, document: dom.window.document, $: id => dom.window.document.getElementById(id), cards: [cardA, cardB], idx: 0, wrapWords: () => {} };
  const start = appJs.indexOf('function unbracket'), end = appJs.indexOf('function wrapWords', start);
  vm.runInNewContext(appJs.slice(start, end), context);
  context.renderCard();              // open page A
  context.idx = 1; context.renderCard();   // flip to page B while it is still generating
  cardB.answer = fullB + ' And the finished ending.'; cardB.streaming = false;   // generation completes off-screen
  context.idx = 0; context.renderCard();   // back to A
  context.idx = 1; context.renderCard();   // return to the latest page: the finished answer, intact
  assert.equal(cardA.answer, fullA, 'rendering page A never flattened or dropped part of its answer');
  assert.equal(cardB.answer, fullB + ' And the finished ending.', 'the completed answer survived the round trip');
  assert.match(dom.window.document.getElementById('answer').textContent, /finished ending/);
  dom.window.close();
});

test('leaving a level stashes the shown answer in the desktop store under the level being left', () => {
  const options = '<option value="engineer">Technical HR + Engineer</option><option value="architect" selected>Architect + Developer</option><option value="director">Director</option>';
  const dom = new JSDOM('<select id="interviewerSelect">' + options + '</select><select id="liveInterviewer">' + options + '</select><div id="depthBars"></div><span id="depthMeter"></span><button id="whoUp"></button><button id="whoDown"></button>');
  const context = { window: { kompasDesktop: {} }, document: dom.window.document, $: id => dom.window.document.getElementById(id), current: {}, cards: [], idx: 0, liveConfig: () => ({ mode: 'technical', length: 'balanced' }) };
  const start = appJs.indexOf('const DESKTOP_RESPONSE_LEVELS'), end = appJs.indexOf('function sayAloud', start);
  vm.runInNewContext(appJs.slice(start, end), context);
  const answer = 'The generated response that was on screen when he switched levels, in full.';
  const card = { question: 'Tell me about a vulnerability you found', anchorQ: 'Tell me about a vulnerability you found', answer, meta: 'm' };
  context.stashShown(card);   // shownLevel defaults to engineer in the source: the level being left
  assert.equal(card.desktopByDepth['three-level-v4|engineer|technical|balanced|Tell me about a vulnerability you found'].answer, answer);
  assert.equal(card.byDepth['engineer|technical|balanced'].answer, answer);
  dom.window.close();
});
