---
status: building
feature: spending
summary: A receipt photo that splits the payment it matches, read by its QR code first and then by an AI model with the user's own key.
---

# Receipt reading

The owner photographs or uploads a receipt. Its fiscal QR code gives the date and total, which match the bank payment, and one category files the whole receipt. That part is built. Next, a model reads the lines, puts each into the owner's categories or suggests new ones, and adds the amounts. The user brings their own key for Anthropic, OpenAI or another popular or open-source model.

## What the research found

- Every hosted provider tested accepts calls from the browser with the user's key. Anthropic needs the `anthropic-dangerous-direct-browser-access` header.
- Two adapters cover them all: Anthropic's Messages API, and one OpenAI-compatible adapter for OpenAI, OpenRouter, Gemini, Mistral, Groq, Ollama and LM Studio. A local model works only on the machine that runs it and needs `OLLAMA_ORIGINS`.
- A small model reads a receipt for well under a cent.
- The Croatian fiscal QR code holds the receipt's JIR or ZKI, the date and time and the total, but no seller and no lines. It checks the model's total and matches the bank payment, but cannot replace the read. Firefox has no `BarcodeDetector`, so the QR is read with jsQR.
- The Content Security Policy has `blob:` in `img-src` for the preview, and each AI host in `connect-src`.
- The key store moved from Investments to `src/shared/secrets`, the first stage of the AI assist plan.

## Order

QR only first, which is built as the plan's 4a. Then the AI read as 4b, with its model picked by a test on 20 receipts, then more providers, and PDFs.

## Open

- Unconfirmed: OpenAI's key-safety page, an OpenAI model's image tokens, Mistral's retention, LM Studio's structured output, HEIC photos and a real receipt's QR address. The check page's script still reads the parameters the plan names, but no real receipt has been scanned.
- How it meets [one AI module for all apps](ai-assist.md), which is 4b.

## Docs

- [Receipt research](../features/spending/research/lane3-receipts.md)
- [Code and data model](../features/spending/research/lane1-code.md)

The build plan: [the spending plan, stage 4](../features/spending/plan.md).
