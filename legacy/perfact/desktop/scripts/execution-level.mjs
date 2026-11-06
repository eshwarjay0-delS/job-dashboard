// Normal Kompas launches must not request administrator rights. Electron
// ships asInvoker. The packaged exe used to rewrite that to highestAvailable,
// which put a UAC consent prompt on every start. asInvoker leaves the
// unknown-publisher SmartScreen warning, if Windows shows one, as a signing
// problem. This function does not sign the binary.

export function asInvokerManifest(xml) {
  const text = String(xml ?? "");
  if (!/requestedExecutionLevel/i.test(text)) return text;
  return text.replace(/(<requestedExecutionLevel\s+level=")[^"]*(")/i, "$1asInvoker$2");
}
