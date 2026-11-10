# Croatian law for Kuna

The Croatian law three of Kuna's apps build on, each in a folder of its own.

- `investments/` is the personal income tax law behind the Investments Tax screen (`src/apps/investments/tax/`), for one case: a resident individual who invests through foreign brokers and files their own JOPPD, INO-IZJAVA and INO-DOH.
- `company/` is the profit tax, VAT, accounting and income tax law behind the Company app's tax classes, state payments (`src/apps/company/packs/hr-doo/preset/`) and business trips, for a Croatian d.o.o. whose accountant keeps the books.

- `assets/` is the customs table of value loss (NN 1/2017) the Assets app estimates a car by.

Each file gives the rates, codes, days, deadlines and edge cases, with a citation for each and a mark for how sure the research is. `sources/` is shared by all three.

Law as researched on 4 November 2026. Consolidated texts on zakon.hr were current through NN 119/26, and the titles of NN 120/26 to 126/26 were checked for income tax, contribution and procedure acts. The Pravilnik o porezu na dohodak was read in the Porezna uprava consolidation through NN 157/25, and an NN title search found no 2026 amendment of it. Values that are not out yet, such as an entry into force of the US treaty, stay open in each file and on the [watch list](sources/watch-list.md).

This is research for building software. It is not legal or tax advice. Where the text leaves a real choice, the file says so and marks it `reading` or `unconfirmed`. For the company, the accountant keeps the books and makes the judgement calls, and Kuna only says how it counts a category for its estimates.

## How the docs are organised

| Folder or file                                                      | Holds                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Capital gains](investments/capital-gains.md)                       | Rates by year, the two-year exemption, losses, FIFO, fees, the year a sale counts in |
| [Foreign capital income](investments/foreign-capital-income.md)     | Dividends and interest from abroad, the credit, US withholding, INO-IZJAVA, INO-DOH  |
| [Other investment income](investments/other-investment-income.md)   | Stock lending and referral credits                                                   |
| [JOPPD for investors](investments/joppd-for-investors.md)           | Report mark, report type, codes, the fields Kuna fills, the code-02 line, due dates  |
| [HNB rates and settlement](investments/hnb-rates-and-settlement.md) | Which HNB list converts a payment, settlement cycles, TARGET days                    |
| [Filing calendar](investments/filing-calendar.md)                   | Every deadline in one table, each naming the file that owns it                       |
| [Tax classes](company/tax-classes.md)                               | Each Company category's class, its add-back, its VAT and buckets, and the law        |
| [State payments](company/state-payments.md)                         | The Naputak's revenue codes, model HR68, the contribution accounts, the seeded rules |
| [Business trips](company/business-trips.md)                         | Per diems at home and abroad, private car kilometres, meals, the travel order, JOPPD |
| [Books and kontos](company/books-and-kontos.md)                     | What the accounting act asks, why Kuna ships no chart of accounts                    |
| [Used car value](assets/used-car-value.md)                          | Tablica 1 of NN 1/2017, how its months count, how the Assets app estimates a car     |
| `sources/`                                                          | Where to read the law, versions and dates, marks and citations, acts, the watch list |

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

`tests/lawDocs.spec.ts` ties both folders to the code, and `tests/taxClasses.spec.ts` ties the company's classes to the ruleset.

**Investments.** Each rule row on the Tax screen names the file and heading it rests on, in `TAX_RULES` in `src/apps/investments/tax/domain/taxRules.ts`. The spec fails when a rule names a file or heading that is missing, when the "Screen:" sentence under that heading does not name the screen marks of the rules resting on it, when the rates under "Rates by year" in [Capital gains](investments/capital-gains.md#rates-by-year) and [Foreign capital income](investments/foreign-capital-income.md#rates-by-year) differ from the rows in `taxRules.ts`, when the table under "Codes" in [JOPPD for investors](investments/joppd-for-investors.md#codes) differs from `JOPPD_CODES`, and when the days under "Settlement cycles" in [HNB rates and settlement](investments/hnb-rates-and-settlement.md#settlement-cycles) differ from `settlementDay.ts`.

**Company.** Each tax class names the heading it rests on, in `TAX_CLASSES` in `src/apps/company/packs/hr-doo/preset/domain/taxClasses.ts`. The spec fails when a class names a file or heading that is missing, when the table under "Classes" in [Tax classes](company/tax-classes.md#classes) has a row no class has or lacks one, when a row's add-back or input VAT share differs from the ruleset on its `From` day, or its VAT treatments and buckets from the class's, and when the table under "Revenue codes" in [State payments](company/state-payments.md#revenue-codes) differs from `hr.state.revenue-codes` and the seeded rules. `tests/taxClasses.spec.ts` fails when a class reads a rule the ruleset lacks, is carried by a role no category may carry, or allows a VAT treatment or a bucket the categories tab does not know.

The tables the spec reads keep their headers as they are. A rule changes in its owning file first, then in the code. The [filing calendar](investments/filing-calendar.md) gathers the Investments deadlines and names the file that owns each.

## Reading a citation

Citations name the act by its abbreviation and the article, as `ZPDoh Art. 67(8)` or `PravPDoh Art. 81(3) item 11`. A paragraph is in brackets and a point after it, so `ZPDoh Art. 65(2)(3)` is Art. 65, paragraph 2, point 3. An NN issue in brackets after an article, as `ZPDoh Art. 70(4) (NN 114/23)`, is the issue that set that wording.

| Abbreviation | Act                                                                    |
| ------------ | ---------------------------------------------------------------------- |
| ZPDoh        | Zakon o porezu na dohodak (income tax act)                             |
| PravPDoh     | Pravilnik o porezu na dohodak                                          |
| ZPD          | Zakon o porezu na dobit (profit tax act)                               |
| PravPD       | Pravilnik o porezu na dobit                                            |
| ZPDV         | Zakon o porezu na dodanu vrijednost (VAT act)                          |
| ZDop         | Zakon o doprinosima (contributions act)                                |
| ZoR          | Zakon o računovodstvu (accounting act)                                 |
| HSFI         | Hrvatski standardi financijskog izvještavanja                          |
| ZTD          | Zakon o trgovačkim društvima (companies act)                           |
| ZLP          | Zakon o lokalnim porezima (local taxes act)                            |
| OPZ          | Opći porezni zakon (general tax act)                                   |
| ZUP          | Zakon o općem upravnom postupku (general administrative procedure act) |
| CSDR         | Regulation (EU) No 909/2014 on central securities depositories         |

[Acts and issues](sources/acts-and-issues.md) lists every act the Investments files cite, with its NN history, its consolidated text and how the research read it. The company's acts are in the ruleset's act registry (`src/apps/company/packs/hr-doo/ruleset/acts.ts`). [Confidence and citations](sources/confidence-and-citations.md) explains how a citation is written and how values are tied to a year.

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

### `assets/`

| File                                       | Checked through     | Covers                                                                                                                                                        |
| ------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Used car value](assets/used-car-value.md) | NN 1/17, 2026-11-04 | The customs table of NN 1/2017 that the Assets app estimates a car by, from its price and first registration, how its months count, and what the table is not |

### `company/`

| File                                            | Checked through       | Covers                                                                                                                                                                                                                                   |
| ----------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Books and kontos](company/books-and-kontos.md) | NN 59/26, 2026-11-04  | What the accounting act asks of a d.o.o.'s books, why Kuna ships no chart of accounts, and what the accountant decides that Kuna only estimates                                                                                          |
| [Business trips](company/business-trips.md)     | NN 129/26, 2026-11-10 | Business trips of a d.o.o.'s employee, the tax-free per diems at home and abroad, private car kilometres, meals provided, the hours and the distance a trip needs, what the travel order holds, and the JOPPD code 17 with its deadlines |
| [State payments](company/state-payments.md)     | NN 18/26, 2026-11-04  | How a d.o.o. pays the state, the Naputak's revenue codes with model HR68, the contribution accounts, and the category rules new books start with for each                                                                                |
| [Tax classes](company/tax-classes.md)           | NN 119/26, 2026-11-04 | The tax class each Company category carries, how Kuna counts it for the profit tax and VAT, the VAT treatments and buckets it allows, and the act and article behind it                                                                  |

### `investments/`

| File                                                                | Checked through       | Covers                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Capital gains](investments/capital-gains.md)                       | NN 126/26, 2026-11-04 | Capital gains on shares and fund units by year from 2023, the two-year exemption and its day count, losses, FIFO per ISIN across accounts, fees, converting a gain once, and the year a sale counts in                                                |
| [Filing calendar](investments/filing-calendar.md)                   | NN 126/26, 2026-11-04 | Every deadline of a resident investor in one table, per payment and per year, with the dates for 2026 income, how a deadline moves past a weekend, and the file that owns each                                                                        |
| [Foreign capital income](investments/foreign-capital-income.md)     | NN 126/26, 2026-11-04 | Dividends and interest paid from abroad, the Croatian rate by year, the credit for tax withheld abroad up to it, US withholding with no treaty in force, the INO-IZJAVA and INO-DOH route, the 30-day JOPPD route, broker interest and Croatian ISINs |
| [HNB rates and settlement](investments/hnb-rates-and-settlement.md) | NN 126/26, 2026-11-04 | Which HNB list converts a sale or a payment in a foreign currency, how it relates to the ECB rate of the day, the settlement day as the day of payment, US and EU settlement cycles, and TARGET closing days                                          |
| [JOPPD for investors](investments/joppd-for-investors.md)           | NN 126/26, 2026-11-04 | The JOPPD a person files for a year's capital gains and within 30 days for income from abroad, its report mark and type, the recipient and receipt codes, the fields Kuna fills, the code-02 line and the due dates                                   |
| [Other investment income](investments/other-investment-income.md)   | NN 126/26, 2026-11-04 | Stock lending income read as interest at the capital income rate, and referral credits read as other income from abroad, with their 30 days, pension contributions and the city's lower rate                                                          |

### `sources/`

| File                                                            | Checked through       | Covers                                                                                                                                                                                                  |
| --------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Acts and issues](sources/acts-and-issues.md)                   | NN 126/26, 2026-11-04 | Every act, bylaw, EU regulation and official document cited, its Croatian title, NN history, the page its text was read from, and how it was read                                                       |
| [Confidence and citations](sources/confidence-and-citations.md) | NN 126/26, 2026-11-04 | The confidence scale and how it maps to the Tax screen's three marks, how a citation is written, and how values are tied to a year                                                                      |
| [Official sources](sources/official-sources.md)                 | NN 126/26, 2026-11-04 | Where the acts, bylaws, forms, guidance, exchange rates and foreign rules behind the Tax screen are published, how each is dated, and how to reach it                                                   |
| [Versions and dates](sources/versions-and-dates.md)             | NN 126/26, 2026-11-04 | Reading publication, entry into force and application dates, which version of a text applies to a year's income, and the Croatian terms for them                                                        |
| [Watch list](sources/watch-list.md)                             | NN 126/26, 2026-11-04 | Treaty steps, bills, settlement changes, readings and unconfirmed points behind the Tax screen and the company's tax classes, each with what settles it, and every place the screen and the docs differ |
| [Watching for changes](sources/watching-for-changes.md)         | NN 126/26, 2026-11-04 | How to notice new acts, amendments, forms, treaty steps and settlement changes, and when each yearly item usually appears                                                                               |

<!-- LAW-INDEX:END -->
