// Reproducible MarketFit voice fixes layered on the upstream Kompas copy.
// Fail on source drift instead of silently dropping a fix during sync.
const replacements = [
  [
    "let transcript = [];            // [{ who, text, at }]",
    "let transcript = [];            // [{ who, text, at }]\nlet transcriptionEpoch = 0;\nlet transcriptionOrder = Promise.resolve();"
  ],
  [
    "  current = s;\n",
    "  transcriptionEpoch++;\n  transcriptionOrder = Promise.resolve();\n  current = s;\n"
  ],
  [
    "if (running) stop(false); await saveRunTranscript();",
    "if (running) await stop(false); await saveRunTranscript();"
  ],
  [
    "function stop(say = true) {",
    "async function stop(say = true) {"
  ],
  [
    "  for (const c of captures.slice()) stopSource(c.who);\n  if (say) status(\"Stopped — transcript saved to this session.\");\n  saveRunTranscript();",
    "  const finishing = captures.slice().map(c => stopSource(c.who));\n  $(\"startBtn\").disabled = true;\n  await Promise.allSettled([...finishing, ...finals]);\n  $(\"startBtn\").disabled = false;\n  if (say) status(\"Stopped — finished processing captured speech.\");\n  await saveRunTranscript();"
  ],
  [
    "noiseSuppression: false",
    "noiseSuppression: true"
  ],
  [
    "  const ctx = await getCtx();\n  const src = ctx.createMediaStreamSource(stream);",
    "  if (!running) { stream.getTracks().forEach(t => t.stop()); owner?.getTracks().forEach(t => t.stop()); return; }\n  const ctx = await getCtx();\n  const src = ctx.createMediaStreamSource(stream);"
  ],
  [
    "function stopSource(who) {\n  for",
    "function stopSource(who) {\n  const finishing = [];\n  for"
  ],
  [
    "    try { if (cap.rec && cap.rec.state !== \"inactive\") { cap.rec.onstop = null; cap.rec.stop(); } } catch {}",
    "    finishing.push(endSegment(cap, cap.voiced, false));"
  ],
  [
    "cap.owner && cap.owner.getAudioTracks().forEach(t => t.stop());",
    "cap.owner && cap.owner.getTracks().forEach(t => t.stop());"
  ],
  [
    "  captures = captures.filter(c => c.who !== who);\n}",
    "  captures = captures.filter(c => c.who !== who);\n  if (who === \"Them\") displayVideo = null;\n  return Promise.allSettled(finishing);\n}"
  ],
  [
    "function endSegment(cap, keep) {",
    "function endSegment(cap, keep, restart = true) {"
  ],
  [
    "  startSegment(cap);                  // the next phrase starts recording immediately — no gap",
    "  const epoch = transcriptionEpoch;\n  const prompt = whisperPrompt();\n  if (restart && !cap.stopped) startSegment(cap);\n  else cap.rec = null;"
  ],
  [
    "    if (blob.size > 2000) transcribe(blob, cap.who, { final: true }).then(settle, settle); else settle();",
    "    if (blob.size) transcribe(blob, cap.who, { final: true, epoch, prompt }).then(settle, settle); else settle();"
  ],
  [
    "  setTimeout(settle, 6000);           // never let a stuck recorder hold AI Answer",
    "  const watchdog = setTimeout(settle, 22000);\n  done.then(() => clearTimeout(watchdog));"
  ],
  [
    "const HALLU = /^(you|thank you|thanks|thank you very much|thank you so much|thanks for watching|thank you for watching|bye|bye bye|okay|ok|so|um|uh|hmm|mm|mhm|yeah|yes|no|right)[.!?,]*$/i;",
    "// Speech activity gates silence before upload; short replies are meaningful speech.\nconst HALLU = /^(thanks for watching|thank you for watching)[.!?,]*$/i;"
  ],
  [
    "let promptCache = { id: null, text: \"\" };\nfunction whisperPrompt() {\n  const s = current || {};\n  if (promptCache.id === s.id) return promptCache.text;\n  const terms = [...new Set((`${s.role || \"\"} ${s.jd || \"\"} ${(s.resume || \"\").slice(0, 3000)}`.match(/\\b[A-Z][A-Za-z0-9+#./-]{1,}\\b/g) || []))].slice(0, 45);\n  promptCache = { id: s.id, text: `Job interview for ${s.role || \"a technical role\"}. ${terms.join(\", \")}.`.slice(0, 550) };\n  return promptCache.text;\n}\n",
    "function whisperPrompt() {\n  const s = current || {};\n  const learned = (s.voiceVocabulary || []).filter(t => typeof t === \"string\").slice(-40);\n  const terms = [...new Set((`${s.role || \"\"} ${s.jd || \"\"} ${(s.resume || \"\").slice(0, 3000)}`.match(/\\b[A-Z][A-Za-z0-9+#./-]{1,}\\b/g) || []))].slice(0, 45);\n  return `Vocabulary: ${[...learned, ...terms].join(\", \")}.`.slice(0, 550);\n}\n"
  ],
  [
    "async function transcribe(blob, who, opt) {\n  const cap = opt.cap; if (cap) cap.inflight++;\n  try {\n    const t0 = performance.now();\n    const res = await fetch(\"/api/transcribe\", { method: \"POST\",\n      headers: { \"content-type\": \"application/octet-stream\", \"x-audio-mime\": blob.type || \"audio/webm\", \"x-whisper-prompt\": encodeURIComponent(whisperPrompt()) }, body: blob });\n    if (res.status === 429) { interimOffUntil = performance.now() + 60000; if (opt.final) status(\"Transcription is rate-limited for a moment — keeping final phrases only.\", \"err\"); return; }\n    if (!res.ok) { if (opt.final) status(`Transcription error ${res.status}.`, \"err\"); return; }\n    const { text } = await res.json();\n    const clean = cleanTranscript(text);\n    if (!clean) return;\n    if (opt.final) onTranscript(who, clean, performance.now() - t0);\n    else if (running) showCaption(who, clean, true);\n  } catch {} finally { if (cap) cap.inflight--; }\n}\n",
    "async function transcribe(blob, who, opt) {\n  const epoch = opt.epoch ?? transcriptionEpoch;\n  const cap = opt.cap; if (cap) cap.inflight++;\n  // Start requests concurrently, but commit results in capture order.\n  const previous = transcriptionOrder;\n  let release;\n  if (opt.final) transcriptionOrder = new Promise(resolve => { release = resolve; });\n  const ctl = new AbortController();\n  const timeout = setTimeout(() => ctl.abort(), 18000);\n  let clean = \"\", failure = \"\";\n  try {\n    const res = await fetch(\"/api/transcribe\", { method: \"POST\", signal: ctl.signal,\n      headers: { \"content-type\": \"application/octet-stream\", \"x-audio-mime\": blob.type || \"audio/webm\", \"x-whisper-prompt\": encodeURIComponent(opt.prompt ?? whisperPrompt()) }, body: blob });\n    if (res.status === 429) {\n      interimOffUntil = performance.now() + 60000;\n      failure = \"Transcription rate limit reached. This phrase was not transcribed; please repeat it or type it.\";\n    } else if (!res.ok) failure = `Transcription error ${res.status}. Please repeat the phrase or type it.`;\n    else clean = cleanTranscript((await res.json()).text);\n  } catch (e) {\n    failure = e.name === \"AbortError\" ? \"Transcription timed out. Please repeat the phrase or type it.\" : \"Could not transcribe audio. Check your connection, then repeat the phrase.\";\n  } finally {\n    clearTimeout(timeout);\n    if (cap) cap.inflight--;\n  }\n  try {\n    if (opt.final) await previous;\n    if (epoch !== transcriptionEpoch) return;\n    if (failure && opt.final) status(failure, \"err\");\n    if (!clean) return;\n    if (opt.final) onTranscript(who, clean);\n    else if (running) showCaption(who, clean, true);\n  } finally { if (release) release(); }\n}\n"
  ],
  [
    "function appendDrawer(who, text) {",
    "function appendDrawer(who, text, entry) {"
  ],
  [
    "  body.append(d); body.scrollTop = body.scrollHeight;",
    "  if (entry) {\n    const edit = document.createElement(\"button\"); edit.className = \"mini\"; edit.textContent = \"Correct\";\n    edit.setAttribute(\"aria-label\", \"Correct transcript: \" + text);\n    edit.onclick = () => {\n      if (d.querySelector(\"textarea\")) return;\n      const input = document.createElement(\"textarea\"); input.value = entry.text;\n      input.setAttribute(\"aria-label\", \"Corrected transcript\");\n      const vocabulary = document.createElement(\"input\"); vocabulary.placeholder = \"Terms to remember, comma-separated (optional)\";\n      vocabulary.setAttribute(\"aria-label\", \"Vocabulary for this session\");\n      const save = document.createElement(\"button\"); save.className = \"mini\"; save.textContent = \"Save correction\";\n      const cancel = document.createElement(\"button\"); cancel.className = \"mini\"; cancel.textContent = \"Cancel\";\n      cancel.onclick = () => renderDrawer();\n      save.onclick = () => {\n        const corrected = input.value.replace(/\\s+/g, \" \").trim().slice(0, 4000);\n        if (!corrected) return;\n        const original = entry.text; entry.text = corrected;\n        const event = sessionLog.find(e => e.t === \"line\" && e.seq === entry.seq);\n        if (event) { event.originalText ??= original; event.text = corrected; }\n        if (current) {\n          const terms = vocabulary.value.split(\",\").map(t => t.trim().slice(0, 60)).filter(Boolean);\n          current.voiceVocabulary = [...new Set([...(current.voiceVocabulary || []), ...terms])].slice(-40);\n          saveSession(current);\n        }\n        logEvent({ t: \"correction\", seq: entry.seq, original, text: corrected });\n        renderDrawer(); saveRunTranscript();\n        status(\"Correction saved. Added vocabulary will guide future Whisper phrases in this session.\");\n      };\n      d.append(input, vocabulary, save, cancel); input.focus();\n    };\n    d.append(edit);\n  }\n  body.append(d); body.scrollTop = body.scrollHeight;"
  ],
  [
    "transcript.forEach(t => appendDrawer(t.who, t.text));",
    "transcript.forEach(t => appendDrawer(t.who, t.text, t));"
  ],
  [
    "  text = fixTerms(text);\n",
    "  const originalText = text;\n  // Keep the recognised words intact; approved vocabulary guides the next recognition.\n"
  ],
  [
    "  logEvent({ t: \"line\", who, text });\n  appendDrawer(who, text);",
    "  logEvent({ t: \"line\", who, text, originalText, seq: heardSeq });\n  appendDrawer(who, text, transcript[transcript.length - 1]);"
  ],
  [
    "  if (!flushing) scheduleAuto();",
    "  if (running && !flushing) scheduleAuto();"
  ],
  [
    "let captures = [];",
    "let sourceGeneration = { You: 0, Them: 0 };\nlet captures = [];"
  ],
  [
    "async function startMic() {\n",
    "async function startMic() {\n  const generation = sourceGeneration.You;\n"
  ],
  [
    "await attachSource(mic, \"You\", null);",
    "await attachSource(mic, \"You\", null, generation);"
  ],
  [
    "async function startSys() {\n",
    "async function startSys() {\n  const generation = sourceGeneration.Them;\n"
  ],
  [
    "    displayVideo = disp.getVideoTracks()[0] || null;\n    await attachSource(new MediaStream(audio), \"Them\", disp);",
    "    await attachSource(new MediaStream(audio), \"Them\", disp, generation);"
  ],
  [
    "async function attachSource(stream, who, owner) {\n  if (!running) { stream.getTracks().forEach(t => t.stop()); owner?.getTracks().forEach(t => t.stop()); return; }\n  const ctx = await getCtx();",
    "async function attachSource(stream, who, owner, generation = sourceGeneration[who]) {\n  const stale = () => !running || generation !== sourceGeneration[who] || !srcOn[who === \"You\" ? \"mic\" : \"sys\"] || captures.some(c => c.who === who);\n  const releaseTracks = () => { stream.getTracks().forEach(t => t.stop()); owner?.getTracks().forEach(t => t.stop()); };\n  if (stale()) { releaseTracks(); return; }\n  let ctx;\n  try { ctx = await getCtx(); } catch (error) { releaseTracks(); throw error; }\n  if (stale()) { releaseTracks(); return; }\n  if (who === \"Them\") displayVideo = owner?.getVideoTracks()[0] || null;"
  ],
  [
    "function stopSource(who) {\n",
    "function stopSource(who) {\n  sourceGeneration[who]++;\n"
  ],
  [
    "  const finishing = captures.slice().map(c => stopSource(c.who));",
    "  const finishing = [stopSource(\"You\"), stopSource(\"Them\")];"
  ],
  [
    "async function start() {\n",
    "async function start() {\n  const generation = sourceGeneration.You;\n"
  ],
  [
    "  if (srcOn.mic) await startMic();\n  if (srcOn.sys)",
    "  if (srcOn.mic) await startMic();\n  if (!running || generation !== sourceGeneration.You) return;\n  if (srcOn.sys)"
  ],
  [
    "} catch (e) { captureErrors.push(\"Mic: \"",
    "} catch (e) { if (generation !== sourceGeneration.You || !running) return; captureErrors.push(\"Mic: \""
  ],
  [
    "} catch (e) { captureErrors.push(\"Call audio: \"",
    "} catch (e) { if (generation !== sourceGeneration.Them || !running) return; captureErrors.push(\"Call audio: \""
  ],
  [
    "  const track = stream.getAudioTracks()[0];\n  if (track) track.addEventListener(\"ended\",",
    "  const tracks = owner ? owner.getTracks() : stream.getAudioTracks();\n  for (const track of tracks) track.addEventListener(\"ended\","
  ]
];
export function patchKompasVoice(source) {
  if (source.includes("// marketfit-voice-v1")) return source;
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error("Kompas voice patch needs review near: " + before.slice(0, 80));
    source = source.replace(before, () => after);
  }
  return "// marketfit-voice-v1\n" + source;
}
