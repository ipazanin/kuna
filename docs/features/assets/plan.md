# Assets plan

Build plan for Kuna's Assets app, with typed valuations, the flat carried forward by the DZS house price index, the car estimated by the NN 1/2017 customs table, the mortgage linked through Loans' published bank loans, and Kuna's Overview leading with what you own less what you owe, checked against Kuna at 0717599.

H8 from [the proposal](../../architecture/hub.md), built to the owner's answers of 4 Nov 2026. It follows the pattern of [the H3 plan](../loans/plan.md) and [the Investments plan](../investments/plan.md), and the shape of [the overview plan](../overview/plan.md). Kuna was read at `0717599`, and every `path:line` is against that commit. The DZS index values in the worked example are public figures. Every other figure is made up.

## Summary

- **Assets is a fourth app** at `#/assets`, with its own file `kuna-assets.json`, first run, Settings, home card and part of Kuna's Overview. It keeps two kinds, `asset` and `valuation`, in euros.
- **A flat's value is carried forward by the DZS house price index** for its region (City of Zagreb, Adriatic or Rest of Croatia), from the newest typed valuation or the price paid. It is worked out on load, shown as an estimate with its quarter, and never stored.
- **A car is estimated by the customs table** of NN 1/2017 from its price paid, the day it was bought and its first registration, until a valuation is typed.
- **The mortgage is linked from the asset.** The asset names its bank loan, picked from a list Loans publishes in `src/apps/loans/facts.ts`. The asset's page and its caption on Kuna's Overview show what is yours after the loan. The sum counts the flat's full value and Loans takes off the full loan, so nothing counts twice.
- **Kuna's Overview leads with "What you own less what you owe"**. Its line says it leaves out bank accounts. The company stays in its own card and is never added in.
- **Left out:** pension pillars, deposits and cash, tax captions, a value-over-time chart, a remove-file action and co-ownership.
- **One commit**, built in the stages below.

## The module map

Every arrow is an import. No arrow points into another app except the one marked.

```
src/apps/assets ─────────────────────────────┐
  workbook/   kinds, readers, codecs, store   │   src/apps/loans
  values/     value on a day, equity          │     facts.ts  (published, one reader)
  houseIndex/ the DZS index and its adapter   │       ▲
  carValue/   the NN 1/2017 customs table     │       │ the one import across apps
  loans/      assetLoans.ts ──────────────────┼───────┘
  overview/, asset/, home/, onboarding/,      │
  settings/, sync/                            │
                                              ▼
src/shared  storage, money, calendar, text, ui, app (hub contract, personalNet)
src/shell   reads AppContribution only
```

### What Assets owns

The two kinds and their file, the value of each asset on a day, the house index estimate, the car estimate, and the equity of an asset whose loan Loans lists. It owns nothing of a loan except the bare UUID it stores in `loan`. Loans owns every loan figure, and Assets reads them only through the published list.

### Loans' published contract

New `src/apps/loans/facts.ts`, the only Loans file another app may import. Its types are its own and say nothing of `BankLoan` (`src/apps/loans/workbook/domain/bankLoan.ts:29-41`):

```ts
/** A bank loan as another app reads it: what it is called and what you owe on it on the day. */
export interface PublishedBankLoan {
  /** The loan's bare UUID, as a record that names it stores it. */
  readonly key: string
  readonly name: string
  /** Null while its plan cannot be worked out. */
  readonly owed: Money | null
  readonly to: RouteLocationRaw
}

/** Every bank loan of the book on the day, for a reader that has the book in hand, such as check:figures. */
export function bankLoansOf(book: Pick<LoanBook, 'bankLoans'>, day: CivilDate): readonly PublishedBankLoan[]

/** The bank loans of the file on screen, a wait while it opens, a failure, or null while Loans is not set up. */
export function publishedBankLoans(day: CivilDate): readonly PublishedBankLoan[] | 'opening' | 'failed' | null
```

`owed` is `bankLoanFigures(book, day)?.owed ?? null` (`src/apps/loans/bankLoans/presentation/bankLoanView.ts:19`, `:36`), as `owedOnDay` reads it (`src/apps/loans/overview/presentation/owedTotals.ts:28`, `:35-36`). `to` is `bankLoanLink` (`src/apps/loans/overview/presentation/loanLinks.ts:18-20`). `publishedBankLoans` is `homeCardFigures(state, (book) => bankLoansOf(book, day))` (`src/shared/app/homeCardFigures.ts:4-15`). Informal loans are not published, since no asset secures one.

**How the boundary spec states the one-way read.** The rule "no app imports another" (`tests/importBoundaries.spec.ts:143-145`) gains one allowed pair, written as a table:

```ts
/** Each app's published file and the one file of another app that may import it. */
const PUBLISHED: Readonly<Record<string, readonly string[]>> = {
  'src/apps/loans/facts.ts': ['src/apps/assets/loans/application/assetLoans.ts'],
}
```

A new case checks that every listed reader exists and imports the file, and that `facts.ts` imports nothing outside Loans and `src/shared`. Loans imports nothing of Assets, which the existing rule already refuses. This is the exception [the proposal](../../architecture/hub.md) planned for published facts ("Another app's `facts.ts`, and only from that app's one translation file"), first used here.

### Where the DZS reader and the car table live

Both live inside Assets.

- **The DZS index** (`src/apps/assets/houseIndex/`) has one user. Investments fetches security closes by GET with no headers (`src/apps/investments/prices/infrastructure/browserPricePorts.ts:3-7`). The DZS needs a POST with a JSON body and parses JSON-stat. The two change for different reasons, vendor quotas against a statistics office's release cycle, so there is nothing to share. A second user of JSON-stat, say a Eurostat fallback, would be the time to move the parser to `src/shared`.
- **The customs table** (`src/apps/assets/carValue/`) has one user. The company's car depreciation is a tax rule of the hr-doo ruleset, which changes when the tax law changes. The customs table changes when the special tax rules on cars change. The table follows the repo's law convention: its rows live in `docs/law/used-car-value.md` with their source, and `tests/lawDocs.spec.ts` compares them with the code, as it does for the tax rates (the repo's `docs/law/README.md`, "Tied to the code").

### What moves to `src/shared` now

- **The find-or-pick resume moves.** Loans' and Investments' `start()` run the same 12 lines with another store, words and routes (`src/apps/loans/app.ts:61-74`, `src/apps/investments/app.ts:94-108`). Assets would be the third copy. All three change when the shared find-or-pick flow changes. New `src/shared/storage/presentation/resumeFileLookup.ts` takes the store, the file words, the router, Google's return and the start and Overview routes. Loans and Investments adopt it in the same commit, and Investments keeps `startPrices` beside it. Company's `start()` is a different flow (`src/apps/company/app.ts:80-83`) and stays as it is.
- **The fake seed does not move.** Loans' seed and Investments' have drifted apart: Investments seeds a prices file, keys and a binned file (`src/apps/investments/workbook/infrastructure/fake/seedFakeInvestments.ts:60-135`). Assets copies Loans' seed (`src/apps/loans/workbook/infrastructure/fake/seedFakeLoans.ts:32-87`), the simple one.
- **The one-line `firstRun` and `asksGoogleOnOpen` stay inline.** They are the same expression in Company, Loans and Investments (`src/apps/company/app.ts:73`, `:79`, `src/apps/loans/app.ts:56`, `:59`, `src/apps/investments/app.ts:86`, `:91`). A helper would add a name and save no reading.

## What the owner sees

- **The home** has a fourth card, Assets, with a slate identity colour, "Assets value" and its figure, and Set up on a fresh device.
- **The Assets Overview** at `#/assets` leads with Assets value, then one card per asset: its name, its value today, how that value was reached, and for a linked asset what is yours after its loan. An empty file says "No assets yet" with Add an asset.
- **An asset's page** at `#/assets/asset?asset=<uuid>` shows the value and its basis, the linked loan with what you owe and a link to the loan's page, what is yours after it, and the valuations newest first. Buttons: Add a valuation and Edit. Delete is in the Edit dialog, as it is for a loan in Loans.
- **The asset dialog** takes a name, a kind (Flat or house, Car, Other), the day bought and the price paid, then for a flat its region and for a car its first registration, then the bank loan on it, picked from Loans, and a note.
- **The valuation dialog** takes a date, a value and a note.
- **Kuna's Overview** leads with "What you own less what you owe" and gains the Assets value tile, whose caption says what is yours after the loans.

Every save has the toast with Undo. Deleting an asset deletes its valuations in the same write, and one Undo puts them back.

### The worked example

Made up, apart from the DZS index values.

**A flat.** Bought on 15 Mar 2025 for €200,000.00, in the City of Zagreb, with no valuation typed. The DZS index for Grad Zagreb (2025 = 100) is 95.05 in 2025 Q1 and 113.53 in 2026 Q2, the newest published quarter. 200,000.00 × 113.53 ÷ 95.05 = €238,884.80. Its bank loan, the Home loan, has €150,000.00 owed today, so €88,884.80 is yours.

| On the flat's page    | Figure      | Caption                                                                                          |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| Value                 | €238,884.80 | Estimate: €200,000.00 of 15 Mar 2025, carried to 2026 Q2 by the DZS index for the City of Zagreb |
| Owed on the Home loan | €150,000.00 | Opens the loan's page                                                                            |
| Yours after the loan  | €88,884.80  |                                                                                                  |

**A car.** Bought new on 15 Jan 2024 for €30,000.00 and first registered that day, with no valuation. On 4 Nov 2026 it is 33 whole months from first registration, which the table puts in "32 to 34 months" at 57.90%. €30,000.00 × 57.90% = €17,370.00.

| On the car's page | Figure     | Caption                                                                                    |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------ |
| Value             | €17,370.00 | Estimate by the customs table: 57.90% of the price after 33 months from first registration |

**Kuna's Overview.**

| Tile                           | Figure      | Caption                                           |
| ------------------------------ | ----------- | ------------------------------------------------- |
| What you own less what you owe | €146,754.80 | Leaves out bank accounts, which no app keeps yet. |
| Investments value              | €40,000.00  |                                                   |
| Owed to you                    | €500.00     |                                                   |
| Assets value                   | €256,254.80 | €88,884.80 yours after the Home loan              |
| You owe in all                 | €150,000.00 | Next €650.00: On 15 Dec, Home loan                |
| You could take out now         | €1,224.00   | In the company's own card, never added in         |

40,000.00 + 500.00 + 256,254.80 − 150,000.00 = 146,754.80. The equity is a caption and is never added, since the flat's full €238,884.80 is in Assets value and the full €150,000.00 is in You owe in all.

### When something is missing

| Situation                           | The asset                                                                                                                                                                   | Kuna's Overview                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The flat has no region              | Value is the typed value or the price paid, with its date.                                                                                                                  | Counted at that value.                                                                                        |
| The DZS index is loading            | The value waits.                                                                                                                                                            | The sum waits, as for Investments' prices (`src/apps/investments/home/presentation/shownPortfolio.ts:19-21`). |
| The DZS index failed or is offline  | The typed value or price paid, with "The DZS index did not load".                                                                                                           | Counted at that value, with the same line under the sum.                                                      |
| The base's quarter is not out yet   | The valuation or the price paid, with "The DZS index has no 2026 Q4 yet, so this is the price paid on …".                                                                   | Counted at that value.                                                                                        |
| The base is older than the index    | The valuation or the price paid, with "The DZS index starts in 2002 Q1, so it cannot carry … Add a valuation."                                                              | Counted at that value.                                                                                        |
| Two assets name the same loan       | Both count, both are read with a problem, and neither shows what is yours after the loan.                                                                                   | Both values count, Loans takes the loan off once, and the caption leaves the loan out.                        |
| A car has a valuation               | That valuation, with its date. The table is no longer used.                                                                                                                 | Counted at that value.                                                                                        |
| An asset has no price, no valuation | No value. Its card says Add a valuation.                                                                                                                                    | Counted as nothing, and the line under the sum adds "1 asset without a value".                                |
| Its loan is deleted in Loans        | "Its loan is no longer in Loans". Edit keeps the stored loan, shown as Not in Loans now, and offers No loan. Nothing is refused, since neither app writes the other's file. | Correct, since the loan is gone from You owe.                                                                 |
| Its loan has no plan yet            | Owed is not shown, and neither is equity, with why.                                                                                                                         | Correct, since Loans leaves that loan out too (`owedTotals.ts:20-28`).                                        |
| Its loan is paid off                | Owed €0.00, all of the value is yours.                                                                                                                                      | Correct.                                                                                                      |
| Loans is not set up                 | No loan block. The dialog's loan field says to set up Loans first.                                                                                                          | Loans is listed with Set up (`src/shell/overview/OverviewScreen.vue:112-117`).                                |
| Loans is opening or failed          | The loan block waits, or says Loans did not open.                                                                                                                           | The sum waits or is held back (`src/shared/app/personalNet.ts:40-43`).                                        |
| Assets is not set up                |                                                                                                                                                                             | Listed with Set up and counted as nothing (`personalNet.ts:31-33`). Loans is unchanged.                       |

## The rules

### The records

Schema `{ assets: 1 }`. Ids, references, dates and money as Loans keeps them: a UUID from the first write (`src/shared/storage/domain/recordId.ts:10-26`), a reference as a bare UUID (`src/apps/loans/workbook/domain/loanReference.ts:9-23`), days as `yyyy-mm-dd`, money as amount text read into integer cents (`src/shared/money/money.ts:1-5`, `src/apps/loans/workbook/domain/informalLoanReading.ts:53`).

| Kind        | Fields                                                                                                                                                                                            | Read rules                                                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset`     | `name`, `kind` (`home`, `car` or `other`), `bought`, `price`, `region` (`zagreb`, `adriatic` or `rest`, a home only), `first_registration` (a car only), `loan` (a bank loan's bare UUID), `note` | A name. `price` above zero, and with `bought`. `region` on a home only, `first_registration` on a car only. `loan` is a bare UUID: whether Loans has it is known only on screen. No other asset names the same `loan`, or both are read with a problem. |
| `valuation` | `asset`, `date`, `value`, `note`                                                                                                                                                                  | Names an asset that counts. `value` zero or above. Not before the asset's `bought`. One per asset and day.                                                                                                                                              |

The reader is `readAssetBook`, shaped like `readLoanBook` (`src/apps/loans/workbook/domain/readLoanBook.ts:104-115`, `:122-125`, `:192-198`). Writes refuse to orphan a valuation through `dependentRefusals` (`src/apps/loans/informalLoans/application/informalLoanWrites.ts:13-19`), and `removeAsset` takes the valuations in the same write (`:29-33`).

### Value on a day

**Owner:** `assetValueOn(asset, valuations, day, index)` in `src/apps/assets/values/domain/assetValue.ts`. It returns the cents and the basis the caption names:

1. **The base.** The newest valuation on or before the day. Without one, the price paid, once `bought` is on or before the day. Without either, no value.
2. **A home with a region, and the index in hand:** the base carried forward by `carriedForward` (below). A home without a region, or with the index failed, keeps the base.
3. **A car with no valuation, and a price, `bought` and `first_registration`:** `customsEstimate` (below). A car with a valuation keeps the valuation.
4. **Anything else:** the base.

### The house index estimate

**Owner:** `carriedForward(value, from, index, day)` in `src/apps/assets/houseIndex/domain/houseIndex.ts`.

- The index is the DZS table `ME_PS14.px`, indicator 3 ("indeksi (2025. = 100)"), categories 3, 4 and 5 (Grad Zagreb, Jadran, Ostalo), every quarter from 2002 Q1. Its values have two decimals and are read as whole hundredths.
- `to` is the newest quarter in the index not after the day's quarter. `from` is the quarter of the base's date.
- The estimate is `dividedRounded(cents × index(to), index(from))` (`src/shared/money/money.ts:55-58`), half away from zero.
- When `from` is newer than every quarter in the index, the value stays the base, and the caption says that quarter is not out yet.
- The quarter of a day is new code in `houseIndex.ts`, since nothing in `src/shared/calendar` has quarters and Assets is its one user.

**The adapter:** `src/apps/assets/houseIndex/infrastructure/dzsHouseIndex.ts`.

- It sends one POST to `https://web.dzs.hr/PXWeb/api/v1/hr/Cijene/Indeksi%20cijena%20stambenih%20objekata/ME_PS14.px` with `{"query":[{"code":"Indikatori","selection":{"filter":"item","values":["3"]}},{"code":"Kategorije","selection":{"filter":"item","values":["3","4","5"]}}],"response":{"format":"json-stat2"}}` and `Content-Type: application/json`, with `AbortSignal.timeout(10_000)`.
- It reads the JSON-stat by its `id` and `size` strides, never by an assumed order. The answer on 4 Nov was 6.8 kB, ids `Kategorije, Indikatori, Tromjesečje`, sizes `3, 1, 98`.
- Its fake twin, `infrastructure/fake/fakeHouseIndex.ts`, is picked inline under `VITE_FAKE_WORKBOOK`, as `pageWorkbookStore` picks the fake Drive (`src/shared/storage/infrastructure/pageWorkbookStore.ts:20-27`). The fake build then sends no request to another origin, which the visual and touch checks refuse.

**When it runs:** `startHouseIndex()` in `src/apps/assets/houseIndex/presentation/useHouseIndex.ts`, called from the Assets `start()`, as Investments starts its prices (`src/apps/investments/app.ts:95`, `src/apps/investments/prices/presentation/usePrices.ts:115-135`). It fetches once per page load, as soon as the Assets file on screen holds a home with a region, and keeps the answer in memory only. Its state is loading, the index, or failed. It does not try again when the browser comes back online, so a page opened offline shows that the index did not load until it is opened again.

### The car estimate

**Owner:** `customsEstimate(price, bought, firstRegistration, day)` in `src/apps/assets/carValue/domain/customsTable.ts`, over `CUSTOMS_TABLE`, the 56 rows of Tablica 1 of the Pravilnik o posebnom porezu na motorna vozila (NN 1/2017, članak 9. stavak 3.), from "0 dana do 1 mjesec, 96" to "168 mjeseci do 180 mjeseci, 19,32".

- Months are whole months from first registration as `wholeMonthsBetween` counts them (`src/shared/calendar/monthKey.ts:69-73`), which is the Pravilnik's own rule: a month has passed on the same day of the next month, or its last day when that day is missing (članak 9. stavak 4.).
- A row covers its months from its lower bound up to, not including, its upper bound. 33 months is "32 do 34", 57.90. 34 months is "34 do 36", 56.48.
- The estimate is `price × share(months on the day) ÷ share(months on the day bought)`, with the share on the day bought taken as 100 when the car was bought on or before its first registration. So a car bought new loses value from the table's first row, and a car bought used loses only what it lost since you bought it.
- After 180 months the last row, 19.32, holds.
- Shares are whole hundredths, and the division is `dividedRounded`.

### Equity

**Owner:** `equityOf(value, loan)` in `src/apps/assets/values/domain/equity.ts`: value less `loan.owed`, or null when the asset has no value, names no loan, its loan is not in the list, or its `owed` is null. The translation file `src/apps/assets/loans/application/assetLoans.ts` is the only place that calls `publishedBankLoans` and turns a `PublishedBankLoan` into Assets' own `AssetLoan`.

### What Assets gives Kuna's Overview

**Owner:** `assetsHubFigures(book, day, index, loans)` in `src/apps/assets/home/presentation/assetsHubFigures.ts`, through `homeCardFigures` as Loans does (`src/apps/loans/app.ts:55`):

- One `has` part, "Assets value", the sum of `assetValueOn` over the assets, linking to `/assets`.
- Its caption is the equity of the linked assets. One linked asset gives "€88,884.80 yours after the Home loan". Several give "€X yours after their loans". None, or Loans not ready, gives no caption.
- Its notes: "1 asset without a value" through the plural helper, and "The DZS index did not load" when it failed and a home has a region.
- `'opening'` while the index loads for a file with a home that has a region. A file with no assets gives null, as Investments' empty file does (`shownPortfolio.ts:22-24`).

`personalNet` (`src/shared/app/personalNet.ts:35-48`) and the overview's sum and parts (`src/shell/overview/OverviewScreen.vue:47-86`) take the new part with no code change.

## Stages

One commit for the whole wave, checked with lint, format, typecheck, vitest, both builds, `check:figures` on every fake set and the live files, and the targeted visual and touch checks. The stages are the order to build in.

### 0. Shared groundwork, no behaviour change

- New: `src/shared/storage/presentation/resumeFileLookup.ts`, as in the module map. Changed: `src/apps/loans/app.ts:60-74` and `src/apps/investments/app.ts:92-108` call it.
- Changed: `scripts/figure-digest.mjs:336-345`: `hub.personal` runs over every personal input given, two or more, instead of Loans and Investments only. With Loans and Investments it prints the same line.
- Specs: `tests/loansGoogleReturn.spec.ts` passes unchanged, and a new `tests/resumeFileLookup.spec.ts` covers a find and a pick that end on the Overview from the start route, and one that stays on another route.
- Proof: every digest group identical on every fake set and the live files.

### 1. Loans' published contract

- New: `src/apps/loans/facts.ts`, as in the module map.
- Changed: `scripts/figure-digest.mjs` `loansGroups` (`:359-431`) adds `loans.published`, the output of `bankLoansOf(workbook, today)`.
- New: `tests/loansFacts.spec.ts`: the sample's home loan with its owed today, a loan with no rate period at its first instalment published with `owed` null, a paid-off loan at €0.00, `publishedBankLoans` waiting while the file opens, failing with it, and null while Loans is not set up.

### 2. The app and its file

- New, copied from Loans' skeleton: `src/apps/assets/app.ts`, `words.ts`, `workbook/` (kinds, the two records and their readers, `readAssetBook`, codecs, the store, write guards, the document, the file helpers, the local status and export), `onboarding/presentation/StartScreen.vue` over the shared first run (`src/shared/storage/presentation/fileFirstRun.ts:46-55`), `settings/presentation/` with the shared books card, Export and Switch storage and no removal (`src/apps/loans/settings/presentation/LoansBooksCard.vue:17-23`), `sync/presentation/assetsSyncGroup.ts`, `home/presentation/assetsHomeCard.ts` with Set up, `overview/presentation/OverviewScreen.vue` with the empty state, and `overview/presentation/assetLinks.ts`.
- New: `workbook/infrastructure/fake/fakeAssets.ts` and `seedFakeAssets.ts`, with ids `fa4e2000-…`, beside Loans' `fa4e0000-…` (`src/apps/loans/workbook/infrastructure/fake/fakeLoans.ts:38-40`). The sample's flat names the fake Home loan `fa4e0000-0000-4000-8000-000000000001` (`fakeLoans.ts:54-56`) as text, since a fake seed may not import Loans either.
- Changed, outside the app:
  - `src/main.ts:19-22` installs Assets after Investments.
  - `src/shared/styles/tokens.css:79-80` and `:171-172` gain `--app-assets`, and `tests/tokenContrast.spec.ts:22` lists it.
  - `tests/designCatalogue.spec.ts:15-21` gains an Assets area, and `.agents/skills/kuna-design/components.md` an Assets column.
  - `tests/importBoundaries.spec.ts`: `'assets'` in the app list (`:124`) and the store in `ADAPTER_WIRING` (`:106-111`).
  - `tests/fixtures/writeBack.ts:116-128` gains an `ASSETS` app under test, and `tests/recordStorageContract.spec.ts:886-915` the two kinds' write rules.
  - `index.html:15` and `public/manifest.webmanifest:5` name your assets beside the books, loans and investments.
- New specs: `tests/assetReaders.spec.ts` (each read rule above, problems listed by kind), `tests/assetsFirstRun.spec.ts` like `tests/loansFirstRun.spec.ts` with `kuna-assets.json` in the folder (`:76`), `tests/assetWrites.spec.ts` (delete takes the valuations, one Undo puts them back, a valuation naming a deleted asset is refused).

### 3. The values

- New: `houseIndex/` (domain, the adapter, its fake, `useHouseIndex.ts`), `carValue/domain/customsTable.ts`, `values/domain/assetValue.ts`.
- New: `docs/law/used-car-value.md` with Tablica 1, its source and "Open points", then `npm run law-index`. `tests/lawDocs.spec.ts` compares its table with `CUSTOMS_TABLE`. The law README's opening line widens from the Tax screen to Kuna's screens.
- Changed: `index.html:7` `connect-src` gains `https://web.dzs.hr`. `public/privacy.html:242-246` names the DZS beside the price vendors: Kuna asks it for the house price index, sending only the table's query, never anything of yours.
- New specs:
  - `tests/houseIndex.spec.ts`: the worked example's €238,884.80, a valuation newer than the index, a home without a region, the quarter of a day at each quarter's edges, and the reader over a saved JSON-stat answer with its ids reordered.
  - `tests/customsTable.spec.ts`: the worked example's €17,370.00, 34 months at 56.48, 0 months at 96, a car bought used at 24 months for €20,000.00 seen at 36 months as 20,000.00 × 55.06 ÷ 63.58 = €17,319.91, after 180 months at 19.32, a first registration on the 31st counted by `wholeMonthsBetween`.
  - `tests/assetValue.spec.ts`: each basis in order, a car with a valuation keeping it, an asset with nothing giving no value.

### 4. The mortgage link

- New: `src/apps/assets/loans/application/assetLoans.ts`, `values/domain/equity.ts`.
- Changed: `tests/importBoundaries.spec.ts:143-145` with the `PUBLISHED` table and its own case, as in the module map.
- New: `tests/assetEquity.spec.ts`: the worked example's €88,884.80, each "When something is missing" row about a loan.

### 5. The screens

- New: the Assets Overview's cards, `asset/presentation/AssetScreen.vue`, `AssetDialog.vue`, `ValuationDialog.vue`, `asset/application/assetWrites.ts`, built from `PageHeader`, `DashboardGrid`, `KpiTile`, `AppCard`, `FactGrid`, `FormGrid`, `AppDialog` and `MoneyInput` in `src/shared/ui`. No new shared component, no chart.
- The loan field is a select over `assetLoans` with No loan first. While Loans is not set up it is disabled with its reason.
- New: `home/presentation/assetsHubFigures.ts`. `assetsHomeCard.ts` shows Assets value and its waiting line.

### 6. Kuna's Overview

- Changed: `src/shell/overview/words.ts` (`:7-17`, `:19-30`):
  - `net` becomes "What you own less what you owe".
  - `leavesOut` names bank accounts only.
  - `description` names Assets.
  - `nothing` takes the names of the apps that count, so a fifth app needs no edit.
- Changed: `src/shell/overview/OverviewScreen.vue:70` passes those names.
- Changed: `README.md:356-357` (the Overview), `:2009` (`check:figures`), `:2158` ("today four"), and a new "Assets app" section after Investments' (`:2389`). It is named so because `README.md:963` "Assets" is the company's.
- Changed: `tests/personalNet.spec.ts`: its `describe` takes the new name, and a three-app case adds Assets value with an equity caption that leaves the sum as it was.

## Checks

### check:figures

- **New inputs:** `--assets <kuna-assets.json>` with an optional `--house-index <saved JSON-stat answer>`, and `--fake-assets <sample or house-and-car>` with the fake index. An Assets file without an index file is valued as if the index failed, as an Investments file without its prices file has no closes (`scripts/figure-digest.mjs:13-15`).
- **New groups:**
  - `loans.published`.
  - `assets.read.records`, `assets.read.problems`.
  - Per asset, by its place in the file and never its name, `assets.asset-N.value` (cents and basis) and `assets.asset-N.equity`. Equity reads `bankLoansOf` over the Loans input, and Loans counts as not set up without one.
  - `assets.totals` and `assets.hub`.
  - `hub.personal` over any two or more personal inputs.
- **Must stay identical:** every Company group on the four fake sets and the live file, every `loans.*` and `investments.*` group, and `hub.personal` for `--fake-loans sample --fake-investments sample`. Run the digest before stage 0 and at the end, and list in the commit that only new groups appeared.

### Fake variants

- `?assets=`:
  - `drive`, an empty file.
  - `browser`, kept in this browser nine days past its export.
  - `sample`: the Zagreb flat linked to the Home loan, the car with no loan, a boat with one valuation, and a plot with no value.
  - `house-and-car`: the car linked to the Car loan `fa4e0000-0000-4000-8000-000000000030` (`fakeLoans.ts:237-238`).
  - `loan-gone`: the flat names a UUID no fake Loans file has.
  - `other-device`, `opening`, `failed`.
- `?index=`: none for the fake index, `opening` holding it, `failed` refusing it.

### Visual check

Locally `npm run check:visual -- --only assets,kuna-overview,home --widths 360,640,1024`, since CI keeps catching overflow at 640 and 1024 px. CI runs all nine widths (`scripts/visual-check.mjs:339-349`). Expected figures are worked out in the check from the same fakes, as `fakeOverviewShows` does (`:437-456`).

- `assets-start` and `assets-start-croatian`: the first run.
- `assets-overview-empty` on `?assets=drive`, and in Croatian.
- `assets-overview` on `?assets=sample&loans=sample`, and in Croatian.
- `assets-flat` on the flat's page, with value, owed and equity, and in Croatian.
- `assets-flat-no-loans` on `?assets=sample`, `assets-flat-loan-gone` on `?assets=loan-gone&loans=sample`, `assets-flat-index-failed` on `?assets=sample&loans=sample&index=failed`.
- `assets-car` with the customs estimate, and in Croatian.
- `assets-opening`, `assets-failed`.
- `assets-settings` on `?assets=drive`, `assets-settings-browser` on `?fake=browser&assets=browser`.
- `kuna-overview` and `kuna-overview-croatian` on `?loans=sample&investments=sample&assets=sample`, replacing their expected text at `:930` and `:939`.
- `kuna-overview-assets-only` on `?assets=sample`, `kuna-overview-index-opening` on `?loans=sample&investments=sample&assets=sample&index=opening` with the placeholder, and `kuna-overview-fresh` (`:988`) naming four apps.
- `home`, `home-croatian` (`:922-923`) and `home-fresh` (`:1120-1129`) with the fourth card. A new `home-assets` on `?assets=sample` shows its figure.
- Editor flows: the asset dialog adding, editing and deleting a flat with Undo, the valuation dialog adding and deleting with Undo, and the loan picked and cleared, at the editor flows' widths and in Croatian. `homeFlowIn` expects four cards (`scripts/support/editorFlows.mjs:4566-4568`), and the fresh home four Set up cards (`:4633`).

### Touch check

At 360 and 430 px (`scripts/touch-check.mjs:197`):

- `assets-start-on-drive` beside `loans-start-on-drive` (`:2699`), and the first run kept in this browser.
- The Assets home card opens the Assets Overview.
- `kuna-overview` (`:443-446`) also taps Assets value, lands on `#/assets`, then Back.
- A flat added by touch: kind, region, price, the Home loan picked, saved, its page read for what is yours, then Undo.
- A valuation added on the car, its estimate caption gone, then Undo.
- The fresh home with four Set up cards (`:2660`).
- Every new control at least 44 by 44 px, which the check asserts after each step.

## New strings

Croatian runs a third longer, so every one is checked at 360 px.

| English                                                                                                                                                                                                                                      | Croatian                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assets                                                                                                                                                                                                                                       | Imovina                                                                                                                                                                                                                                       |
| Your flat, your car and the other things you own, in a file of their own, with what each is worth today.                                                                                                                                     | Vaš stan, automobil i ostala imovina u zasebnoj datoteci, s današnjom vrijednošću svake stavke.                                                                                                                                               |
| Pick your Assets file                                                                                                                                                                                                                        | Odaberite datoteku imovine                                                                                                                                                                                                                    |
| Assets file                                                                                                                                                                                                                                  | Datoteka imovine                                                                                                                                                                                                                              |
| Assets value                                                                                                                                                                                                                                 | Vrijednost imovine                                                                                                                                                                                                                            |
| No assets yet                                                                                                                                                                                                                                | Još nema imovine                                                                                                                                                                                                                              |
| Add an asset                                                                                                                                                                                                                                 | Dodaj imovinu                                                                                                                                                                                                                                 |
| Flat or house, Car, Other                                                                                                                                                                                                                    | Stan ili kuća, Automobil, Ostalo                                                                                                                                                                                                              |
| Region for the house price index                                                                                                                                                                                                             | Područje za indeks cijena stambenih objekata                                                                                                                                                                                                  |
| City of Zagreb, Adriatic, Rest of Croatia                                                                                                                                                                                                    | Grad Zagreb, Jadran, Ostatak Hrvatske                                                                                                                                                                                                         |
| Bought on                                                                                                                                                                                                                                    | Datum kupnje                                                                                                                                                                                                                                  |
| Price paid                                                                                                                                                                                                                                   | Plaćena cijena                                                                                                                                                                                                                                |
| First registration                                                                                                                                                                                                                           | Prva registracija                                                                                                                                                                                                                             |
| The bank loan on it                                                                                                                                                                                                                          | Kredit na ovoj imovini                                                                                                                                                                                                                        |
| No loan                                                                                                                                                                                                                                      | Bez kredita                                                                                                                                                                                                                                   |
| Set up Loans to pick a loan                                                                                                                                                                                                                  | Postavite Kredite da biste odabrali kredit                                                                                                                                                                                                    |
| Add a valuation                                                                                                                                                                                                                              | Dodaj procjenu                                                                                                                                                                                                                                |
| Valuation                                                                                                                                                                                                                                    | Procjena                                                                                                                                                                                                                                      |
| Estimate: {value} of {date}, carried to {quarter} by the DZS index for the {region}                                                                                                                                                          | Procjena: {value} od {date}, preračunato na {quarter} indeksom DZS-a za područje {region}                                                                                                                                                     |
| The index follows the region's market, not your building.                                                                                                                                                                                    | Indeks prati tržište područja, ne vašu zgradu.                                                                                                                                                                                                |
| The DZS index has no {quarter} yet, so this is the price paid on {date} (or the valuation of {date}).                                                                                                                                        | DZS još nema indeks za {quarter}, pa je ovo plaćena cijena od {date} (ili procjena od {date}).                                                                                                                                                |
| The DZS index did not load, so flats show their valuation or the price paid.                                                                                                                                                                 | Indeks DZS-a nije se učitao, pa stanovi pokazuju procjenu ili plaćenu cijenu.                                                                                                                                                                 |
| The DZS index starts in {quarter}, so it cannot carry the price paid on {date}. Add a valuation.                                                                                                                                             | Indeks DZS-a vodi se za {quarter} i kasnije, pa ne može preračunati plaćenu cijenu od {date}. Dodajte procjenu.                                                                                                                               |
| Estimate by the customs table: {share} of the price after {n} month(s) from first registration, and for a car bought used: {share} at {n} months from first registration, from the price paid at {m} months, when the share was {share then} | Procjena prema carinskoj tablici: {share} cijene nakon {n} mjeseca (mjeseci) od prve registracije, a za rabljeni automobil: {share} nakon {n} mjeseci od prve registracije, od plaćene cijene nakon {m} mjeseci, kad je udio bio {share then} |
| Owed on {loan}                                                                                                                                                                                                                               | Dug po kreditu „{loan}”                                                                                                                                                                                                                       |
| Yours after the loan                                                                                                                                                                                                                         | Vaše nakon kredita                                                                                                                                                                                                                            |
| {amount} yours after {loan}                                                                                                                                                                                                                  | {amount} vaše nakon kredita „{loan}”                                                                                                                                                                                                          |
| {amount} yours after their loans                                                                                                                                                                                                             | {amount} vaše nakon kredita na njima                                                                                                                                                                                                          |
| Its loan is no longer in Loans                                                                                                                                                                                                               | Kredit ove imovine više nije u Kreditima                                                                                                                                                                                                      |
| Loans did not open, so what is yours is not shown                                                                                                                                                                                            | Krediti se nisu otvorili, pa se vaš dio ne prikazuje                                                                                                                                                                                          |
| {n} asset(s) without a value                                                                                                                                                                                                                 | {n} stavka (stavke, stavki) imovine bez vrijednosti, through the plural helper                                                                                                                                                                |
| What you own less what you owe                                                                                                                                                                                                               | Imovina umanjena za dugove                                                                                                                                                                                                                    |
| Leaves out bank accounts, which no app keeps yet.                                                                                                                                                                                            | Ne uključuje bankovne račune, koje još nijedna aplikacija ne vodi.                                                                                                                                                                            |
| Your money across Loans, Investments and Assets, and what the company could pay you.                                                                                                                                                         | Vaš novac u Kreditima, Ulaganjima i Imovini te što vam tvrtka može isplatiti.                                                                                                                                                                 |
| Nothing to add up until an app is set up: {apps}, joined with or.                                                                                                                                                                            | Nema što zbrojiti dok ne postavite aplikaciju: {apps}, spojeno s ili.                                                                                                                                                                         |

## Settled without asking

- **Three kinds of asset.** Flat or house carries a region, car carries a first registration, and other is typed only. Parking, land and a boat are Other until one needs its own rule.
- **No tax fields or captions.** Useful area, use and acquisition costs serve only the property tax and the two-year rule, which nobody asked to show.
- **No source on a valuation.** The note holds "bank's appraisal" or "my guess". The price paid is the asset's own field, not a valuation.
- **The index is kept in memory only.** Offline, or with the DZS down, a flat shows what you typed. A copy in this browser would be a second thing to keep fresh, since the DZS revises past quarters.
- **One loan per asset.** None of the loans in the plans has a second loan on the same flat. A second one later is a second field or a link record.
- **One asset per loan**, the owner's answer of 5 Nov. The asset dialog hides a loan another asset names and keeps the asset's own loan when it edits itself. A write that would put a loan on a second asset is refused, and a file where two assets name one loan is read with a problem on both, so what is yours is never worked out with a loan taken off twice.
- **Assets is installed after Investments**, so its tile follows Investments value on the home and the Overview.

## Unconfirmed

- **Firefox on the deployed origin.** The coordinator and this plan's research checked the DZS with curl on 4 Nov: the POST answered with `Access-Control-Allow-Origin: *`, and an `OPTIONS` preflight answered `Access-Control-Allow-Methods: GET, POST` and `Access-Control-Allow-Headers: Content-Type`. A POST from Firefox on `ipazanin.github.io` is still to try, before stage 3 lands.
- **Later amendments to Tablica 1** of NN 1/2017 were not looked for. The page loaded is the 2017 text.
- **After 180 months** the Pravilnik has no row. Holding 19.32 is this plan's reading.
- **Tablica 1 is a tax table.** It gives the share of the special tax left on a used car, set by "postotak pada vrijednosti" of the car on the Croatian market (članak 9. stavak 1.). Using it as the car's value is the owner's choice and is labelled an estimate.
- **The DZS's newest quarter is provisional.** The answer's note says "Podaci za drugo tromjesečje 2026. privremeni su." The estimate moves when the DZS revises it. Nothing is stored, so nothing goes stale.
- **Which towns are in Jadran and Ostalo.** The DZS list was not opened. The owner picks the region.
- **Whether the flat is co-owned.** Kuna Loans counts a loan in full, and the asset counts its full value. If the flat is shared, both figures are too high by the other owner's part. The domain lane's note that Loans already counts a loan "by yourShare" is mistaken: `yourShare` is the part of an instalment you pay after the subsidy (`src/apps/loans/bankLoans/domain/loanFigures.ts:86`), not a share of ownership.
- **The Croatian strings** have not been checked at 360 px.

## Sources

Loaded on 4 Nov 2026.

- DZS PxWeb, Tabela 1.4 Indeksi cijena stambenih objekata, po tromjesečjima, `ME_PS14.px`, POST and preflight run with curl. The answer: `updated` 2026-10-01, ids `Kategorije, Indikatori, Tromjesečje`, sizes `3, 1, 98` for the three regions, quarters 2002 Q1 to 2026 Q2. Grad Zagreb 95.05 in 2025 Q1 and 113.53 in 2026 Q2. Jadran 95.21 and 108.46, Ostalo 92.96 and 113.34. https://web.dzs.hr/PXWeb/api/v1/hr/Cijene/Indeksi%20cijena%20stambenih%20objekata/ME_PS14.px
- Pravilnik o posebnom porezu na motorna vozila, NN 1/2017, članak 9. stavci 1, 3, 4 and Tablica 1, read verbatim from the downloaded page. https://narodne-novine.nn.hr/clanci/sluzbeni/2017_01_1_2.html
- DZS, Indeksi cijena stambenih objekata za prvo tromjesečje 2026., on the revision and the base 2025 = 100, as the domain lane read it. https://podaci.dzs.hr/media/5wwfeoni/cij-2026-2-1_1-indeksi-cijena-stambenih-objekata-za-prvo-tromjesečje-2026.pdf
- [The proposal](../../architecture/hub.md), the published facts rule and H8. [Lane 3, apps](../../architecture/research/hub-lane3-apps.md), "Personal assets". [The overview plan](../overview/plan.md), the sum and the owner's answer of 4 Nov on the name.

## The owner's answer, 2026-11-05

- One asset per loan. The loan picker hides a loan already on another asset, keeps the asset's own loan when it edits itself, and the reader flags two assets on one loan as a read problem.

## The owner's answers, 2026-11-04

- Carry the flat's value forward by the DZS index for its region, shown as an estimate with its quarter. Work it out on load and never store it.
- Count a car, estimated from purchase price and first registration by the NN 1/2017 customs table, until a valuation is typed.
- Leave the pension pillars out of Assets v1.
- The overview's lead figure reads "What you own less what you owe", with the leaves-out line naming bank accounts. It becomes "Net worth" once a spending app brings bank accounts.
- Standing direction: "since amount of business logic is growing, I want you to be well organized, to have good separation and reusability, think modular monolith".

Taken as the lead's defaults the same day, open to the owner's change:

- The mortgage link is in v1, through Loans' published list.
- Assets is its own app.
- No remove-file action.
- The company stays in its own card and is never added in.
- No deposits or cash in Assets.
