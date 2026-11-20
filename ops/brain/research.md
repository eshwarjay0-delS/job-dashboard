# Research notes — dossier, grounding tags, desktop shell

Public pages only. No tool run that spends money. Houston profile only; none of this is a new biography.

## (a) Cited dossier, GPT Researcher / STORM shape

STORM (Shao et al., NAACL 2024, [arXiv:2402.14207](https://arxiv.org/abs/2402.14207), [code](https://github.com/stanford-oval/storm)) writes a long article by discovering perspectives, asking questions against retrieved sources, then expanding an outline with citations. The authors’ own caveat: source bias and over-association of unrelated facts.

GPT Researcher ([github.com/assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)) plans sub-queries, reads pages, and returns a markdown report with citations. Its published deep-agent comparison ([BENCHMARK.md](https://github.com/assafelovic/gpt-researcher/blob/main/deep_agents/BENCHMARK.md)) reports more verified citations than a raw search tool on the same harness. That benchmark is their web pipeline, not this repo.

Use the shape, not the web. Before a session, build a short dossier from the Houston resume and the JD already on the request: an outline of 4–6 questions the interviewer might ask, each with the resume line id that can answer it, or an explicit gap. Do not run it on the 1-second answer path. Do not let a cited web sentence become “I did”.

## (b) Sentence-level grounding tags

ALCE (Gao, Yen, Yu, Chen, EMNLP 2023, [arXiv:2305.14627](https://arxiv.org/abs/2305.14627), [code](https://github.com/princeton-nlp/ALCE)) asks the model to attach a passage citation to each statement, then scores whether the passage supports it. On their ELI5 set, even the best systems lacked full citation support about half the time. The useful part for Kompas is the tag, not their NLI judge.

Each spoken sentence gets a hidden tag: a resume line id, `jd` (gap only), or `none`. Strip the tag before the card and before TTS. `gateDisplayedAnswer` already drops some ungrounded products; the tag makes the drop explainable. A sentence tagged `none` that states a personal fact does not ship. A `jd` tag may only appear inside the gap clause from fold 2 of `ops/brain/answer-plan.md`.

## (c) Tauri 2 + WASAPI loopback + sherpa-onnx Moonshine Tiny, versus the Electron shell

Today the shell is Electron in `legacy/perfact/desktop` (`electron` ^44.5.1). `main.js` loads the live site. Computer audio is WASAPI loopback: `setDisplayMediaRequestHandler` calls `loopbackCapture()` and passes `audio: "loopback"` (`output-loopback.cjs`, `main.js` around the display-media handler). The REA register records the published `kompas-desktop-latest` asset at 162,251,677 bytes (13 Nov 2026). That number is the installer, not a memory measurement from this session.

Tauri 2 is the smaller shell ([v2.tauri.app](https://v2.tauri.app/)); on Windows it uses the system WebView. sherpa-onnx already has a Tauri v2 mic sample ([VAD + ASR](https://k2-fsa.github.io/sherpa/onnx/tauri/vad-asr-mic.html)). WASAPI loopback from Rust is a separate capture path (cpal loopback, as in [tauri-plugin-system-audio](https://github.com/Subcue/tauri-plugin-system-audio)). Moonshine Tiny is an English ASR model, 27M parameters ([model card](https://huggingface.co/moonshine-ai/moonshine-tiny)). The sherpa int8 pack lists `encode.int8.onnx` 17M, `preprocess.onnx` 6.5M, `cached_decode.int8.onnx` 43M, `uncached_decode.int8.onnx` 51M ([sherpa Moonshine models](https://k2-fsa.github.io/sherpa/onnx/moonshine/models.html)). It transcribes. It does not answer, and it does not fix a lifted claim.

## Top 2

**1. Sentence-level grounding tags.** Cost: a tag on each sentence in `shapeDisplayedAnswer` / `gateDisplayedAnswer`, stripped in the same function before return, plus an offline check that every personal sentence has a resume line id. No new model and no network. Risk: a missed strip speaks “[resume:4]” aloud; a wrong id makes a false sentence look sourced. Mitigation: the spoken string is the text with tags removed, and the id must match a line that contains the same tool tokens.

**2. Local cited dossier (STORM outline, GPT Researcher citations, resume+JD corpus only).** Cost: one prep pass when the session starts, stored with the session, read by the answer prompt as an outline. Not on the token-by-token path. Risk: over-association (STORM’s published failure) and a JD line written as experience. Mitigation: every dossier bullet is `resume` or `gap`, and the answer route may quote a `gap` only through `jdGapBridge`.

The desktop rewrite is third. It replaces a loopback path that already exists, redoes content protection and the Chrome handoff, and adds an English ASR model that does not touch answer relevance. Build it only if the installed Electron loopback is the measured problem.
