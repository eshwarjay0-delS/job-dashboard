# OpenRouter 403 on a plain question

Date: 21 November 2026. Method: public reference review and source reading. No model call and no key was read.

After `a8c469fb`, five `POST /api/answer` bodies that contained only `question` returned HTTP 403 in about half a second. The body was `{ code: "OPENROUTER_FORBIDDEN", error: "OpenRouter blocked the request. Check key permissions and account policy." }`. That sentence is this app's wrapper. The status came from OpenRouter.

The route's first model was `openai/gpt-oss-120b`, then `google/gemini-2.5-flash`. A body without `stream: true` uses the JSON path, which returned that provider status. A streamed call can still answer through Groq after OpenRouter refuses, which is why one streamed check returned text.

OpenRouter's public zero-retention list (https://openrouter.ai/docs/guides/features/zdr) includes `gpt-oss-120b` on several hosts, including Groq. A 403 means the account data policy or a guardrail left no allowed provider for the model that was chosen. Gemini 2.5 Flash text is not on that zero-retention list. `meta-llama/llama-3.3-70b-instruct` is, on Groq.

The first model is now Llama 3.3 70B. A 403 tries gpt-oss-120b, then gemini-2.5-flash, then the direct Groq key. The caller does not receive HTTP 403.
