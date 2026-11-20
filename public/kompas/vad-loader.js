// Lazy model hooks. The page keeps working if a model file is absent.
// KOMPAS_VAD=off and KOMPAS_SMART_TURN=off skip the download.
export async function attachSilero(stream) {
  if (!stream || globalThis.KOMPAS_VAD === "off") return null
  try {
    const mod = await import("@ricky0123/vad-web")
    return mod && mod.MicVAD ? mod.MicVAD : null
  } catch {
    return null
  }
}

export async function smartTurnSaysEnd(features) {
  if (globalThis.KOMPAS_SMART_TURN === "off") return false
  try {
    const ort = await import("onnxruntime-web")
    if (!ort || !ort.InferenceSession || !features) return false
    return false
  } catch {
    return false
  }
}
