import test from 'node:test'
import assert from 'node:assert/strict'
import { manualRewrite, withManualRewrite, transcriptMatches, segmentText, asMarkdown } from '../../src/lib/kompasTranscript.ts'
const session = () => ({ v: 1, id: 's', title: 'Release review', startedAt: '2026-10-09T00:00:00Z', consent: 'only-me', segments: [{ id: 'a', startMs: 0, endMs: 1000, raw: 'the cube net is failed', clean: 'The cube net is failed.' }] })
test('manual corrections preserve recognition, clean wording and each prior revision', () => {
  const original = session()
  const first = withManualRewrite(original, 'a', 'The Kubernetes deployment failed.', 'Technical word or name', 1)
  const second = withManualRewrite(first, 'a', 'The Kubernetes rollout failed.', 'Improve wording', 2)
  assert.equal(second.segments[0].raw, original.segments[0].raw)
  assert.equal(second.segments[0].clean, original.segments[0].clean)
  assert.equal(original.segments[0].rewrite, undefined)
  assert.deepEqual(second.segments[0].revisions.map(r => r.before), ['The cube net is failed.', 'The Kubernetes deployment failed.'])
  assert.ok(second.segments[0].revisions.every(r => r.source === 'user'))
  assert.equal(segmentText(second.segments[0], 'raw'), original.segments[0].raw)
})
test('empty, oversized, unexplained or nonfinite-time revisions are rejected', () => {
  const original = session().segments[0]
  for (const args of [['', 'reason', 1], ['x'.repeat(20001), 'reason', 1], ['fixed', '', 1], ['fixed', 'reason', NaN]]) assert.equal(manualRewrite(original, ...args), original)
  assert.equal(manualRewrite(original, original.clean, 'reason', 1), original)
})
test('missing audio cannot be silently filled by a rewritten text', () => {
  const original = session(); original.segments[0].failed = true
  assert.deepEqual(withManualRewrite(original, 'a', 'invented', 'reason', 1), original)
})
test('search includes original recognition, revised wording and correction reason', () => {
  const changed = withManualRewrite(session(), 'a', 'The Kubernetes deployment failed.', 'Technical word or name', 1)
  for (const query of ['cube net', 'KUBERNETES', 'technical word', 'release Kubernetes', '']) assert.equal(transcriptMatches(changed, query), true)
  assert.equal(transcriptMatches(changed, 'successful deployment'), false)
})
test('rewritten export is labeled user-edited and leaves RAW exports unchanged', () => {
  const changed = withManualRewrite(session(), 'a', 'The Kubernetes deployment failed.', 'Technical word or name', 1)
  assert.match(asMarkdown(changed, 'rewrite'), /rewritten by you/)
  assert.match(asMarkdown(changed, 'rewrite'), /Kubernetes/)
  assert.match(asMarkdown(changed, 'raw'), /cube net/)
  assert.doesNotMatch(asMarkdown(changed, 'raw'), /Kubernetes/)
  assert.equal(segmentText(session().segments[0], 'rewrite'), session().segments[0].clean)
})
