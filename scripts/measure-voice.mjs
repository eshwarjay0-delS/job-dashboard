// Measures the voice matching in src/lib/kompasVoice.ts on a folder of recordings, and prints the two settings it uses.
//
//   node scripts/measure-voice.mjs <folder> [how many per voice] [labels.json,more-labels.json]
//
// The folder holds WAV files of single sentences by two or more voices. Whose voice a file is comes from the label files
// when they are given (each a list of { id, voice }, where id is the file's name without ".wav"); otherwise from the name:
// the part after the last "-" when that part is letters ("intro-03-ru.wav" is voice "ru"), otherwise "base". ffmpeg must be
// on the path: it turns each file into one channel at 16,000 samples a second.
//
// The mistake it prevents: settings chosen by feel. SCALE (how much one voice differs from itself, number by number) and
// SAME (how close two prints must be to count as one voice) are worked out on HALF of the recordings and every result below
// them is measured on the OTHER half, so the settings are not marked on their own homework.
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const V = await import(pathToFileURL(path.resolve(import.meta.dirname, "../src/lib/kompasVoice.ts")).href)
const folder = process.argv[2], perVoice = Number(process.argv[3]) || 240
if (!folder) { console.log("Give the folder of recordings."); process.exit(1) }

const labels = new Map()
for (const file of (process.argv[4] || "").split(",").filter(Boolean)) {
  for (const row of JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""))) if (row && row.id && row.voice) labels.set(String(row.id), String(row.voice))
}
const voiceOf = (file) => { const known = labels.get(file.replace(/\.wav$/i, "")); if (known) return known; const m = /-([a-z]+)\.wav$/i.exec(file); return m ? m[1].toLowerCase() : "base" }
const sentenceOf = (file) => file.replace(/-[a-z]+\.wav$/i, "").replace(/\.wav$/i, "")
const byVoice = new Map()
for (const file of readdirSync(folder).filter(f => /\.wav$/i.test(f)).sort()) {
  const list = byVoice.get(voiceOf(file)) ?? []
  if (list.length < perVoice) { list.push(file); byVoice.set(voiceOf(file), list) }
}

function samplesOf(file) {
  const out = spawnSync("ffmpeg", ["-v", "error", "-i", path.join(folder, file), "-ac", "1", "-ar", String(V.VOICE_RATE), "-f", "f32le", "-"], { maxBuffer: 64 * 1024 * 1024 })
  if (out.status !== 0 || !out.stdout.length) return null
  const whole = new Float32Array(out.stdout.buffer, out.stdout.byteOffset, Math.floor(out.stdout.length / 4)).slice()
  // CUT_SECONDS=2.5 keeps only the start of each sentence: a line in a real conversation is often that short.
  const cut = Number(process.env.CUT_SECONDS) || 0
  return cut > 0 ? whole.subarray(0, Math.min(whole.length, Math.round(cut * V.VOICE_RATE))) : whole
}

const all = []
for (const [voice, files] of byVoice) {
  let kept = 0, seconds = 0
  for (const file of files) {
    const samples = samplesOf(file)
    if (!samples) continue
    const print = V.voiceprintOf(samples)
    if (!print) continue
    all.push({ voice, sentence: sentenceOf(file), print, seconds: samples.length / V.VOICE_RATE })
    kept++; seconds += samples.length / V.VOICE_RATE
  }
  console.log(`voice "${voice}": ${kept} sentences with a print, ${(seconds / Math.max(1, kept)).toFixed(1)} s each on average`)
}
const voices = [...byVoice.keys()]
if (voices.length < 2) { console.log("Two voices are needed to measure anything."); process.exit(1) }

// Half to set, half to test. Split by sentence, so the same words are not on both sides.
const sentences = [...new Set(all.map(a => a.sentence))].sort()
const settingSide = new Set(sentences.filter((_, i) => i % 2 === 0))
const setting = all.filter(a => settingSide.has(a.sentence)), testing = all.filter(a => !settingSide.has(a.sentence))

// SCALE: for each number in a print, how much it moves within one voice (pooled over the voices).
const dims = V.SCALE.length
const scale = Array.from({ length: dims }, (_, i) => {
  let sum = 0, n = 0
  for (const voice of voices) {
    const values = setting.filter(a => a.voice === voice).map(a => a.print.dims[i]).filter(Number.isFinite)
    if (values.length < 2) continue
    const mean = values.reduce((x, y) => x + y, 0) / values.length
    sum += values.reduce((x, y) => x + (y - mean) ** 2, 0); n += values.length - 1
  }
  return n ? Math.sqrt(sum / n) : 1
})
console.log("\nSCALE measured on the setting half (paste into kompasVoice.ts):")
console.log("  " + scale.slice(0, 12).map(n => n.toFixed(2)).join(", ") + ",")
console.log("  " + scale.slice(12, 24).map(n => n.toFixed(2)).join(", ") + ",")
console.log("  " + scale.slice(24).map(n => n.toFixed(3)).join(", ") + ",")

// Distances with the SCALE that is in the file now (run again after pasting to see the settings as shipped).
const far = (a, b) => V.voiceDistance(a.print, b.print)
const pairs = (list, same) => { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if ((list[i].voice === list[j].voice) === same) out.push(far(list[i], list[j])); return out.sort((a, b) => a - b) }
const at = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1)))]
const sameSet = pairs(setting, true), otherSet = pairs(setting, false)
console.log(`\nwith the SCALE in the file: one voice against itself, middle ${at(sameSet, 0.5).toFixed(2)}, 95 in 100 below ${at(sameSet, 0.95).toFixed(2)}`)
console.log(`                            two different voices,        middle ${at(otherSet, 0.5).toFixed(2)}, 95 in 100 above ${at(otherSet, 0.05).toFixed(2)}`)
// SAME: the cut that gets the fewest pairs wrong on the setting half.
let bestCut = 0, bestWrong = Infinity
for (let cut = 0.5; cut <= 8; cut += 0.05) {
  const wrong = sameSet.filter(d => d > cut).length / sameSet.length + otherSet.filter(d => d <= cut).length / otherSet.length
  if (wrong < bestWrong) { bestWrong = wrong; bestCut = cut }
}
console.log(`SAME that gets the fewest pairs wrong on the setting half: ${bestCut.toFixed(2)} (in the file: ${V.SAME})`)

// The test half, with the settings as they are in the file.
console.log("\nON THE TEST HALF, with the settings in the file:")
const sameTest = pairs(testing, true), otherTest = pairs(testing, false)
console.log(`  two sentences by one voice taken for one voice: ${(100 * sameTest.filter(d => d <= V.SAME).length / sameTest.length).toFixed(1)}% of ${sameTest.length} pairs`)
console.log(`  two sentences by two voices taken for two:      ${(100 * otherTest.filter(d => d > V.SAME).length / otherTest.length).toFixed(1)}% of ${otherTest.length} pairs`)
for (const me of voices) {
  const mine = testing.filter(a => a.voice === me), others = testing.filter(a => a.voice !== me)
  if (mine.length < 8) continue
  // The person reads for about ten seconds: the first three sentences.
  const print = V.blend(mine.slice(0, 3).map(a => a.print))
  const rest = mine.slice(3)
  const iAmMe = rest.filter(a => V.voiceDistance(a.print, print) <= V.SAME).length, theyAreNot = others.filter(a => V.voiceDistance(a.print, print) > V.SAME).length
  // A meeting: the two voices taking turns, labelled line by line.
  const otherVoices = voices.filter(v => v !== me)
  const turns = []
  for (let i = 0; i < Math.min(rest.length, 40); i++) {
    turns.push({ id: `m${i}`, print: rest[i].print, who: me })
    for (const v of otherVoices) { const line = testing.filter(a => a.voice === v)[i]; if (line) turns.push({ id: `${v}${i}`, print: line.print, who: v }) }
  }
  const named = V.speakersOf(turns, print)
  const right = turns.filter(t => (named[t.id] === V.YOU) === (t.who === me)).length
  // Were the other people told apart from each other? Each given name is counted for the voice it was mostly used for.
  const names = new Map()
  for (const t of turns) { if (t.who === me) continue; const of = names.get(named[t.id]) ?? new Map(); of.set(t.who, (of.get(t.who) ?? 0) + 1); names.set(named[t.id], of) }
  let pure = 0, othersTotal = 0
  for (const of of names.values()) { pure += Math.max(...of.values()); for (const n of of.values()) othersTotal += n }
  console.log(`  "${me}" as the person: own lines called You ${(100 * iAmMe / rest.length).toFixed(1)}% of ${rest.length}; other voices not called You ${(100 * theyAreNot / others.length).toFixed(1)}% of ${others.length}; in a meeting of ${voices.length}, You-or-not right on ${(100 * right / turns.length).toFixed(1)}% of ${turns.length} lines; the ${otherVoices.length} others got ${names.size} names, ${(100 * pure / Math.max(1, othersTotal)).toFixed(1)}% of their lines under the right one`)
}
