import test from 'node:test'
import assert from 'node:assert/strict'
import { readBoundedAudio } from '../../src/lib/kompasAudioUpload.ts'

const source = (...parts) => new ReadableStream({
  start(controller) { for (const part of parts) controller.enqueue(part); controller.close() },
})
const bytes = (...values) => Uint8Array.from(values)

test('empty request body returns empty audio', async () => {
  assert.deepEqual(await readBoundedAudio(null, 4), bytes())
})
test('empty stream returns empty audio', async () => {
  assert.deepEqual(await readBoundedAudio(source(), 4), bytes())
})
test('one small chunk keeps exact bytes', async () => {
  assert.deepEqual(await readBoundedAudio(source(bytes(0, 1, 255)), 4), bytes(0, 1, 255))
})
test('several chunks concatenate in arrival order', async () => {
  assert.deepEqual(await readBoundedAudio(source(bytes(1), bytes(2, 3), bytes(4)), 4), bytes(1, 2, 3, 4))
})
test('exactly at byte limit succeeds', async () => {
  assert.deepEqual(await readBoundedAudio(source(bytes(1, 2), bytes(3, 4)), 4), bytes(1, 2, 3, 4))
})
test('one byte over the limit rejects', async () => {
  assert.equal(await readBoundedAudio(source(bytes(1, 2), bytes(3, 4, 5)), 4), null)
})
test('oversized first chunk is rejected without a copy', async () => {
  assert.equal(await readBoundedAudio(source(new Uint8Array(1024)), 16), null)
})
test('oversize stops reading and cancels upstream source', async () => {
  let cancelled = false, reads = 0
  const stream = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(bytes(1, 2, 3)) },
    cancel() { cancelled = true },
  }, { highWaterMark: 0 })
  assert.equal(await readBoundedAudio(stream, 4), null)
  assert.equal(cancelled, true)
  assert.equal(reads, 2)
})
test('Uint8Array subview keeps only its own bytes', async () => {
  const backing = bytes(90, 1, 2, 91)
  assert.deepEqual(await readBoundedAudio(source(backing.subarray(1, 3)), 2), bytes(1, 2))
})
test('source read failure propagates rather than silently truncating audio', async () => {
  const stream = new ReadableStream({ pull(controller) { controller.error(new Error('broken upload')) } })
  await assert.rejects(readBoundedAudio(stream, 10), /broken upload/)
})
test('zero byte limit permits empty stream but rejects nonempty audio', async () => {
  assert.deepEqual(await readBoundedAudio(source(), 0), bytes())
  assert.equal(await readBoundedAudio(source(bytes(1)), 0), null)
})
test('invalid byte limits are rejected', async () => {
  await assert.rejects(readBoundedAudio(source(bytes(1)), -1), RangeError)
  await assert.rejects(readBoundedAudio(source(bytes(1)), Number.POSITIVE_INFINITY), RangeError)
})
