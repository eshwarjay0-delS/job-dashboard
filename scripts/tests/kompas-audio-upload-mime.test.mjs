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
