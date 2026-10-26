/** MIME of the verified container sent to the recognizer, not the untrusted browser header. */
const MIME_BY_CONTAINER: Readonly<Record<string, string>> = {
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  flac: "audio/flac",
}

/** Keep the existing declared type only when a container is not recognized. */
export function uploadMimeForContainer(container: string, declaredMime: string): string {
  return MIME_BY_CONTAINER[container] ?? declaredMime.split(";")[0]!.trim().toLowerCase()
}
