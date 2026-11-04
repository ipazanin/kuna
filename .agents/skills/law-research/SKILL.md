---
name: law-research
description: Find, date and verify the Croatian tax law behind Kuna's Investments Tax screen, and record it in docs/law/. Use whenever a task needs a rate, code, deadline, form, exchange rate day or settlement rule for a resident investing through foreign brokers, when adding or changing a rule row in src/apps/investments/tax/, when updating a file in docs/law/, or when checking whether the law or a yearly item has changed.
---

# Law research

Every figure the Tax screen computes rests on `docs/law/`. Read the law from its source, date it, cite it, and mark how sure you are. Never state a rate, code, deadline or form from memory or from a search snippet.

## Where to read

[Official sources](../../../docs/law/sources/official-sources.md) has the URL schemes and access notes for each source. In short:

| Source                                  | Status                                      | Use it for                                              |
| --------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Narodne novine (narodne-novine.nn.hr)   | The only binding Croatian text              | Every act, bylaw, amendment, correction and treaty law  |
| Porezna uprava Propisi JSON endpoints   | Unofficial consolidation with every version | The Pravilnik o porezu na dohodak as it stands, then NN |
| zakon.hr                                | Unofficial consolidation, lags NN           | Current ZPDoh, ZDop, OPZ, ZUP and their NN chains       |
| Porezna uprava forms, examples, notices | Official guidance, not law                  | JOPPD codes, the yearly capital gains notice, INO-DOH   |
| EUR-Lex through Cellar                  | Binding EU law                              | Settlement cycles under CSDR                            |
| HNB API, ECB data API                   | Official data                               | Which day's rate a list carries                         |
| SEC, IRS                                | Foreign authorities on their own rules      | US settlement, US withholding                           |
| Sabor                                   | Bills                                       | What is coming. Mark it `pending`                       |
| RRiF, TEB, broker guides, news          | Secondary                                   | Leads only. Find the source text before using a figure  |

Fetch with a browser user agent and follow redirects. Keep the Narodne novine API at three requests per second or less. Read EU texts through the Publications Office Cellar, because EUR-Lex challenges automated fetches. Keep downloads in a scratch folder, never in the repository.

## Find the text that applies

Follow the recipe in [Versions and dates](../../../docs/law/sources/versions-and-dates.md):

1. Get the amendment chain from the zakon.hr header or the Porezna uprava Propisi node, and cross-check it with an NN title search.
2. Check NN issues after the consolidator's cut-off for newer amendments.
3. Read each amendment's final and transitional articles for _stupa na snagu_ and _primjenjuje se_. Income of a year is taxed under the text its transitional article names, as NN 114/23 Art. 40 does for 2023.
4. Confirm the article in the NN text before marking it `confirmed-nn`.

## Record it

- Put the rule in the file that owns it, following the [`law-docs` rule](../../../.claude/rules/law-docs.md) and the conventions in [`docs/law/README.md`](../../../docs/law/README.md). Cite the act, article and NN issue, and give a confidence mark and the screen mark it supports.
- Quote the key line in Croatian when the reading turns on the wording.
- When a rule row is added or moved, set its `law` in `TAX_RULES` (`src/apps/investments/tax/domain/taxRules.ts`) to the file and heading. When a rate or a JOPPD code changes, change the table the spec reads and `taxRules.ts` together.
- Put anything unknown, pending or estimated on the [watch list](../../../docs/law/sources/watch-list.md) with what would settle it and when. Never soften `estimate`, `pending` or `unconfirmed`. List every place where the screen and a doc differ there too, and leave the code to its own change.
- When you have verified a whole file, set its `checked` date and `nn_through` issue. Update the [filing calendar](../../../docs/law/filing-calendar.md) when a deadline changes, and [acts and issues](../../../docs/law/sources/acts-and-issues.md) when you cite a new act or issue.
- Run `npm run law-index`, `npm run format` and `npm test`.

## Check for changes

[Watching for changes](../../../docs/law/sources/watching-for-changes.md) lists the signals and the yearly calendar.

1. Find the newest NN issue with the API (`POST /api/editions`) and compare it with the lowest `nn_through` in the [law index](../../../docs/law/README.md#index).
2. Scan the titles of the issues in between for the keywords listed there, and check the watch list items that are due.
3. Report what changed and which files it touches. Updating a file is a separate task with its own research.

## Limits

This is research for building software, not legal or tax advice. When the text leaves a real choice of interpretation, mark it `reading` and say so to the user instead of picking one silently.
