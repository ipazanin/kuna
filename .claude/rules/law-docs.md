---
paths:
  - 'docs/law/**'
  - 'src/apps/investments/tax/**'
---

# Law docs

- Follow the shape, citation format and confidence marks in [`docs/law/README.md`](../../docs/law/README.md). Use the [`law-research` skill](../../.agents/skills/law-research/SKILL.md) to find, date and verify the law.
- The docs cover one case: a resident individual investing through foreign brokers. Law for the company's books belongs elsewhere.
- Start every file with frontmatter: `checked` is the date its law was last verified, `nn_through` is the last Narodne novine issue that check covered, and `summary` says in one line what it covers. Update `checked` and `nn_through` only after verifying the whole file against the law, not after an edit. Run `npm run law-index` after adding a file or changing its frontmatter. Never edit the generated index by hand.
- State each rule once, in the file that owns it, and link to it from elsewhere. When a deadline changes, update the [filing calendar](../../docs/law/filing-calendar.md) too.
- Never state a figure without a citation and a confidence mark. Put anything unknown on the [watch list](../../docs/law/sources/watch-list.md).
- Each rule row in `TAX_RULES` names the file and heading it rests on. A new row lands with its doc section, and a renamed heading lands with its new anchor. `tests/lawDocs.spec.ts` fails otherwise.
- Keep the headers of the tables the spec reads: "Rates by year" in capital gains and foreign capital income, "Codes" in JOPPD for investors, and "Settlement cycles" in HNB rates and settlement.
- Under each heading a rule row names, keep one "Screen:" sentence that names the screen mark of every rule resting on it. Change it and the rule's `mark` together.
- Write in English, quote Croatian where the reading turns on the wording, and use made-up figures in examples.
