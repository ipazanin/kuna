---
checked: 2026-11-04
nn_through: 126/26
summary: The confidence scale and how it maps to the Tax screen's three marks, how a citation is written, and how values are tied to a year
---

# Confidence and citations

How these docs mark how sure a value is, how they cite law, and how a value is tied to a year.

## The confidence scale

Every value carries one mark. Where a year's value differs in certainty, each year gets its own mark.

| Mark                     | Meaning                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirmed-nn`           | Read in the binding text: the Narodne novine page or issue PDF, or the EU Official Journal for EU law                                                                                              |
| `confirmed-consolidated` | Read in the zakon.hr or Porezna uprava consolidated text, with the amendment list checked. The NN article itself was not loaded                                                                    |
| `confirmed-table`        | Read in a list or table an authority compiles from binding texts, such as the Porezna uprava treaty map, or on a foreign authority's own page about its own rule, such as the SEC on US settlement |
| `reading`                | The text was loaded, and applying it to the case is an interpretation the text does not spell out                                                                                                  |
| `practice`               | Someone's filed figures apply it and match to the cent. It is not a rule found in the text                                                                                                         |
| `estimate`               | Worked out before the official figure exists                                                                                                                                                       |
| `pending`                | In a bill or draft not yet enacted                                                                                                                                                                 |
| `unconfirmed`            | Not loaded or not confirmed. Never used as a fact                                                                                                                                                  |

The last three are watched marks. A value marked `estimate`, `pending` or `unconfirmed` is never softened in any file. Each one sits on [the watch list](watch-list.md) with what is unknown and what would settle it.

### How the Tax screen shows a mark

The screen's rule list has three marks (`RuleMark` in `taxRules.ts`). Each doc mark maps to one:

| Screen mark | Doc marks                                                   |
| ----------- | ----------------------------------------------------------- |
| Settled     | `confirmed-nn`, `confirmed-consolidated`, `confirmed-table` |
| A reading   | `reading`, `practice`                                       |
| Unconfirmed | `estimate`, `pending`, `unconfirmed`                        |

Each rule section in the docs ends with the screen mark it supports. When the doc and the screen differ, the doc is right until the code catches up, and the difference is listed on [the watch list](watch-list.md#where-the-screen-and-the-docs-differ).

### Picking a mark

1. A value with two qualities, such as "read in the consolidated text, and a broker guide fills it in the same way", takes the first as its mark and states the rest in words.
2. When only part of a rule is uncertain, the rule keeps its mark and the uncertain part is stated next to it.
3. A mark is never raised without a new load of the text. Where a file raises one, it says which page was loaded and on which day.

## How a citation is written

Inline, a citation names the act by its abbreviation and the article, in plain text: ZPDoh Art. 67(8), ZPDoh Art. 65(2)(3), PravPDoh Art. 81(3) item 11, ZDop Art. 13(3). Several articles of one act go together: ZPDoh Art. 81(3), 81(4).

An article of an amending act itself, such as a transitional or in-force rule, is cited by its NN issue: NN 114/23 Art. 40, NN 138/20 Art. 17.

Each file ends with a "Sources" list. For each act it gives:

| Part      | What to write                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Act       | the abbreviation and the Croatian title, from [acts and issues](acts-and-issues.md)                                                                                                     |
| NN issues | the issues that set this wording, oldest first, as `number/yy`. Where no issue was read for the article, the act's listed issues, and then the mark is at most `confirmed-consolidated` |
| URL       | the page loaded: the consolidated page for a consolidated read, the NN page for an NN read                                                                                              |
| Date      | the day it was checked                                                                                                                                                                  |

A Croatian quote is copied exactly, and kept short.

Things that are not sources of a rule are named in words: professional commentary (RRiF, TEB), broker guides (Raiffeisen KAG, Finax), news reports, bills before the Sabor and drafts on e-Savjetovanja.

When the text behind a value was never loaded, the value is not a rule. It is an open item with no value until the text is read.

## How values are tied to a year

The docs cover the tax years 2023 to 2026, the years Kuna computes. Kuna computes nothing before 2023.

- A value holds for income received in a calendar year. The values for one rule follow each other with no gap and no overlap.
- "2027 assumed" means no enacted change was found in the Narodne novine through the file's `nn_through`. The value for 2026 carries on, and Kuna uses the 2026 row and says so.
- A value that a bill would change is `pending` from the bill's start, with the bill named.

### Which date picks the value

| Date           | Used for                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Settlement day | A sale's tax year, its rate and its HNB conversion. See [Capital gains](../investments/capital-gains.md)     |
| Payment day    | A dividend's, interest's or referral credit's tax year, rate and conversion                                  |
| Trade day      | The two-year test, as a reading. See [Capital gains](../investments/capital-gains.md#counting-the-two-years) |
| 31 December    | The capital gains JOPPD's report mark                                                                        |

## Sources

- Not acts. The research notes of 3 and 4 November 2026 behind the Tax screen.
