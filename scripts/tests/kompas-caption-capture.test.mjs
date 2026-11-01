import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Owner, 1 Nov 2026, titled "caption capture": when the desktop shell
// detects a live-caption box anywhere, its text flows automatically into
// the question box through the same onTranscript path as heard lines.
// Caption updates repeat the tail of the previous one, so only new words
// enter; a repeated word is the safe failure, a lost word is not.
// Assertions compare strings, not vm-realm objects (deepStrictEqual fails
// on cross-realm prototypes even when the values are identical).
const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const preloadSrc = readFileSync(new URL('../../../perfact-desktop/preload.js', import.meta.url), 'utf8');

function loadFn() {
  const start = appSrc.indexOf('function captionNewPart(');
  const end = appSrc.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, 'captionNewPart slice found');
  const context = {};
  runInNewContext(appSrc.slice(start, end + 2) + '\nthis.captionNewPart = captionNewPart;', context);
  return context.captionNewPart;
}

function check(last, text, part, next) {
  const r = loadFn()(last, text);
  assert.equal(r.part, part);
  assert.equal(r.next, next);
}

test('empty caption ingests nothing', () => {
  check('hello world', '   ', '', 'hello world');
});

test('first caption ingests whole', () => {
  check('', 'What is a SIEM', 'What is a SIEM', 'What is a SIEM');
});

test('repeated caption ingests nothing', () => {
  check('What is a SIEM', 'What is a SIEM', '', 'What is a SIEM');
});

test('extended caption ingests only the new words', () => {
  check('What is a SIEM', 'What is a SIEM and how does it work', 'and how does it work', 'What is a SIEM and how does it work');
});

test('scrolled-back caption ingests nothing and keeps the longer text', () => {
  check('What is a SIEM and how does it work', 'What is a SIEM', '', 'What is a SIEM and how does it work');
});

test('overlapping caption trims the repeated tail', () => {
  check('tell me about SIEM', 'SIEM and incident response', 'and incident response', 'SIEM and incident response');
});

test('a single stopword overlap does not trim a new sentence', () => {
  check('the cat sat', 'the dog ran', 'the dog ran', 'the dog ran');
});

test('unrelated caption ingests whole', () => {
  check('What is a SIEM', 'Describe your on-call rotation', 'Describe your on-call rotation', 'Describe your on-call rotation');
});

test('a mid-word prefix never loses a partial word', () => {
  check('SIEM', 'SIEMs are tools', 'SIEMs are tools', 'SIEMs are tools');
});

test('the page wires captions into the transcript as interviewer lines', () => {
  assert.match(appSrc, /onTranscript\("Them", r\.part/);
  assert.match(appSrc, /window\.kompasDesktop\?\.onCaption/);
  assert.match(appSrc, /window\.__kompasCaption = onCaptionText/);
  assert.match(appSrc, /lastCaption = "";/);
});

test('the desktop bridge carries the caption channel', () => {
  assert.match(preloadSrc, /onCaption: \(fn\) => \{ ipcRenderer\.on\("kompas:caption"/);
});
