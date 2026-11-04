# Lane 3: receipt photos to draft transactions

Research date 2026-11-04. Sources are vendor docs loaded in this session, plus CORS preflights I sent with curl from this machine (Origin `https://ipazanin.github.io`, fake keys only). Anything seen only in a search snippet is marked **unconfirmed**. Prices are USD list prices on the day.

## Short answer

- Every hosted provider on the list answers a browser call with the user's key. I confirmed this with real preflights, not only docs. Anthropic is the only one that needs an extra header (`anthropic-dangerous-direct-browser-access: true`).
- Two adapters cover everything: Anthropic's native Messages API, and one OpenAI-compatible Chat Completions adapter with `image_url` data URLs and `response_format: json_schema`. The second covers OpenAI, Gemini (its OpenAI endpoint), Mistral, OpenRouter, Groq, Ollama and LM Studio. No third adapter is needed.
- The cheapest models that should be good enough cost about a seventh of a US cent per receipt: Claude Haiku 5.5 and GPT-6 Luna, both $0.10 in / $0.50 out per million tokens. That is roughly 700 receipts per dollar.
- The Croatian fiscal QR code gives date, time, total and JIR or ZKI, with no AI call. It does not give the merchant or the items. Porezna uprava's check service only answers "registered or not", needs reCAPTCHA and refuses cross-origin calls. So the QR helps as a cross-check on the AI's total and as a key to match the bank transaction. It cannot replace the AI read.
- Firefox has no `BarcodeDetector` on any platform, so QR reading needs a JS or WASM decoder in Kuna.
- eRačun (Fiskalizacija 2.0) is B2B and B2G only. Consumers keep getting fiscal receipts with JIR and QR. It does not matter for personal spending.

## What Kuna already has

- Vendor keys live in `localStorage` under `kuna.price-vendor-key.<vendorId>` with a changed-at time, in `src/apps/investments/prices/infrastructure/vendorKeys.ts`.
- They sync through the Drive hidden app folder (`appDataFolder`, scope `drive.appdata`) in `src/apps/investments/prices/infrastructure/googleKeysDrive.ts` and the Keys sync step in `src/apps/investments/prices/presentation/useKeysSync.ts`. AI keys can reuse this store and step as further vendor ids.
- The CSP in `index.html` will need changes:
  - `connect-src` lists only Google and the price vendors today. Each AI host has to be added (`https://api.anthropic.com`, `https://api.openai.com`, `https://generativelanguage.googleapis.com`, `https://api.mistral.ai`, `https://openrouter.ai`, `https://api.groq.com`). Local servers also need `http://localhost:11434`, `http://127.0.0.1:11434` and `http://localhost:1234`.
  - `img-src 'self'` blocks a preview of the photo from `blob:` or `data:`. Add `blob:`.
  - `script-src` has no `'wasm-unsafe-eval'`, so a WASM QR decoder (ZXing) is blocked until that is added. jsQR is pure JS and needs no change.
- The company plan already has a `Rule` concept (ordered conditions, first enabled match wins, outcome is a category) and `Category` with `slug`, `family`, `bucket`. See the project plan around the domain table and "How `Categorise.gs` reads it". Learned merchant rules should reuse this shape. Which store owns them is a decision for the owner (below).

## 1. Calling each provider from a browser page

Preflight results are what the server actually returned to `OPTIONS` with `Origin: https://ipazanin.github.io`.

| Provider                           | Endpoint                                                                               | Auth header                                                       | Extra flag                                        | Preflight result                                                                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic                          | `POST https://api.anthropic.com/v1/messages`                                           | `x-api-key` (or `Authorization: Bearer`) plus `anthropic-version` | `anthropic-dangerous-direct-browser-access: true` | With the flag: 200, `access-control-allow-origin: *`. Without it: 400, body "Disallowed CORS origin". A real POST with the flag returns `access-control-allow-origin: *` and `access-control-expose-headers: *`. |
| Anthropic, OpenAI-compatible layer | `POST https://api.anthropic.com/v1/chat/completions`                                   | `Authorization: Bearer`                                           | same flag                                         | Same as above: 200 with the flag, 400 without.                                                                                                                                                                   |
| OpenAI                             | `POST https://api.openai.com/v1/chat/completions`                                      | `Authorization: Bearer`                                           | none                                              | 200, origin echoed back. `/v1/responses` returns `*`.                                                                                                                                                            |
| Gemini native                      | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `x-goog-api-key`                                                  | none                                              | 200, origin echoed back.                                                                                                                                                                                         |
| Gemini, OpenAI-compatible          | `POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`        | `Authorization: Bearer`                                           | none                                              | 200, origin echoed back.                                                                                                                                                                                         |
| Mistral                            | `POST https://api.mistral.ai/v1/chat/completions` (and `/v1/ocr`)                      | `Authorization: Bearer`                                           | none                                              | 200, `*`.                                                                                                                                                                                                        |
| OpenRouter                         | `POST https://openrouter.ai/api/v1/chat/completions`                                   | `Authorization: Bearer`                                           | optional `HTTP-Referer`, `X-Title` (both allowed) | 204, `*`.                                                                                                                                                                                                        |
| Groq                               | `POST https://api.groq.com/openai/v1/chat/completions`                                 | `Authorization: Bearer`                                           | none                                              | 204, `*`.                                                                                                                                                                                                        |
| Ollama                             | `POST http://localhost:11434/v1/chat/completions`                                      | none                                                              | server must allow the origin                      | Not tested. No local server was running and I did not start one.                                                                                                                                                 |
| LM Studio                          | `POST http://localhost:1234/v1/chat/completions`                                       | optional token if "Require Authentication" is on                  | "Enable CORS" switch                              | Not tested, same reason.                                                                                                                                                                                         |

Notes per provider:

- **Anthropic.** The TypeScript SDK README says browser use is "disabled by default to avoid exposing your secret API credentials" and is enabled with `dangerouslyAllowBrowser: true` ([anthropic-sdk-typescript](https://github.com/anthropics/anthropic-sdk-typescript)). The API overview lists the required headers, with `anthropic-version` `2026-10-21` as the current example ([API overview](https://platform.claude.com/docs/en/api/overview)). That page does not mention the browser header. Its behaviour above is from my preflights.
- **OpenAI.** The SDK has the same `dangerouslyAllowBrowser` flag and warns that "any user with access to the browser can potentially inspect, extract, and misuse these credentials" ([openai-node](https://github.com/openai/openai-node)). OpenAI's key-safety help article returned 403 to my fetch, so its wording is **unconfirmed**.
- **Gemini.** The key page says "Do not hardcode API keys directly in web or mobile apps" and recommends origin restrictions on the key ([Gemini API keys](https://aistudio.google.com/docs/api-key)). That advice targets a developer's own key baked into an app, not a user's own key.
- **OpenRouter.** It supports an OAuth PKCE flow made for browser apps. The user clicks through on openrouter.ai, comes back with a `code`, and the page exchanges it at `https://openrouter.ai/api/v1/auth/keys` for a user-controlled key. No copy and paste is needed, which helps on a phone ([OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth.md)).
- **Ollama.** "Ollama allows cross-origin requests from `127.0.0.1` and `0.0.0.0` by default. Additional origins can be configured with `OLLAMA_ORIGINS`." On macOS the app takes environment variables through `launchctl setenv`, then needs a restart ([Ollama FAQ](https://docs.ollama.com/faq)). For Kuna that means `OLLAMA_ORIGINS=https://ipazanin.github.io`.
- **LM Studio.** It has an "Enable CORS" switch, "Serve on Local Network", the port (1234 by default) and "Require Authentication" ([LM Studio server settings](https://lmstudio.ai/docs/developer/core/server/settings), [OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat)).

### Calling localhost from an https page

- MDN says content from loopback addresses such as `http://127.0.0.1/` or `http://localhost/` counts as a secure origin ([MDN mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content)). So a fetch from Kuna's https page to `http://localhost:11434` is not blocked as mixed content. I have not tested this in Firefox or Chrome.
- Chrome adds a Local Network Access check. A public origin connecting to loopback needs the `loopback-network` permission, so the user sees a prompt. The `targetAddressSpace` fetch option declares the target and exempts an `http://` target from mixed-content blocking once the user grants the permission ([Chrome Local Network Access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)). The guide gives no version number. A search snippet places the start at Chrome 142 (**unconfirmed**).
- Firefox also has a local network permission prompt. Search snippets of Mozilla's support article mention ETP Strict from Firefox 149, a rollout to everyone from Firefox 151, and prefs `network.lna.enabled` and `network.lna.skip-domains`. All of this is **unconfirmed**, because the page itself returned a bot challenge to my fetch.
- From the phone it is a different story. The phone reaching the laptop's Ollama at `http://192.168.x.x` is a private address, not loopback. That request is plain mixed content and is blocked. Only Chrome's `targetAddressSpace` plus a permission prompt might allow it. In practice, local models work only in the browser on the machine that runs them.

### Terms on keys in a browser

| Provider      | What I found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Status                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Anthropic     | Commercial terms let a customer use the Services "to power products and services Customer makes available to its own customers and end users" (A.1). The customer is "responsible for all activity under its account" (D.5) ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms)). The key article says "If someone needs access to the Claude API, they should obtain their own key", which is exactly the bring-your-own-key model. It also suggests separate keys per purpose and spend limits ([API key best practices](https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure)). I found no clause that forbids users putting their own key in their own browser. | Loaded                             |
| OpenAI        | The SDK README warning only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Help article **unconfirmed** (403) |
| Google        | "Only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom" ([Gemini API terms](https://aistudio.google.com/docs/terms)). Kuna is an API client used in Croatia, so a user on a free-tier Gemini key is arguably outside the terms. Nothing addresses bring-your-own-key directly.                                                                                                                                                                                                                                                                                                                                                                                 | Loaded                             |
| OpenRouter    | Built for it, with browser OAuth PKCE that mints user keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Loaded                             |
| Mistral, Groq | I did not load their terms. Their CORS is wide open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Not checked                        |

Every vendor warns about the same real risk: script on the page reads the key. For Kuna that means an XSS bug or a malicious extension. Kuna's strict CSP already narrows this. The other mitigations are a key used only for Kuna and a spend limit on it.

## 2. Per provider: images, structured output, models, cost

### Cost per typical receipt

Assumptions behind every figure:

- The phone photo is downscaled in the browser to 1176 x 1568 px JPEG.
- About 1,500 text tokens go in: instructions, schema, and about 40 category slugs with names.
- About 1,000 tokens of JSON come out for 15 lines, plus up to 1,000 thinking or reasoning tokens.

Image tokens use each vendor's published formula. Real receipts should be measured in the eval.

| Provider and model                         | Price in / out per MTok                                                                                                                                                | Image tokens at 1176 x 1568                                                                                                  | About per receipt |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Anthropic `claude-haiku-5-5`               | $0.10 / $0.50 (prompts up to 100k tokens)                                                                                                                              | 42 x 56 = 2,352                                                                                                              | $0.0014           |
| Anthropic `claude-sonnet-5-5`              | $2 / $10                                                                                                                                                               | 2,352                                                                                                                        | $0.028            |
| Anthropic `claude-opus-5-5`                | $4 / $20                                                                                                                                                               | 2,352                                                                                                                        | $0.056            |
| OpenAI `gpt-6-luna`                        | $0.10 / $0.50                                                                                                                                                          | about 1,813 patches times a multiplier. The table gives 1.2 for the gpt-5.6 family but does not list Luna (**unconfirmed**). | about $0.0014     |
| Gemini `gemini-3.1-flash-lite`             | $0.25 / $1.50                                                                                                                                                          | 4 tiles x 258 = 1,032                                                                                                        | $0.0037           |
| Mistral `ministral-14b-2512`               | $0.20 / $0.20                                                                                                                                                          | about (1155 x 1540) / 784 = 2,269, capped at 1540 px                                                                         | $0.0010           |
| Mistral `mistral-ocr-4-1` with annotations | $5 per 1,000 annotated pages                                                                                                                                           | n/a                                                                                                                          | $0.005            |
| Groq `qwen/qwen3.8-27b` (preview)          | $0.80 / $4.00                                                                                                                                                          | fixed 2,048                                                                                                                  | $0.009            |
| OpenRouter                                 | the underlying provider's price, "no markup on inference pricing", plus a fee when buying credits. The FAQ renders the percentage dynamically, so I could not read it. | same as the model                                                                                                            | same as the model |
| Ollama or LM Studio                        | free, runs on the laptop                                                                                                                                               | n/a                                                                                                                          | $0                |

At 100 receipts a month, Haiku 5.5 or GPT-6 Luna costs about $0.15 a month. Sonnet 5.5 costs about $2.80.

### Anthropic

- **Vision** ([Vision](https://platform.claude.com/docs/en/build-with-claude/vision)):
  - Formats are JPEG, PNG, GIF and WebP. The limit is 10 MB per image base64-encoded, and 8000 x 8000 px.
  - A request can hold 600 images on 1M-context models. The request limit is 128 MB.
  - Cost is `ceil(w/28) x ceil(h/28)` visual tokens.
  - "Claude 4.7 and later models" use the high-resolution tier: long edge 2,576 px, at most 4,784 visual tokens. All other models use 1,568 px and 1,568 tokens. Haiku 5.5 counts as a later model.
  - The block shape is `{"type":"image","source":{"type":"base64","media_type":"image/jpeg","data":"..."}}`.
- **PDF.** A `document` block with base64 `application/pdf` works. The limits are 600 pages and 128 MB on the first-party API. Pages are processed as text plus image, "typically 1,500–3,000 tokens" per page ([PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)).
- **Structured output.** `output_config.format` takes `{type: "json_schema", schema}` and works on every current model ([Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
  - The schema subset requires `additionalProperties: false`. `enum` takes strings, numbers, booleans or null only.
  - It does not accept `minimum`, `maximum`, `minLength` or `maxLength`. `minItems` may only be 0 or 1. Nullable fields are written as `"type": ["string","null"]`.
  - It is incompatible with citations and with prefill.
  - Enum casing can drift, so compare case-insensitively.
  - A `refusal` or `max_tokens` stop can return JSON that does not match the schema. Check `stop_reason` before parsing.
  - Strict tool use (`strict: true`) is the other route. For a single extraction, `output_config.format` is simpler.
- **Models** ([Models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview)):
  - The exact ids are `claude-opus-5-5` ($4 / $20), `claude-sonnet-5-5` ($2 / $10) and `claude-haiku-5-5` ($0.10 / $0.50 up to 100k-token prompts, $0.50 / $2.50 above).
  - Haiku 5.5 was released October 7, 2026, and the overview describes it as "for high-volume, latency-sensitive tasks such as classification, extraction, and routing".
  - Haiku 5.5's default effort is `medium`, with adaptive thinking on by default. The bundled Claude API skill reference says `thinking: {type: "disabled"}` is accepted on Haiku 5.5 only at effort `high` or below. Try effort `low` first, and thinking off if that holds quality.
  - Omit `temperature`, `top_p` and `top_k`.
  - Batch requests are 50% off, but they are useless for an interactive capture.
- **Anthropic's OpenAI-compatible layer** at `https://api.anthropic.com/v1/` ([OpenAI SDK compatibility](https://platform.claude.com/docs/en/api/openai-sdk)):
  - It accepts `image_url` (with `detail` ignored) and `response_format` json_schema with `strict: true`.
  - It rejects `file` parts (no PDF) and has no prompt caching.
  - Anthropic says it is "primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution". That is why I would keep a native adapter for Anthropic.

### OpenAI

- **Vision** ([Images and vision](https://developers.openai.com/api/docs/guides/images-vision)):
  - Formats are PNG, JPEG, WebP and non-animated GIF. A request takes up to 512 MB total and 1,500 images. Each image is capped at 30,000 patches, and anything over that is rejected, not resized.
  - `detail` is `low`, `high`, `original` or `auto`.
  - Newer models use 32 x 32 patches times a model multiplier. That table covers the gpt-5.x and gpt-6-astra models, not gpt-6-luna.
- **Request shape.** In Chat Completions, an image is `{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,...","detail":"auto"}}`. `response_format` is `{"type":"json_schema","json_schema":{"name","schema","strict":true}}` ([Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)). Structured Outputs works in both Chat Completions and Responses ([Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)).
- **PDF.** Chat Completions accepts PDFs as `file` parts with base64 `file_data`. The limit is 50 MB per file and per request ([PDF files](https://developers.openai.com/api/docs/guides/pdf-files)).
- **Models** ([Models](https://developers.openai.com/api/docs/models), [Pricing](https://developers.openai.com/api/docs/pricing)):
  - The current list is `gpt-6-luna` ($0.10 / $0.50), `gpt-6.1-terra` ($1 / $5), `gpt-6.1-sol` ($2 / $10) and `gpt-6-astra` ($10 / $50).
  - The `gpt-6-luna` page lists text and image input, structured outputs, and both Chat Completions and Responses. It notes that Chat Completions supports function calling only with reasoning set to none ([gpt-6-luna](https://developers.openai.com/api/docs/models/gpt-6-luna)).
  - Older cheap models are still priced: `gpt-5-nano` ($0.05 / $0.40), `gpt-5-mini` ($0.25 / $2.00) and `gpt-4o-mini` ($0.15 / $0.60). The vision guide marks gpt-5-nano and gpt-5-mini as deprecated.

### Gemini

- **Vision** ([Image understanding](https://aistudio.google.com/docs/image-understanding)):
  - Formats are PNG, JPEG, WebP, HEIC and HEIF. Inline data caps the whole request at 20 MB.
  - An image costs 258 tokens if both sides are 384 px or less. Larger images are split into 768 x 768 tiles at 258 tokens each.
  - Gemini 3 adds `media_resolution`. The page does not list its levels.
- **OpenAI-compatible endpoint** at `https://generativelanguage.googleapis.com/v1beta/openai/`. It takes `image_url` with base64 data URLs and supports structured output through `response_format`. It is marked "still in beta" ([OpenAI compatibility](https://aistudio.google.com/docs/openai)).
- **Native structured output** ([Structured output](https://aistudio.google.com/docs/structured-output)):
  - The native API supports `minimum`, `maximum`, `minItems` and `maxItems`.
  - It silently strips `minLength` and `maxLength`.
  - Very large or deeply nested schemas get a 400.
- **Models** ([Pricing](https://aistudio.google.com/docs/pricing)):
  - Image input per MTok: `gemini-3.1-flash-lite` $0.25 in / $1.50 out, `gemini-3.5-flash-lite` $0.30 / $2.50, `gemini-3.8-flash` $0.75 / $3.75 (price through December 31, 2026).
  - `gemini-2.5-flash-lite` and `gemini-2.5-flash` are deprecated and route to 3.5 flash-lite from December 1, 2026.
- **PDF.** The image page only points to "File input methods". Not checked.

### Mistral

- **Vision** ([Vision](https://docs.mistral.ai/inference/conversations/vision.md)):
  - The vision models are `mistral-large-2512`, `mistral-medium-2508`, `mistral-small-2506` and `ministral-14b-2512`, `ministral-8b-2512`, `ministral-3b-2512`.
  - Base64 goes as `"image_url": "data:image/jpeg;base64,..."`. Note this is a bare string, not an object. Mistral's API probably accepts the object form too, but I did not confirm it.
  - Formats are PNG, JPEG, WebP and single-frame GIF. The limits are 10 MB per image and 8 images per request.
  - The max resolution is 1540 x 1540 at about `(w x h) / 784` tokens. Images above 10000 x 10000 are rejected.
- **Structured output.** `response_format: {type: "json_schema", json_schema: {..., strict: true}}` ([Custom structured outputs](https://docs.mistral.ai/inference/conversations/structured-output/custom.md)).
- **Prices** ([API pricing](https://docs.mistral.ai/inference/pricing.md)):
  - `ministral-3b-2512` $0.10 / $0.10, `ministral-8b-2512` $0.15 / $0.15, `ministral-14b-2512` $0.20 / $0.20, `mistral-small-2603` $0.15 / $0.60, `mistral-large-4` $0.70 / $2.10.
  - `mistral-ocr-4-1` is $4 per 1,000 pages, or $5 annotated.
- **Mistral Document AI.** OCR plus "annotations" in a JSON format you provide. It is a receipt-shaped product, and `/v1/ocr` preflight returns `*`. It is a separate request shape from chat, so it would need its own adapter. Not worth it for v1.
- **Lifecycle.** `mistral-small-2506` and `mistral-medium-2508` are marked deprecated on the models page, so prefer Ministral 3.

### OpenRouter

- **Chat Completions** takes `image_url` (schema `ChatContentImage`) and `response_format` json_schema ([Create a chat completion](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion.md)).
- **Images.** The image guide now documents the Responses API with `input_image` items. It lists PNG, JPEG, WebP and GIF, and says image limits vary per provider ([Image inputs](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding.md)).
- **Structured outputs** depend on the endpoint ([Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)):
  - Filter models by `supported_parameters=structured_outputs`.
  - Set `provider.require_parameters: true` so the request only goes to endpoints that honour the schema.
  - A "Response Healing" plugin exists for non-streaming json_schema requests.
- **Models.** The public `GET /api/v1/models` returned 269 models with image input and structured outputs. They include `anthropic/claude-haiku-5.5` ($0.10 / $0.50), `openai/gpt-6-luna` ($0.10 / $0.50), `google/gemini-3.1-flash-lite` ($0.25 / $1.50), `mistralai/ministral-3b-2512` and `google/gemma-4-26b-a4b-it` ($0.039 / $0.118). One OpenRouter key therefore reaches the Claude, GPT, Gemini and open models through the OpenAI-compatible adapter.

### Groq

- **Vision** ([Vision](https://console.groq.com/docs/vision)):
  - The vision models are `qwen/qwen3.8-27b` (preview, $0.80 / $4.00, at most 3 images, fixed 2,048 tokens per image) and `meta-models/muse-spark-open` (limited preview).
  - A request with an image URL is capped at 20 MB.
  - Base64 goes in `image_url` as a data URL.
- **Structured outputs** ([Structured outputs](https://console.groq.com/docs/structured-outputs)):
  - `strict: true` uses constrained decoding on `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` and `meta-models/muse-spark-open`.
  - Streaming and tool use are not supported with Structured Outputs.
- **Models.** The production models listed have no vision, so Groq is not a good default for receipts ([Models](https://console.groq.com/docs/models)).

### Ollama and LM Studio

- **Ollama's OpenAI endpoint** is `http://localhost:11434/v1/` ([OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)).
  - It takes base64 images as data URLs. Image URLs are not supported, and neither is `tool_choice`.
  - It lists `response_format` as supported. The page does not say json_schema.
  - The structured outputs page says the format works through the OpenAI API via `response_format`, and that vision models accept the same `format` parameter ([Structured outputs](https://docs.ollama.com/capabilities/structured-outputs)). Ollama's cloud does not support structured outputs.
- **Vision models** in the Ollama library, checked on ollama.com/library:
  - `qwen2.5vl` (3b, 7b, 32b, 72b), `llama3.2-vision` (11b, 90b), `gemma3` (1b, 4b, 12b, 27b)
  - the newer `gemma4` (e2b, e4b, 12b, 26b, 31b), `qwen3-vl` (2b to 235b) and `ministral-3` (3b, 8b, 14b)
  - On a laptop, something around 7b to 14b is the realistic range. Quality on Croatian thermal receipts is unknown until tested.
- **LM Studio** serves `/v1/chat/completions` "text and images" on port 1234. Its structured-output support is listed as a section, but I did not read the details (**unconfirmed**).

## 3. One adapter shape

Two adapters cover all the providers.

1. **Anthropic native** (`POST /v1/messages`):
   - headers `x-api-key`, `anthropic-version`, `anthropic-dangerous-direct-browser-access: true`
   - an `image` or `document` block
   - `output_config.format` with the schema
   - optional `output_config.effort`
2. **OpenAI-compatible Chat Completions** (`POST {baseUrl}/chat/completions`). It needs a `Bearer` key, a user message with a text part and an `image_url` data URL, and `response_format` json_schema strict. A preset per provider holds base URL, model ids, and quirks:

   | Preset     | Base URL                                                  | Quirks                                      |
   | ---------- | --------------------------------------------------------- | ------------------------------------------- |
   | OpenAI     | `https://api.openai.com/v1`                               | PDF via `file` parts works here             |
   | OpenRouter | `https://openrouter.ai/api/v1`                            | add `provider.require_parameters: true`     |
   | Gemini     | `https://generativelanguage.googleapis.com/v1beta/openai` | marked beta                                 |
   | Mistral    | `https://api.mistral.ai/v1`                               | 8 images max, 1540 px                       |
   | Groq       | `https://api.groq.com/openai/v1`                          | 3 images max, no streaming with schema      |
   | Ollama     | `http://localhost:11434/v1`                               | no key, laptop only, needs `OLLAMA_ORIGINS` |
   | LM Studio  | `http://localhost:1234/v1`                                | "Enable CORS" on                            |

A Gemini-native third adapter would only be needed if the beta compatibility layer misbehaves, or for `media_resolution`. Anthropic could in principle also go through adapter 2 with its extra header. Anthropic itself calls that layer test-only, and it drops PDF input, so keep the native one.

Images-only v1 avoids the uneven PDF support. A PDF receipt (an emailed one, for example) could be rendered to an image in the browser later, or sent only to Anthropic or OpenAI, which take PDFs.

## 4. Croatian fiscal receipts

### What the QR code holds

- The Pravilnik o fiskalizaciji računa u krajnjoj potrošnji (NN 153/25, in force 1 January 2026) sets the content in Članak 17: "QR kod minimalno sadrži" four items, "odvojeni su separatorima" ([NN 153/2025](https://narodne-novine.nn.hr/clanci/sluzbeni/full/2025_12_153_2278.html)). The four items are:
  - the URL of Porezna uprava's receipt check page
  - the JIR or the ZKI
  - the issue date and time
  - the total
- Članak 18 sets QR model 1 or 2, at least 2 x 2 cm with 2 mm quiet zone, ECC at least L, and no logo.
- The exact URL format comes from the check page's own JavaScript (`https://porezna.gov.hr/rn/assets/index-CU4QgkZ0.js`), which reads these query parameters:
  - `jir`: UUID shape `********-****-****-****-************`
  - `zki`: 32 hex characters (MD5 of the issuer's RSA-SHA1 signature, per Članak 16)
  - `datv`: `YYYYMMDD_HHMM`, split on `_` into an 8-digit date and a 4-digit time
  - `izn`: the total. With no separator it is cents (the code divides by 100). With a comma or dot it is euros.
- So a QR looks like this made-up example: `https://porezna.gov.hr/rn?jir=1a2b3c4d-0000-4000-8000-1234567890ab&datv=20261103_1842&izn=2349`. That means 3 November 2026 at 18:42, €23.49.
- I have not scanned a real receipt to confirm that every POS vendor writes exactly this form. The rule says "minimalno", so extra parameters are possible.

### The check page cannot be used from Kuna

- The page is `https://porezna.gov.hr/rn/`. Porezna uprava lists three ways to check a receipt: QR, the mPorezna app, and this page ([Kako prepoznati ispravan račun](https://porezna-uprava.gov.hr/hr/kako-prepoznati-ispravan-racun/8613)).
- The page posts to `/rn/api/provjeri-racun` with a reCAPTCHA token. It gets back only `{tip, poruka, referenca}`: a severity and a message.
- Članak 46(2) of NN 153/25 confirms it only shows "je li račun ... prijavljen u Sustav za fiskalizaciju".
- My preflight and POST from another origin both got 403, with no `Access-Control-Allow-Origin`.
- So the service gives no amount, date or seller beyond what you typed in. It is not callable from Kuna, and the reCAPTCHA rules out automation anyway.

### The QR alone, without AI

- **What it gives:** date, time, total and JIR or ZKI. That is enough for a draft with a date and amount, and for a strong match to the bank card payment on the same day with the same amount. The bank row already carries the merchant name.
- **What it does not give:** the merchant, its OIB, the items or the VAT split.
- **Use it as a check.** If the AI's `total` differs from `izn`, flag the receipt. If both match the bank amount, the read is very likely right.
- **BarcodeDetector support**, per the MDN compat data ([MDN BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector), compat data from `mdn/browser-compat-data`):
  - Chrome Android 83+: yes
  - Chrome desktop: macOS and ChromeOS only
  - Safari and iOS: behind a flag
  - Firefox desktop and Android: not implemented (bug 1553738)
  - The owner's daily browser therefore needs a library:

    | Library            | npm version | License    | Notes                                    |
    | ------------------ | ----------- | ---------- | ---------------------------------------- |
    | `barcode-detector` | 3.2.3       | MIT        | a polyfill of the same API on ZXing WASM |
    | `zxing-wasm`       | 3.1.6       | MIT        |                                          |
    | `jsqr`             | 1.4.0       | Apache-2.0 | pure JS, no WASM                         |

  - The WASM ones need `'wasm-unsafe-eval'` added to Kuna's `script-src`. jsQR fits the current CSP as is.
- **Decoding from the photo.** The QR can be decoded from the same photo that goes to the AI, so the user takes one picture. A small or blurry QR on a crumpled receipt may fail. Then the AI read stands alone.

### eRačun and Fiskalizacija 2.0

- Porezna uprava's comparison poster separates two flows. B2C receipts go to citizens "neovisno o načinu plaćanja", with JIR and QR. eRačun is B2B and B2G structured invoicing, and "eRačunom se ne smatra pdf poslan na mail" (`https://porezna.gov.hr/fiskalizacija/api/dokumenti/46`, "Usporedba F1_F2_plakat.pdf").
- The Fiskalizacija 2.0 page says B2C fiscalisation "proširena je na sve oblike plaćanja" from 1 January 2026. Card and transfer receipts now get JIR and QR too ([Porezna uprava, općenito](https://porezna-uprava.gov.hr/hr/opcenito-8032/8032)).
- The Zakon o fiskalizaciji (NN 89/25) entered into force 1 September 2025. Most eRačun articles apply from 1 January 2026, and MIKROeRAČUN issuing from 1 January 2027 ([NN 89/2025](https://narodne-novine.nn.hr/clanci/sluzbeni/2025_06_89_1233.html)).
- Its definitions list a receipt's elements:
  - the issuer's OIB, date and time, receipt number, and whether the issuer is in the VAT system
  - the amount split by tax rate, the payment method, the operator's OIB and the ZKI
- **Takeaway for personal spending:** every receipt prints the seller's OIB. That makes it the right key for merchant rules, better than a name that varies between "KONZUM d.d." and "Konzum PJ 0412".
- **eRačun** never reaches a private person, so it does not matter for this app. On the company side, incoming eRačuns are EN 16931 XML that could be read with no AI at all. That is out of scope here.

## 5. Making the AI reliable

### The request

Send one user message with the image and a short text part. Keep the stable parts (role, rules, category list) in the system prompt so Anthropic prompt caching could apply later. Haiku 5.5's minimum cacheable prompt is 512 tokens, and at these sizes the saving is fractions of a cent, so v1 can skip caching.

The draft prompt, in English, with Croatian terms kept:

> You read one Croatian shop receipt from a photo. Copy what is printed. Do not guess hidden or cut-off text, use null instead.
> Amounts are euros with a decimal comma on the receipt. Return them as numbers with a dot.
> Return every product line in printed order. A line with a quantity such as "2 x 1,29" or a weight such as "0,532 kg x 2,99" gives quantity and unitPrice, and lineTotal is the printed line amount.
> A discount line (POPUST, AKCIJA, -10%) is its own line with kind "discount" and a negative lineTotal. A deposit (POVRATNA NAKNADA) has kind "deposit". A tip (NAPOJNICA) has kind "tip".
> Keep the printed text in `printed`. Put plain Croatian words in `expanded`, for example "MLIJ.TR.2,8% 1L" becomes "mlijeko trajno 2,8% 1 l".
> Copy the seller's OIB (11 digits), the JIR, the ZKI, the receipt number, the VAT table (PDV rates 25, 13, 5 and their base and tax), and the payment method (GOTOVINA, KARTICA, TRANSAKCIJSKI RAČUN).
> If the receipt shows a buyer OIB or "R1", set `buyerOib`.
> For each line choose one category slug from the list. If none fits, use "new" and propose a short name in `newCategory`. Give a confidence of high, medium or low.
> Known rules for this merchant: {rules for this OIB or name, if any}. Past corrections: {up to 10 recent item-to-category corrections for this merchant}.
> Categories: {slug, name and one-line meaning for each}.

### The schema

The schema below works under all of these at once:

- Anthropic's subset: every object has `additionalProperties: false`, nullable fields use type arrays, no min or max keywords
- OpenAI and Groq strict mode: every field is listed in `required`
- Mistral strict mode
- Gemini's OpenAI endpoint

Put the category slugs in an `enum` with `"new"` added, so the model cannot invent a slug. Generate the enum from the user's category list per request.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["merchant", "buyerOib", "issuedOn", "issuedAt", "receiptNumber", "jir", "zki", "currency", "lines", "vat", "total", "paymentMethod", "unreadable"],
  "properties": {
    "merchant": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "oib", "address"],
      "properties": {
        "name": { "type": "string" },
        "oib": { "type": ["string", "null"], "description": "11 digits as printed" },
        "address": { "type": ["string", "null"] }
      }
    },
    "buyerOib": { "type": ["string", "null"] },
    "issuedOn": { "type": "string", "format": "date" },
    "issuedAt": { "type": ["string", "null"], "description": "HH:MM" },
    "receiptNumber": { "type": ["string", "null"] },
    "jir": { "type": ["string", "null"] },
    "zki": { "type": ["string", "null"] },
    "currency": { "type": "string", "enum": ["EUR", "other"] },
    "lines": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["printed", "expanded", "kind", "quantity", "unit", "unitPrice", "lineTotal", "vatRate", "category", "newCategory", "confidence"],
        "properties": {
          "printed": { "type": "string" },
          "expanded": { "type": "string" },
          "kind": { "type": "string", "enum": ["product", "discount", "deposit", "tip", "fee"] },
          "quantity": { "type": ["number", "null"] },
          "unit": { "type": ["string", "null"], "enum": ["kom", "kg", "l", "m", "other", null] },
          "unitPrice": { "type": ["number", "null"] },
          "lineTotal": { "type": "number" },
          "vatRate": { "type": ["number", "null"] },
          "category": { "type": "string", "enum": ["groceries", "household", "alcohol", "new"] },
          "newCategory": { "type": ["string", "null"] },
          "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
        }
      }
    },
    "vat": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["rate", "base", "tax"],
        "properties": {
          "rate": { "type": "number" },
          "base": { "type": "number" },
          "tax": { "type": "number" }
        }
      }
    },
    "total": { "type": "number" },
    "paymentMethod": { "type": "string", "enum": ["cash", "card", "transfer", "other", "unknown"] },
    "unreadable": { "type": "array", "items": { "type": "string" }, "description": "parts of the receipt that could not be read" }
  }
}
```

Two checks before shipping it:

- Count the optional and union fields against Anthropic's strict complexity limits. Those limits are 24 optional parameters and 16 `anyOf` or type-array parameters across all strict schemas in a request ([Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). The page states them for strict tools. Whether they also apply to `output_config.format` needs a test.
- `"enum"` that mixes strings and `null` inside a type array may not pass every provider. Test it per preset, or use `"unit": {"type": "string", "enum": [..., "none"]}`.

### Checks in code, not in the model

Convert every amount to integer cents with `Math.round(x * 100)` the moment the JSON arrives. All checks run on cents.

1. **Lines sum to the total.** The sum of `lineTotal` over all kinds equals `total`, give or take 1 cent per line for per-line rounding.
2. **Each line adds up.** Where both are present, `quantity x unitPrice` is within 1 cent of `lineTotal`. Weighed goods round per line.
3. **VAT adds up.** `sum(vat.base + vat.tax)` equals `total`. Any PNP (porez na potrošnju) in restaurants or deposits outside the VAT table explain a gap. Show the gap rather than fail.
4. **The QR agrees.** QR `izn` equals `total`, and QR `datv` equals `issuedOn` and `issuedAt`.
5. **The bank agrees.** The matching bank row's amount equals `total`.
6. **OIB is valid.** An 11-digit OIB passes the ISO 7064 MOD 11,10 check digit. Unverified from a primary source here, but it is the standard Croatian OIB rule. A failed check means a misread digit.

What to do when checks fail:

- A failed sum check marks the draft "needs review" and shows the difference, for example "lines add up to €22.99, receipt says €23.49".
- One automatic retry, sending the model its own JSON and the difference, costs another tenth of a cent on Haiku. That is worth trying in the eval before deciding.
- Never auto-correct a line to force the sum.

### Category mapping and confidence

- **Apply learned rules before and after the AI.** Before, rules go into the prompt. After, they override the model, the way Kuna's `rulesEngine` already works ("first enabled match wins"). The order of precedence is:
  1. a rule for this merchant and this item text
  2. a rule for this merchant
  3. the model's pick
- **Do not trust the model's confidence alone.** Self-reported confidence is poorly calibrated. Treat a line as confident only when the model says high and a code signal agrees:
  - a rule matched, or
  - the same expanded text was confirmed before, and
  - the sum check passed
- **Review screen.** Group lines by category, so a 15-line Konzum receipt shows as three or four groups to confirm, not 15 rows.

### Suggesting a new category

The `"new"` slug plus `newCategory` lets the model propose a category, for example "pet food". Show it as a suggestion the user accepts, renames or maps to an existing category. Never create a category silently. A new category changes reports, and in the company app categories carry `bucket` and `roles` that drive every P&L figure.

### Learning from corrections

When the user changes a line's category, offer "always for this merchant" or "always for this item at this merchant". Store the rule keyed on merchant OIB (the name is the fallback) plus folded item text.

This is the same shape as the company app's `Rule` (conditions AND, ordered, outcome category, with `rule` or `review` confidence). Reuse that concept rather than adding a second rule type. Where it lives is a decision below.

Corrections also feed the prompt as few-shot examples for that merchant. That helps the model with truncated names like "JAG.SVJ." without any training.

### Croatian receipt words

This list is from general knowledge, not from a primary source. Verify each against a few real receipts in the eval.

| Printed                       | Meaning                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| KOM, kom.                     | komad, piece                                                                           |
| KOL                           | količina, quantity                                                                     |
| CIJ, CIJENA                   | unit price                                                                             |
| IZN, IZNOS                    | line amount                                                                            |
| UKUPNO, ZA PLATITI, SVEUKUPNO | total                                                                                  |
| POPUST, AKCIJA, -x%           | discount                                                                               |
| PDV, PDV 25%, 13%, 5%         | VAT and its rates                                                                      |
| OSN, OSNOVICA                 | tax base                                                                               |
| PNP                           | porez na potrošnju, a local consumption tax on drinks in hospitality                   |
| POVRATNA NAKNADA              | deposit on drink containers                                                            |
| NAPOJNICA                     | tip, which can be fiscalised separately (the Pravilnik mentions "podatak o napojnici") |
| GOTOVINA, NOVČANICE           | cash                                                                                   |
| KARTICA, KARTICE              | card                                                                                   |
| TRANSAKCIJSKI RAČUN           | bank transfer                                                                          |
| OPER, OPERATER, BLAG          | cashier, register                                                                      |
| R1, R-1, OIB KUPCA            | business receipt with the buyer's OIB                                                  |
| JIR, ZKI                      | fiscal identifiers                                                                     |

Item names are cut to fit the till, for example "MLIJ.TR.2,8%1L", "KRUH POLUBIJ.", "DET.TEK.". Keep `printed` for rules and `expanded` for display.

## 6. Privacy and cost

### What leaves the device

- The downscaled photo, which can show the masked card number, a loyalty card number, the cashier's name and the shop address.
- The user's category list.
- The merchant rules and recent corrections sent as examples.
- Nothing from the bank ledger needs to go. Matching to the bank row happens locally.
- Re-encoding the photo through a canvas produces a new JPEG without the camera's EXIF block, which on phones can hold GPS. That is the normal canvas behaviour, but verify it on Android and iOS in the eval.

### Provider retention for API calls

| Provider          | Default for API calls                                                                                                                                                                                                                   | Training                                                           | Source                                                                                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic         | "automatically delete inputs and outputs on our backend within 30 days". Flagged usage-policy cases are kept up to 2 years. ZDR by agreement. Fable and Mythos models require 30-day retention, which does not affect the models above. | "Anthropic may not train models on Customer Content from Services" | [Privacy center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) |
| OpenAI            | Abuse monitoring logs kept up to 30 days. Chat Completions stores no application state by default. Responses stores at least 30 days unless `store` is false. Flagged images are kept for review even under ZDR.                        | "not used to train or improve OpenAI models" unless opted in       | [Your data](https://developers.openai.com/api/docs/guides/your-data)                                                                                                                                                                                                                    |
| Google Gemini     | Paid: prompts logged "for a limited period of time" for abuse only, period not stated. Unpaid: used to improve products, with human review. In the EEA, Switzerland and the UK the paid data terms apply to unpaid quota too.           | Paid: no. Unpaid outside the EEA: yes.                             | [Gemini API terms](https://aistudio.google.com/docs/terms)                                                                                                                                                                                                                              |
| Mistral           | Retention period not found. ZDR on paid plans for stateless calls. A separate admin toggle opts API data out of training.                                                                                                               | Opt-out toggle under Admin, Privacy                                | [Zero data retention](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention.md), [Training opt-out](https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training)                                                             |
| OpenRouter        | Does not store prompts or responses unless the user opts in. Stores request metadata. Screens for CSAM in flight. `zdr: true` per request limits routing to ZDR endpoints. The underlying provider's own policy also applies.           | Off by default                                                     | [Data collection](https://openrouter.ai/docs/guides/privacy/data-collection.md), [ZDR](https://openrouter.ai/docs/guides/features/zdr.md)                                                                                                                                               |
| Groq              | "does not retain customer data for inference requests" by default. Logs up to 30 days only for reliability or abuse cases. Any customer can turn on ZDR.                                                                                | n/a                                                                | [Your data](https://console.groq.com/docs/your-data)                                                                                                                                                                                                                                    |
| Ollama, LM Studio | Nothing leaves the laptop                                                                                                                                                                                                               | n/a                                                                | n/a                                                                                                                                                                                                                                                                                     |

For Kuna, call OpenAI through Chat Completions, or set `store: false` if Responses is ever used. Tell Gemini users to use a billed key. The terms on making API clients available in the EEA point the same way.

### Compressing the image in the browser

1. Decode the photo with `createImageBitmap(file)`.
2. Draw it to a canvas and export with `canvas.toBlob(cb, "image/jpeg", 0.85)`. WebP export works in Chrome and Firefox 96+ but not in Safari, per MDN compat data, so JPEG is the one format every browser writes and every provider reads.
3. A 1176 x 1568 JPEG at 0.85 lands around 200 to 400 KB, about a third larger as base64. That is far under every provider's limit.

**Tall receipts are the trap.** A long-edge cap shrinks the width. A 1:4 receipt capped at 1,568 px is only 392 px wide, which is too small to read.

- Cap by area instead, for example about 1.8 megapixels, at most 2,576 px long edge for Claude.
- Or cut receipts taller than about 1:2.5 into two overlapping halves and send both images in one request.
- Mistral's 1540 x 1540 cap and Groq's fixed 2,048 tokens make them weaker for long receipts.
- Grayscale and a contrast boost may help thermal paper. Test before adding.

HEIC from iPhones:

- Gemini accepts HEIC, but Anthropic, OpenAI and Mistral list only JPEG, PNG, WebP and GIF.
- Whether iOS Safari hands the page a JPEG or a HEIC from `<input accept="image/*">` is **unverified**.
- Whether Firefox desktop can decode an uploaded HEIC is also **unverified**.
- Show a plain error when `createImageBitmap` fails.

## 7. Camera capture on a phone

MDN compat data for the `capture` attribute on `<input type="file">`:

- Chrome Android 25+
- Firefox Android 79+
- Safari iOS 10+
- Desktop browsers: none

Desktop shows the normal file picker ([MDN capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)). So:

- **"Take photo"** is `<input type="file" accept="image/*" capture="environment">`. It opens the rear camera directly on Android Chrome, Android Firefox and iOS.
- **"Upload"** is `<input type="file" accept="image/*,application/pdf">` with no `capture`. Phones then offer gallery, files or camera.

This works the same in an installed PWA and in a browser tab, and needs no permission prompt. A live camera view (`getUserMedia`) is only needed for scanning the QR live, and v1 does not need that.

## Proposal, plainest first

1. **QR only, no AI.**
   - What it does: "Add receipt" takes a photo and decodes the QR with jsQR (fits the current CSP). It builds a draft with date, time and total, and offers the bank transaction with the same amount on that day. The user picks one category.
   - Cost: no keys, no cost, no data leaves the device.
   - Limits: no merchant name unless matched to the bank, no items. Fails on receipts with no QR (pre-2021, foreign, damaged) or a QR the phone cannot read.
2. **Add one AI read, with two adapters.**
   - Adapters: Anthropic native, plus one OpenAI-compatible adapter with presets for OpenAI and OpenRouter. Ollama comes as a laptop-only preset with a short setup note (`OLLAMA_ORIGINS`).
   - Default models: Claude Haiku 5.5 or GPT-6 Luna, both about $0.0014 a receipt.
   - Keys: stored like the price vendor keys and synced through the Drive app folder. OpenRouter's PKCE sign-in is added later so phone users never paste a key.
   - Checks: the QR total and the bank amount both check the AI's total.
3. **Then widen.** Add Gemini, Mistral and Groq presets (same adapter, CSP entries only), learned rules, the auto-retry on a sum mismatch, and PDF receipts for the providers that take them.

Before step 2 ships, run a small eval: 20 real receipts from Konzum, Lidl, Spar, a pharmacy, a café with PNP and a petrol station. Run them through Haiku 5.5, GPT-6 Luna, Gemini 3.1 Flash-Lite and one local Qwen or Gemma vision model, and score:

- the total matches
- the line sum matches
- items read right
- categories right

This costs well under $1.

## Decisions only the owner can make

### 1. Does a receipt add new transactions or split the bank payment?

You pay €23.49 by card at Konzum. The Erste feed already has "POS KUPOVINA KONZUM 23,49". You then photograph the receipt, which has groceries, dish soap and beer.

- **Split the bank row into the receipt's items.** Totals stay right with no double counting, and the bank row gains detail. This needs a matching step (amount, day, then merchant). A cash receipt with no bank row becomes a standalone cash transaction.
- **Create new draft transactions from the receipt.** This is simpler to build. But the €23.49 now counts twice until you delete or link one of them, every time.

Recommendation: split the bank row, with a standalone cash transaction as the fallback.

### 2. Which AI services can you point Kuna at?

A friend uses an OpenAI-compatible host Kuna does not list, for example a self-hosted server at their own https address.

- **A fixed list of providers plus localhost.** Kuna's CSP keeps naming every host. A script injected into the page cannot send a key or a photo anywhere else. Adding a provider means a Kuna release.
- **Any base URL the user types.** This covers every OpenAI-compatible service at once. But `connect-src` has to allow any https host, which removes the CSP's protection against a stolen key being sent away.

Recommendation: the fixed list.

### 3. Which model is the default?

You photograph 100 receipts a month.

- **Claude Haiku 5.5 or GPT-6 Luna.** About $0.15 a month. Accuracy is unknown until the eval.
- **Claude Sonnet 5.5.** About $2.80 a month, probably fewer misread lines.
- **A local model.** Free and private, but only on the laptop, and slower.

Recommendation: decide after the 20-receipt eval. Pick the cheapest model that matches the totals on at least 19 of 20 and gets most categories right.

### 4. Categories per item or per receipt?

A €61.20 Lidl receipt has 22 lines: food, cleaning products, a kids' toy and wine.

- **Per item, grouped by category on the review screen.** Your spending report shows wine apart from groceries. Review is three or four groups, not 22 rows. Each receipt costs a few seconds more to check.
- **One category per receipt, with an optional manual split.** It is quickest to confirm, but the toy and the wine vanish into "groceries".

Recommendation: per item, grouped.

### 5. Where do learned merchant and item rules live?

You correct "DET.TEK." at Konzum from groceries to household and tick "always".

- **The same rule store and shape the company app uses.** One rules concept and one engine, and rules look the same everywhere. But the personal ledger then owns a rules tab or file of its own in the same format. That is a storage ownership choice for the personal app.
- **A separate receipt-rules file in the Drive app folder.** This is quick to add. But it is a second rule type with its own matching, and these rules do not show where your bank categorisation rules do.

Recommendation: the same shape. Which store owns it depends on the personal app's storage plan, so that needs your answer.

### 6. Keep the photo after reading it?

Six months later the kettle breaks, and the shop wants the receipt.

- **Discard after extraction.** Nothing extra is stored and nothing to clean up. The paper receipt is the only proof.
- **Keep it in a Drive folder you pick.** You have proof for warranty and returns, and R1 receipts can go to the company accountant. It uses some Drive space and a `drive.file` write.

Recommendation: discard by default, with a "keep photo" switch per receipt.

### 7. What happens to an R1 receipt?

You buy printer toner for the company and the receipt shows the company's OIB as buyer.

- **Flag it as a company expense** and offer to move it to the company app as an owner advance. That shape already exists in the plan's `owner-advances` tab. This adds a link between the apps.
- **Treat it like any personal receipt.** It is simple, but the company cost is easy to miss.

Recommendation: flag it, and leave the move for a later wave.
