#!/usr/bin/env node
/**
 * Offline Kompas ASR regression scorer. No network access or external LLM required.
 * Input: local JSONL with consented:true, reference, hypothesis, and optional
 * technicalTerms, conditions, editCount, speakerCorrect, latencyMs.
 * Output: aggregate metrics only. Never commit real reference transcripts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MAX_WORDS = 2048;
export function words(text, strict = false) {
  const source = String(text).normalize('NFC').trim();
  const prepared = strict ? source : source.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ');
  return prepared ? prepared.split(/[\s\u200B]+/u).filter(Boolean) : [];
}

export function alignment(reference, hypothesis) {
  const n = reference.length, m = hypothesis.length;
  if (n > MAX_WORDS || m > MAX_WORDS) throw new Error('clip exceeds word limit');
  const costs = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  const ops = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { costs[i][0] = i; ops[i][0] = 2; }
  for (let j = 1; j <= m; j++) { costs[0][j] = j; ops[0][j] = 3; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const same = reference[i - 1] === hypothesis[j - 1];
    const diag = costs[i - 1][j - 1] + (same ? 0 : 1);
    const del = costs[i - 1][j] + 1;
    const ins = costs[i][j - 1] + 1;
    if (diag <= del && diag <= ins) { costs[i][j] = diag; ops[i][j] = same ? 0 : 1; }
    else if (del <= ins) { costs[i][j] = del; ops[i][j] = 2; }
    else { costs[i][j] = ins; ops[i][j] = 3; }
  }
  const result = { substitutions: 0, deletions: 0, insertions: 0, referenceWords: n };
  let i = n, j = m;
  while (i || j) {
    const op = ops[i][j];
    if (op === 0) { i--; j--; }
    else if (op === 1) { result.substitutions++; i--; j--; }
    else if (op === 2) { result.deletions++; i--; }
    else { result.insertions++; j--; }
  }
  return result;
}

const ratio = (a, b) => b ? Number((a / b).toFixed(6)) : null;
const percentile = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1] : null;
function phraseOccurrences(haystack, needle) {
  if (!needle.length) return 0;
  let matches = 0;
  // Count actual term occurrences, not just whether a term appears anywhere.
  // Non-overlapping occurrences prevent a repeated token from being reused twice.
  for (let i = 0; i <= haystack.length - needle.length;) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { matched = false; break; }
    }
    if (matched) { matches++; i += needle.length; }
    else i++;
  }
  return matches;
}

export function score(rows) {
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error('invalid clip count');
  const c = { clips: rows.length, referenceWords: 0, rawReferenceWords: 0,
    substitutions: 0, deletions: 0, insertions: 0, rawErrors: 0,
    technicalTerms: 0, technicalTermsHeard: 0, editsObserved: 0, zeroEdits: 0,
    speakersObserved: 0, speakersCorrect: 0, silenceClips: 0, silenceFalsePositiveClips: 0 };
  const latencies = [];
  for (const row of rows) {
    if (!row || row.consented !== true) throw new Error('evaluation consent required');
    if (typeof row.reference !== 'string' || typeof row.hypothesis !== 'string' ||
      row.reference.length > 20000 || row.hypothesis.length > 20000) throw new Error('invalid transcript');
    const ref = words(row.reference), hyp = words(row.hypothesis);
    const a = alignment(ref, hyp);
    const raw = alignment(words(row.reference, true), words(row.hypothesis, true));
    c.referenceWords += a.referenceWords;
    c.rawReferenceWords += raw.referenceWords;
    c.substitutions += a.substitutions;
    c.deletions += a.deletions;
    c.insertions += a.insertions;
    c.rawErrors += raw.substitutions + raw.deletions + raw.insertions;
    if (!ref.length) { c.silenceClips++; if (hyp.length) c.silenceFalsePositiveClips++; }
    const terms = row.technicalTerms ?? [];
    if (!Array.isArray(terms) || terms.length > 100) throw new Error('invalid technical terms');
    for (const term of terms) {
      if (typeof term !== 'string' || term.length > 200) throw new Error('invalid technical term');
      const t = words(term);
      const expected = phraseOccurrences(ref, t);
      const recognized = phraseOccurrences(hyp, t);
      c.technicalTerms += expected;
      c.technicalTermsHeard += Math.min(expected, recognized);
    }
    if (row.editCount !== undefined) {
      if (!Number.isSafeInteger(row.editCount) || row.editCount < 0) throw new Error('invalid edit count');
      c.editsObserved++;
      if (row.editCount === 0) c.zeroEdits++;
    }
    if (row.speakerCorrect !== undefined) {
      if (typeof row.speakerCorrect !== 'boolean') throw new Error('invalid speaker adjudication');
      c.speakersObserved++;
      if (row.speakerCorrect) c.speakersCorrect++;
    }
    if (row.latencyMs !== undefined) {
      if (typeof row.latencyMs !== 'number' || !Number.isFinite(row.latencyMs) || row.latencyMs < 0) throw new Error('invalid latency');
      latencies.push(row.latencyMs);
    }
  }
  return { clips: c.clips, referenceWords: c.referenceWords,
    rawWer: ratio(c.rawErrors, c.rawReferenceWords),
    normalizedWer: ratio(c.substitutions + c.deletions + c.insertions, c.referenceWords),
    substitutionRate: ratio(c.substitutions, c.referenceWords),
    deletionRate: ratio(c.deletions, c.referenceWords),
    insertionRate: ratio(c.insertions, c.referenceWords),
    technicalTermRecall: ratio(c.technicalTermsHeard, c.technicalTerms),
    technicalTermOccurrences: c.technicalTerms,
    zeroEditRate: ratio(c.zeroEdits, c.editsObserved), observedEdits: c.editsObserved,
    speakerAttributionAccuracy: ratio(c.speakersCorrect, c.speakersObserved),
    adjudicatedSpeakers: c.speakersObserved,
    silenceFalsePositiveRate: ratio(c.silenceFalsePositiveClips, c.silenceClips),
    silenceClips: c.silenceClips,
    p50LatencyMs: percentile(latencies, 0.5), p95LatencyMs: percentile(latencies, 0.95),
    observedLatencies: latencies.length };
}

export function evaluate(rows) {
  const conditions = new Map();
  for (const row of rows) {
    const tags = row.conditions ?? [];
    if (!Array.isArray(tags) || tags.length > 20 ||
      tags.some(t => typeof t !== 'string' || !/^[a-z0-9_]{1,40}$/.test(t))) throw new Error('invalid condition tags');
    for (const tag of new Set(tags)) {
      if (!conditions.has(tag)) conditions.set(tag, []);
      conditions.get(tag).push(row);
    }
  }
  const byCondition = {};
  for (const [tag, group] of [...conditions].sort((a, b) => a[0].localeCompare(b[0]))) {
    Object.defineProperty(byCondition, tag, { value: score(group), enumerable: true });
  }
  return { schemaVersion: 1, overall: score(rows), byCondition };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: node kompas-voice-quality.mjs consented.jsonl');
    const data = readFileSync(process.argv[2], 'utf8');
    if (data.length > 20_000_000) throw new Error('manifest exceeds size limit');
    const rows = data.split(/\r?\n/u).filter(line => line.trim()).map(line => JSON.parse(line));
    process.stdout.write(JSON.stringify(evaluate(rows), null, 2) + '\n');
  } catch (error) {
    console.error('Kompas voice evaluation failed: ' + (error instanceof Error ? error.message : 'unknown error'));
    process.exitCode = 1;
  }
}
