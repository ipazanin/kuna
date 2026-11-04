# Assets app, lane 1: the code

Read at `0717599` on `main` in the Kuna repo, read only. Every path is relative to the repo, the design documents under `docs/` included. Every figure and name is made up.

## In short

- A fourth app is mostly copying Loans' skeleton. The shell, the home, the menu, the router, the sync, the first run screen, the file card, the export and Kuna's Overview already loop over installed apps. About 28 skeleton files are app-written, plus about 15 places outside the app folder.
- The plainest record set is two kinds: `asset` and `valuation`, euros only, UUID ids, bare UUID references, as Loans does. The mortgage link is one optional field on the asset, `loan`, holding the bank loan's bare UUID.
- No app may import another today (`tests/importBoundaries.spec.ts:143-145`), and nothing crosses apps except the hub figures the shell reads. The proposal planned a published `facts.ts` per app with one translation file in the reader (`docs/architecture/hub.md:145`). That is the plainest way for Assets to list bank loans and show equity.
- `personalNet` needs no change. Assets joins with one `has` part, its gross value. Equity shows as that part's caption and is never added, so the mortgage is taken off once, by Loans' `owes` part.
- The owner said on 2026-11-04 not to call the figure net worth (`docs/features/overview/plan.md:213`). With assets in, only bank accounts are missing. The label is the owner's call.

## 1. What Loans and Investments needed

### AppContribution members and `main.ts`

`src/main.ts:19` imports each `app.ts` in one `Promise.all`, and `:20-22` installs them in order. Install order is home order (`src/shell/routing/appRegistry.ts:5-9`). A fourth app adds one import and one `installApp`. The boundary spec checks the import is dynamic (`tests/importBoundaries.spec.ts:124-126`).

Members of `AppContribution` (`src/shared/app/appContribution.ts:84-126`), as Loans fills them (`src/apps/loans/app.ts:29-75`):

| Member                          | Loans                                                                                       | Investments                                            | Assets would need                           |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `id`, `name`, `colour`          | `LOANS_APP`, `words.name`, `--app-loans` (`:30-32`)                                         | `:52-54`                                               | `assets`, Assets or Imovina, `--app-assets` |
| `install()`                     | seeds `?loans=` in the fake build only (`:33-39`)                                           | seeds `?investments=`, `?prices=`, `?keys=` (`:55-62`) | seeds `?assets=`                            |
| `screens`, `menu()`, `settings` | Overview, Scenarios, two loan pages, Settings, Start bare (`:40-49`)                        | eight screens (`:63-74`)                               | Overview, an asset page, Settings, Start    |
| `menuCount`                     | none (`:50`)                                                                                | holdings and transactions (`:75-80`)                   | none                                        |
| `subtitle`                      | null (`:51`)                                                                                | null (`:81`)                                           | null                                        |
| `moneyFormat`                   | `DEFAULT_MONEY_FORMAT` (`:52-53`)                                                           | same (`:82-83`)                                        | same                                        |
| `homeCard`                      | `LOANS_HOME_CARD` (`:54`)                                                                   | `:84`                                                  | `ASSETS_HOME_CARD`                          |
| `hub`                           | `{ counts: true, figures: () => homeCardFigures(state, …loansHubFigures…) }` (`:55`)        | `:85`                                                  | same shape as Loans                         |
| `firstRun`, `startPath`         | `state.status !== 'opening' && state.choice === null && state.workbook === null` (`:56-57`) | identical (`:86-87`)                                   | identical                                   |
| `syncGroup`                     | `loansSyncGroup` (`:58`)                                                                    | `:88`                                                  | one more copy                               |
| `gallery`                       | none                                                                                        | optional (`:89-90`)                                    | none                                        |
| `asksGoogleOnOpen`              | `loadWorkbookChoice(LOANS_APP)?.source === 'drive' && autoSyncOn.value` (`:59`)             | identical (`:91`)                                      | identical                                   |
| `start()`                       | resumes a find or pick (`:61-74`)                                                           | the same plus prices (`:94-108`)                       | a third copy of the find or pick resume     |

`start()` in Loans and Investments is the same 12 lines with a different store, words and start route. A third copy is the point to lift it into `src/shared/storage/presentation`, since all three change for the same reason, the shared find-or-pick flow.

### File kind and storage

All generic now:

- The document: `newDocument(app, schema, {}, savedAt)` (`src/apps/loans/workbook/infrastructure/loansDocument.ts:14-16`), schema `{ loans: 1 }` (`:11`), and an `AppDocument` whose `read` maps records to the book (`:19-26`). The format is generic (`src/shared/storage/infrastructure/documentFormat.ts:9-46`).
- The store: `pageWorkbookStore(app, document, pickTitle)` (`src/shared/storage/infrastructure/pageWorkbookStore.ts:17`), wrapped once (`src/apps/loans/workbook/application/loansStore.ts:9-14`). It handles Drive or browser, the fake Drive (`pageWorkbookStore.ts:20-27`) and the shared Google sign-in (`:41-44`).
- File name `kuna-<app>.json` (`src/shared/storage/infrastructure/driveDocument.ts:43-45`), so Assets gets `kuna-assets.json` for free. The device key is `kuna.workbook-file.<app>` (`src/shared/storage/infrastructure/workbookChoice.ts:4-26`).
- The first run is one shared screen fed a `FileFirstRun` (`src/shared/storage/presentation/fileFirstRun.ts:46-55`). Loans' `StartScreen.vue` only fills it (`src/apps/loans/onboarding/presentation/StartScreen.vue:13-25`). The app writes its own first run words (`src/apps/loans/onboarding/presentation/words.ts`, 56 lines, the `FirstRunWords` shape at `fileFirstRun.ts:7-29`).
- Sync: the shell builds one page sync from every app's `syncGroup` (`src/shell/App.vue:70`, `src/shared/sync/presentation/pageSync.ts:117-118`). The app's group is a store, no steps, the books scopes, undo, an export control and its file card route (`src/apps/loans/sync/presentation/loansSyncGroup.ts:8-18`). Auto sync is one shared switch (`autoSyncOn`, read in `app.ts:59`).

App-written, per app: `loansDocument.ts`, `loansStore.ts`, `loansCodecs.ts` (the codec list and lookup, `:12-30`), `loanKinds.ts`, `loansBooks.ts`, `readLoanBook.ts`, `loanWriteGuards.ts` (two lines over `dependentRefusalsOf`, `:9-14`), `loansFile.ts` (file name, local title, new contents, `:10-19`), `useLoansExport.ts` and `LocalLoansStatus.vue` (thin wrappers over `useFileExport` and `LocalFileStatus`), the workbook words, and `loansSyncGroup.ts`.

### Settings and the remove-file action

Loans Settings is one shared `BooksFileCard` with Export and Switch storage (`src/apps/loans/settings/presentation/LoansBooksCard.vue:17-23`) inside a page header (`SettingsScreen.vue:7-12`). Loans has no remove action.

Investments has one: a Remove button on the same card (`src/apps/investments/settings/presentation/InvestmentsBooksCard.vue:28-40`), `RemoveFileDialog.vue` (111 lines), `useFileRemoval.ts` and `settings/application/fileRemoval.ts`. Most of it is Investments' own: the keys file and the prices file go first (`fileRemoval.ts:53`, `:76-79`). Only the last step is generic: `store.dropWorkbook(id, first)` (`src/shared/storage/application/createWorkbookStore.ts:444-461`), which trashes the Drive file or forgets the browser one and clears the cache.

For Assets, a remove action needs only `dropWorkbook` and a confirm dialog. If the owner wants one, it should be one shared dialog that Loans gets in the same change, so the two plain apps remove the same way.

### The home card

`AppHomeCard` is icon, purpose and `figures()` (`appContribution.ts:47-54`). Loans' card is 19 lines through `homeCardFigures` (`src/apps/loans/home/presentation/loansHomeCard.ts:11-19`, `src/shared/app/homeCardFigures.ts:4-15`). The home itself is generic (`src/shell/home/HomeScreen.vue:14`, `src/shell/home/HomeAppCard.vue:21-52`), and so is the sidebar from 1024 px (`src/shell/App.vue:40-47`).

### Fake build variants and `check:figures`

- Seeds: `seedFakeLoans(variant)` (`src/apps/loans/workbook/infrastructure/fake/seedFakeLoans.ts:32-76`) with `drive`, `browser`, `sample`, `one-loan`, `house-and-car`, `equal-principal`, `other-device`, `opening`, `failed`. It is about 90 lines of near copy per app. The browser id carries the shared marker prefix `FAKE-WORKBOOK-ONLY-DO-NOT-SHIP` (`seedFakeLoans.ts:15`, `scripts/support/devOnlyMarkers.mjs:8`), so `assert-no-fake-bytes` covers a new app without change.
- Fake files: `fakeLoansDocument(savedAt, set)` with fixed ids `fa4e0000-…` (`fakeLoans.ts:38-40`, `:296-320`). The sample home loan is `fa4e0000-0000-4000-8000-000000000001` (`fakeLoans.ts:54-56`), the car loan `…000000000030` (`:237-238`). Investments uses `fa4e1000-…`. Assets would take `fa4e2000-…` and name the fake loans' ids as text, since a fake seed may not import Loans either.
- `scripts/figure-digest.mjs`: inputs `--loans` and `--fake-loans` (`:8-9`, `:157-158`, `:168`, `:177`), Investments the same (`:10-11`). Each app has a `…Groups(add)` function that returns how Kuna's Overview reads the file (`:359-431` for Loans, `:458-…` for Investments). `hub.personal` is added only when Loans and Investments are both given (`:336-345`). Assets needs `--assets` and `--fake-assets`, an `assetsGroups`, and `hub.personal` for any two or more personal inputs.

### Checks, boundaries, words, README

- Visual check: Loans pages at `scripts/visual-check.mjs:1561-1873`, Investments from `:1899`, the home's expected text at `:922-923`, `:1120-1173`, Kuna's Overview at `:924-990` with its figures from `fakeOverviewShows` (`:437-456`). Widths are the nine in `VIEWPORTS` (`:339-349`), 640 and 1024 among them.
- Touch check: two phone widths (header, `scripts/touch-check.mjs:1-2`). The Overview step taps each part's tile and goes back (`:429-462`, the tile list at `:443-446`). The fresh home expects three Set up cards (`:2660`). The first-run flows sit in the flow table (`:2699-2725`).
- Editor flows: `homeFlowIn` requires exactly three cards in order (`scripts/support/editorFlows.mjs:4566-4568`) and the fresh home three Set up cards (`:4633`). `LOANS` and `INVESTMENTS` app handles (`:3611-3612`).
- Import boundaries: the app list (`tests/importBoundaries.spec.ts:124`), `ADAPTER_WIRING` gains the store (`:106-111`).
- Other specs that list apps: `tests/tokenContrast.spec.ts:22` and `src/shared/styles/tokens.css:79-80`, `:171-172` (the identity colour), `tests/designCatalogue.spec.ts:15-21` with the column in `.agents/skills/kuna-design/components.md`, `tests/fixtures/writeBack.ts:116-128` and `tests/recordStorageContract.spec.ts:886-915` (the contract suite over every kind), a first run spec like `tests/loansFirstRun.spec.ts` (its folder check at `:76`), a readers spec like `tests/loanReaders.spec.ts`, and a Google return spec like `tests/loansGoogleReturn.spec.ts`.
- Words: one `words.ts` per folder with `en` and `hr: Translation<typeof en>` (`src/apps/loans/home/presentation/words.ts:6-20`). Loans has app, home, onboarding, settings, workbook domain and workbook presentation words, plus per-feature words. The type makes a missing Croatian key a type error.
- README: "The shell and its apps" says "today three" (`README.md:2158`), one section per app (`README.md:2173` Loans, `:2389` Investments), the Overview text (`README.md:356-357`) and the `check:figures` line (`README.md:2009`). Also `index.html:15` and `public/manifest.webmanifest:5` name the three apps, and `public/privacy.html` names the files it writes.

### Generic now versus written per app

Generic: the registry, router, home, sidebar, first-run redirect, gallery and Kuna's Overview (`appRegistry.ts:6-28`, `src/shell/routing/router.ts:30-34`, `App.vue:32-78`, `src/shell/overview/OverviewScreen.vue:47-57`), the store, document format, file naming, device choice, first run screen, file card, local status, export, find, `homeCardFigures`, `dropWorkbook`, the page sync and `personalNet`.

Written per app, using Loans as the smallest template: `app.ts`, `words.ts`, home card, hub figures and words, start screen and words, settings screen, books card and words, sync group, codecs, store, write guards, kinds, books type, book reader, domain words, document, fake file, fake seed, file helpers, local status, export wrapper, file words, links, Overview screen and words. That is 28 files before any record type, reader, write or screen of the app's own.

## 2. Record shapes

What Loans and Investments do:

- **Ids.** Every record has `id: RecordId`, made once as `recordIdOf(kind, newRecordId())`, a random UUID (`src/shared/storage/domain/recordId.ts:10-26`, `src/apps/loans/informalLoans/application/informalLoanWrites.ts:36-38`).
- **References.** A child names its parent by the parent's bare UUID in a field such as `loan` (`src/apps/loans/workbook/domain/loanReference.ts:9-23`), read back with the parent's kind so a UUID of another kind finds nothing (`:20-23`). Investments does the same (`src/apps/investments/workbook/domain/handPriceReading.ts:16`, `:25`).
- **Dated values.** A child record with a `date` and an amount: a movement (`src/apps/loans/workbook/domain/movement.ts:11-19`) or a hand price (`src/apps/investments/workbook/domain/handPrice.ts:6-12`). The reader checks the parent exists and the date is not before the parent starts (`src/apps/loans/workbook/domain/readLoanBook.ts:194-198`).
- **Money.** `Money`, integer cents (`src/shared/money/money.ts:1-5`), stored as amount text (`informalLoanReading.ts:53`) and read by `requiredMoney` or `optionalMoney` (`src/shared/storage/domain/storedFields.ts:140-146`). Investments adds `Decimal` for quantities and prices (`handPrice.ts:10`), which a valuation does not need.
- **Currency.** No file keeps one. Both apps use `DEFAULT_MONEY_FORMAT`, euros (`src/shared/money/moneyFormat.ts:27-28`, `loans/app.ts:52-53`, `investments/app.ts:82-83`). Investments keeps a currency per instrument and per income (`instrument.ts:80`, `income.ts:18`) but converts before anything leaves the app. `personalNet` refuses to add apps of different currencies (`src/shared/app/personalNet.ts:44-45`).
- **Deleting a parent.** The write removes its children in the same unit of work, so one Undo puts them back (`informalLoanWrites.ts:29-33`). A write that would orphan a child that stays is refused through `dependentRefusals` (`informalLoanWrites.ts:18`, `src/shared/storage/application/dependentRefusals.ts:17-36`).
- **New fields later.** A field the app does not know is kept as the file gave it (`documentFormat.ts:6`). A file saved by a newer schema refuses writes on an older app (`documentFormat.ts:22-25`, `documentRecordStorage.ts:109-110`).

The plainest set for Assets v1, schema `{ assets: 1 }`:

| Kind        | Fields                                                                                                                   | Rules                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `asset`     | `name`, `bought` (date, optional), `price` (what was paid, optional), `loan` (a bank loan's bare UUID, optional), `note` | name required. Price above zero when given.                                                                                               |
| `valuation` | `asset`, `date`, `value`, `note`                                                                                         | names an asset that counts, value zero or above, not before `bought`, one per asset and day (`sharedKeys`, as `readLoanBook.ts:122-125`). |

Value on a day is the latest valuation on or before it, else the price paid once bought, else nothing (and a note says "1 asset without a value", as `investmentsHubFigures.ts:12` does for holdings). Deleting an asset takes its valuations in the same write.

No other record is needed. Lane 3's `kind`, `currency`, `disposed date`, `purchase transaction id` and valuation `source` (`docs/architecture/research/hub-lane3-apps.md:76-77`) are left out: no screen needs a kind yet, no file keeps a currency, nothing sells an asset yet, the personal ledger does not exist, and a source fits in the note. The domain lane may find a reason for `kind` or `source`. Either is a later optional field.

The `loan` field holds one loan. A second loan on the same flat would need a second field or a link record. None of the owner's loans needs that, so v1 keeps one.

## 3. Linking the mortgage to the flat

### What exists

- No app imports another, checked at `tests/importBoundaries.spec.ts:143-145`, with no exception.
- The only thing that crosses apps is `hub.figures()`, read by the shell (`appContribution.ts:57-82`, `OverviewScreen.vue:30-57`). Each part is a label, cents, a caption and a route. It carries no record id.
- The proposal planned a published file per app: "Another app's `facts.ts`, and only from that app's one translation file. Empty until H5." (`docs/architecture/hub.md:145`, also `:27`, `:66` and `docs/architecture/research/hub-lane1-architecture.md:127`). H5 was never built. No `facts.ts` exists under `src/apps`.
- Lane 3 put the link on the loan: "secured by (an asset id, optional)" (`docs/architecture/research/hub-lane3-apps.md:54`, `:107`). The roadmap row says "mortgage equity by asset id" (`docs/architecture/hub.md:183`).

### The plainest design

**The asset names its loan.** The `asset` record's `loan` field holds the bank loan's bare UUID. Nothing in the Loans file changes.

**Loans publishes its bank loans.** `src/apps/loans/facts.ts` exports one function and one type, separate from Loans' own model:

```ts
/** A bank loan as another app may read it: what it is called and what you owe on it on the day. */
export interface PublishedBankLoan {
  readonly key: string
  readonly name: string
  readonly lender: string
  /** Null while its plan cannot be worked out. */
  readonly owed: Money | null
  readonly to: RouteLocationRaw
}

/** Loans' bank loans on the day, a wait while the file opens, a failure, or null while Loans is not set up. */
export function publishedBankLoans(day: CivilDate): readonly PublishedBankLoan[] | 'opening' | 'failed' | null
```

It is `homeCardFigures(state, …)` over `book.bankLoans`, with `owed` from `bankLoanFigures(book, day)?.owed` (as `src/apps/loans/overview/presentation/owedTotals.ts:28`, `:35-36`) and `to` from `bankLoanLink` (`src/apps/loans/overview/presentation/loanLinks.ts:18-20`). A pure twin over a `LoanBook` lets `figure-digest.mjs` call it without the store.

**Assets reads it in one file**, for example `src/apps/assets/loans/application/assetLoans.ts`, and turns it into its own terms. The asset dialog lists the bank loans to pick from, and the asset's page shows value, owed on its loan and equity, with a link to the loan's page.

**The boundary spec gets the one exception** the proposal planned: an import of `src/apps/loans/facts.ts` from that one Assets file.

Loans stays upstream and knows nothing of assets. Assets is the only reader, so there is one direction and no cycle.

### Why not the other ways

- **The loan names its asset** (lane 3's shape). Loans' bank loan dialog would need Assets' list, and Assets would still need each loan's balance for equity, so each app reads the other. It also changes the Loans file.
- **The shell matches them.** The shell would subtract a loan from an asset, which is money logic in a shell the proposal keeps free of it (`docs/architecture/hub.md:27`), and Assets' own page could still not show equity.
- **A slot on `AppContribution` the shell hands to apps.** It works within today's rules, but it puts a Loans type in `src/shared` and adds plumbing through `start()` for one reader.

### What happens when

| Situation                     | Assets shows                                                                                                                                                                                        | Kuna's Overview                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The loan is deleted in Loans  | The asset counts at its value. Its page says its loan is no longer in Loans, and the dialog offers to clear the link. Nothing is refused or cascaded, since neither app can write the other's file. | Correct: the asset's value is in, the loan is gone from Loans' part.                                     |
| The loan is paid off          | Owed is zero, equity equals value. The completed loan still lists.                                                                                                                                  | Correct.                                                                                                 |
| The loan has no plan yet      | Owed unknown. Equity is not shown, and the page says why.                                                                                                                                           | Correct. Loans' part already leaves that loan out (`owedTotals.ts:20-28`).                               |
| Loans is not set up           | Value only. The link picker says to set up Loans first.                                                                                                                                             | Loans counts as nothing and is named with Set up (`personalNet.ts:31-33`, `OverviewScreen.vue:112-117`). |
| Loans is opening              | Equity waits.                                                                                                                                                                                       | The sum waits (`personalNet.ts:42-43`).                                                                  |
| Loans failed                  | Equity is not shown, and the page names Loans.                                                                                                                                                      | The sum is held back (`personalNet.ts:40-41`).                                                           |
| The Assets file is not set up | Nothing. Loans is unchanged.                                                                                                                                                                        | Assets counts as nothing and is named with Set up.                                                       |

## 4. The overview after the change

**How Assets joins.** `hub: { counts: true, figures: () => homeCardFigures(state, (book) => assetsHubFigures(book, today())) }`, as Loans does (`loans/app.ts:55`). One part, as Investments has one (`src/apps/investments/home/presentation/investmentsHubFigures.ts:8-14`): label "Assets value", the total value today, `side: 'has'`, the route of the Assets Overview. Its notes say what it leaves out, such as an asset without a value. `personalNet` and `OverviewScreen.vue` need no code change, since both loop over counted apps (`personalNet.ts:35-48`, `OverviewScreen.vue:47-50`, `:81-86`). Install Assets after Investments so its tile follows Investments value.

**Equity without counting the mortgage twice.** The part adds the gross value. Loans' "You owe in all" already takes off the whole mortgage (`src/apps/loans/home/presentation/loansHubFigures.ts:16-19`). Equity goes in the caption only, such as "€120,000.00 yours after the Home loan" for one linked asset, or "€135,000.00 yours after their loans" for several. A caption is never summed (`OverviewScreen.vue:109`). An equity part on the `has` side, beside Loans' `owes` part, would take the mortgage off twice.

**The label.** The shell cannot tell which app is assets without knowing money, so a label that switches when Assets is set up means app knowledge in the shell or a label contributed by an app. A fixed label works in every state, because a missing Assets file already shows as "Not set up: Assets". See the first decision.

**Words that change** in `src/shell/overview/words.ts` (English `:7-17`, Croatian `:19-30`):

- `description` names Loans and Investments.
- `net` is the label.
- `leavesOut` says "bank accounts and property, which no app keeps yet". It becomes "Leaves out bank accounts, which no app keeps yet" plus what the apps' notes add. The company is already shown apart under its own heading (`:16`).
- `nothing` names "Loans or Investments". It should name the counted apps from the registry, so a fifth app needs no edit.

Also `README.md:356-357`, `tests/personalNet.spec.ts` (its `describe` and a three-app case), and the visual and touch expectations listed in section 6.

## 5. A section inside Investments or Loans instead

|                     | New Assets app                                                                | A section in Loans                                                                                                                                                                 | A section in Investments                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| What the owner sees | A fourth card, its own first run and file, Assets in Kuna's Overview          | Loans grows a Property screen. Its card and name no longer fit a car or land.                                                                                                      | A flat beside ETFs, in Holdings, Performance and the mix                                                                                |
| The mortgage link   | Across files: Loans' `facts.ts`, one translation file, one boundary exception | In the same file. The reader checks the loan exists and a delete is refused or takes the link (`readLoanBook.ts:147-149`, `informalLoanWrites.ts:18`)                              | Across files, as with a new app                                                                                                         |
| Cost                | About 28 skeleton files, about 15 places outside, plus the domain and screens | The domain and screens only. Loans' words, home card purpose (`src/apps/loans/home/presentation/words.ts:7`) and README change                                                     | The domain plus exclusions from performance, the time-weighted return, the benchmark, the checks and tax, since a flat is not a holding |
| Later               | Bank accounts and spending stay separate apps, as planned                     | Moving assets out later means moving records between files, which Kuna has no tool for. Field names are close to permanent (`docs/features/loans/plan.md`, "The storage is ready") | Same as Loans, and worse, since the price and tax code would carry the exclusions                                                       |

Recommendation: the new app, which the owner already picked. The business language changes between a loan's plan and a dated valuation, and the extra cost is a copied skeleton plus one published file the proposal planned anyway. The Loans section is the cheapest in code, but it fixes property inside the Loans file for good. Investments is the worst fit.

## 6. What the checks need

**Specs**

- `tests/assetReaders.spec.ts`: a valuation naming no asset, two on one day, one before `bought`, a negative value, the problems listed by kind.
- `tests/assetValue.spec.ts`: value on a day from the latest valuation, the price paid before any valuation, nothing before `bought`, the totals.
- `tests/assetEquity.spec.ts`: value less owed, a loan gone, a loan without a plan, a paid-off loan, Loans not set up, opening and failed.
- `tests/loansFacts.spec.ts`: the published list from the sample book, `owed` null for a loan without a plan.
- `tests/assetWrites.spec.ts`: delete takes the valuations and one Undo puts them back.
- `tests/assetsFirstRun.spec.ts` like `loansFirstRun.spec.ts`, with the folder holding `kuna-assets.json`.
- `tests/personalNet.spec.ts`: a three-app case with assets, and the equity caption not changing the sum.
- `tests/recordStorageContract.spec.ts` and `tests/fixtures/writeBack.ts`: `ASSETS_WRITES` and an `ASSETS` app under test.
- `tests/importBoundaries.spec.ts`: `'assets'` in the app list, the store in `ADAPTER_WIRING`, the one `facts.ts` exception, and a check that no other file imports `facts.ts`.
- `tests/tokenContrast.spec.ts`, `tests/designCatalogue.spec.ts` and the catalogue column.

**Fake data.** `?assets=` with `drive` (empty), `browser`, `sample` (a flat linked to the sample Home loan `fa4e0000-0000-4000-8000-000000000001`, with three valuations, plus a car with only its price paid), `house-and-car` (the car linked to the Car loan `…000000000030`), `loan-gone` (a flat naming a UUID no fake Loans file has), `other-device`, `opening`, `failed`.

**Digest groups.** `--assets <file>` and `--fake-assets <set>`, beside the Loans inputs: `assets.read.records`, `assets.read.problems`, per asset by its place in the file `assets.asset-N.values` and `assets.asset-N.equity`, and `assets.totals`. Equity reads the Loans input's published list when one is given, else Loans as not set up. `hub.personal` for any two or more of Loans, Investments and Assets (`scripts/figure-digest.mjs:336-345`). Company, Loans and Investments digests unchanged.

**Visual pages** at the suite's nine widths (360, 640 and 1024 among them, `scripts/visual-check.mjs:339-349`), Croatian at 360 at least:

- The Assets first run.
- The empty Overview (`assets=drive`).
- The Overview with assets (`assets=sample&loans=sample`).
- The flat's page with equity.
- The flat's page with Loans not set up (`assets=sample`), and with its loan gone (`assets=loan-gone&loans=sample`).
- Opening and failed.
- Settings.
- The asset and valuation dialogs in the editor flows with add, edit, delete and Undo.
- Kuna's Overview with all three apps, with Assets alone, and fresh (`fake=empty`) naming four apps.
- The home with four cards and the fresh home with four Set up cards.

Today's checks to update: `visual-check.mjs:922-923`, `:930`, `:939`, `:988`, `:1120-1129`, `fakeOverviewShows` at `:437-456`, and `editorFlows.mjs:4566-4568`, `:4633`.

**Touch steps** at the two phone widths:

- The first run kept in this browser and on the fake Drive.
- The Assets card opening its Overview.
- Kuna's Overview tile "Assets value" opening `#/assets` and Back, added to `touch-check.mjs:443-446`.
- Adding a flat, linking the Home loan in its dialog, and reading equity on its page.
- Adding a valuation and undoing it.
- The fresh home with four Set up cards (`touch-check.mjs:2660`).
- The 44 px rule on every new control, which the touch check applies after each step.

## Decisions for the owner

### 1. What the lead figure on Kuna's Overview is called

The Overview's lead tile reads "Investments less loans" today. On 4 Nov you said not to call it net worth, because property and bank accounts were missing. With the flat in, only bank accounts are missing. For example, Investments €40,000, the flat €250,000, loans €180,000 give €110,000.

- **Call it "What you own less what you owe".** One label whatever is set up. The line under it says it leaves out bank accounts. Cost: the words in two languages and the checks that read them.
- **Call it "Net worth" now.** The usual name. The line under it still says bank accounts are missing. Cost: the same, but the name claims more than it counts until a spending app exists.
- **Keep listing the parts: "Investments and assets less loans".** Exact. Cost: a long label, longer still in Croatian, to check at 360 px, and it changes again with each app.

Recommendation: "What you own less what you owe", and "Net worth" once bank accounts are in.

### 2. Whether the flat shows what is yours after the mortgage

Net worth is right without any link: the flat's value is added and Loans takes off the whole mortgage. The link adds one thing, a line such as "€70,000.00 yours after the Home loan" on the flat's page and under Assets value on the Overview.

- **Link the loan in the asset's dialog.** Assets reads Loans' bank loans through one published file, as the proposal planned for company facts. Cost: that file, a translation file in Assets, one exception in the boundary spec and the equity specs and pages.
- **Leave the link out of v1.** Cost: nothing now. The equity line comes later, with the same design.

Recommendation: link it, since that is what you asked for and the published file is small.

### 3. Assets as its own app, or a Property screen inside Loans

Confirming the choice you made, since the cost differs.

- **Its own app.** As planned. Cost: about 28 copied skeleton files and the cross-file link.
- **A Property screen inside Loans.** The flat and its loan sit in one file, so the link is checked on save. Cost: Loans' name and purpose stop fitting, and moving property out later has no tool.

Recommendation: its own app.

### 4. Whether Assets Settings can remove its file

Investments Settings has "Remove the Investments file". Loans has none.

- **No remove, as Loans.** Cost: none. You remove the file in Drive.
- **Add Remove to Assets and Loans together.** One shared dialog over the existing store removal. Cost: a dialog, its words in two languages and a touch flow.

Recommendation: no remove in v1.

## Gotchas

- The company's Year page already has an Assets tab, "Imovina" in Croatian (`src/apps/company/packs/hr-doo/presentation/year/words.ts:19`, `:47`). Only one app's menu shows at a time, so the names do not meet on one screen. The company's asset kind is `hr-doo.asset` (`hrDooKinds.ts:14`), in another file, so a personal `asset` kind does not clash.
- Overview tiles are keyed by label (`OverviewScreen.vue:109`), so the Assets part's label must differ from every other app's.
- `figure-digest.mjs` imports Loans code directly. That is fine for a script, but the equity group needs the pure twin of `publishedBankLoans`, since the store-bound one reads the page's store.
- Kind names do not start with the app id, against the proposal's rule (`docs/architecture/hub.md:148`). Loans' `bank-loan` and Investments' `price` show the rule was dropped. Each file has its own kinds, so nothing clashes.
