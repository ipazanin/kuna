---
status: planned
feature: spending
summary: A receipt photo read by an AI model with the user's own key, its lines sorted into the spending categories.
---

# Receipt reading

The owner photographs or uploads a receipt. A model reads it, puts each line into the owner's categories or suggests new ones, and adds the amounts. The user brings their own key for Anthropic, OpenAI or another popular or open-source model.

## What the research found

- Every hosted provider tested accepts calls from the browser with the user's key. Anthropic needs the `anthropic-dangerous-direct-browser-access` header.
- Two adapters cover them all: Anthropic's Messages API, and one OpenAI-compatible adapter for OpenAI, OpenRouter, Gemini, Mistral, Groq, Ollama and LM Studio. A local model works only on the machine that runs it and needs `OLLAMA_ORIGINS`.
- A small model reads a receipt for well under a cent.
- The Croatian fiscal QR code holds the receipt's JIR or ZKI, the date and time and the total, but no seller and no lines. It checks the model's total and matches the bank payment, but cannot replace the read. Firefox has no `BarcodeDetector`, so the QR is read with jsQR.
- The Content Security Policy needs each AI host in `connect-src` and `blob:` in `img-src`.
- The key store moves from Investments to `src/shared/secrets`, the first stage of the AI assist plan, before receipts use it.

## Proposed order

QR only first. Then the two adapters with a cheap default picked by a test on 20 receipts, then more providers, rules learned per seller's OIB, and PDFs.

## Open

- Whether to keep the photo on Drive beside the spending file, as invoice PDFs already are, or only the read lines. The research recommends keeping the photo.
- Unconfirmed: OpenAI's key-safety page, an OpenAI model's image tokens, Mistral's retention, LM Studio's structured output, HEIC photos and a real receipt's QR address.
- How it meets [one AI module for all apps](ai-assist.md).

## Docs

- [Receipt research](../features/spending/research/lane3-receipts.md)
- [Code and data model](../features/spending/research/lane1-code.md)

The build plan is written and waits for the owner's review: [the spending plan, stage 4](../features/spending/plan.md).
