# Investments tax plan: the Tax screen

Build plan for Investments stage 12, a Tax screen with Year, Sales, Foreign income and Turns tax-free tabs that works out the owner's 2026 capital gains tax, foreign income and deadlines from the FIFO lots at HNB's rate of each settlement day, with an XLSX register, a tax line on the sell form and a year-round home badge, checked against Kuna at e8963de.

Stage 12 of [the Investments plan](plan.md), built to the owner's answers of 3 Nov 2026. The rules come from the source research of 3 Nov and [lane 3](research/investments/lane3-maths-and-tax.md). Kuna was read at `e8963de`, and every `path:line` is against that commit. Every figure is made up. This is the owner's own tax, and the owner files it directly.

## Summary

- A fifth menu entry, **Tax**, after Performance, with a year select and four tabs: **Year**, **Sales**, **Foreign income** and **Turns tax-free**. Performance's Tax-free and Withheld tabs move into it and their old links follow.
- A dollar sale's gain is worked out in dollars and converted once, at HNB's rate for the sale's settlement day. That rate is the list HNB applies that day, which is the ECB rate of the previous TARGET working day, read from the prices file. A record's stored rate is never used.
- The base is gains minus losses on lots under two years, floored at zero, same year only. Losses on lots past two years are listed apart.
- Kuna gives the JOPPD figures (report mark 26365, codes 1001 and 1006, a code-02 line for tax-free gains, due 1 March 2027) and each foreign payment's route (INO-DOH, or JOPPD within 30 days).
- Each rule on screen and here is marked **settled** or **a reading**. Readings are built as they are.
- Extras: an XLSX register in Croatian, a tax line on the sell form, and a home badge that reaches year round.
- Stored data changes in one place only: two new income kinds, stock lending and referral credit. A file in today's shape still reads.

## What the owner sees

The menu reads Overview, Holdings, Transactions, Performance, Tax, with Settings apart. The route is `/investments/tax`, with `?year=` and `?tab=`. The icon is `i-lucide-landmark`, which the Withheld tab gives up.

The year select is a `USelect` under the `PageHeader`, listing each year with a sale or foreign income, newest first, kept in `?year=`. Without `?year=` it opens on the year whose JOPPD deadline comes next: 2026 until 1 Mar 2027, then 2027. It hides on Turns tax-free, which has no year. `ScreenSkeleton` shows while the file opens, and an `EmptyState` shows for a year with no sale and no foreign income.

### The worked example

All four tabs use one made-up 2026:

| Sale                                                                     | Lots it closes                                                                   | In its currency | Euros                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------- |
| Mon 2 Mar, 15 Example World ETF at €130.00, €1.00 fee                    | 10 units from 15 Jan 2024 (tax-free since 16 Jan 2026), 5 units from 10 Jun 2025 |                 | €298.33 tax-free, €49.17 taxable (lane 3's FIFO example) |
| Mon 15 Jun, 10 Example Dividend Co at $50.00, no fee, settles Tue 16 Jun | 10 units from 12 Jan 2026 at $60.00                                              | −$100.00        | ÷ 1.2500 = −€80.00, a taxable loss                       |
| Fri 2 Oct, 10 Example Tech at $120.00, no fee, settles Mon 5 Oct         | 10 units from 10 Mar 2025 at $100.00                                             | +$200.00        | ÷ 1.2000 (Friday's ECB rate) = €166.67                   |
| A 2023 lot of another share                                              |                                                                                  |                 | −€40.00, past two years, listed apart                    |

Monday 5 Oct takes Friday 2 Oct's ECB rate, 1.2000. Monday's own ECB rate, 1.2100, would give €165.29.

### Year

- Four `KpiTile` in `DashboardGrid layout="tiles"`: **Tax to pay €16.30** (caption "on JOPPD by 1 Mar 2027"), **Taxable gains €215.84** (lots under two years, before losses), **Losses offset €80.00**, **Tax-free gains €298.33** (lots past two years).
- A line under the tiles: "€40.00 of losses on lots past two years do not lower the tax. A reading."
- `AppCard` **What to type into JOPPD**, a `FactGrid`, each fact captioned Settled or A reading. JOPPD, INO-DOH and INO-IZJAVA carry `lang="hr"`.

| Field                                                    | 2026 example                            | Mark                                             |
| -------------------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Report mark                                              | 26365                                   | A reading (Porezna's crypto example)             |
| Report type, submitter mark                              | 11, 4                                   | A reading (same example)                         |
| 6.1 Recipient                                            | 1001                                    | A reading                                        |
| 6.2 Receipt                                              | 1006                                    | Settled                                          |
| 10.1, 10.2 Period                                        | 1.1.2026 to 31.12.2026                  | A reading                                        |
| 11 Primitak                                              | €215.84                                 | A reading                                        |
| 13.1 Izdatak                                             | €80.00, at most field 11                | A reading                                        |
| 13.3 Dohodak, 13.5 Porezna osnovica                      | €135.84                                 | A reading                                        |
| 14.1 Porez, page A V.2                                   | €16.30 (12% of €135.84)                 | Settled rate, field a reading                    |
| 14.2 Prirez                                              | €0.00                                   | Settled                                          |
| 16.1, 16.2 Payment                                       | 1, €16.30                               | A reading                                        |
| Second line: 15.1 code, 15.2 and 16.2 amount, page A VII | 02, €298.33, recipient and receipt 0000 | Code settled, reporting shares with it a reading |

- `AppCard` **Deadlines**: JOPPD and payment by Mon 1 Mar 2027 (settled). INO-DOH by Mon 1 Feb 2027, file by Fri 29 Jan (a reading). INO-IZJAVA by Thu 23 Jul 2026, eight days after the year's first payment with tax withheld abroad (settled). Each payment whose 30 days still run.
- A collapsible `AppCard` **Rules Kuna uses** (`tax.rules`), one line per rule in the rules table below with its mark and source.

### Sales

A collapsible `AppCard` (`tax.sales`) holding a `FigureTable`, one group per sale with its lot rows and the sale's total. Columns: sold, settles, holding, units, bought, days held, cost, proceeds and fees in the currency, gain in the currency, HNB rate, gain in euros, and a status word: **Taxable**, **Tax-free**, **Loss** or **Old loss, not offset**. Colour is never the only cue. Below 768 px each row takes two lines, as `HoldingRow.vue` does. `ShowAllButton` after ten sales. The download button sits in the card's header.

The Example Tech row reads: sold Fri 2 Oct, settles Mon 5 Oct (estimated), bought 10 Mar 2025, 571 days, cost $1,000.00, proceeds $1,200.00, fees $0.00, gain $200.00, HNB 1.2000, €166.67, Taxable.

Two warnings sit on the row they concern:

- **Within five days of the tax-free day.** A sale on Tue 13 Jan 2026 closing a lot tax-free from 16 Jan 2026 is taxable on trade dates, and settlement can move either end.
- **Traded in December, settles in January.** A Xetra sale on Wed 30 Dec 2026 settles in January 2027. Kuna counts it in 2026, the trade's year, and converts it at the settlement day's rate (a reading).

A sale whose settlement day has no rate in the prices file yet shows "Rate not out yet, at Fri 2 Oct's" and the euro figures read "about". A sale before the file's first ECB rate shows a warning naming it and stays out of the totals.

### Foreign income

A `FigureTable`, one row per payment of the year, with subtotals per country (the ISIN's first two letters, as `withheldByCountry.ts:27-30` does today). This replaces Withheld by country. Columns: paid, payer, country, kind, gross and withheld in the currency, HNB rate, gross and withheld in euros, Croatian 12%, credit, left to pay, route.

| Payment                                                       | Euros at HNB's rate     | 12%    | Credit | Left to pay         | Route                                                          |
| ------------------------------------------------------------- | ----------------------- | ------ | ------ | ------------------- | -------------------------------------------------------------- |
| Wed 15 Jul, US dividend $100.00, $30.00 withheld, rate 1.1000 | €90.91, €27.27 withheld | €10.91 | €10.91 | €0.00 (€16.36 lost) | INO-DOH by 1 Feb 2027, file by 29 Jan                          |
| Fri 16 Oct, Irish ETF distribution €50.00, nothing withheld   | €50.00                  | €6.00  | €0.00  | €6.00               | JOPPD within 30 days, by 15 Nov                                |
| Stock lending $10.00, nothing withheld, rate 1.1000           | €9.09                   | €1.09  | €0.00  | €1.09               | JOPPD within 30 days                                           |
| Wed 2 Sep, referral credit €40.00                             | €40.00                  | none   |        |                     | 30 days, by 2 Oct. "Rate set by your city, check." Unconfirmed |

- The US subtotal's caption says "No US treaty in force in 2026, 30% withheld".
- A dividend Revolut booked net (its note says so, `importDryRun.ts:595`, `:599`) is flagged "Booked net: type the tax withheld" and counted on neither route until the withholding is typed.
- A coupon is left out with a note, since bond interest is not taxed (Art. 65(2) item 4). Bonds wait for stage 13 anyway.
- Other income that is neither lending nor a referral, such as a refund of tax withheld, is listed with its note and no tax figure.
- A reversal lowers the year's figures for its payer and route.

### Turns tax-free

`TaxFreeTab.vue` as it is, moved from Performance.

### The download

`kuna-porez-2026.xlsx`, headers in Croatian whatever the screen's language:

- **Evidencija:** every buy, sale, split and spin-off of each instrument sold in the year, from its first buy, in the 2018 example's columns: R.br., Finan. imovina, Datum, Opis trans. (Kupnja, Prodaja), Iznos po jedinici, Količina, Ukupna vrijednost, Nabavna vrijednost otuđene imovine, Troškovi, Dobitak/gubitak (neto). Amounts are in the acquisition currency (Art. 70(6)), followed by Valuta, Datum namire, Tečaj HNB-a and Dobitak/gubitak (EUR). The titles come from a summary of the 2018 opinion, not its verbatim table, so they are unconfirmed.
- **Prodaje 2026**, **Inozemni dohodak 2026**: the two tabs' rows.
- **Sažetak**: the Year tab's figures and JOPPD fields.

### The sell form

`TradeSummary.vue:40-48` keeps "Past two years: 10 of 15 units free of tax" and gains one fact: "About €16.30 of tax on this sale, €16.30 for 2026 with it". The first figure is the year's tax with the sale minus the year's tax without it, so in the example the June loss shows: this sale alone would be €20.00. It reads "about" because a sale typed today settles tomorrow or later, before its rate is out. A lot within five days of its tax-free day gets the same warning as on Sales.

### The home card

The card has one `waiting` string (`appContribution.ts:41`), used today for late prices (`investmentsHomeCard.ts:34`). The nearest tax date wins, and any tax date wins over late prices:

- "INO-DOH by 29 Jan" in January, when last year has payments with tax withheld abroad.
- "JOPPD by 1 Mar" from 1 Jan to the deadline, when last year has any sale line, taxable or tax-free.
- "Tax on 1 payment by 15 Nov" at any time of year, while a payment with nothing withheld abroad is inside its 30 days.

Kuna does not know when the owner filed, so a badge stays until its date passes.

## The rules

Pages were loaded on 3 Nov 2026 unless the line says otherwise. Porezna's HTML pages came only through a fetch tool's summary.

| Rule                                                                                                  | Mark                                     | Source                                                                                                       | Kuna                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 12% on capital gains, no surtax                                                                       | Settled                                  | ZPDoh Art. 70(4), zakon.hr consolidated text current to NN 119/26. Porezna's notice of 13 Jan 2026 (summary) | `taxRules.ts`, keyed by year                                                                         |
| Tax-free after two years                                                                              | Settled                                  | Art. 67(8)                                                                                                   | The day after the second anniversary, on trade dates, as `lots.ts:92-95`                             |
| The anniversary day itself                                                                            | A reading                                | Art. 67(8) says "nakon dvije godine"                                                                         | Taxable on the anniversary. Warning within five days either side                                     |
| FIFO per kind of asset, across accounts                                                               | A reading                                | Art. 70(5), 70(8). RRiF copy of a Porezna opinion of 6 Apr 2016                                              | One queue per instrument (ISIN) across accounts, transfers keep lots (`lots.ts:242-246`, `:363-371`) |
| Register may be in the acquisition currency                                                           | Settled                                  | Art. 70(6)                                                                                                   | Lines carry currency legs                                                                            |
| Gain worked out in its currency, converted once                                                       | A reading                                | Art. 12(8) converts income, once, on the payment day. Raiffeisen KAG guide, Jan 2026. Finax guide 2024       | One conversion per sale                                                                              |
| HNB's rate of a day is the ECB rate of the previous TARGET working day                                | A reading of "objavljuje na dan isplate" | HNB API rows for 30 Oct to 3 Nov 2026. HNB's ECB rates page (summary)                                        | `hnbRate.ts`                                                                                         |
| The rate day is the settlement day                                                                    | A reading                                | Art. 12(8) "dan isplate", Art. 11(3) cash principle                                                          | Settlement day, estimated where not known                                                            |
| A late-December sale settling in January counts in the trade's year                                   | A reading                                | No source                                                                                                    | Counted in the trade's year, flagged                                                                 |
| Losses only against same-year gains, never below zero, no carry                                       | Settled                                  | Art. 67(11)                                                                                                  | Base floored at zero                                                                                 |
| Losses on lots past two years do not offset                                                           | A reading                                | Art. 67(8). RRiF copy of the 2016 opinion. Raiffeisen guide, Jan 2026                                        | Listed apart with a note                                                                             |
| JOPPD and payment by the last day of February, moved past a weekend                                   | Settled                                  | Art. 70(4). ZUP Art. 81(2) through OPZ Art. 4. Porezna's crypto example of 6 Feb 2026 ("do 2. ožujka 2026.") | 1 Mar 2027                                                                                           |
| Receipt code 1006, non-taxable code 02                                                                | Settled                                  | Porezna's JOPPD form with annexes, created 24 Dec 2025                                                       | Shown                                                                                                |
| Recipient 1001, mark 26365, type 11, submitter 4, the field mapping                                   | A reading                                | Porezna's crypto example and its PDF. Raiffeisen and Finax guides                                            | Shown                                                                                                |
| Tax-free share gains reported with code 02                                                            | A reading                                | Duty stated for crypto only (Porezna, 6 Feb 2026)                                                            | One code-02 line                                                                                     |
| Foreign tax credited per payment, at most the Croatian 12%                                            | Settled                                  | Art. 80(2), (3). Porezna's Austrian INO-DOH example                                                          | Credit is the lower of withheld and 12%                                                              |
| No US treaty in 2026, 30% withheld                                                                    | Settled                                  | Porezna's treaty page 7559 (summary). tportal, 30 Jul 2026                                                   | Caption on the US subtotal                                                                           |
| Tax withheld abroad: INO-IZJAVA within 8 days of the year's first such payment, INO-DOH by 31 January | Settled                                  | Art. 81(3), (4)                                                                                              | Deadlines card                                                                                       |
| INO-DOH moves to Mon 1 Feb 2027                                                                       | A reading                                | ZUP Art. 81(2). TEB, 29 Jun 2026, gives 31.1.2027                                                            | 1 Feb, file by 29 Jan                                                                                |
| Nothing withheld abroad: pay and report within 30 days on a JOPPD                                     | Settled                                  | Art. 81(1)                                                                                                   | The 30th day, never moved, which is the cautious date                                                |
| Codes for 30-day JOPPDs: dividends 1003 and 1001, interest 1103 and 1005                              | A reading                                | Porezna's JOPPD code table                                                                                   | Shown on the payment's row                                                                           |
| Broker cash interest is taxable                                                                       | A reading                                | Art. 65(2) item 3 exempts only up to 0.5% a year at banks                                                    | Taxed at 12%                                                                                         |
| Stock lending is interest at 12%                                                                      | A reading                                | Art. 65(1) item 3                                                                                            | 12%, JOPPD in 30 days, or INO-DOH when withheld                                                      |
| Referral credit is other income at the city's rate                                                    | Unconfirmed                              | Art. 39(2), (3) item 11. Art. 19a, 40                                                                        | Amount and date, no figure                                                                           |
| US settlement is one business day from 28 May 2024                                                    | Settled for the US                       | SEC press release 2023-29: "The compliance date for the final rules is May 28, 2024."                        | Settlement estimate                                                                                  |
| European listings settle in two business days                                                         | Unconfirmed, not loaded                  |                                                                                                              | Settlement estimate                                                                                  |

## Stored data

**New income kinds.** `INCOME_KINDS` (`income.ts:7`) gains `lending` and `referral`. Both are taxed apart from `other`, so the owner agreed to them.

- The import already tells them apart by the workbook's row type, which is what writes the note today (`importDryRun.ts:599`). It sets the kind from the same test at `importDryRun.ts:604`.
- Records already stored as `other` are picked by their note. `incomeOf` (`incomeReading.ts:21`) reads an `other` whose note has a part equal to the stock yield or referral label, in English or Croatian (`imports/domain/words.ts:9-10`, `:21-22`), as the new kind. A reversal's note keeps the label after its first part (`importDryRun.ts:612`), so it is picked too.
- Why today's file still reads: `other` stays a valid kind, no field is added or removed, and the reader does the picking. A record changes its stored kind only when it is next written.
- An older build on another device refuses the new kinds and lists those records as problems (`readInvestmentBook.ts:111-119`), as it does any record it cannot read.
- Both new kinds stay in the Income tab's `other` group (`incomeHistory.ts:17`), so the Income figures do not move.

**No settlement day is stored.** `Trade` has only `date` (`trade.ts:15`). Kuna estimates it as the trade day plus one weekday for a USD instrument traded from 28 May 2024, and two weekdays otherwise. Exchange holidays are not known, so an estimate can be a day early. Every settlement day on screen and in the XLSX reads "estimated". A stored settle date can come later with a broker reader that has one.

**Closed lot lines are not stored.** `RealisedLine` (`lots.ts:49-60`) is worked out on every read (`lots.ts:247-293`). It gains `costInCurrency`, `proceedsInCurrency` and `feesInCurrency`, split by quantity with `decimalParts` as the euro legs are. The cost share comes from `Lot.costInCurrency` (`lots.ts:40`), which spin-offs already carry (`lots.ts:335-346`). The days are the lot's `opened` and the sale's `trade.date`. The file does not change.

**The rate port.** `RateBook` (`rateBook.ts:9-12`) gains `newestDay(currency)`. `unitsPerEuroOnOrBefore` (`pricesFileBooks.ts:100-107`) falls back silently to an older rate when the file is behind. So a rate counts as final only when the series reaches the day before the settlement day, and it is an estimate otherwise.

## Stages

Each stage is one commit, checked with lint, format, typecheck, vitest, both builds and the targeted visual and touch checks. The new feature folder is `src/apps/investments/tax/`.

### 1. Rules, HNB's rate, settlement and deadlines

- New: `tax/domain/taxRules.ts` (a row per year from 2024: 12% on gains and on capital income, two years, US withholding with no treaty, each with its mark and source), `tax/domain/hnbRate.ts`, `tax/domain/settlementDay.ts`, `tax/domain/taxDeadlines.ts`.
- Changed: `prices/domain/rateBook.ts`, `prices/domain/pricesFileBooks.ts`, the rate books in `tests/fixtures/investments.ts`.
- A year with no row, such as 2027 before the bill is in Narodne novine, uses the newest row and says so.
- `tests/hnbRate.spec.ts`, made-up ECB rates: **a Monday takes Friday's rate** (Mon 5 Oct 2026 gives Fri 2 Oct's 1.2000, not Monday's 1.2100). A Saturday takes Friday's. Tue 7 Apr 2026 takes Thu 2 Apr's, past Good Friday and Easter Monday. A day before the series gives none. A series ending Fri 2 Oct asked for Wed 7 Oct gives Friday's rate marked as an estimate.
- `tests/settlementDay.spec.ts`: a USD trade on Fri 2 Oct 2026 settles Mon 5 Oct. A Xetra trade on Thu 1 Oct settles Mon 5 Oct. A USD trade on Fri 24 May 2024 settles in two weekdays. Wed 30 Dec 2026 on Xetra settles in January and is flagged.
- `tests/taxDeadlines.spec.ts`: 2025 gives Mon 2 Mar 2026, matching Porezna. 2026 gives Mon 1 Mar 2027. INO-DOH for 2026 gives 1 Feb 2027, safe 29 Jan. A payment on 16 Oct 2026 is due 15 Nov, unmoved. INO-IZJAVA after 15 Jul 2026 is due 23 Jul.

### 2. Closed lot lines carry their currency legs

- Changed: `holdings/domain/lots.ts`.
- `tests/investmentLots.spec.ts` gains: the Example Tech line carries cost $1,000.00, proceeds $1,200.00 and fees $0.00. A $1.00 fee over three lots splits to $0.33, $0.33 and $0.34. A spin-off lot's currency cost moves with it. Lane 3's euro figures stay as they are.

### 3. Stock lending and referral credit kinds

- Changed: `workbook/domain/income.ts`, `workbook/domain/incomeReading.ts`, `imports/domain/importDryRun.ts`, `workbook/domain/words.ts` (`incomeKinds`, `:71`, `:131`), `income/domain/incomeHistory.ts`. `IncomeFields.vue:25` lists the kinds by itself.
- `tests/investmentReaders.spec.ts`: an `other` with "Stock yield income" reads as `lending`, with "Nagrada za preporuku" as `referral`, a reversal with the label too, and an `other` with any other note stays `other`. `tests/portfolioWorkbook.spec.ts`: STOCK YIELD INCOME and REFERRAL CREDIT rows import as the new kinds and a second import adds nothing. `tests/incomeHistory.spec.ts`: both count as other income.

### 4. The tax year

- New: `tax/domain/taxYear.ts`. The year's lines by the sale's trade year, each sale's currency gain converted once at the HNB rate of its settlement day, the base, old losses apart, the JOPPD fields, the code-02 line, and the two warnings. It never reads `trade.rate`.
- Changed: `scripts/figure-digest.mjs` gains `investments.tax.<year>`.
- `tests/taxYear.spec.ts`:
  - The worked example gives 11 €215.84, 13.1 €80.00, 13.5 €135.84, 14.1 €16.30, code 02 €298.33 and €40.00 apart.
  - **The Monday-settling Example Tech sale converts at Friday's ECB rate**, €166.67, and a stored trade rate of 1.0800 changes nothing.
  - Losses larger than gains give zero. A 2025 loss leaves 2026 alone.
  - A sale on 13 Jan 2026 of a lot tax-free from 16 Jan is taxable and warned.
  - A spin-off lot keeps its parent's day.
  - Units bought at Broker One in Jan 2024, moved, and sold at Broker Two in Jul 2026 close the 2024 lot, tax-free.
  - A sale with no rate yet is marked as an estimate.

### 5. Foreign income

- New: `tax/domain/foreignIncome.ts`, which takes the country rule from `withheldByCountry.ts:27-30`.
- Changed: `scripts/figure-digest.mjs` gains `investments.tax.<year>.foreign`.
- `tests/foreignIncome.spec.ts`: the US $100.00 with $30.00 withheld gives €90.91, €10.91 credit, nothing to pay and INO-DOH. A US payment with 15% withheld is still credited only up to 12%. The Irish €50.00 gives €6.00 by 15 Nov. Lending of $10.00 gives €1.09. A referral credit gives a date and no figure. A net-booked dividend is flagged and on neither route. A coupon is left out. A reversal lowers its payer's figures.

### 6. The Tax screen, with the tabs moved from Performance

- New: `tax/presentation/TaxScreen.vue`, `YearTab.vue`, `SalesTab.vue`, `ForeignIncomeTab.vue`, `taxLinks.ts` (route, tab values `year`, `sales`, `foreign`, `tax-free`, and the default year), `words.ts`.
- Moved into `tax/`: `income/presentation/TaxFreeTab.vue` and `income/domain/taxFreeCalendar.ts`.
- Changed:
  - `app.ts:58-67`: screen and menu.
  - `PerformanceScreen.vue:14-15`, `:51-52`, `:60-61`, `:133-134`: the two tabs go, and `?tab=tax-free` and `?tab=withheld` are replaced with `/investments/tax?tab=tax-free` and `?tab=foreign`, through a `movedTab` in `performanceLinks.ts`.
  - `income/presentation/words.ts`: the tab, description and card words of both tabs go (`:11-12`, `:19-20`, `:64-90`, and the Croatian at `:147-148`, `:155-156`, `:200-226`). The Tax-free words move to `tax/presentation/words.ts`.
  - `fakeInvestments.ts`: a third block of records after the later ones, so earlier ids stay. It adds a sale of 12 Example Tech on Fri 2 Oct 2026 closing 10 tax-free units and 2 of the 8 Sep lot, a sale of Example Spin Co below cost (an old loss, since its lots carry the 2023 day), a US dividend with 30% withheld, an Example World ETF distribution with nothing withheld, a lending payment and a referral credit.
  - `scripts/visual-check.mjs`: `:148-149`, `:522-523`, `:2242-2275`.
  - `scripts/touch-check.mjs`.
- Deleted: `income/presentation/WithheldTab.vue`, `income/domain/withheldByCountry.ts`, `tests/withheldByCountry.spec.ts`.
- Proof:
  - `tests/taxLinks.spec.ts`: the default year on 15 Feb 2027 is 2026 and on 2 Mar 2027 is 2027. `movedTab` maps both old values.
  - `tests/taxFreeCalendar.spec.ts` passes unchanged apart from its import.
  - Visual pages `investments-tax`, `-sales`, `-foreign` and `-tax-free` on `?investments=sample` at `#/investments/tax?year=2026`, at 360, 768, 1440 and 1920 px in both themes, with Croatian pages at 360 px. The year is pinned because the fake day is the day the check runs (`visual-check.mjs:357`). Expected figures come from the domain functions, as `fakeIncomeShows` does (`:516-530`).
  - Performance's pages show eight tabs.
  - Touch: `investments-tax-sales` opens Sales on a phone and expands a sale. `investments-tax-old-link` opens `#/investments/performance?tab=withheld` and lands on Foreign income.
  - The design reviewer reports no Critical finding.

### 7. The download

- New: `tax/infrastructure/taxRegisterFile.ts`, which loads SheetJS through `src/shared/xlsx/sheetGrids.ts` as `portfolioTemplate.ts:53-54` does. The button in `SalesTab.vue` calls `downloadFile` (`src/shared/files/downloadFile.ts:5`).
- `tests/taxRegisterFile.spec.ts` reads the bytes back: four sheets, Croatian headers in an English session, Kupnja and Prodaja rows from the first buy, the HNB rate and euros on each sale row.
- Touch `investments-tax-sales` taps Download and checks the file name `kuna-porez-2026.xlsx`.

### 8. The tax line on the sell form

- Changed: `transactions/domain/tradePreview.ts` (it already takes the `RateBook`, `:43`), `TradeSummary.vue`, `transactions/presentation/words.ts` (`summary`, `:176`, `:354`).
- `tests/investmentWrites.spec.ts`: the worked example's Example Tech sale previews €16.30 on this sale and €16.30 for the year, €20.00 without the June loss, and "about" while its rate is not out.
- Touch `investments-usd-sell` after `investments-usd-buy` (`touch-check.mjs:2288`) types a sale at 360 px and reads the line.

### 9. The home badge

- New: `tax/domain/taxReminders.ts`. Changed: `home/presentation/investmentsHomeCard.ts:34`.
- `tests/taxReminders.spec.ts`: on 10 Jan 2027 "INO-DOH by 29 Jan" leads. On 15 Feb 2027 "JOPPD by 1 Mar". On 2 Mar 2027 nothing. On 3 Nov 2026, with the Irish payment of 16 Oct, "Tax on 1 payment by 15 Nov". A tax date wins over late prices.
- The home visual page's expected text comes from the same function on the check's day.

## Figure digests

- **Stage 2:** `investments.holding-N` changes its hash for each instrument with a sale, because a holding carries its `ClosedSale` lines (`holding.ts:69`, `:166`). Entry counts and every euro figure stay the same. No other group moves.
- **Stage 3:** nothing on the sample, which has no such rows. On the owner's live file `investments.read.records` changes for the stock yield and referral rows. The income groups stay the same.
- **Stages 4 and 5:** new `investments.tax.*` groups only.
- **Stage 6:** the new fake records change almost every `investments.*` group on the sample: records, holdings, cash, portfolio, last day, performance and income. Run the digest before and after and list the moved groups in the commit. The live file does not move.
- **Stages 7 to 9:** no change.
- Company and Loans groups stay the same throughout.

## New strings

Croatian runs a third longer, so every one is checked at 360 px.

| English                                                         | Croatian                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Tax                                                             | Porez                                                                       |
| Year, Sales, Foreign income                                     | Godina, Prodaje, Inozemni dohodak                                           |
| Tax to pay                                                      | Porez za uplatu                                                             |
| on JOPPD by 1 Mar 2027                                          | na JOPPD-u do 1. 3. 2027.                                                   |
| Taxable gains, Losses offset, Tax-free gains                    | Oporezivi dobici, Odbijeni gubici, Dobici bez poreza                        |
| Losses on lots past two years do not lower the tax              | Gubici na kupnjama starijim od dvije godine ne umanjuju porez               |
| What to type into JOPPD                                         | Što upisati u JOPPD                                                         |
| Deadlines                                                       | Rokovi                                                                      |
| Rules Kuna uses                                                 | Pravila koja Kuna koristi                                                   |
| Settled, A reading, Unconfirmed                                 | Utvrđeno, Tumačenje, Nepotvrđeno                                            |
| Taxable, Tax-free, Loss, Old loss, not offset                   | Oporezivo, Bez poreza, Gubitak, Stari gubitak, ne odbija se                 |
| Settles {day}, estimated                                        | Namira {day}, procjena                                                      |
| Within five days of the tax-free day                            | Unutar pet dana od dana bez poreza                                          |
| Traded in December, settles in January                          | Prodano u prosincu, namira u siječnju                                       |
| Rate not out yet, at {day}'s                                    | Tečaj još nije objavljen, uzet je onaj od {day}                             |
| No HNB rate for {day} in the prices file                        | U datoteci cijena nema tečaja HNB-a za {day}                                |
| HNB rate                                                        | Tečaj HNB-a                                                                 |
| Withheld abroad, Croatian 12%, Credit, Left to pay              | Zadržano u inozemstvu, Hrvatskih 12 %, Odbitak, Za uplatu                   |
| INO-DOH by 1 Feb 2027, file by 29 Jan                           | INO-DOH do 1. 2. 2027., predajte do 29. 1.                                  |
| JOPPD within 30 days, by {day}                                  | JOPPD u 30 dana, do {day}                                                   |
| INO-IZJAVA by {day}                                             | INO-IZJAVA do {day}                                                         |
| No US treaty in force in 2026, 30% withheld                     | Ugovor sa SAD-om u 2026. nije na snazi, zadržava se 30 %                    |
| Rate set by your city, check                                    | Stopu određuje vaš grad, provjerite                                         |
| Booked net: type the tax withheld                               | Knjiženo neto: upišite zadržani porez                                       |
| Stock lending, Referral credit (income kinds)                   | Posudba dionica, Nagrada za preporuku                                       |
| Download for Porezna (XLSX)                                     | Preuzmi za Poreznu (XLSX)                                                   |
| About {amount} of tax on this sale, {amount} for {year} with it | Oko {amount} poreza na ovu prodaju, {amount} za {year}. s njom              |
| JOPPD by 1 Mar, INO-DOH by 29 Jan                               | JOPPD do 1. 3., INO-DOH do 29. 1.                                           |
| Tax on {n} payment(s) by {day}                                  | Porez na {n} isplatu (isplate, isplata) do {day}, through the plural helper |
| No sale and no foreign income in {year}                         | Nema prodaja ni inozemnog dohotka u {year}.                                 |

The XLSX headers are Croatian only and are listed under the download.

## Still open

- **The 2027 bill.** The Government's draft of 10 Sep 2026, probably PZ 339, adds only the Croatian investment account and keeps 12%, two years, losses, FIFO and the February deadline. Add a 2027 row to `taxRules.ts` once it is in Narodne novine. Until then 2027 uses 2026's row and says so.
- **The US treaty.** Signed in 2022, protocol 28 Apr 2026, ratification bill in the Sabor since July. Add the 15% treaty rate to the year it comes into force.
- **The readings,** built as they are and marked on screen: converting once and which day's list, the settlement day and a late-December sale's year, the anniversary day, FIFO across brokers, old-lot losses, recipient 1001, the JOPPD field mapping, code 02 for shares, the INO-DOH weekend move, the 30-day JOPPD codes, broker interest, and lending as interest.
- **Unconfirmed:** the referral credit's tax, the 2018 register's exact column titles, and two-day settlement for European listings.
- **Settlement days are estimates** until a broker reader stores one.
- **The INO-IZJAVA date** is on the Deadlines card only. The owner's badge answer names JOPPD, INO-DOH and the 30-day payments, so the badge leaves it out.

## Sources

Loaded on 3 Nov 2026 unless marked.

- Zakon o porezu na dohodak, consolidated, https://www.zakon.hr/z/85/Zakon-o-porezu-na-dohodak (Arts. 11, 12, 39, 65, 67, 70, 80, 81 read verbatim). Not the official gazette.
- Zakon o općem upravnom postupku, Art. 81, https://www.zakon.hr/z/65/Zakon-o-op%C4%87em-upravnom-postupku. Opći porezni zakon, Art. 4, https://www.zakon.hr/z/100/Op%C4%87i-porezni-zakon.
- Porezna uprava, JOPPD form with annexes (created 24 Dec 2025), https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Documents/POREZ%20NA%20DOHODAK/JOPPD.pdf?vel=1253556.
- Porezna uprava, crypto JOPPD example, 6 Feb 2026, https://porezna-uprava.gov.hr/hr/primjer-podnosenja-obrasca-joppd-za-primitke-po-osnovi-trgovanja-kriptoimovinom/8342, and its PDF.
- Porezna uprava, Austrian dividend INO-DOH example, https://porezna-uprava.gov.hr/UserDocsImages/Arhiva/HR_obrasci/Obrasci%20nesvrstani/INODOH/DIVIDENDA%20AUSTRIJA.pdf?vel=497838.
- Porezna uprava pages read through a summary: capital gains notice of 13 Jan 2026 (8281), INO-DOH (4524, 4525), INO-IZJAVA (4526), questions and answers (4529), treaties (7559).
- Porezna uprava, opinion of 19 Mar 2018 on crypto gains, https://porezna-uprava.gov.hr/Misljenja/Detaljno/2335. Read by lane 3 on 30 Oct. Register column titles from a summary on 3 Nov.
- HNB, ECB reference rates page (summary) and https://api.hnb.hr/tecajn-eur/v3 (rows of 30 Oct to 3 Nov 2026).
- RRiF copy of a Porezna opinion of 6 Apr 2016, https://www.rrif.hr/oporezivanje_kapitalnih_dobitaka_i_dinamika_placan-3338-misljenje/.
- Raiffeisen KAG, guide for 2025 gains, Jan 2026, https://a.storyblok.com/f/314998/x/1ac8f064a3/brosura-porez-na-kapitalne-dobitke_2025.pdf.
- Finax, guide for 2024 gains, http://www.finax.eu/themes/finax-rebranding/assets/_static_docs/hr/FInax-Brosura-porez-2024.pdf.
- TEB, "Inozemni dohodak", 29 Jun 2026, https://teb.hr/novosti/2026/inozemni-dohodak/.
- tportal, 30 Jul 2026, on the US treaty, https://www.tportal.hr/biznis/clanak/izbjegavanje-dvostrukog-oporezivanja-sa-sad-om-odnosi-se-i-na-mirovine-evo-detalja-20260730.
- Vlada, session 201 of 10 Sep 2026 and its draft bill, https://vlada.gov.hr/201-sjednica-vlade-republike-hrvatske-47263/47263.
- SEC press release 2023-29, https://www.sec.gov/newsroom/press-releases/2023-29.

## The owner's answers, 2026-11-03

- The INO-IZJAVA date shows on the Deadlines card only, not on the home badge.
- A sale traded in late December and settled in January counts in its trade year, flagged as a reading.
- Build both this plan and the simpler loan simulator.
