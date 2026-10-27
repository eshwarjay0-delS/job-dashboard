/**
 * Voice messages on Meta Cloud arrive as a media id, NOT as an on-device
 * WhatsApp transcript or a live microphone stream. Decode once, then pass the
 * recognized text into the exact same account-owned WhatsApp command pipeline.
 *
 * Do not store raw audio, reveal media URLs, or run any LLM for command intent.
 * Transcription uses the existing Kompas Whisper recognizer and metering.
 */
import { downloadMedia } from "@/lib/whatsapp"
import { audioType, SpeechError, transcribeAudio } from "@/lib/kompasSpeech"
import { hashUserId } from "@/lib/sttLedger"

type Message = Record<string, unknown>
type VoiceResult =
  | { ok: true; message: Message; elapsedMs: number; characters: number }
  | { ok: false; reply: string }

type SpeechDeps = {
  download: typeof downloadMedia
  transcribe: typeof transcribeAudio
  hash: typeof hashUserId
}
const defaultDeps: SpeechDeps = { download: downloadMedia, transcribe: transcribeAudio, hash: hashUserId }

// The recorder uploads a complete OGG/Opus note after Send, not a stream.
// A size bound controls WhatsApp CDN memory, recognizer cost and serverless time.
export const MAX_WHATSAPP_VOICE_BYTES = 4 * 1024 * 1024
const MIN_WHATSAPP_VOICE_BYTES = 800
const MAX_TRANSCRIPT_LENGTH = 60_000

/**
 * STT punctuates tiny spoken commands and usually hears our brand "Kompas"
 * as the English word "compass". Normalize ONLY isolated commands; never
 * rewrite a sentence, document or interview answer.
 */
export function normalizeShortVoiceCommand(raw: string): string {
  const text = raw.trim()
  const phrase = text.replace(/[.!?\s]+$/g, "").trim().toLowerCase()
  if (phrase === "kompas" || phrase === "compass") return "kompas"
  if (["revert", "start", "help", "menu", "status"].includes(phrase)) return phrase
  const selection = phrase.match(/^(?:use|switch(?: to)?)\s+(one|two|three|four|five|six|seven|eight|nine|[1-9])$/)
  if (selection) {
    const n = ["one","two","three","four","five","six","seven","eight","nine"].indexOf(selection[1])
    return "use " + (n >= 0 ? n + 1 : selection[1])
  }
  return text
}

/** No transcript or audio content is emitted to application logs. */
export async function speechToWhatsAppText(
  msg: Message,
  owner: string,
  deps: SpeechDeps = defaultDeps,
): Promise<VoiceResult> {
  const audio = msg.audio as { id?: unknown; mime_type?: unknown } | undefined
  if (msg.type !== "audio" || !audio || typeof audio.id !== "string" || !/^[A-Za-z0-9_-]{3,256}$/.test(audio.id))
    return { ok: false, reply: "I couldn't read that WhatsApp voice note. Please resend it or use your keyboard microphone to dictate text." }
  if (!owner.trim()) return { ok: false, reply: "Link and verify your WhatsApp account before sending voice messages." }

  const mime = String(audio.mime_type || "audio/ogg").split(";")[0]!.trim().toLowerCase()
  if (!audioType(mime))
    return { ok: false, reply: "That audio format isn't supported yet. Send a WhatsApp voice note (OGG/Opus), or use your keyboard microphone to dictate." }

  const started = Date.now()
  let bytes: Buffer
  try {
    bytes = await deps.download(audio.id, MAX_WHATSAPP_VOICE_BYTES)
  } catch {
    return { ok: false, reply: "I couldn't download your voice note. Try a shorter recording, or use the WhatsApp keyboard microphone." }
  }
  if (bytes.byteLength < MIN_WHATSAPP_VOICE_BYTES) {
    return { ok: false, reply: "That voice note was too short to understand. Please record again." }
  }
  if (bytes.byteLength > MAX_WHATSAPP_VOICE_BYTES) {
    return { ok: false, reply: "That voice note is too large. Please split it into shorter recordings." }
  }
  try {
    // Speech purpose "transcribe" uses the pre-existing Kompas accuracy, admin
    // credentials, vocabulary guard, usage ledger and container sniffing.
    const result = await deps.transcribe({
      audio: new Uint8Array(bytes), mime, purpose: "transcribe",
      userHash: deps.hash(owner),
    })
    const spoken = normalizeShortVoiceCommand(result.text)
    if (!spoken) return { ok: false, reply: "I couldn't detect clear speech in the voice note. Please try again or dictate using your keyboard microphone." }
    if (spoken.length > MAX_TRANSCRIPT_LENGTH)
      return { ok: false, reply: "The spoken message is too long. Please send it as a few shorter notes." }
    return {
      ok: true,
      // Keep Meta's original message ID: the signed, de-duplicated webhook owns
      // delivery and command semantics. The reducer never sees raw audio.
      message: { ...msg, type: "text", text: { body: spoken }, mfitVoiceNote: true },
      characters: spoken.length,
      elapsedMs: Date.now() - started,
    }
  } catch (error) {
    if (error instanceof SpeechError) {
      if (error.code === "busy") return { ok: false, reply: "Speech recognition is busy. Please try that note again shortly." }
      if (error.code === "bad-audio") return { ok: false, reply: "I couldn't read the audio encoding. Please record a fresh WhatsApp voice note." }
      if (error.code === "too-large") return { ok: false, reply: "Please split the recording into shorter voice notes." }
    }
    return { ok: false, reply: "Speech recognition isn't available right now. You can use WhatsApp's keyboard microphone to dictate a text message instead." }
  }
}
