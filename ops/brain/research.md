# Research notes — dossier, grounding tags, desktop shell

20 Nov 2026. Houston profile only. No new employers, tools, or numbers. These are recommendations for Chief, not a build.

Kompas already has two of the hooks. `whereFrom` in `src/lib/kompasSourceRetrieval.ts` attaches a passage id and a quote to a spoken sentence when three tokens overlap. `answerForVerifiedUser` in `src/lib/kompasAnswerService.ts` reads a prepared dossier and gives up at 110 ms. The desktop shell is Electron 44 (`legacy/perfact/desktop/package.json`). `legacy/perfact/desktop/main.js` already takes Windows output audio with Chromium's WASAPI loopback (`audio: "loopback"`).

## (a) Cited dossier, gpt-researcher / STORM

STORM (Shao, Jiang, Kanell, Xu, Khattab, Lam, NAACL 2024, [arXiv:2402.14207](https://arxiv.org/abs/2402.14207)) researches a topic by asking questions from several perspectives, grounds those questions on sources, then writes an outline and a long article. The authors' own editor feedback names the failure mode that matters here: source bias, and stitching unrelated facts together. A live interview cannot wait for that loop.

[GPT Researcher](https://github.com/assafelovic/gpt-researcher) is the lighter shape of the same idea: plan a few questions, retrieve, write a report that cites what it retrieved. Use that shape once, before the interview, not on the live answer path. One dossier per job description. Each paragraph cites either a resume line or a public page about a tool. A tool page may explain what the tool does. It may not become a sentence that starts with "I".

## (b) Sentence-level grounding tags

ALCE (Gao, Yen, Yu, Chen, EMNLP 2023, [arXiv:2305.14627](https://arxiv.org/abs/2305.14627)) scores citations per sentence: citation recall is whether the cited passage supports the sentence. That is the right bar, and it does not need their NLI model to start.

`whereFrom` is already that tag, local and cheap. The missing piece is the gate. A spoken sentence with no tag is not shown. One exception: the honest gap sentence, tagged `bridge`, which is allowed to name a tool the resume does not contain and must not claim he ran it. Tags stay off the spoken card. They are for the check and the side panel.

## (c) Tauri 2 + WASAPI loopback + sherpa-onnx Moonshine Tiny

Tauri 2 does not ship WASAPI loopback. The sherpa-onnx Tauri sample captures a microphone through cpal ([docs](https://k2-fsa.github.io/sherpa/onnx/tauri/vad-asr-mic.html)). Loopback is a separate plugin, for example [tauri-plugin-system-audio](https://github.com/Subcue/tauri-plugin-system-audio), which opens the default output device with `AUDCLNT_STREAMFLAGS_LOOPBACK`. That is a new shell, not a patch on the Electron app that already does this.

sherpa-onnx's Moonshine Tiny English int8 build is an offline model: an encoder plus two decoders ([model page](https://k2-fsa.github.io/sherpa/onnx/moonshine/models.html)). The streaming Tiny card is 34M parameters, English only, and the model card says it can invent words on short or noisy audio ([Moonshine Streaming Tiny](https://huggingface.co/moonshine-ai/moonshine-streaming-tiny)). Interview loopback is that audio. Names like ServiceNow, CMDB, and KYC are where a tiny English model drifts. The dollar cost of the weights is zero. The cost that matters is replacing a working shell.

## Top 2

**1. Sentence-level tags, on `whereFrom`.**

- Cost: no model call and no new dependency. A filter in the display gate.
- Risk: a strict filter drops the one true gap sentence. The `bridge` tag is the exception, and it has to be the only untagged-source sentence on the card. If that exception is missing, he cannot say he has not used a JD tool.

**2. One cited dossier per JD, gpt-researcher shape, built before the interview.**

- Cost: one research job per job description, offline. Not a call on the live answer, and not a STORM multi-perspective loop.
- Risk: a cited paragraph about a tool slides into the spoken "I" voice. STORM's editors already saw unrelated facts get joined. The dossier is explanation material. Personal history stays on the resume lines. If a sentence's only citation is a web page, it cannot be spoken as his work.

The Tauri + Moonshine shell is third. It does not fix a wrong answer, and it replaces loopback that already works. Revisit it only after the tags and the dossier are in, and only if cloud speech is the bill that has to go.
