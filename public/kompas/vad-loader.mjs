// Browser model hooks. Weights stay on the CDN. A failed fetch returns to the
// lexical pause gate and never surfaces an error.
export const VAD_VERSION = "0.0.31"
export const ORT_VERSION = "1.22.0"
export const SMART_TURN_REVISION = "f766f81d3cfdf7737ac64aad813d91bbfd56bf93"
export const VAD_BASE = `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_VERSION}/dist/`
export const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
export const SMART_TURN_URL = `https://huggingface.co/pipecat-ai/smart-turn-v3/resolve/${SMART_TURN_REVISION}/smart-turn-v3.2-cpu.onnx`
export const QUESTION_PAUSE_MS = 700

const N_FFT = 400
const HOP = 160
const N_MELS = 80
const N_SAMPLES = 16000 * 8
const N_FRAMES = 800

let ortReady = null
let vadReady = null
let silero = null
let smartSession = null
let smartLoading = null
let melBank = null

export function vadEnabled(flag = globalThis.KOMPAS_VAD) {
  return flag !== "off"
}

export function smartTurnEnabled(flag = globalThis.KOMPAS_SMART_TURN) {
  return flag !== "off"
}

/** Lexical question gate. "unsure" is the only case that may consult smart-turn. */
export function lexicalTurn(text, pauseMs) {
  const raw = String(text || "").replace(/\s+/g, " ").trim()
  if (!Number.isFinite(pauseMs) || pauseMs < QUESTION_PAUSE_MS) return "wait"
  if (/right\?\s*$/i.test(raw)) return "wait"
  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length < 4) return "wait"
  if (/^(?:hi|hello|hey|thanks|thank you|can you hear me|are you there)\b/i.test(raw)) return "wait"
  if (/^(?:i(?:'m| am)?|my |we )\b/i.test(raw) && !/\b(?:can you|could you|tell me|what do you|how do you|why do you)\b/i.test(raw)) return "wait"
  const clear = /\?\s*$/.test(raw)
    || /^(?:what|how|why|when|where|who|which|can|could|would|do|did|have|are|is|tell|walk)\b/i.test(raw)
    || /\b(?:tell me about|walk me through)\b/i.test(raw)
  return clear ? "fire" : "unsure"
}

export async function runSmartTurnOrLexical(opts) {
  const decision = lexicalTurn(opts && opts.text, opts && opts.pauseMs)
  if (decision !== "unsure") return decision
  const flag = opts && Object.prototype.hasOwnProperty.call(opts, "smartTurnFlag") ? opts.smartTurnFlag : globalThis.KOMPAS_SMART_TURN
  if (!smartTurnEnabled(flag)) return "wait"
  try {
    const ended = typeof opts.load === "function" ? await opts.load() : await smartTurnSaysEnd(opts && opts.audio)
    return ended ? "fire" : "wait"
  } catch {
    return "wait"
  }
}

function loadScript(src) {
  return new Promise((resolve) => {
    try {
      if (typeof document === "undefined") return resolve(false)
      const prior = document.querySelector(`script[data-kompas-src="${src}"]`)
      if (prior && prior.dataset.ready === "1") return resolve(true)
      const sc = document.createElement("script")
      sc.src = src
      sc.async = true
      sc.dataset.kompasSrc = src
      sc.onload = () => { sc.dataset.ready = "1"; resolve(true) }
      sc.onerror = () => { try { sc.remove() } catch {} resolve(false) }
      document.head.appendChild(sc)
    } catch {
      resolve(false)
    }
  })
}

function loadOrt() {
  if (globalThis.ort && globalThis.ort.InferenceSession) return Promise.resolve(true)
  if (ortReady) return ortReady
  ortReady = loadScript(ORT_BASE + "ort.wasm.min.js").then((ok) => {
    if (!ok || !globalThis.ort) { ortReady = null; return false }
    try {
      globalThis.ort.env.wasm.wasmPaths = ORT_BASE
      globalThis.ort.env.wasm.numThreads = 1
    } catch {}
    return true
  })
  return ortReady
}

async function cachedBytes(url) {
  try {
    if (typeof caches !== "undefined" && caches.open) {
      const box = await caches.open("kompas-models")
      const hit = await box.match(url)
      if (hit) return new Uint8Array(await hit.arrayBuffer())
    }
  } catch {}
  const res = await fetch(url)
  if (!res.ok) throw new Error("cdn")
  const buf = await res.arrayBuffer()
  try {
    if (typeof caches !== "undefined" && caches.open) {
      const box = await caches.open("kompas-models")
      await box.put(url, new Response(buf.slice(0), { headers: { "content-type": "application/octet-stream" } }))
    }
  } catch {}
  return new Uint8Array(buf)
}

function hzToMel(freq) {
  const fSp = 200 / 3
  const minLogMel = 1000 / fSp
  const logstep = Math.log(6.4) / 27
  if (freq >= 1000) return minLogMel + Math.log(freq / 1000) / logstep
  return freq / fSp
}

function melToHz(mel) {
  const fSp = 200 / 3
  const minLogMel = 1000 / fSp
  const logstep = Math.log(6.4) / 27
  if (mel >= minLogMel) return 1000 * Math.exp(logstep * (mel - minLogMel))
  return fSp * mel
}

function melFilters() {
  if (melBank) return melBank
  const bins = N_FFT / 2 + 1
  const points = N_MELS + 2
  const melMin = hzToMel(0)
  const melMax = hzToMel(8000)
  const hz = []
  for (let i = 0; i < points; i++) hz.push(melToHz(melMin + (melMax - melMin) * i / (points - 1)))
  const bank = Array.from({ length: N_MELS }, () => new Float32Array(bins))
  for (let i = 0; i < N_MELS; i++) {
    const enorm = 2 / (hz[i + 2] - hz[i])
    for (let k = 0; k < bins; k++) {
      const freq = k * 16000 / N_FFT
      const lower = (freq - hz[i]) / (hz[i + 1] - hz[i])
      const upper = (hz[i + 2] - freq) / (hz[i + 2] - hz[i + 1])
      const w = Math.max(0, Math.min(lower, upper))
      bank[i][k] = w * enorm
    }
  }
  melBank = bank
  return bank
}

function sampleAt(buf, index) {
  const n = buf.length
  let j = index - (N_FFT / 2)
  if (j < 0) j = -j
  else if (j >= n) j = (n - 1) - (j - (n - 1))
  if (j < 0 || j >= n) return 0
  return buf[j]
}

/** Whisper log-mel for 8 seconds of 16 kHz audio. Shape [80, 800], row-major. */
export function whisperFeatures(audio) {
  const src = audio instanceof Float32Array ? audio : new Float32Array(audio || [])
  const buf = new Float32Array(N_SAMPLES)
  if (src.length >= N_SAMPLES) buf.set(src.subarray(src.length - N_SAMPLES))
  else buf.set(src, N_SAMPLES - src.length)
  const window = new Float32Array(N_FFT)
  for (let i = 0; i < N_FFT; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N_FFT))
  const bank = melFilters()
  const spec = new Float32Array(N_MELS * N_FRAMES)
  let peak = -Infinity
  for (let frame = 0; frame < N_FRAMES; frame++) {
    const start = frame * HOP
    const power = new Float32Array(N_FFT / 2 + 1)
    let audible = false
    for (let t = 0; t < N_FFT; t++) if (sampleAt(buf, start + t) !== 0) { audible = true; break }
    if (audible) {
      for (let k = 0; k <= N_FFT / 2; k++) {
        let re = 0
        let im = 0
        const ang = (-2 * Math.PI * k) / N_FFT
        for (let t = 0; t < N_FFT; t++) {
          const v = sampleAt(buf, start + t) * window[t]
          re += v * Math.cos(ang * t)
          im += v * Math.sin(ang * t)
        }
        power[k] = re * re + im * im
      }
    }
    for (let m = 0; m < N_MELS; m++) {
      let sum = 0
      const row = bank[m]
      for (let k = 0; k < row.length; k++) sum += row[k] * power[k]
      const log = Math.log10(Math.max(sum, 1e-10))
      spec[m * N_FRAMES + frame] = log
      if (log > peak) peak = log
    }
  }
  const floor = peak - 8
  for (let i = 0; i < spec.length; i++) spec[i] = (Math.max(spec[i], floor) + 4) / 4
  return spec
}

export async function prepareSession() {
  if (!smartTurnEnabled()) return null
  if (smartSession) return smartSession
  if (smartLoading) return smartLoading
  smartLoading = (async () => {
    try {
      const ok = await loadOrt()
      if (!ok) return null
      const bytes = await cachedBytes(SMART_TURN_URL)
      smartSession = await globalThis.ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] })
      return smartSession
    } catch {
      return null
    } finally {
      smartLoading = null
    }
  })()
  return smartLoading
}

export async function smartTurnSaysEnd(audio) {
  if (!smartTurnEnabled() || !audio || !audio.length) return false
  try {
    const session = smartSession || await prepareSession()
    if (!session) return false
    const features = whisperFeatures(audio)
    const inputName = (session.inputNames && session.inputNames[0]) || "input_features"
    const tensor = new globalThis.ort.Tensor("float32", features, [1, N_MELS, N_FRAMES])
    const out = await session.run({ [inputName]: tensor })
    const key = (session.outputNames && session.outputNames[0]) || Object.keys(out)[0]
    const value = out[key] && out[key].data ? Number(out[key].data[0]) : 0
    return value > 0.5
  } catch {
    return false
  }
}

export async function attachSilero(stream, hooks) {
  if (!stream || !vadEnabled()) return null
  try {
    const ortOk = await loadOrt()
    if (!ortOk) return null
    if (!vadReady) {
      const ok = await loadScript(VAD_BASE + "bundle.min.js")
      vadReady = ok && globalThis.vad && globalThis.vad.MicVAD ? true : null
    }
    const MicVAD = globalThis.vad && globalThis.vad.MicVAD
    if (!MicVAD) return null
    if (silero && silero.destroy) { try { await silero.destroy() } catch {} silero = null }
    const handle = await MicVAD.new({
      model: "v5",
      redemptionMs: QUESTION_PAUSE_MS,
      minSpeechMs: 160,
      getStream: async () => stream,
      pauseStream: async () => {},
      resumeStream: async () => stream,
      baseAssetPath: VAD_BASE,
      onnxWASMBasePath: ORT_BASE,
      onSpeechStart: () => { try { hooks && hooks.onSpeechStart && hooks.onSpeechStart() } catch {} },
      onSpeechEnd: (audio) => { try { hooks && hooks.onSpeechEnd && hooks.onSpeechEnd(audio) } catch {} },
    })
    await handle.start()
    silero = handle
    try { globalThis.__kompasSileroLive = true } catch {}
    return handle
  } catch {
    try { globalThis.__kompasSileroLive = false } catch {}
    return null
  }
}

export async function releaseModels() {
  try { if (silero && silero.pause) await silero.pause() } catch {}
  try { if (silero && silero.destroy) await silero.destroy() } catch {}
  silero = null
  try { globalThis.__kompasSileroLive = false } catch {}
}
