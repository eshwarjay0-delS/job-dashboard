// Master dossier ("Bible") + per-session mini dossier merge (/workspace/dossier-bot/merge-rules.md).
import test from 'node:test'
import assert from 'node:assert/strict'
import { SECTION_IDS, emptyBible, mergeMini, loadBible, toSpeedSources, makeItem } from '../../src/lib/dossierBible.ts'

const src = (doc, session, span) => ({ doc, session, span })
const metric = (text, s, extra = {}) => makeItem({ section: 'stories', kind: 'metric', text, source: s, ...extra })

test('sections are stable ids in the same order for master and mini', () => {
  const b = emptyBible(), m = emptyBible('s1')
  assert.deepEqual(Object.keys(b.sections), SECTION_IDS)
  assert.deepEqual(Object.keys(m.sections), SECTION_IDS)
})

test('duplicate items fold into one and keep every session id', () => {
  const a = makeItem({ section: 'qbank', kind: 'answer', text: 'I validate remediation before closure.', source: src('session', 's1', 'q1') })
  const b = makeItem({ section: 'qbank', kind: 'answer', text: 'I validate  remediation before closure', source: src('session', 's2', 'q4') })
  let bible = mergeMini(emptyBible(), { ...emptyBible('s1'), sections: { ...emptyBible('s1').sections, qbank: [a] } }).bible
  bible = mergeMini(bible, { ...emptyBible('s2'), sections: { ...emptyBible('s2').sections, qbank: [b] } }).bible
  assert.equal(bible.sections.qbank.length, 1)
  assert.deepEqual(bible.sections.qbank[0].seenIn.sort(), ['s1', 's2'])
})

test('conflicting metrics: the better-sourced wins, the loser stays as an alternate', () => {
  const weak = metric('Validated remediation for 40 servers', src('session', 's1', 'about 40 servers'))
  const strong = metric('Validated remediation for 35 servers', src('resume', 's2', 'validated remediation for 35 servers'))
  let bible = mergeMini(emptyBible(), withItems('s1', [weak])).bible
  const r = mergeMini(bible, withItems('s2', [strong]))
  const it = r.bible.sections.stories
  assert.equal(it.length, 1)
  assert.match(it[0].text, /35/)
  assert.equal(it[0].alternates.length, 1)
  assert.match(it[0].alternates[0].text, /40/)
  assert.equal(r.log.filter((l) => l.rule === 'conflict').length, 1)
})

test('a hole never overwrites a sourced item', () => {
  const good = metric('Validated remediation for 35 servers', src('resume', 's1', 'validated remediation for 35 servers'))
  const hole = metric('Validated remediation for [ ___ confirm: your actual figure ] servers', src('session', 's2', null), { status: 'hole' })
  let bible = mergeMini(emptyBible(), withItems('s1', [good])).bible
  bible = mergeMini(bible, withItems('s2', [hole])).bible
  assert.equal(bible.sections.stories.length, 1)
  assert.equal(bible.sections.stories[0].status, 'sourced')
})

test('a sourced item fills a hole', () => {
  const hole = metric('Validated remediation for [ ___ confirm: your actual figure ] servers', src('session', 's1', null), { status: 'hole' })
  const good = metric('Validated remediation for 35 servers', src('transcript', 's2', 'remediation for 35 servers'))
  let bible = mergeMini(emptyBible(), withItems('s1', [hole])).bible
  bible = mergeMini(bible, withItems('s2', [good])).bible
  assert.equal(bible.sections.stories.length, 1)
  assert.equal(bible.sections.stories[0].status, 'sourced')
  assert.deepEqual(bible.sections.stories[0].seenIn.sort(), ['s1', 's2'])
})

test('an item with no source is rejected; a metric whose figure is not in its span is rejected', () => {
  const r = mergeMini(emptyBible(), withItems('s1', [
    makeItem({ section: 'qbank', kind: 'answer', text: 'Floating claim', source: null }),
    metric('Cut triage time by 40%', src('session', 's1', 'cut triage time noticeably')),
  ]))
  assert.equal(r.bible.sections.qbank.length + r.bible.sections.stories.length, 0)
  assert.equal(r.rejected.length, 2)
})

test('old-shape dossiers still load: markdown, {items:[{q,a}]}, and a bible JSON', () => {
  const md = '# Dossier · engineer · standard · general\n\n### Q1\n\n**SAY THIS**\n\nA one.\n'
  const fromMd = loadBible(md)
  assert.equal(fromMd.sections.qbank.length, 1)
  assert.equal(fromMd.sections.qbank[0].source.doc, 'legacy-dossier')
  const fromItems = loadBible({ items: [{ q: 'Q2', a: ['x', 'y'] }] })
  assert.equal(fromItems.sections.qbank[0].text, 'Q2 — x y')
  assert.deepEqual(loadBible(JSON.parse(JSON.stringify(fromItems))), fromItems)
})

test('speed-index sources come only from sourced items, JD stays emphasis', () => {
  const b = mergeMini(emptyBible(), withItems('s1', [
    makeItem({ section: 'stories', kind: 'story', text: 'At Citi I tracked remediation.', source: src('resume', 's1', 'remediation tracking') }),
    makeItem({ section: 'signals', kind: 'term', text: 'Control oversight', source: src('jd', 's1', 'control oversight') }),
    makeItem({ section: 'stories', kind: 'story', text: 'Hole [ ___ confirm before the call: what ]', source: src('session', 's1', null), status: 'hole' }),
  ])).bible
  const s = toSpeedSources(b)
  assert.match(s.resume, /tracked remediation/)
  assert.match(s.jd, /Control oversight/)
  assert.doesNotMatch(JSON.stringify(s), /___/)
})

function withItems(session, items) {
  const m = emptyBible(session)
  for (const it of items) m.sections[it.section].push(it)
  return m
}

test('sealed dossier has a stable contentHash and per-item hash; timestamps do not change them', async () => {
  const { sealBible, canonicalJson } = await import('../../src/lib/dossierBible.ts')
  const it = makeItem({ section: 'stories', kind: 'story', text: 'At Citi I tracked remediation.', source: src('resume', 's1', 'remediation tracking'), updatedAt: 1 })
  const a = sealBible(withItems('s1', [it]))
  const b = sealBible(withItems('s1', [{ ...it, updatedAt: 999 }]))
  assert.match(a.contentHash, /^[0-9a-f]{64}$/)
  assert.equal(a.contentHash, b.contentHash)
  assert.match(a.sections.stories[0].hash, /^[0-9a-f]{64}$/)
  const c = sealBible(withItems('s1', [{ ...it, text: 'At Citi I tracked remediation and access reviews.' }]))
  assert.notEqual(a.contentHash, c.contentHash)
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 0 }] }), '{"a":[2,{"c":0,"d":1}],"b":1}')
})

test('opener: one sourced first-person sentence, or a marked hole when there is no source', async () => {
  const { withOpener } = await import('../../src/lib/dossierBible.ts')
  const it = makeItem({ section: 'qbank', kind: 'answer', text: 'Q — A', source: src('session', 's1', 'Q') })
  const ok = withOpener(it, 'At Cigna I validate remediation before closure. More text.', src('resume', 's1', 'validating remediation and coordinating closures'))
  assert.equal(ok.opener.text, 'At Cigna I validate remediation before closure.')
  assert.equal(ok.opener.status, 'sourced')
  const none = withOpener(it, 'I cut review time by 40%.', null)
  assert.equal(none.opener.status, 'hole')
  assert.match(none.opener.text, /\[ ___ /)
  const third = withOpener(it, 'Eshwar validates remediation.', src('resume', 's1', 'x'))
  assert.equal(third.opener.status, 'hole')
})
