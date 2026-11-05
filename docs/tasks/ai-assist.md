---
status: building
feature: ai-assist
summary: One AI module and one key shared by every app, to help enter data and explain figures.
---

# AI help across the apps

The owner asked how every app could use the same AI models with the same API key to help enter data, most of all in Company, where there is much to organise and many laws to read.

## Findings

- One module, `src/shared/ai/`, can own the keys, the two adapters (Anthropic Messages and OpenAI-compatible), the tool loop and the generic checks. Each app owns its tasks, its read-only tools, the check against its own rules and the screen that writes a confirmed draft through its existing write path.
- The safest high-value tasks are in Company. Suggest categories for rows waiting in review, and explain a figure from the `TracedFigure` the pack already computes, which needs no tools at all.
- The law goes in as tools, not as one big prompt. The ruleset without local tax rates is about 108,000 characters, the local rates rule alone about 760,000, and `docs/law` about 121,000. A rule index sits in a cached system prompt, and tools return one rule version or one law section by id.
- A law question costs about half a cent on Haiku 5.5 and 5 to 7 cents on Sonnet 5.5 with tools.
- The model only drafts. Cited rule ids and law anchors must have come back from a tool in the same run, and an amount in an answer must equal a figure a tool returned, or the answer is flagged.
- `flagged_by = 'ai'` already exists and means "no rule decided this row", though no model ran. A real suggestion must not reuse it silently.

## Proposal

1. Move the keys codec and sync from Investments to `src/shared/keys/`, add `src/shared/ai/` with both adapters, an Assistant card in Kuna settings, a Kuna-wide AI keys file in the hidden Drive folder, and one task: suggest categories for the review queue.
2. Explain a figure, with no tools.
3. Questions with tools: ask the ruleset, "can I pay myself X" through the scenario functions, and explain an Investments tax line.
4. Documents: a loan offer PDF checked against Kuna's own EKS, a broker statement into import rows, the year-end package checked by its ties, an invoice into an asset or advance draft.
5. The rest: draft a rule from a coverage group, map an unknown export, more provider presets.

New boundary rules keep AI hosts in the adapters, keep `shared/ai` away from writes and mail, and keep assist tasks read-only.

## Open decisions

1. One model for everything, or a quick and a careful choice. Recommended: two choices, Haiku 5.5 and Sonnet 5.5.
2. A Kuna-wide AI keys file, or the existing Investments keys file. Recommended: the Kuna-wide file.
3. Which data may go to a hosted model. Recommended: anything with employee data stays local or manual.
4. Whether a confirmed suggestion stores anything new. Recommended: nothing, and the "AI guess" label is reworded to "No rule".
5. Whether many suggestions can be confirmed at once. Recommended: high-confidence ones in one tap, listed first, with Undo for the batch.
6. Whether the model may answer beyond Kuna's rules. Recommended: only from Kuna's library.

## Docs

- [One AI module shared by every app](../features/ai-assist/research/shared-module.md)
- The [receipt research](../features/spending/research/lane3-receipts.md) found that two adapters cover the hosted and local providers.
- The [module map](../architecture/modules.md) lists the key store in `src/shared/secrets`.

The build plan is written and waits for the owner's review: [the AI assist plan](../features/ai-assist/plan.md).

## Where it stands

Stages 1 to 4 are on main: the shared secrets file `kuna-secrets.json` with the migration of the old keys files, the AI module with both adapters and a model picker, suggested categories on the review queue, and Explain on a figure. Explain sends no row-level step and at most 300 steps of a figure's tree.

The first real call needs the owner's own key. It must confirm that `count_tokens` answers from a browser, since Test has no fallback, and that OpenRouter accepts `require_parameters`. Questions with tools, documents and the rest of the plan are still to build.
