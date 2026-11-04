# Croatian law for Kuna's Tax screen

The Croatian personal income tax law the Investments Tax screen (`src/apps/investments/tax/`) builds on, for one case: a resident individual who invests through foreign brokers and files their own JOPPD, INO-IZJAVA and INO-DOH. Each file gives the rates, codes, days, deadlines and edge cases, with a citation for each and a mark for how sure the research is.

Law as researched on 4 November 2026. Consolidated texts on zakon.hr were current through NN 119/26, and the titles of NN 120/26 to 126/26 were checked for income tax, contribution and procedure acts. The Pravilnik o porezu na dohodak was read in the Porezna uprava consolidation through NN 157/25, and an NN title search found no 2026 amendment of it. Values that are not out yet, such as an entry into force of the US treaty, stay open in each file and on the [watch list](sources/watch-list.md).

This is research for building software. It is not legal or tax advice. Where the text leaves a real choice, the file says so and marks it `reading` or `unconfirmed`.

## How the docs are organised

| Folder or file                                          | Holds                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Capital gains](capital-gains.md)                       | Rates by year, the two-year exemption, losses, FIFO, fees, the year a sale counts in |
| [Foreign capital income](foreign-capital-income.md)     | Dividends and interest from abroad, the credit, US withholding, INO-IZJAVA, INO-DOH  |
| [Other investment income](other-investment-income.md)   | Stock lending and referral credits                                                   |
| [JOPPD for investors](joppd-for-investors.md)           | Report mark, report type, codes, the fields Kuna fills, the code-02 line, due dates  |
| [HNB rates and settlement](hnb-rates-and-settlement.md) | Which HNB list converts a payment, settlement cycles, TARGET days                    |
| [Filing calendar](filing-calendar.md)                   | Every deadline in one table, each naming the file that owns it                       |
| `sources/`                                              | Where to read the law, versions and dates, marks and citations, acts, the watch list |

Every file starts with frontmatter that the index below is generated from:

```yaml
---
checked: 2026-11-04
nn_through: 126/26
summary: One line on what the file covers
---
```

`checked` is the date the file's law was last verified, and `nn_through` the last Narodne novine issue that check covered. [Official sources](sources/official-sources.md) says where to read the law, and [Versions and dates](sources/versions-and-dates.md) how to tell which text applies on a date. After adding a file or changing its frontmatter, run `npm run law-index`. `npm test` fails while the index is stale.

Every file has the same shape: what it covers, the rules under headings, a worked example where a figure is computed, "Open points" for anything unsettled, and "Sources" with the acts, their NN issues and the pages loaded. Worked examples use made-up round figures.

## Tied to the code

Each rule row on the Tax screen names the file and heading it rests on, in `TAX_RULES` in `src/apps/investments/tax/domain/taxRules.ts`. `tests/lawDocs.spec.ts` fails when a rule names a file or heading that is missing, when the "Screen:" sentence under that heading does not name the screen marks of the rules resting on it, when the rates under "Rates by year" in [Capital gains](capital-gains.md#rates-by-year) and [Foreign capital income](foreign-capital-income.md#rates-by-year) differ from the rows in `taxRules.ts`, when the table under "Codes" in [JOPPD for investors](joppd-for-investors.md#codes) differs from `JOPPD_CODES`, and when the days under "Settlement cycles" in [HNB rates and settlement](hnb-rates-and-settlement.md#settlement-cycles) differ from `settlementDay.ts`. Those four tables are read by the spec, so keep their headers as they are.

A rule changes in its owning file first, then in the code. The [filing calendar](filing-calendar.md) gathers the deadlines and names the file that owns each.

## Reading a citation

Citations name the act by its abbreviation and the article, as `ZPDoh Art. 67(8)` or `PravPDoh Art. 81(3) item 11`. A paragraph is in brackets and a point after it, so `ZPDoh Art. 65(2)(3)` is Art. 65, paragraph 2, point 3. An NN issue in brackets after an article, as `ZPDoh Art. 70(4) (NN 114/23)`, is the issue that set that wording.

| Abbreviation | Act                                                                    |
| ------------ | ---------------------------------------------------------------------- |
| ZPDoh        | Zakon o porezu na dohodak (income tax act)                             |
| PravPDoh     | Pravilnik o porezu na dohodak                                          |
| ZDop         | Zakon o doprinosima (contributions act)                                |
| ZLP          | Zakon o lokalnim porezima (local taxes act)                            |
| OPZ          | Opći porezni zakon (general tax act)                                   |
| ZUP          | Zakon o općem upravnom postupku (general administrative procedure act) |
| CSDR         | Regulation (EU) No 909/2014 on central securities depositories         |

[Acts and issues](sources/acts-and-issues.md) lists every act cited, with its NN history, its consolidated text and how the research read it. [Confidence and citations](sources/confidence-and-citations.md) explains how a citation is written and how values are tied to a year.

## Confidence marks

| Mark                     | Meaning                                                                                                | On the Tax screen |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------- |
| `confirmed-nn`           | Read in the binding text: Narodne novine, or the EU Official Journal for EU law                        | Settled           |
| `confirmed-consolidated` | Read in a consolidated text (zakon.hr or Porezna uprava), with the amendment list checked              | Settled           |
| `confirmed-table`        | Read in a list or table an authority compiles, or on a foreign authority's own page about its own rule | Settled           |
| `reading`                | The text was loaded, and applying it to the case is an interpretation                                  | A reading         |
| `practice`               | Someone's filed figures apply it and match to the cent                                                 | A reading         |
| `estimate`               | Derived before the official figure exists                                                              | Unconfirmed       |
| `pending`                | In a bill or draft not yet enacted                                                                     | Unconfirmed       |
| `unconfirmed`            | Not loaded or not confirmed. Never used as a fact                                                      | Unconfirmed       |

`estimate`, `pending` and `unconfirmed` are never softened. Each one is on the watch list with what is unknown and what would settle it.

## Index

<!-- LAW-INDEX:START -->

### Rules

| File                                                    | Checked through       | Covers                                                                                                                                                                                                                                                |
| ------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Capital gains](capital-gains.md)                       | NN 126/26, 2026-11-04 | Capital gains on shares and fund units by year from 2023, the two-year exemption and its day count, losses, FIFO per ISIN across accounts, fees, converting a gain once, and the year a sale counts in                                                |
| [Filing calendar](filing-calendar.md)                   | NN 126/26, 2026-11-04 | Every deadline of a resident investor in one table, per payment and per year, with the dates for 2026 income, how a deadline moves past a weekend, and the file that owns each                                                                        |
| [Foreign capital income](foreign-capital-income.md)     | NN 126/26, 2026-11-04 | Dividends and interest paid from abroad, the Croatian rate by year, the credit for tax withheld abroad up to it, US withholding with no treaty in force, the INO-IZJAVA and INO-DOH route, the 30-day JOPPD route, broker interest and Croatian ISINs |
| [HNB rates and settlement](hnb-rates-and-settlement.md) | NN 126/26, 2026-11-04 | Which HNB list converts a sale or a payment in a foreign currency, how it relates to the ECB rate of the day, the settlement day as the day of payment, US and EU settlement cycles, and TARGET closing days                                          |
| [JOPPD for investors](joppd-for-investors.md)           | NN 126/26, 2026-11-04 | The JOPPD a person files for a year's capital gains and within 30 days for income from abroad, its report mark and type, the recipient and receipt codes, the fields Kuna fills, the code-02 line and the due dates                                   |
| [Other investment income](other-investment-income.md)   | NN 126/26, 2026-11-04 | Stock lending income read as interest at the capital income rate, and referral credits read as other income from abroad, with their 30 days, pension contributions and the city's lower rate                                                          |

### `sources/`

| File                                                            | Checked through       | Covers                                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Acts and issues](sources/acts-and-issues.md)                   | NN 126/26, 2026-11-04 | Every act, bylaw, EU regulation and official document cited, its Croatian title, NN history, the page its text was read from, and how it was read                         |
| [Confidence and citations](sources/confidence-and-citations.md) | NN 126/26, 2026-11-04 | The confidence scale and how it maps to the Tax screen's three marks, how a citation is written, and how values are tied to a year                                        |
| [Official sources](sources/official-sources.md)                 | NN 126/26, 2026-11-04 | Where the acts, bylaws, forms, guidance, exchange rates and foreign rules behind the Tax screen are published, how each is dated, and how to reach it                     |
| [Versions and dates](sources/versions-and-dates.md)             | NN 126/26, 2026-11-04 | Reading publication, entry into force and application dates, which version of a text applies to a year's income, and the Croatian terms for them                          |
| [Watch list](sources/watch-list.md)                             | NN 126/26, 2026-11-04 | Treaty steps, bills, settlement changes, readings and unconfirmed points behind the Tax screen, each with what settles it, and every place the screen and the docs differ |
| [Watching for changes](sources/watching-for-changes.md)         | NN 126/26, 2026-11-04 | How to notice new acts, amendments, forms, treaty steps and settlement changes, and when each yearly item usually appears                                                 |

<!-- LAW-INDEX:END -->
