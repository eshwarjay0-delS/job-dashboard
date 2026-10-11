# Kompas voice quality benchmark

Run the offline evaluator on explicitly consented, privately stored speech references. Keep audio, reference transcripts and correction histories outside GitHub. This tool prints aggregate metrics and does not modify production recognition.

Usage: node scripts/kompas-voice-quality.mjs path/to/consented.jsonl

Each JSONL row needs consented, reference, hypothesis. Optional: technicalTerms, conditions, editCount, speakerCorrect, latencyMs.

Compare a fixed consented recording set before and after changes. Measure word error rate, deletions, insertions, technical term recall, zero edit rate, speaker accuracy, and P50/P95 latency. No real baseline has been collected yet. Preserve existing Indic character error evaluation in Perfact.
