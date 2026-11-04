# Investments lane 2: how the app fits into Kuna's code

What a third Kuna app adds file by file and what it reuses, how money in several currencies fits beside Company and Loans, where daily prices can come from with no server, what may be public, and how the home and a net worth view would read it. Read against the Kuna repo at 210875f.

Read against the Kuna repo at HEAD `210875f` (30 Oct 2026, "Add lint phases 2 and 3"). Another agent was editing the working tree while I read it (`scripts/visual-check.mjs`, `src/shared/charts/chartTooltip.ts`, `src/shared/ui/DonutCard.vue`, `src/shell/gallery/GalleryScreen.vue` were modified), so every `file:line` below is from `git show HEAD:<file>`, not from the files on disk. Paths are from the repo root. The prototype was read at valore `6e2fd62`. Every figure in an example is made up.

## Short version

- **The app seam holds.** A third app is one `AppContribution` (`src/shared/app/appContribution.ts:43-79`), installed in `src/main.ts:19-21`, with its own JSON file on Drive or in the browser through `pageWorkbookStore` (`src/shared/storage/infrastructure/pageWorkbookStore.ts:17`). Routes, the home card, the sidebar, sync, backups, Undo and export come with it. Loans did exactly this in 79 files.
- **Extract the first run before copying it a third time.** Loans' first run is a near copy of Company's (Home, Folder and Find steps), and its text is hard-coded English. A shared "where the file lives" flow saves the third copy.
- **Money stays as it is for Company and Loans.** `Money` is integer cents with no currency (`src/shared/money/money.ts:5`), used in about 200 files. Investments needs three new value types beside it, not a change to it: an amount in a named currency, a quantity with many decimals, and a unit price with many decimals. Conversion to euros belongs in the app's domain, at the ECB rate of the day, and only the app's EUR result leaves the app.
- **Price history must not live in the holdings file.** Every save uploads the whole document and Drive keeps up to 100 revisions forever (`src/shared/storage/infrastructure/driveDocument.ts:33-35`). Daily closes for 30 symbols over 5 years are about 38,000 rows. They belong in a separate prices file or a device cache.
- **Daily prices with no server: two good options.** (1) A scheduled GitHub Actions job in a public repo fetches with a key kept in GitHub secrets and publishes `prices.json`. It costs nothing and needs no CSP change if served from `ipazanin.github.io`, but the symbol list becomes public. (2) A daily Apps Script trigger in the owner's own Google account writes prices into a file in the owner's Drive that Kuna reads with `drive.file`. Nothing becomes public, but it works only for a file on Drive and needs a one-time script setup. Euro FX rates can come straight from the ECB in the browser in either case: its API answers with `Access-Control-Allow-Origin: *` and needs no key.
- **Recommendation:** ECB rates fetched by the browser, plus option 2 for stock, ETF, crypto and gold prices, because it keeps even the symbol list private and the owner already runs Apps Script projects with clasp. Option 1 is the fallback if the owner is fine with a public list of symbols.
- **Privacy:** holdings (quantities, prices paid, dates, fees, totals, brokers) never go into the repo, the site, CI logs, fixtures or screenshots. The fake build and tests use made-up portfolios. `public/privacy.html:221-222` promises "The page talks only to Google's own APIs", so any price source outside Google changes that page.
- **Net worth** can only come through the contribution, since the shell may not import an app (`tests/importBoundaries.spec.ts:132-136`). Add an optional net worth part to `AppContribution`. Company's cash is the company's, not the owner's, so it should not be added to personal net worth without a decision.

## What a third app adds, and what it reuses

### What it reuses as it is

| Part                    | Where                                                                                                        | What the app gets                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App seam                | `src/shared/app/appContribution.ts:43-79`                                                                    | id, name, colour, screens, menu, settings, menu counts, subtitle, money format, home card, first run, sync group, gallery, start                                                                                             |
| Registration and routes | `src/shell/routing/appRegistry.ts:6-9`, `src/shell/routing/router.ts:32-35`                                  | Each screen becomes a route under the app id. `refuseScreensOutside` (`router.ts:88-93`) refuses a route outside `/<id>`                                                                                                     |
| First run redirect      | `src/shell/routing/appRegistry.ts:21-23`, `src/shell/App.vue:62-73`                                          | While `firstRun()` is true, any address under the app goes to `startPath`                                                                                                                                                    |
| Home card               | `src/shell/home/HomeAppCard.vue:18-53`, `src/shared/app/homeCardFigures.ts:5-16`                             | Set up, opening, failed and figures states for free. Figures are `HomeAmount { label, cents }` (`appContribution.ts:19-22`) formatted in the app's money format (`HomeAppCard.vue:43`)                                       |
| Sidebar                 | `src/shell/App.vue:34-52`, `src/shell/ui/ScreenNavigation.vue`                                               | The menu of the app on screen only, with Settings set apart                                                                                                                                                                  |
| Storage                 | `pageWorkbookStore.ts:17-54`, `documentStorePorts.ts:64-187`                                                 | One `kuna-<app>.json` (`driveDocument.ts:42-44`), found on another device by its `appProperties` mark (`driveDocument.ts:74-93`), daily backups in `backups/`, kept revisions, the browser-kept file in IndexedDB, the cache |
| Records                 | `recordKind.ts:15-17`, `recordCodec.ts:41-54`, `writeRules.ts:37-53`                                         | A kind per record type, a codec with an id field, write rules with refusals                                                                                                                                                  |
| Undo                    | `writeRules.ts:43-44`, `createWorkbookStore.ts:36`, `:458-462`                                               | Any write of an undoable kind. An import of 150 trades in one write is one Undo, as `removeInformalLoan` does for a loan and its movements (`src/apps/loans/informalLoans/application/informalLoanWrites.ts:29-33`)          |
| Export and its reminder | `src/apps/loans/workbook/presentation/loansFile.ts:23-32`, `src/shared/storage/domain/exportReminder.ts:2-9` | Download as `kuna-<app>-export-<day>.json`, reminder after 7 days unexported                                                                                                                                                 |
| Sync                    | `src/shared/sync/presentation/pageSync.ts:15-26`, `:104-127`                                                 | The books step first, then the app's own steps, in the page's one sync                                                                                                                                                       |
| Text                    | `src/shared/text/translation.ts:20-36`, `src/shared/text/language.ts:58-61`                                  | Typed English and Croatian dictionaries with Croatian plurals                                                                                                                                                                |
| Design library          | `src/shared/ui/*`, `.agents/skills/kuna-design/SKILL.md:13-21`                                               | `KpiTile`, `ChartCard`, `SparkLine`, `DonutCard`, `FigureTable`, `MoneyText`, `DashboardGrid`, `StepCard`, `BooksFileCard`, `LocalFileStatus`                                                                                |
| Charts                  | `src/shared/charts/echarts.ts:18`                                                                            | Bar, line and pie only. A candlestick or area-range chart needs registering there first                                                                                                                                      |

### What it must add, file by file

Shaped on Loans, the most recent app. Suggested id `investments`, so routes are `/investments/...`, the file is `kuna-investments.json` and the colour token is `--app-investments`. The Croatian name ("Ulaganja"?) is a glossary choice.

Inside `src/apps/investments/`:

| File                                                               | Copies the shape of                                                                | Holds                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.ts`                                                           | `src/apps/loans/app.ts:24-68`                                                      | The contribution. `moneyFormat` returns EUR (`DEFAULT_MONEY_FORMAT`, `moneyFormat.ts:23`). `firstRun` as `loans/app.ts:49`. `install()` seeds the fake portfolio only in the fake build (`loans/app.ts:28-34`) |
| `words.ts`                                                         | `src/apps/loans/words.ts`                                                          | The app's name in both languages                                                                                                                                                                               |
| `home/presentation/investmentsHomeCard.ts` + `words.ts`            | `src/apps/loans/home/presentation/loansHomeCard.ts:13-25`                          | Portfolio value, then gain all time                                                                                                                                                                            |
| `sync/presentation/investmentsSyncGroup.ts`                        | `src/apps/loans/sync/presentation/loansSyncGroup.ts:7-16`                          | The file, plus a Prices step (see the gotcha below)                                                                                                                                                            |
| `workbook/domain/investmentKinds.ts`                               | `src/apps/loans/workbook/domain/loanKinds.ts:9-14`                                 | Kinds such as `instrument`, `trade`, `cash-movement`, `account` (lane 3 decides the set)                                                                                                                       |
| `workbook/domain/*.ts`, `*Reading.ts`                              | `informalLoan.ts`, `informalLoanReading.ts:11-40`                                  | Each record, its codec and its refusals                                                                                                                                                                        |
| `workbook/domain/readInvestmentBook.ts`, `investmentsBooks.ts`     | `loansBooks.ts:3-12`                                                               | The records and the book they make                                                                                                                                                                             |
| `workbook/application/investmentsCodecs.ts`, `investmentsStore.ts` | `loansStore.ts:8-13`                                                               | `pageWorkbookStore('investments', ...)`                                                                                                                                                                        |
| `workbook/infrastructure/investmentsDocument.ts`                   | `loansDocument.ts:9-26`                                                            | App id, schema `{ investments: 1 }`, the empty document                                                                                                                                                        |
| `workbook/infrastructure/fake/seedFakeInvestments.ts`              | `seedFakeLoans.ts`                                                                 | Made-up portfolios for the fake build, the visual check and the touch check                                                                                                                                    |
| `workbook/presentation/` export, find, local status                | `loansFile.ts`, `useLoansExport.ts`, `useFindLoansFile.ts`, `LocalLoansStatus.vue` | Four small files that differ from Loans only in names. Worth making generic in `src/shared/storage/presentation` when the third copy appears                                                                   |
| `*/application/*Writes.ts`                                         | `informalLoanWrites.ts:13-27`                                                      | Write rules per kind, such as "a sell may not exceed the units held"                                                                                                                                           |
| `onboarding/`                                                      | `src/apps/loans/onboarding/presentation/*`                                         | Better extracted, see below                                                                                                                                                                                    |
| `settings/presentation/`                                           | `LoansBooksCard.vue:16-21`                                                         | `BooksFileCard` with Export and Switch storage, plus price source settings                                                                                                                                     |
| Screens                                                            | `overview/`, `bankLoans/`                                                          | Overview, a holding page, trades, import                                                                                                                                                                       |

Outside the app folder:

| File                                                                   | Change                                                                                                                                                |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts:19-21`                                                    | Import `./apps/investments/app` and `installApp` it. Install order is home order (`appRegistry.ts:5`)                                                 |
| `src/shared/styles/tokens.css:72-73`, `:136-137`                       | `--app-investments` in light and dark, beside `--app-company` and `--app-loans`                                                                       |
| `tests/importBoundaries.spec.ts:119`                                   | Add `'investments'` to the apps the boundary test checks                                                                                              |
| `tests/fixtures/writeBack.ts:104-114`                                  | An `INVESTMENTS` `AppUnderTest`                                                                                                                       |
| `tests/recordStorageContract.spec.ts:592-614`                          | The app's write rules, a fixture per kind and the kind count, so every kind runs against Drive and the browser                                        |
| `tests/firstRun.spec.ts`, a new `investmentsFirstRun.spec.ts`          | As `tests/loansFirstRun.spec.ts:29-87`                                                                                                                |
| `scripts/visual-check.mjs:317`, `:391-394`, `:517-539`                 | The home's expected text names every card. New screen entries for the app                                                                             |
| `scripts/touch-check.mjs`, `scripts/support/editorFlows.mjs:2851-2890` | First run and editor flows                                                                                                                            |
| `index.html:7`                                                         | `connect-src` only if the browser calls a price host (see the options)                                                                                |
| `index.html:15`, `public/manifest.webmanifest` description             | Both still describe the company books and loans only                                                                                                  |
| `public/privacy.html:221-222`                                          | The "talks only to Google's own APIs" sentence                                                                                                        |
| `src/shared/money/`                                                    | New formatters and value types (see Multi-currency). Lint allows `Intl` only in `src/shared/money`, `calendar` and `text` (`eslint.config.js:98-124`) |
| `.agents/skills/kuna-design/components.md`                             | A row per new shared component, which `tests/designCatalogue.spec.ts` checks                                                                          |

### Fix before the third copy

1. **The first run is copied, not shared.** Loans' `FolderStep.vue` and `FindStep.vue` differ from Company's mostly in names (a diff of the two at HEAD shows the same flow with Company's extra statement options). A third app would make a third copy. Extract a shared "where the file lives" flow (home choice, folder, find) into `src/shared/storage/presentation`, taking the store, the file's display name and the new contents. Company keeps its extra steps around it.
2. **Loans' first run and toasts are English only.** `StartScreen.vue:36` and `:39`, `HomeStep.vue:18-22` and `:53-65`, `useFindLoansFile.ts:20-32` and `useLoansExport.ts:26-28` hold literal English, while the design rules say every visible string goes through the app's text (`.agents/skills/kuna-design/SKILL.md:32`). Language stage 2 probably covers this. The shared flow should start translated, not copy the literals.
3. **The ring takes at most five parts** (`.agents/skills/kuna-design/patterns.md:28`, `DonutCard.vue:34` at HEAD, being edited now). Allocation by asset class has six kinds (stocks, bonds, money market funds, cash, crypto, gold). Either fold two into one ("bonds and money market"), show allocation as a bar, or extend the rule. Decide in the design lane.
4. **A home figure cannot show a sign or a percent.** `HomeAmount` is `cents` only (`appContribution.ts:19-22`) and the card always uses `MoneyText` with the default sign (`HomeAppCard.vue:43`). "Gain all time +€1,240" needs an optional `sign: 'always'` and `tone: 'outcome'` on `HomeAmount`, a small shell change.

### A sync gotcha

The page's sync runs groups only for apps whose file is on Drive (`pageSync.ts:106`, `:122`). A Prices step in the app's sync group would never run for a portfolio kept in the browser. Prices need their own refresh on open, independent of the sync, or the browser-kept mode goes without prices. The fake build calls no outside service (`.github/workflows/deploy.yml:42-49`), so the price source also needs a fake adapter, as Drive has (`pageWorkbookStore.ts:20-27`).

## Multi-currency

### Today

- `Money` is a branded number of cents with no currency (`src/shared/money/money.ts:1-5`). About 200 files under `src` use it.
- Each app names one currency for its screens through `moneyFormat()` (`appContribution.ts:62-63`). The shell sets the page's format from the app on screen (`App.vue:59-60`). Company reads its currency from its settings (`src/apps/company/app.ts:59`). Loans hard-codes euros (`src/apps/loans/app.ts:46-47`).
- A single figure can already be written in another currency: `formatMoney(cents, sign, format)` takes a format (`moneyFormat.ts:87-89`) and `MoneyText` takes a `format` prop (`MoneyText.vue:18-19`). So showing "$1,234.50" beside "€1,109.17" needs no new formatter.
- No FX conversion exists anywhere in Kuna. The only FX mention is a VAT rule note on the HNB middle rate (`src/apps/company/packs/hr-doo/ruleset/rules/vat.ts:411-434`).
- Typed amounts accept at most two decimals (`src/shared/money/typedAmount.ts:4-11`). Stored amounts are written as two-decimal text (`src/shared/storage/domain/recordFields.ts:9-14`). A stored decimal is also read as a JS `number` (`storedFields.ts:43-62`), which loses digits beyond about 15 significant ones.
- Loans already does exact maths in fixed-point integers: a yearly rate is a whole number of millionths, and the plan uses `BigInt` (`src/apps/loans/bankLoans/domain/yearlyRate.ts:4-7`, `:49-52`). That is the precedent for quantities.

### What investments needs that cents cannot hold

| Concept                    | Example (made up)                                                   | Why `Money` cannot hold it                                                   |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Quantity held              | 0.00841 BTC, 3.25 ETF units, 31.1 g gold                            | Not money, and needs up to 8 decimals for crypto                             |
| Unit price                 | 0.0000123 USD a token, 1.1132 USD per EUR, 98.75% of par for a bond | Needs more than two decimals                                                 |
| Amount in a named currency | 50.00 USD paid, 1.20 USD fee                                        | The currency travels with the figure, and two currencies must never be added |
| FX rate                    | 1.1132 USD per EUR on 29 Oct                                        | A dated decimal                                                              |

Crypto, gold and foreign cash are best modelled as holdings with a quantity and a price, not as currencies. `Intl.NumberFormat` accepts `BTC` and `XAU` as currency codes but writes them with two decimals (checked in Node, 30 Oct 2026), so formatting them as money would be wrong.

### How the types could look without touching Company and Loans

All new, in `src/shared/money` (lint keeps formatting there), and nothing in Company or Loans changes:

- `CurrencyCode`: a branded ISO 4217 code, checked against `Intl.supportedValuesOf('currency')`.
- `CurrencyAmount { money: Money, currency: CurrencyCode }`: a cash figure in a named currency. Adding two refuses different currencies. `Money` stays the cents inside it.
- `Decimal`: an exact decimal as a scaled `BigInt` (for example 12 places, as valore's `normalizeAmount` allows, `valore/src/features/portfolio/domain/decimal.ts:5`), read from the stored field's text, never through `number`. `Quantity` and `UnitPrice` are branded uses of it.
- `formatQuantity`, `formatUnitPrice(price, currency)` and `typedDecimal` beside `formatMoney` and `typedAmount`.

A holding's value is quantity times unit price, rounded half away from zero to cents once, as `moneyFromAmount` rounds (`money.ts:9-20`). Example: 10 units at 50.00 USD at 1.10 USD per EUR is 500.00 USD, and 500 / 1.10 = 454.5454... is 454.55 EUR.

### Where conversion belongs

In the investments app's domain, as a pure function of an amount and a dated rate: `inEuros(amount: CurrencyAmount, rate: EuroRate): Money`. Rates come in through a port the infrastructure fills. It stays in the app until a second app needs it (Company's foreign-currency VAT one day), the same rule the design library uses for components (`SKILL.md:21`).

Two dates matter:

- **Value today** uses the latest ECB reference rate.
- **Cost** uses the rate of the trade day. Where the broker's statement gives the EUR actually paid, the trade record should keep that amount and say so, since it beats any reference rate. Lane 3 decides which rate Croatian tax wants.

Only EUR leaves the app. Its home card and any net worth part report euro cents, so the shell never converts and never meets a second currency.

### Where price history lives

Not in `kuna-investments.json`. A save uploads the whole document (`driveDocument.ts:15-17`) and the app keeps up to 100 revisions forever plus 30 daily backups (`driveDocument.ts:33-35`). 30 symbols at about 252 closes a year for 5 years is about 38,000 rows, a few MB, copied into every revision. The holdings file keeps trades and instruments (a few hundred rows). Price history goes in a separate prices file or an IndexedDB cache per device, rebuilt from the source when missing. Which one follows from the price option chosen.

## Daily prices with no server

### What the page allows today

- CSP: `connect-src 'self' https://www.googleapis.com https://gmail.googleapis.com https://openidconnect.googleapis.com https://oauth2.googleapis.com` (`index.html:7`). The dev server only adds `ws://localhost:*` (`scripts/devContentSecurityPolicy.ts:8-10`). Any other host must be added in `index.html:7`.
- `'self'` is the page's origin, scheme plus host plus port, with no path (MDN, see Sources). The site is `https://ipazanin.github.io/kuna/` (`vite.config.ts:7-10`), so every project site of the account, such as `https://ipazanin.github.io/kuna-prices/`, is already `'self'`.
- The service worker passes through any same-origin GET it did not precache (`scripts/service-worker.js:38-47`). But the build lists every file in `dist/` as a precached asset and hashes them into the release id (`scripts/pwa.ts:26-46`). A `prices.json` built into the app would be cached until the next release and would change the release every day, prompting an update daily. Prices must be published outside the app's build.
- Deploys run on every push to `main` and run the full verify job first (`.github/workflows/deploy.yml:3-6`, `:17-60`), which takes an hour or more. The `pages` concurrency group cancels a deploy in progress (`deploy.yml:13-15`). A daily commit to `main`, or a daily Pages deploy from the same repo, would collide with real deploys.

### Which hosts answer a browser (checked 30 Oct 2026 with `curl -H "Origin: https://ipazanin.github.io"`)

| Host                                                      | `Access-Control-Allow-Origin`                                  | Key                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `data-api.ecb.europa.eu` (EUR reference rates)            | `*`, returned the 29 Oct USD rate as CSV                       | none                                                             |
| `api.frankfurter.dev` (ECB rates, third party)            | `*`                                                            | none                                                             |
| `api.coingecko.com`                                       | `*`                                                            | none needed for this call from my machine, lane 4 owns its terms |
| `api.binance.com`, `api.kraken.com`                       | `*`, and the caller's origin                                   | none                                                             |
| `www.alphavantage.co`, `api.twelvedata.com`, `finnhub.io` | `*`                                                            | required                                                         |
| `ipazanin.github.io` (Pages), `raw.githubusercontent.com` | `*`                                                            | none                                                             |
| `query1.finance.yahoo.com`                                | unconfirmed: answered 429 to my requests                       | none                                                             |
| `stooq.com` CSV download                                  | unconfirmed: answered a JavaScript proof-of-work page, not CSV | none                                                             |

Lane 4 picks the providers. This table only says what a browser can reach.

### The options

**A. The browser calls a CORS-friendly API directly.**
Works for ECB rates and crypto today with no key. For stocks and ETFs on European exchanges (the export has `.DE` and `.AS` symbols) the keyless options did not answer a browser. A keyed API in the public bundle publishes the key. The way around that is "bring your own key": the owner types a personal key once in the app's settings on each device and it stays in that device's storage, never in the file or the repo.
Changes: each host goes into `connect-src` (`index.html:7`), a fake adapter for the fake build, `privacy.html:221-222`. Each provider sees the owner's IP and symbols on every open. Free tiers are per key and per day, so two devices share one budget.

**B. A scheduled GitHub Actions job publishes `prices.json`.**
A workflow on `schedule` fetches closes after the markets shut, with the key in GitHub secrets, and publishes JSON. Standard runners are free in public repos. Secrets are not passed to workflows from forks. Placement decides the rest:

- _B1, a separate public repo `kuna-prices` with its own Pages site._ Served at `https://ipazanin.github.io/kuna-prices/prices.json`, which is `'self'`, so no CSP change and no change to Kuna's deploy. Pages limits (1 GB site, 100 GB a month) are far away. Gotcha: GitHub disables scheduled workflows in a public repo after 60 days with no repository activity. A deploy without a commit is probably no activity. Whether the job's own daily commit counts is unconfirmed.
- _B2, an orphan `prices` branch in the Kuna repo, read from `raw.githubusercontent.com`._ The workflow file lives on `main` (schedules run only on the default branch) and pushes to `prices`, which does not trigger `deploy.yml` (it watches `main` only). Kuna's own activity keeps the schedule alive. Costs one `connect-src` host. `raw.githubusercontent.com` caches for 5 minutes (`max-age=300` observed), which is fine for daily data.

Either way the symbol list is public, in the workflow config and in the JSON. Logs of a public repo are public too, so the job must print nothing about holdings, and it must never read the holdings file. A variant hides the list: the job encrypts the JSON with a key only the owner's devices hold (Web Crypto AES-GCM). Cost: one more secret to carry to each device.

**C. A Google Apps Script web app as a proxy.**
The page calls `https://script.google.com/macros/s/<id>/exec?symbols=...`. The script, running as the owner, fetches with a key kept in its script properties and answers JSON. Symbols go only to Google and the provider. Costs: the URL ships in the public bundle and the endpoint must allow anonymous access, so anyone with the URL can spend the key's quota. Google's docs say the response is redirected to a one-time `script.googleusercontent.com` URL. They do not mention CORS, and community answers disagree on whether a cross-origin `fetch` gets `Access-Control-Allow-Origin: *`, so browser access is unconfirmed until tried. Two `connect-src` hosts. A cold start can take seconds.

**D. A daily Apps Script trigger writes prices into the owner's Drive.**
A time-driven trigger in the owner's own account reads which instruments the owner holds, fetches closes with a key in script properties, and overwrites the content of `kuna-prices.json` beside the holdings file. Kuna reads it with the `drive.file` scope it already has. `drive.file` reaches only files Kuna created or the user opened with it (Google's scope page), so Kuna should create the empty prices file at setup and the script should replace its content, keeping the file id. The script must never write into `kuna-investments.json`, because Kuna's save checks the head revision and treats an outside edit as a conflict (`driveDocument.ts:95-100`).
Costs: works only when the portfolio is on Drive. The script is set up once (the owner already deploys Apps Script with clasp). Consumer quotas are 20,000 URL fetches and 90 minutes of trigger runtime a day, far above one daily run. Whether price providers refuse requests from Google's servers is unconfirmed. No CSP change, nothing public, and the prices file never enters the holdings file's revisions.

### Comparison

|                           | A browser                      | B1 kuna-prices Pages             | B2 prices branch            | C Apps Script proxy           | D Apps Script into Drive  |
| ------------------------- | ------------------------------ | -------------------------------- | --------------------------- | ----------------------------- | ------------------------- |
| Key kept secret           | only if typed per device       | yes                              | yes                         | yes, but quota open to anyone | yes                       |
| Symbol list public        | no                             | yes                              | yes                         | no                            | no                        |
| CSP change                | a host per provider            | none                             | `raw.githubusercontent.com` | two Google hosts              | none                      |
| Browser-kept portfolio    | yes                            | yes                              | yes                         | yes                           | no                        |
| Works offline after fetch | cache                          | cache                            | cache                       | cache                         | Drive copy in cache       |
| Moving parts              | adapters per provider          | second repo, schedule kept alive | one workflow                | one script, a public endpoint | one script, one trigger   |
| Unconfirmed               | Yahoo and Stooq from a browser | 60-day rule with bot commits     |                             | CORS on the redirect          | providers from Google IPs |

### Recommendation

ECB reference rates straight from the browser for EUR conversion: free, keyless, primary source, CORS open, published around 16:00 CET on TARGET working days. That adds one host, `https://data-api.ecb.europa.eu`, to `connect-src`. Then option D for instrument prices, with option B2 as the fallback if the owner accepts a public symbol list or wants prices in a browser-kept portfolio. Option C has the weakest trade: an anonymous endpoint and unconfirmed CORS, for no gain over D.

## Privacy

The repo is public (`gh repo view ipazanin/kuna`: `PUBLIC`) and so is the site.

**Never public, anywhere:** quantities, prices paid, trade dates, fees, totals, gains, broker and account names, the real Yahoo export or any copy of it. That covers source, fixtures, the fake build's seed, test snapshots, visual check screenshots, CI logs, commit messages and PR text. The fake portfolios are made up in the shape of the export, as `seedFakeLoans.ts` is. A test of the Yahoo import uses a made-up CSV with the same 17 columns.

**Can be public if the owner agrees:** the code, the supported asset kinds, the provider mapping logic, and prices of public instruments. A list of symbols is the open question. It says what the owner owns or owned, never how much. The export holds 26 distinct symbols over 154 rows, so a published list would show the owner's picks fairly exactly. Padding it with a broad list (an index's members) blurs that, at the cost of API calls. Options D and A keep it private.

**Already true and worth knowing:** every project site of the account shares one origin, `https://ipazanin.github.io`. valore is live at `/valore/` (HTTP 200 on 30 Oct 2026). Kuna keeps a browser-kept file in IndexedDB databases named `kuna-document-<id>` (`src/shared/storage/infrastructure/browserDocument.ts:20`) and small keys in localStorage (`src/shared/google/googleSession.ts:9-12`). Any script on another page of that origin can read them. Kuna keeps no Google token (`googleSession.ts:5-7`), so the exposure is the browser-kept books. An investments file kept in the browser adds holdings to that. A prices site under B1 serves JSON only, no scripts, so it adds no risk.

**The privacy page** promises "There is no server. The page talks only to Google's own APIs" (`public/privacy.html:221-222`). A call to the ECB or a price host changes that sentence, with what each host sees: the IP and, for A, the symbols.

## The home card and a future net worth view

**The investments card** reads its own store, like `LOANS_HOME_CARD` (`loansHomeCard.ts:13-25`): portfolio value in EUR first, then gain all time, and the prices' date in `waiting` when they are more than a few market days old. The gain wants the sign change to `HomeAmount` above.

**Net worth** needs figures from three apps. The shell may not import an app (`tests/importBoundaries.spec.ts:132-136`) and apps may not import each other (`:138-140`), so the only path is the contribution. Proposed: an optional `netWorth(): readonly NetWorthPart[] | 'opening' | 'failed' | null` on `AppContribution`, where a part is `{ label, cents, side: 'asset' | 'liability', asOf }` in euro cents. The shell sums the parts it gets, as it renders home cards today, and stays ignorant of loans or trades. Every store is opened when the page starts (`src/shared/sync/application/autoSync.ts:70`), so the parts arrive without visiting each app.

What each app would give:

- **Investments:** value of holdings and cash at brokers, an asset.
- **Loans:** what you owe, a liability, and what others owe you, an asset, from `owedTotals` (`src/apps/loans/overview/presentation/owedTotals.ts:21-27`). Loans formats in EUR today (`loans/app.ts:46-47`), so its cents are already euros.
- **Company:** cash on hand (`src/apps/company/home/presentation/companyHomeCard.ts:16`) is the d.o.o.'s money, not the owner's. Adding it to personal net worth counts money that reaches the owner only as salary, dividends or loan repayment, and the owner's loans to or from the company would then count twice. The hub proposal already lists "whether net worth counts your stake in the company" as open. Until the owner decides, show Company apart from the total. Company's currency is a setting (`company/app.ts:59`), so its part must convert or refuse when that setting is not EUR.

The hub proposal also plans published `facts.ts` per app read through one translation file. The boundary test does not allow that at HEAD (`importBoundaries.spec.ts:138-140`). A net worth part on the contribution needs no cross-app import, so it can come first.

## Decisions for the owner

1. **Where prices come from.** Today nothing fetches prices. Option D keeps everything private but needs the portfolio on Drive and a one-time Apps Script setup. Option B2 works in every mode but publishes the list of symbols you track. Recommendation: D, with ECB rates from the browser.
2. **Whether the symbol list may be public.** It decides whether B is open at all.
3. **Whether net worth adds the company.** On a net worth view, adding Company's cash would show, for example, €40,000 of company money as yours. Options: leave it out and show it apart (no cost), or count your stake at a value you choose (a new setting and a rule for loans between you and the company). Recommendation: show it apart for now.
4. **Allocation with six kinds.** The ring takes five parts. Fold bonds and money market funds into one, or use a bar.

## Sources checked

All loaded on 30 Oct 2026.

- GitHub Docs, [Events that trigger workflows, schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows): shortest interval 5 minutes, delays under load, default branch only, disabled in a public repo after 60 days with no repository activity.
- GitHub Docs, [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): 1 GB site, 100 GB a month soft bandwidth, 10 builds an hour, which does not apply to custom Actions workflows.
- GitHub Docs, [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): standard hosted runners are free in public repos.
- GitHub Docs, [Using secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets): secrets are not passed to workflows triggered from a fork.
- GitHub Docs, [What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): project sites live at `<owner>.github.io/<repository>`.
- Google, [Content Service](https://developers.google.com/apps-script/guides/content): output is redirected to a one-time `script.googleusercontent.com` URL. No mention of CORS.
- Google, [Web apps](https://developers.google.com/apps-script/guides/web): execute as the owner or as the visitor, `doGet` returns `ContentService` text.
- Google, [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas): 20,000 URL fetches a day, 90 minutes of triggers a day, 6 minutes an execution for consumer accounts.
- Google, [Choose Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth): `drive.file` covers files created or opened with the app, and is non-sensitive.
- ECB, [Euro foreign exchange reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html): updated around 16:00 CET on working days except TARGET closing days, for information purposes only.
- ECB Data Portal API help (`data.ecb.europa.eu/help/api/data`) returned 503. Unconfirmed as a page. The API itself answered `D.USD.EUR.SP00.A` with `lastNObservations=1` and `format=csvdata` with CORS `*`.
- MDN, [connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) and [Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy): `connect-src` governs `fetch`, and `'self'` is the document's origin.
- Apps Script web app CORS from a browser: only community answers found, which disagree. Unconfirmed.
