# Shared exchange rates plan

One file of exchange rates for all of Kuna, with one owner in `src/shared/rates`. The ECB stays the source for the 29 currencies it publishes, Twelve Data fills the rest with the key Kuna already keeps, and a person can type a rate or paste a history. Read at `main` 704a05c on 7 November 2026. Rates in examples are public quotes or made up.

The plan stops for the owner's review before anything is built. The [home currency plan](home-currency-plan.md) builds on it.

## The owner's answers, 2026-11-07

These override anything below that says otherwise.

- **Provider:** Twelve Data, with rows sanity-checked and shown before they are stored. If a real key can't cover rare currencies, Frankfurter is the fallback.
- **A typed rate:** ECB always wins. Typed and pasted rates only fill days ECB lacks. So the hand series never overrides an ECB day, and tax's separate book stays a guard against other sources.
- **Tax with no official rate:** left out and listed.
- **A company's foreign statement:** build it properly now, so balances per currency, exchange gains and year-end come into this plan's queue instead of a refusal stage. Company figures never use Twelve Data.

## Summary

- **The file.** `kuna-rates.json` in the Kuna folder on Drive, or in this browser where no app's file is on Drive. Only `src/shared/rates` writes it, and it syncs through one step of the page's sync, as the keys do.
- **ECB rates move.** The `ecb:` series leave `kuna-investments-prices.json` for the new file. Spending stops fetching on every page load and reads the same rows.
- **Which rate wins.** A typed rate beats the ECB, and the ECB beats Twelve Data. Twelve Data never fills a day the ECB covers.
- **Tax reads the ECB alone.** Tax takes a separate book of ECB rows, and the types refuse any other. Filed years stay as they are.
- **Screens.** One Exchange rates card on Kuna settings, with one dialog to type a rate and one to paste a history.
- **The company.** A statement in a foreign currency is refused for now, with balances and exchange gains left to later stages.

## What the code does today

The issue assumes every foreign record stores its rate. That holds for part of the code only, and the rest decides what can move.

| Figure                                                            | Rate it uses                                        | Where                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Investments cost, deposits, withdrawals, fees, income in euros    | The rate stored on the record                       | `Trade.rate`, `Income.rate`, `CashMovement.rate`                   |
| Investments today's value, foreign cash value, forecast           | The book, on or before the day                      | `holding.ts:131`, `portfolioFigures.ts:92`, `incomeForecast.ts:97` |
| Exchanges and transfers between foreign currencies, exchange fees | The book, of their day. These records store no rate | `accountCash.ts:80-87`, `fees.ts:24`                               |
| Capital gains and foreign income tax                              | The book, never the stored rate                     | `taxYear.ts:98`, `foreignIncome.ts:199`                            |
| Every Spending row                                                | The book, of the row's day. Rows store no rate      | `euroRows.ts:33`                                                   |
| Company                                                           | No conversion. A USD balance adds in at face value  | `cash/domain/balances.ts:66`                                       |

Three more facts shape the design:

- **Kuna does not know what was filed.** `taxReminders.ts:13` says so. A filed year holds only because the tax figure is worked out again from rows that do not change.
- **Two copies of ECB rows.** Investments keeps them in its prices file from 2015 on. Spending fetches them into memory on each page load (`spending/rates/presentation/useRates.ts`), so offline it has none.
- **A bug in ended series.** The ECB API still answers for currencies it stopped publishing, and `ecbRates.ts` expects a 404 for those. Ended series on 7 November 2026: ARS, DZD, MAD and TWD at 30 October 2020, RUB at 1 March 2022, HRK at 30 December 2022, BGN at 31 December 2025. On-or-before then gives ARS at 91.5953 today, where Frankfurter's quote for 4 November 2026 is 1,738.42. A holding in ARS would show about 19 times too much. This is read from the code and the ECB's answer, not run through a screen.

## Which keyed provider

Twelve Data, for currencies the ECB does not publish. The owner already holds its key, `connect-src` already allows it, and it is the only candidate that gives a whole history in one call.

|                      | Twelve Data forex                                                                 | ExchangeRate-API                        | Open Exchange Rates                        |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| Free limit           | 8 credits a minute, 800 a day, 1 credit per symbol                                | 1,500 requests a month                  | 1,000 requests a month                     |
| Currencies           | 152. 121 have a euro pair, all written `EUR/X`                                    | 165                                     | About 170                                  |
| Ten years of history | 1 call, 1 credit                                                                  | Not on the free plan                    | About 3,650 calls, so 4 months of quota    |
| Base                 | Any pair                                                                          | Any                                     | USD only                                   |
| A person's use       | Personal, internal and non-commercial. Basic is "internal non-display usage only" | Commercial or personal, storing allowed | Domestic and private only, no business use |
| A company's use      | "Business plans are required for any company"                                     | Allowed                                 | Refused                                    |
| Browser call         | `*` tested                                                                        | `*` tested with a bogus key             | `*` tested with a bogus key                |
| CSP                  | Already allowed                                                                   | Needs adding                            | Needs adding                               |

### Tested without a key

With Twelve Data's `demo` key, which answers `EUR/USD` and refuses `EUR/ARS`:

- One `time_series` call returned 5,000 rows from 8 January 2008 to today. A second call reached the first row, 1 December 2003. The pager in `twelveData.ts` already pages this way.
- Set against the ECB on 4,799 shared days, Twelve Data differs by a median 0.21% and 0.82% at the 95th percentile. Since 2022 the largest gap is 2.6%. On 6 November 2026, $1,000 is €897.70 at Twelve Data's close and €895.66 at the ECB.
- **Its history holds wrong rows.** 8 December 2008 reads 1.4918 where the ECB has 1.2854, 16% off. Other 2008 days dated the 8th are off too, which looks like day and month swapped. That reading is a guess.
- It returned 114 weekend rows and a row for today, a Saturday, still moving. 24 ECB days have no row.

So a market close is good enough for a currency with nothing better, and worse than the ECB where the ECB exists. Kuna stores weekdays before today only, and the backfill dry run names the largest one-day moves.

### What needs a key

The owner's key answers these at stage 5, before the card ships:

- Whether the free key gets `EUR/ARS` and other non-major pairs, and how far back.
- The real credit count of a daily fetch. Twelve Data's pricing page is silent on free history depth.
- ExchangeRate-API and Open Exchange Rates past the key check. Neither was called with a real key, and the plan needs neither.

30 of Twelve Data's currencies have no euro pair, among them BAM, ZMW and VES. Those take a typed rate or a CSV. Kuna does not cross them through the dollar.

## What happens to figures

| Change                                                | What moves                                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECB rows move to the new file                         | Nothing. `check:figures` stays identical                                                                                                            |
| Twelve Data or a CSV adds a currency that had no rate | Rows and holdings listed as unconverted now count. Nothing else moves                                                                               |
| A typed rate on a day                                 | That day's Spending rows, that day's exchanges and transfers, and that day's value lines. Stored rates on records do not move, and neither does tax |
| An ended series stops at its last day plus 30 days    | Figures in ARS, RUB and the like go from wrong to "no rate". Tax on such a sale goes from estimated to left out and listed                          |

Filed years cannot move, because tax reads only ECB rows and those rows stay fixed. Changing Spending's past is accepted, since nothing is filed from it. A new Investments record still gets its rate filled in from the everyday book and stored, and a later typed rate does not rewrite it.

## The file

`kuna-rates.json`, in the style of the prices file: one line per series, sorted by key, so a revision's diff is short.

```json
{
  "format": "kuna-rates",
  "version": 1,
  "written_at": "2026-11-07T08:00:00.000Z",
  "wanted": { "ARS": "2024-01-01" },
  "series": {
    "ecb:USD": {
      "currency": "USD",
      "from": "2015-01-01",
      "checked": "2026-11-06",
      "rows": [
        ["2026-11-05", "1.1224"],
        ["2026-11-06", "1.1165"]
      ]
    },
    "twelvedata:ARS": { "currency": "ARS", "from": "2024-01-01", "checked": "2026-11-06", "rows": [["2026-11-05", "1719.67"]] },
    "hand:ARS": {
      "currency": "ARS",
      "rows": [
        ["2023-12-29", "893.50", "2026-11-07T09:12:00.000Z"],
        ["2024-02-01", null, "2026-11-07T09:15:00.000Z"]
      ]
    }
  }
}
```

- **Scale.** Every rate is text, in units of the currency per euro, as in the prices file and on records. The euro is the file's one base, and the home currency plan crosses through it.
- **A hand rate is marked by its source.** Its series is `hand:`, and its third column says when it was typed. A `null` rate is a removal, so the removal reaches other devices.
- **`wanted`** holds what a person added before any record names it.

### Home and sync

- **On Drive.** The file sits in the Kuna folder, marked with `appProperties` as that folder is, so any device finds it wherever the person moves it (`storage/infrastructure/kunaFolder.ts`). With no Kuna folder yet, it goes beside the first app's file. The token is `drive.file`, so no new permission is asked. It is not put in the hidden folder, because a person should be able to see it and restore it.
- **In this browser.** The same text in a Dexie database `kuna-rates`, as `pricesCache.ts` keeps its copy. It is the only copy while no app is on Drive, and the card offers a download of it, since typed rates cannot be fetched again. Import takes that file back.
- **Writers.** Only `ratesUpdate` in `src/shared/rates`. No app writes it.
- **The sync.** One `ratesStep(wanted)` in the pattern of `secretsStep`. Investments and Spending list it, later the company too, and in one run only the first group's step reaches Drive. It reads the file, merges, fetches what is due, and writes only when something changed.
- **Merging.** Drive refuses no stale write, so the merge is what protects a typed rate, as with the keys. Fetched rows merge by day, the later `checked` winning. Hand rows merge by day, the newest time winning. A write lost to another device comes back at the next sync, because this browser's copy still holds it.

### Which source wins

For each currency Kuna builds one list of days, then answers on or before the day as today.

1. A hand row wins its day, including over the ECB.
2. An ECB row wins its day.
3. A Twelve Data row counts only outside the ECB's span: before its first row, or after its last row once the series has ended.

An ECB series has ended when the day it was last checked is more than 30 days after its last row. A rate from an ended ECB series serves up to 30 days past its last row, and then there is no rate. Rule 3 stops market rates filling Saturdays between ECB days, where they would shift a figure by a fraction of a percent with no one asking.

## The shared owner

```
src/shared/money/rateBook.ts   RateBook, EcbRateBook, eurosAtRate, on-or-before. No file knowledge.
src/shared/rates/
  domain/          ratesFile (codec), ratesMerge, rateBooks (the layers), ratesGaps
  application/     ratesUpdate, ratesPorts
  infrastructure/  ecbRates, twelveDataRates, googleRatesDrive, ratesCache, fake/
  presentation/    useRates, ratesStep, RatesCard, TypeRateDialog, ImportRatesDialog, words
src/shared/vendors/   vendorUsage, browserLock, the Twelve Data series pager, moved from Investments
```

### The published contract

```ts
/** What a figure may read from the rates file. */
export interface RatesInHand {
  /** Hand, then ECB, then Twelve Data, for everything but tax. */
  readonly everyday: RateBook
  /** ECB rows alone, which tax and later the company's books read. */
  readonly official: EcbRateBook
}

/** Rates wanted beside what the apps' demand names, such as those a workbook about to be imported needs. Resolves once asked. */
export function askForRates(wanted: RatesWanted): Promise<void>

/** Rows an app held before this file existed, taken in once. Rows the file already has stay. */
export function seedRates(series: ReadonlyMap<CurrencyCode, readonly DatedRate[]>): Promise<void>
```

- `AppContribution` gains `ratesDemand(): ReadonlyMap<CurrencyCode, CivilDate> | null`. The shell passes these to the rates module, which sees no app. Spending's comes from `ratesNeeded`, and Investments' from the currencies and first day in `priceDemand`, with its always-rated USD, GBP and CHF.
- `EcbRateBook` is a brand on `RateBook`, owned in `rateBook.ts` and listed in `BRAND_OWNERS`. `hnbRate` and `dayRate` take only it, so a market rate reaching tax is a compile error.
- App domain code imports only `RateBook` from `src/shared/money`, so `DOMAIN_SHARED` does not change. Building the books stays in `shared/rates/domain`, read by each app's presentation and by `figure-digest.mjs`.
- The rule that a capability module does not import another gains named edges: rates may import `secrets` for a key, and `sync`, `storage` and `vendors`. `tests/importBoundaries.spec.ts` lists them.

### What moves and what goes

| Today                                                                                                                                                                                 | After                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `investments/prices/infrastructure/vendors/ecb.ts`, `prices: 'rates'`, `RatesWanted` fetch scope, `stillPublished`, `fetchRates`, `pricesFileRateBook`, `rateSeriesKey`, `ECB_SOURCE` | Deleted. The vendor list loses its ECB row                                                                                                     |
| `ecb:` series in the prices file                                                                                                                                                      | Copied into the rates file once, through `seedRates`, then dropped at prices file version 4                                                    |
| `spending/rates`: `useRates`, `ratesStep`, `ratesState`, `browserRatesFetch`, fake fetch                                                                                              | Deleted or moved to `shared/rates`. `euroRows`, `ratesNeeded` and `unratedNote` stay, as Spending's own                                        |
| `eurosAtEcbRate`, `EcbRate`                                                                                                                                                           | `eurosAtRate`, `DatedRate`, since the rate need not be the ECB's                                                                               |
| `readClosesCsv`                                                                                                                                                                       | Generalised to Date and a named value column in `src/shared/money/datedCsv.ts`, with `closesCsv.ts` calling it. Rates accept `Rate` or `Close` |
| Investments' `vendorUsage`, `browserLock`                                                                                                                                             | `src/shared/vendors`, because prices and rates spend the same Twelve Data credits under one lock                                               |

## The screens

One card on Kuna settings, after the sync card, because Spending users never see Investments' Prices tab.

**Exchange rates card.** It leads with one line: "USD, GBP and CHF come from the ECB, up to 6 Nov 2026." Below that is one row for each currency that is not plain ECB, or that has a gap.

| Row                   | Line                                                         | Actions                                 |
| --------------------- | ------------------------------------------------------------ | --------------------------------------- |
| ARS, from Twelve Data | Up to 6 Nov 2026                                             | Fetch history, Type a rate, Paste rates |
| BAM, typed by you     | 3 rates, the newest of 2 Nov 2026                            | Type a rate, Paste rates                |
| RUB, needs a rate     | The ECB stopped on 1 Mar 2022. A sale of 4 May 2025 has none | Type a rate, Paste rates                |

Under the rows are Add a currency and, folded, the Twelve Data key row from `useSecretRows`. It is the same `twelvedata` secret as Prices, so a key saved in one place shows in both. Its note says a free key is for personal use. No request count or limit line appears here, as Prices keeps those.

**Type a rate.** A day, and "1 EUR = [ ] ARS". Remove sits beside a rate typed before. The Spending or transaction line that uses it then says "your rate of 2 Nov" where it now says the ECB.

**Paste rates.** A paste field or a file, a currency, and a direction picker with a preview: "1 EUR = 1,719.67 ARS". It reuses the dry run of `ImportClosesCard`: first and last day, days added, days replaced, and the file's largest one-day moves. Nothing is written before Add. Written rows go in as `hand:`, so they are marked and win.

**Fetch history.** Asks Twelve Data from the first day needed and shows the same dry run. Written rows go in as `twelvedata:`.

**Gaps.** `ratesGaps` compares `ratesDemand` with the rows. The card shows each gap. Spending's `unratedNote` and Investments' no-rate check link to the card and stop saying "the ECB rates did not load" when the ECB was never going to have them.

## The company side

### What the law says

- **Loaded.** Zakon o uvođenju eura, Art. 17(2): from the euro's introduction HNB's euro middle rates apply for statistical, accounting and tax reporting, unless another rule says otherwise.
- **Loaded.** Zakon o računovodstvu, Art. 38(2): amounts in books and annual statements are in the official currency. Art. 3 takes the spot rate's meaning from Regulation (EU) 2023/1803, the adopted IFRS.
- **Loaded.** Zakon o PDV-u, Art. 36(2) and (3): VAT converts at HNB's middle rate on the day the VAT obligation arises, or at the rate the ECB publishes that day.
- **Unconfirmed.** The HSFI text on foreign currency. The Narodne novine page did not load. RRiF summaries from 2012 and later say that a balance at the balance date goes at HNB's middle rate and differences go through income and expense, citing HSFI 11. Those are kuna-era and secondary.
- **Unconfirmed.** IAS 21's paragraphs on spot and closing rates. The regulation's text was too large to load.
- **Unconfirmed.** Which HNB list "on the day" means for books, the published or the applied one. The same question stands open for tax in [HNB rates and settlement](../../law/investments/hnb-rates-and-settlement.md). Also what applies to a currency outside HNB's 13.

The `official` book serves this for 12 of HNB's 13 currencies. BAM has no ECB row. The other 17 live ECB currencies have no HNB list, and Kuna's tax already uses the ECB rate for them.

### What a foreign account would need

This is large, so it is scoped out past stage 6:

- A balance chain per currency, since `Transaction.amount` is cents in the book's currency and `camtStatement.ts` keeps the balance check within one currency.
- A euro amount per row at the day's HNB-equal rate, which reaches every bucket, Year's figures and `hr-doo`'s accrual and VAT.
- Realised gains on exchange, and year-end revaluation of the balance.

Twelve Data never serves any of this, for the rate's sake and because its terms require a Business plan for a company.

## Stages

Each stage is a commit series on `main` that leaves Kuna working.

### 0. Moves, no behaviour

`src/shared/vendors`, `datedCsv.ts`, `eurosAtRate`, `DatedRate`, and the module map's new rows. Digests identical.

### 1. The file, and Spending on it

`shared/rates` with ECB only: codec, merge, update, step, cache, Drive adapter, fake Drive. Spending deletes its fetch and reads `everyday`. It now works offline after its first sync. The step's "Off in Settings" wording goes with it, if issue 61 has not fixed it. Digests identical, with `--fake-spending foreign` reading the fake ECB through the file. A new `--rates <file>` replaces `--spending-rates`.

### 2. Investments on it

`ratesDemand`, `seedRates`, `askForRates` for imports and compared listings, prices file version 4, the vendor card without ECB. A version 3 prices file still reads and seeds. Digests identical, on the fake sets and on the owner's export run by the owner, with `--investments-prices` seeding as the app does.

### 3. Two books, and ended series

`EcbRateBook`, tax on `official`, the 30-day stop. Digests identical on fake sets. A new set `--fake-investments ended-currency` shows the "no rate" lines and adds its own groups.

### 4. Typed and pasted rates, and the card

The card, Type a rate, Paste rates, `wanted`, gaps, the browser download, the source named on figures. New groups for `--fake-spending hand-rates`. Existing groups identical.

### 5. Twelve Data

`twelveDataRates`, the daily fetch for currencies outside the ECB's span, Fetch history, the key row. Weekdays before today only. A 429 stops the fetch, and the next sync goes on. Gate: the owner's key answers the open questions above. If the free key lacks non-major pairs, this stage stops and the choice of provider comes back. New groups for `--fake-spending fetched-rates`. Existing groups identical.

### 6. The company refuses a foreign statement

The dry run refuses a camt statement or new account outside the book's currency, with a sentence. A file already holding such an account still reads, with today's problem line. `tests` cover it. Digests identical on every fake set.

### Later, each its own issue after the unconfirmed sources are read

- **7.** Balance per currency on Cash, in the account's currency and in euros at the `official` book, summed in euros.
- **8.** Rows in euros, exchange gains, year-end revaluation, the reach into Year and `hr-doo`, and a `docs/law` file for it. The accountant's practice is checked here.

## Specs

- `tests/ratesFile.spec.ts`: round trip, refusal of a newer version, one line per series, a removal read back.
- `tests/ratesMerge.spec.ts`: two devices each type a rate and both stay, a removal beats an older typed rate, the same inputs in either order give the same file.
- `tests/rateBooks.spec.ts`: hand beats ECB on its day only, a Twelve Data Saturday row is ignored inside the ECB's span, Twelve Data serves after an ended series, ARS on today after 2020 is null, `official` never holds a hand or Twelve Data row.
- `tests/ratesGaps.spec.ts`: a record before the first rate, an ended series, a currency no source has.
- `tests/datedCsv.spec.ts`: Yahoo's file as before, a `Rate` column, day-first and ambiguous dates, and a table test for direction naming `0.8`, as the money rules ask of each rate parser.
- `tests/twelveDataRates.spec.ts`: drops weekends and today, pages past 5,000 rows, reads a 429 for the minute and the day.
- `tests/importBoundaries.spec.ts`: the new edges and the brand.
- A compile-time case that passing `RateBook` to `hnbRate` fails.

## Checks

- Every stage: `npm run check`, both builds and `check:figures`, compared before and after with a fixed `--today` on `--fake five-employees --fake-loans sample --fake-investments sample --fake-assets sample --fake-spending foreign`. New sets add groups, and existing groups stay identical. Any group that moves is named in the commit with its reason.
- Stages 2 and 3 also run on the owner's real exports, by the owner, since only those can hold a currency the fake sets lack.
- Stages 4 and 5: targeted `check:visual` at 360, 640, 1024 and 1440 px in both languages and themes, a touch check of the dialogs and the `design-reviewer` agent. The full suites run in CI.
- `docs/architecture/modules.md` and `.claude/rules/kuna-money.md` change in the stage that changes what they state.

## Decisions for the owner

### Which source fills currencies the ECB lacks

Someone holds a fund in Argentine pesos, and today Kuna values it at the ECB's rate from 2020. You chose a keyed provider before this test. The test found wrong rows in Twelve Data's 2008 history, and Frankfurter, tried for ARS without a key, answers 1,719.67 for 2 November 2026 from central bank sources.

- **Stay with Twelve Data.** Each person needs a free key, though you already have one. A backfill can bring a wrong old row, which the dry run points at and a typed rate corrects. The free key's reach past EUR/USD is unknown until stage 5.
- **Use Frankfurter instead.** Nobody needs a key, and its site allows commercial use of its blended rates. It is one free service with no stated quota and no warranty, its rate is a blend, and the CSP needs one more host.

I recommend Twelve Data, as you decided, with the stage 5 gate. If the free key fails there, Frankfurter is the fallback and costs one adapter.

### Whether a typed rate may beat the ECB

Someone exchanged dollars on 3 November at their bank's 1.15, and the ECB says 1.1179. They type 1.15 for that day.

- **It wins, except in tax.** Their Spending rows of 3 November and that day's exchange lines use 1.15, marked as theirs. Tax stays at 1.1179. Their past euros can differ from the official ones by their own choice.
- **Typing is refused where the ECB has a row.** Every ECB-covered figure stays official. A person who wants a correction cannot make one, and a record's own stored rate remains the only way.

I recommend that it wins, since a person who typed it meant it and tax is protected either way.

### What tax does with a currency that has no official rate

Someone receives a dividend in pesos on 4 May 2025. Neither the ECB nor HNB has a rate that day, and what the law requires then is unconfirmed. Today Kuna takes the ECB's 2020 rate and marks it as an estimate. After stage 3 the payment is listed and left out of the year's figures, as any payment with no rate already is.

- **Left out and listed.** No tax figure rests on a rate Kuna cannot stand behind. The person works that one payment out outside Kuna, and the year's total says it is short.
- **Allow a typed rate, marked.** The year's total includes it, and the screen and the register mark it as the person's rate. It is the one place where tax leaves ECB-equal rates, and a filed year could move if the rate is later changed.

I recommend left out and listed, until the law on such a currency is read.

### What a company's foreign statement does now

A USD statement arrives for a company. Today $1,000 beside €1,000 shows €2,000.00 in cash on hand, with one problem line in Settings.

- **Refuse it now.** Nothing wrong reaches a figure. A company with a foreign account cannot import it until stage 8. A small change, and the money research recommends it too.
- **Show a balance per currency first.** Cash becomes right, in euros at the day's rate. The rows would still enter income and costs at face value, so the screen looks finished while Year's figures are wrong. A moderate change.
- **Leave it.** It stays latent while all accounts are in euros, and costs nothing, but the first person with such an account gets a wrong figure.

I recommend refusing it now.

## Settled without asking

- ECB series move out of the prices file, so one rule has one owner.
- Rates per euro throughout, with no stored base per series.
- A Twelve Data rate never fills a day the ECB covers.
- Old currencies take one setup: a pasted history or one typed rate, which holds for later days until the next row. A code Intl does not list stays refused by `currencyCodeOf`. In Node today that includes DEM and ITL and not HRK. Other browsers' lists are unverified.
- Hand and pasted rows share one source, as both are the person's own.

## Sources

Loaded on 7 November 2026 for this plan, or run live on 6 and 7 November:

- Live calls with no real key: `api.twelvedata.com` `forex_pairs`, `time_series` and `earliest_timestamp` with `demo` and a bogus key. `v6.exchangerate-api.com`, `open.er-api.com` and `openexchangerates.org` with a bogus key or none. `data-api.ecb.europa.eu` for the series list, USD from 2003 and ARS. `api.frankfurter.dev/v2/rates`.
- <https://twelvedata.com/pricing.md>, <https://twelvedata.com/docs/market-data/time-series>, <https://twelvedata.com/docs/advanced/batch-requests>
- <https://www.exchangerate-api.com/terms>, <https://openexchangerates.org/terms>
- Zakon o uvođenju eura, NN 57/22, Art. 17, <https://narodne-novine.nn.hr/clanci/sluzbeni/2022_05_57_803.html>
- Zakon o računovodstvu, Art. 3, 16, 38 and 39, in force from 10 June 2026, <https://www.zakon.hr/z/118/Zakon-o-računovodstvu>
- Zakon o PDV-u, Art. 36, <https://www.zakon.hr/z/1455/Zakon-o-porezu-na-dodanu-vrijednost>
- RRiF 1/2012, a summary only, secondary, <https://www.rrif.hr/clanak-13788/>
- In the repo: [HNB rates and settlement](../../law/investments/hnb-rates-and-settlement.md), [the money research](../../architecture/research/money-and-domain-types.md), [the module map](../../architecture/modules.md)

Loaded in the earlier research on 6 and 7 November and not reloaded here: the limits and coverage of ExchangeRate-API and Open Exchange Rates, Frankfurter's site and license, <https://api.hnb.hr/>, ZPDoh Art. 12(8), and the Porezna uprava VAT FAQ.

Did not load, so nothing rests on them: HSFI at Narodne novine (page unavailable), Regulation (EU) 2023/1803 on EUR-Lex (too large), the IFRS page for IAS 21 (gives only an outline).
