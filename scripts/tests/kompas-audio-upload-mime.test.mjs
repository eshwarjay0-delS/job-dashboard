import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { uploadMimeForContainer } from '../../src/lib/kompasAudioMime.ts'

test('verified WAV beats incorrect browser WebM declaration', () => {
  assert.equal(uploadMimeForContainer('wav', 'audio/webm'), 'audio/wav')
})
test('verified Safari MP4 beats WebM and preserves canonical MP4 MIME', () => {
  assert.equal(uploadMimeForContainer('mp4', 'audio/webm'), 'audio/mp4')
  assert.equal(uploadMimeForContainer('m4a', 'audio/mp4'), 'audio/mp4')
})
test('verified WebM beats incorrect browser MP4 declaration', () => {
  assert.equal(uploadMimeForContainer('webm', 'audio/mp4'), 'audio/webm')
})
test('verified Ogg, MP3, and FLAC have matching provider MIME', () => {
  assert.equal(uploadMimeForContainer('ogg', 'audio/wav'), 'audio/ogg')
  assert.equal(uploadMimeForContainer('mp3', 'audio/mp4'), 'audio/mpeg')
  assert.equal(uploadMimeForContainer('flac', 'audio/webm'), 'audio/flac')
})
test('unknown container preserves normalized legacy declaration', () => {
  assert.equal(uploadMimeForContainer('unknown', ' Audio/X-Wav;codecs=pcm '), 'audio/x-wav')
})
test('provider form uses verified MIME and original audio bytes', () => {
  const speech = readFileSync(new URL('../../src/lib/kompasSpeech.ts', import.meta.url), 'utf8')
  assert.match(speech, /import \{ uploadMimeForContainer \} from "@\/lib\/kompasAudioMime"/)
  assert.match(speech, /const container = containerFor\(input\.audio, input\.mime\)/)
  assert.match(speech, /new Blob\(\[input\.audio as BlobPart\], \{ type: uploadMimeForContainer\(container, type\) \}\), `audio\.\$\{container\}`/)
})

test('audioType accepts Android Chrome video/webm and video/mp4 declarations', () => {
  const speech = readFileSync(new URL('../../src/lib/kompasSpeech.ts', import.meta.url), 'utf8')
  const start = speech.indexOf('export const AUDIO_TYPES')
  const end = speech.indexOf('/** The type before', start)
  const block = speech.slice(start, end)
  assert.match(block, /"video\/webm": "webm"/)
  assert.match(block, /"video\/mp4": "mp4"/)
  assert.match(block, /"audio\/webm": "webm"/)
  const types = {}
  for (const m of block.matchAll(/"([^"]+)": "([^"]+)"/g)) types[m[1]] = m[2]
  const audioType = (mime) => {
    const type = String(mime || "").split(";")[0].trim().toLowerCase()
    return type in types ? type : null
  }
  assert.equal(audioType('audio/webm;codecs=opus'), 'audio/webm')
  assert.equal(audioType('video/webm;codecs=opus'), 'video/webm')
  assert.equal(audioType('video/mp4'), 'video/mp4')
  assert.equal(audioType('audio/mp4'), 'audio/mp4')
  assert.equal(audioType('audio/aac'), null)
})
