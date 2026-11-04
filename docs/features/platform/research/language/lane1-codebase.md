# Language lane 1: the text Kuna holds today

Inventory at kuna 2cafa72 of the English UI text, plural and sentence assembly, date and number formatting, Croatian already in code, text-bound checks, Nuxt UI text and where a language setting could live.

Read against `ipazanin/kuna` at `2cafa72`. All citations are `file:line` in that repo. Counts come from a heuristic scan of string literals, template text and text props. A spot check of 40 hits found about 85% real UI text. Read them as orders of magnitude. Sibling lanes: [lane 2, mechanics](lane2-mechanics.md). The decision on per-file number format is in [the H2 plan](../../second-storage-plan.md).

## Headline

- No i18n layer exists. There is no library in `package.json` or `node_modules`, no `Intl.PluralRules`, and `UApp` gets no `locale` (`src/shell/App.vue:71`).
- About 6,000 candidate strings. Roughly 4,400 are company UI text. The rest are ruleset research notes, file header notes and parser messages.
- English grammar is coded into sentence builders. There are 127 one-or-many ternaries, a `RecordNoun` with `a`/`an` articles, and verbs that would need gender agreement in Croatian.
- Dates ignore every setting. They come from 55 `Intl.DateTimeFormat('en-GB', …)` constants in 41 files.
- Money already follows each file's number format through `AppContribution.moneyFormat()`.
- The checks lean hard on English text. Pinning English in tests and browser checks keeps nearly all of them working.

## 1. Where the English text lives

### Rough counts per area

Excludes `infrastructure/fake/` and `generatedLocalRates.ts`.

| Area               | Files with text | Template text nodes | Text props (`title`, `label`, `description`, `placeholder`, `aria-label` …) | Script strings | Total  |
| ------------------ | --------------- | ------------------- | --------------------------------------------------------------------------- | -------------- | ------ |
| `src/shell`        | 12 of 15        | 5                   | 15                                                                          | 15             | ~35    |
| `src/shared`       | 56 of 92        | 13                  | 18                                                                          | 221            | ~250   |
| `src/apps/loans`   | 46 of 64        | 68                  | 191                                                                         | 181            | ~440   |
| `src/apps/company` | 331 of 452      | 623                 | 1,021                                                                       | 3,671          | ~5,300 |

Most of the text sits in TypeScript, not templates. By layer, company presentation holds ~2,750 strings in 159 files. Company domain holds ~1,230 in 101 files. The hr-doo ruleset holds ~520 in 15 files, and settings holds ~300.

### Files with the most text

Excluding the dev-only gallery (`GalleryScreen.vue`, 168 hits, dropped from production by `src/apps/company/app.ts:48-52`):

1. `src/apps/company/imports/domain/camtStatement.ts`: 148. Mixed: ISO tag names that must stay, plus English refusal messages.
2. `src/apps/company/packs/hr-doo/ruleset/rules/owner-pay.ts`: 130. Rule titles and research notes, plus Croatian statute quotes.
3. `src/apps/company/packs/hr-doo/ruleset/rules/profit-tax.ts`: 95.
4. `src/apps/company/workbook/infrastructure/workbookTemplate.ts`: 95. Header-cell notes written into exports.
5. `src/apps/company/packs/hr-doo/presentation/yearEnd/yearEndWording.ts`: 93.
6. `src/apps/company/settings/domain/settings.ts`: 92. Setting notes and validation messages.
7. `src/apps/company/packs/hr-doo/ruleset/acts.ts`: 76.
8. `src/apps/company/packs/hr-doo/presentation/assets/AssetsPanel.vue`: 72.
9. `src/apps/company/packs/hr-doo/presentation/payScenarios/payScenariosView.ts`: 68.
10. `src/apps/company/packs/hr-doo/presentation/salaries/salariesView.ts`: 67.
11. `src/apps/company/packs/hr-doo/presentation/taxes/TaxesPanel.vue`: 60.
12. `src/apps/company/packs/hr-doo/infrastructure/hrDooTabs.ts`: 59. Column notes for the pack tabs.
13. `src/apps/company/invoicing/presentation/InvoiceRunDialog.vue`: 58.
14. `src/apps/company/packs/hr-doo/presentation/TakenPanel.vue`: 57.
15. `src/apps/company/transactions/presentation/TransactionsScreen.vue`: 56.

Loans peaks at `bankLoans/presentation/BankLoanDialog.vue` (40), `PlanCard.vue` (27) and `BankLoanScreen.vue` (26). In shared, the largest are `sync/presentation/SyncStatus.vue` (25) and `storage/application/recordWrites.ts` (21).

### By kind

- **Screen names and page titles.** Screen names are static `AppScreen.title` strings (`src/apps/company/app.ts:17-23`, `src/apps/loans/app.ts:12,27-32`, `src/shell/routing/screens.ts:9`). App names are `'Company'` and `'Loans'` (`app.ts:30`, `loans/app.ts:19`). The router copies the titles into `meta.title` once, when it is created (`src/shell/routing/router.ts:32-35`). `screenName` joins them as `"Overview, Loans"` (`src/shell/routing/appRegistry.ts:30-32`). `browserTitle.ts:8` adds `" – Kuna"`. A language switch at runtime has to recompute these.
- **Toasts.** 22 `toast.add` calls in 12 files. Many pass `failure.message` straight through (27 `instanceof Error ? x.message` sites, for example `src/apps/company/review/presentation/ReviewScreen.vue:98`).
- **Refusals and errors from domain and application code.** `WorkbookWriteRefused` prefixes `"Nothing was written. "` and joins every refusal sentence (`src/shared/storage/application/workbookWriteRefused.ts:12`). Refusal sentences are built in 16 `WriteRules` implementations, in `recordWrites.ts` (about 20 templates) and in `slug.ts:11-21,89`. There are 154 `throw new …(` sites, 104 of them in company. Domain readers return English `reasons`, and 264 `tracedFigure(label, …)` calls put English labels in domain results.
- **Change summaries.** `recordsChangeInWords.ts:4-29` builds sentences such as `Added the invoice "1-1-26"` or `Changed 2 categories and deleted an asset`. The nouns come from `RecordNoun` (see section 2). The 46 `store.write('<title>', …)` titles stay in the session and are never saved.
- **Validation messages.** Setting validators (`settings.ts:753-767`, for example `"${locale}" is not a locale tag such as en-GB`) and company facts (`packs/hr-doo/domain/companyFacts.ts:89,99`).
- **Google errors.** `src/shared/google/googleAuth.ts`, `googleScopes.ts` and `loadScript.ts` hold user-facing English. `GoogleApiError` puts the raw HTTP body in its message (`googleApi.ts:9`).
- **Chart text.** 18 chart builders hold about 60 `description` and series-name sites, for example `src/apps/loans/balances/presentation/balanceChart.ts:58-59`. `src/shared/charts/chartTooltip.ts:38,43` holds `"Incomplete month, figures so far"` and `"no data"`. `ChartCard.vue:142` sets `aria-label="Show ${title} as a table"`.
- **Static shell files.** `index.html:2` has `lang="en"`, `:15` the meta description and `:49` `aria-label="Opening Kuna"`. `public/manifest.webmanifest:5-6` has the description and `"lang": "en"`. `public/privacy.html` is a fixed English page. The service worker (`scripts/service-worker.js`) shows no text.
- **Invoice PDF.** Its labels are fixed English: `"Invoice place and date:"`, `"Due date:"`, column headings, `"Total invoice amount"` (`src/apps/company/invoicing/infrastructure/invoicePdf.ts:165-232`). This is client-facing document text, not UI. The mail month already follows each client's `mail_language` (`invoicing/domain/invoiceMail.ts:35-43`, `settings/presentation/factTabColumns.ts:30`).

### Text stored in the user's files: do not translate

- **`kuna-*.json`.** The `"format": "kuna"` marker and the app id (`src/shared/storage/infrastructure/documentFormat.ts:17,36-42`). Record kind names: the first argument of `recordKind`, which also starts every record id (`workbook/domain/coreKinds.ts:13-22`, `packs/hr-doo/domain/hrDooKinds.ts:10-16`, `loans/workbook/domain/loanKinds.ts:9-14`). Also field names, setting keys such as `number_locale` (`settings.ts:394`) and bucket label keys (`settings.ts:234-244`).
- **Stored enum values.** Buckets, VAT treatments, rule `confidence` (`rule`/`review`/`ai`), `direction` (`credit`/`debit`), asset groups, grant releases, CIT returns (`pd`/`pd-nn`), loan movement kinds and extra payment effects. Some editors show these raw values as labels: `settings/presentation/CategoriesEditor.vue:99-100` and `CategoryFilterBar.vue:32`. Others map them to words: `PurchasePlanDialog.vue:40` and `MovementDialog.vue:43`.
- **Sheets and xlsx.** Tab names (`workbook/infrastructure/workbookSnapshot.ts:14-30`) and column names (`workbookTemplate.ts:57` onward, `hrDooTabs.ts`).
- **Drive names.** `kuna-<app>.json` and the dated backups (`driveDocument.ts:41-47`), the `statements` folder (`onboarding/domain/statementsChoice.ts:11`), and `<month>-salary.xlsx` and `<period>-pdv.xlsx` (`accountant/accountantMailFiling.ts:87,112`).
- **Grey zone.**
  - The header-cell notes are written into every export but never read back (`workbookTemplate.ts:8-11`, `workbookFile.ts:56`). They could follow a file language later.
  - Default bucket labels (`settings.ts:125-133`) and `reviewLabel: 'human'` (`settings.ts:141`) are English code defaults that the file can override. A Croatian UI shows the English defaults until the user renames them.
  - Category labels shown through `useDisplayNames` come from the file and stay as the user wrote them.

## 2. Plurals, sentence assembly and interpolation

Croatian needs three plural forms, and its past participles agree with the noun's gender. These spots assume English:

- **One-or-many ternaries.** 127 lines of `x === 1 ? '…' : '…'` in 67 files, all two-way. Examples:
  - `src/apps/loans/bankLoans/presentation/PlanCard.vue:34`: `` `${instalments} instalments over ${n} ${n === 1 ? 'year' : 'years'}` ``
  - `src/apps/company/imports/presentation/ImportPanel.vue:185,194`: `'1 row'` against `` `${count} rows` ``, plus `is`/`are` agreement
  - `src/apps/company/packs/hr-doo/presentation/taxes/TaxesPanel.vue:231`: `'payment is'` against `'payments are'`
  - `src/apps/company/rules/presentation/RuleEditor.vue:208`: `'row waits'` against `'rows wait'`
  - `src/apps/company/billingPlan/presentation/BillingPlanPanel.vue:219`: `'One row of the tab is'` against `` `${n} rows of the tab are` ``
  - `src/apps/company/invoicing/presentation/ClientsPanel.vue:32`: a nested count with `is`/`are`
  - `src/apps/company/packs/hr-doo/presentation/salaries/salariesView.ts:347`: three-way 0/1/many, the only one found
- **Numbers glued to a fixed plural noun.** 76 template literals with no singular at all, for example `` `${figures.instalmentsLeft} instalments left` `` (`BankLoanTiles.vue:22`), `` `${days} days late` `` (`BankLoanScreen.vue:83`) and `{{ account.count }} rows since …` (`company/overview/presentation/OverviewScreen.vue:288`).
- **Record nouns.** `RecordNoun { one, many, article: 'a' | 'an' }` (`src/shared/storage/domain/recordKind.ts:1-17`) covers 22 kinds. It feeds `recordsChangeInWords.ts:4-29`, which also holds the verbs `added`/`changed`/`deleted` (`:8-14`), and the refusals in `recordWrites.ts`. Croatian would need gender and case here, not an article. `slug.ts:19-21` picks `a`/`an` from the first letter.
- **Lists.** `listInWords` (`src/shared/text/listInWords.ts:2-3`, `"a, b and c"`) has 16 calls in 12 files. There are 13 inline `join(' and ' | ' or ' | ' nor ')` sites, for example `mail/domain/mailSource.ts:172` (`…and ${rest} more`) and `companyFacts.ts:89`.
- **Casing tricks.** 18 `capitalised()` calls (four local copies: `camtStatement.ts:362`, `scenarioGuards.ts:126`, `slug.ts:23`, `recordWrites.ts:84`), 14 `charAt(0).toUpperCase()` and 22 `label.toLowerCase()`. An example is `effectName(…).toLowerCase()` (`BankLoanScreen.vue:78`). They depend on English word order.
- **Relative time.** `src/shared/calendar/syncAge.ts:9-15` returns `just now`, `${n} min ago`, `${n} h ago`, `yesterday` and `on 20 Nov`.
- **Sentence joins.** `[a, b].filter(...).join(', ')` and `.join('. ')` assemble headers and details (`BankLoanScreen.vue:59,120`). The sync button's aria-label is built as `"Syncing, Statements, step 2 of 2"`, and the checks wait for that exact text (`scripts/support/editorFlows.mjs:1385`).

## 3. Dates, months, numbers and money

| What                                              | Where                                                                                                                                                                                                                                                                               | Follows                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money: full, whole, compact, percent, one-decimal | `src/shared/money/moneyFormat.ts:31-102`, a reactive `active` format imported by 63 files                                                                                                                                                                                           | The file on screen, through `AppContribution.moneyFormat()` (`src/shared/app/appContribution.ts:52-53`). Company uses `currency` + `number_locale` (`company/app.ts:58`). Loans uses `DEFAULT_MONEY_FORMAT` = EUR, `en-GB` (`loans/app.ts:36-37`, `moneyFormat.ts:18`) |
| Percent in panels                                 | `TakenPanel.vue:140`, `TaxesPanel.vue:76`                                                                                                                                                                                                                                           | File `numberLocale`                                                                                                                                                                                                                                                    |
| Ruleset terms                                     | `ruleset/presentation/ruleWording.ts:163-167`, called with the file locale (`RulesetPanel.vue:40`)                                                                                                                                                                                  | File locale, but the currency is hard-coded `EUR`                                                                                                                                                                                                                      |
| Invoice PDF amounts                               | `invoicePdf.ts:109-111`                                                                                                                                                                                                                                                             | File `numberLocale` and currency. Dates are fixed `dd.mm.yyyy.` (`:104-107`)                                                                                                                                                                                           |
| One-decimal day counts                            | `InvoicingScreen.vue:53`, `DaysToPaidStrip.vue:37`, `InvoicesPanel.vue:91`                                                                                                                                                                                                          | Hard-coded `en-GB`. They ignore the file, unlike `formatDecimal`                                                                                                                                                                                                       |
| Currency names in running text and the picker     | `moneyFormat.ts:62-72` (`DisplayNames('en')` plus an English casing rule), `settings/presentation/moneyChoices.ts:3`                                                                                                                                                                | English always                                                                                                                                                                                                                                                         |
| Dates                                             | 55 `Intl.DateTimeFormat('en-GB', …)` in 41 files. Helpers exist in `shared/calendar/dayLabel.ts:3-14` ("20 Nov 2026"), `monthLabel.ts:4-26` ("Oct 2026", "Oct 26") and `syncAge.ts:1`. Even so, 25 components define their own identical `dayFormat` constant                       | Nothing. Always English, built once when the module loads                                                                                                                                                                                                              |
| Month names                                       | Only through Intl: long month (`OverviewScreen.vue:49-50`, `waitingForYou.ts:27-28`, `planWording.ts:14`), short month (`forecastView.ts:80`, `CadenceCalendar.vue:43`, `SalariesScreen.vue:103`), and `fillRestOfYear.ts:17-18` and `periodInWords.ts:8-9`, which are domain files | Nothing                                                                                                                                                                                                                                                                |
| Weekday names                                     | None shown                                                                                                                                                                                                                                                                          |                                                                                                                                                                                                                                                                        |
| Times                                             | `SyncStatus.vue:54-56`, `SyncStepList.vue:22`, `SessionChanges.vue:33`, `BooksFileCard.vue:24`                                                                                                                                                                                      | Nothing                                                                                                                                                                                                                                                                |
| Chart axes                                        | Month axes through `monthAxisLabel` (`monthLabel.ts:18-26`). Value axes through `formatCompactMoney`                                                                                                                                                                                | Dates: nothing. Money: the file                                                                                                                                                                                                                                        |
| Sorting                                           | `naturalOrder.ts:1` (`Collator('en')`). 45 `localeCompare` calls without a locale, mostly on ISO dates and slugs                                                                                                                                                                    | English or the browser default                                                                                                                                                                                                                                         |
| Native date inputs                                | 27 `type="date"` inputs                                                                                                                                                                                                                                                             | The browser's own locale, outside the app's control                                                                                                                                                                                                                    |
| Typed amounts                                     | `typedAmount.ts:8-10` takes a point or a comma and no grouping                                                                                                                                                                                                                      | Neutral                                                                                                                                                                                                                                                                |

Two facts matter for the H2 decision. First, 14 domain files format dates or money themselves, for example `filters/domain/periodInWords.ts`, `accrual/revenueByDelivery.ts` and `accrualBalanceSheet.ts`. Language therefore reaches into the domain, not only presentation. Second, the `number_locale` setting tells the user `"Dates and text stay in English."` (`settings.ts:396`). That sentence has to change in this wave. `civilDate.ts:82,96` uses `en-GB` `formatToParts` for time-zone arithmetic and is not display text.

## 4. Croatian already in code

**Parsing keywords. They must stay as they are, whatever the UI language.**

- CSV header guesses: `isplat`, `tere[cć]enj`, `uplat`, `odobrenj`, `potra[zž]uje`, `ra[cč]un (platitelja|primatelja)` (`imports/domain/profileGuess.ts:12-15`).
- Bank mail preset subject `ERSTE Izvadak` (`mail/domain/bankPresets.ts:10`).
- Accountant mail attachments `^\S+ PLACA` and `^PDV\b.*\.XLSX$` (`accountantMailFiling.ts:87,111`). The subject phrases `Plaća za`, `PDV za` and `Račun za` are user-set values in the file, shown as examples (`companyFacts.ts:155-157`).
- Diacritic folding with `đ` handled by hand (`src/shared/text/fold.ts:4-10`, `rules/domain/transactionFacts.ts:7`). Stripping of `Grad`/`Općina` (`ruleset/localUnits.ts:41-49`).
- camt.053 parsing uses ISO tags and English messages, with no Croatian.

**Croatian reference data. It is the same in both languages.**

- Act titles (`ruleset/acts.ts`, 19 lines with diacritics, ids such as `ZPDV` and `ZDop`).
- Municipality and county names (`generatedLocalRates.ts`).
- Statute quotes inside rules (`owner-pay.ts:438`).
- The GFI form line names used as `hint` (`yearEnd.ts:42-78`, for example `'Materijalni troškovi'`). Their English labels live in `yearEndWording.ts:9-17`. In a Croatian UI, the hint could become the label.

**Croatian terms inside English UI text.** `PDV`, `JOPPD` (`ruleWording.ts:130`), `PD-NN` (`CompanyFactsCard.vue:161`, `profit-tax.ts:267`), `GFI`, `Narodne novine`, `Porezna uprava`, `Naredba`, `d.o.o.` and NN issue numbers. The ruleset notes are long English research prose with Croatian citations. Translating them is a content job, not a key-extraction job.

## 5. What depends on English text in checks and tests

- **Vitest.** 167 spec files in `tests/` run in the `node` environment (`vitest.config.ts`). They mount no components and keep no snapshots. About 261 assertion lines in 65 files compare English prose, for example `tests/statementSync.spec.ts:238`, `tests/mailSource.spec.ts:104` and `tests/revenueByDelivery.spec.ts:52`. 126 lines hold en-GB style dates and 26 hold formatted euro figures. A setup file already runs for every spec (`tests/setup/installPack.ts`), which makes it an easy place to pin English.
- **`check:figures`.** `scripts/figure-digest.mjs:281-291` hashes whole result objects, string fields included. Traced-figure labels, reasons and waiting-job text all feed the hash. Rewording English changes digests, and swapping strings for keys would change them all once. Keeping English output under a pinned locale keeps them stable.
- **`check:touch` and editor flows.** `scripts/touch-check.mjs` (1,855 lines) and `scripts/support/editorFlows.mjs` (2,866 lines) use 28 aria-label selectors with English text and 57 literal text comparisons. They make about 95 `waitForText`/`rowNamed`-style calls and 57 `toast(page, title)` calls. They also rely on Nuxt UI's own `button[aria-label="Close"]` (`touch-check.mjs:1080,1756`, `editorFlows.mjs:95`). Most other selectors use `data-testid` (about 670).
- **`check:visual`.** 127 visits, 77 `shows:` English text expectations and screen titles checked in the top bar (`visual-check.mjs:184-190,202`). It saves screenshots to the gitignored `visual-check/` folder and compares no pixels. It already pins the theme with `?theme=`.

**Estimate.** If the checks ran in Croatian, about 400 test lines and most browser flows would fail. If English stays the default and the checks pin it, almost nothing breaks. The pin would be a vitest setup line plus a `?lang=en`-style query like `?theme=`. Only tests that call a formatter whose signature changes would need edits.

## 6. Nuxt UI

- **Version and locales.** `@nuxt/ui` is 4.12.0. It ships `hr`, `en` and `en_gb` locales in `node_modules/@nuxt/ui/dist/runtime/locale/`.
- **No locale set today.** `UApp` is rendered with only `:toaster` (`src/shell/App.vue:71`), so it falls back to `en`. `UApp` takes `locale` and passes `locale.code` to Reka's `ConfigProvider` (`@nuxt/ui/dist/runtime/components/App.vue:19,30-40`). Nothing imports `@nuxt/ui/locale`.
- **Components in use**, by count: UButton 252, UFormField 127, UInput 104, UIcon 88, USelect 42, UBadge 35, UAlert 35, UModal 29, UEmpty 23, USwitch 12, USelectMenu 12, URadioGroup 11, UCheckbox 11, UPopover 6, USlideover 5, UFileUpload 4, UTextarea 2, UTable 2, UTabs 1, UInputTags 1.
- **Components with built-in text:**
  - UModal and USlideover: the close button's `"Close"`.
  - UToast and the toaster: `"Close"`, `"Notification"` and `"Notifications ({hotkey})"`.
  - USelectMenu: `"Search…"`, `"No data"`, `"No matching data"` and `'Create "{label}"'`. Three menus set their own search placeholder (`BillingRowDialog.vue:138`, `InvoicingTermsForm.vue:151`, `CompanyStep.vue:75`).
  - UTable: `"No data"`, in `TransactionsScreen.vue:550`.
  - UFileUpload: `"Remove {filename}"`.
  - UAlert: `"Close"`, only when `close` is set, which no use does.
- **Not used.** There is no calendar, date picker or input-date component. Dates go through native `type="date"` inputs.

## 7. Where a language setting could live

- **Per device, like the theme.** `src/shared/theme/theme.ts:3-8,14,44-71` keeps a System/Light/Dark choice in `localStorage` (`kuna.theme`), with a `?theme=` pin for screenshots. `index.html:18` repeats the pick in an inline script, and the CSP allows that script by its hash (`index.html:7,17`). Doing the same for `<html lang>` means a new hash. Other per-device keys follow the same pattern: `cardCollapse.ts:8-17`, `autoSyncSwitch.ts`, `mailDraftSwitch.ts` and `workbookChoice.ts`.
- **The shell's settings screen.** The "This device" tab (`src/shell/settings/SettingsScreen.vue:33,56-57`) holds `AppearanceCard.vue`, whose theme radio group (`:10-29`) is the natural neighbour for a language choice.
- **Per file, like the number format.** Company settings are records in `kuna-company.json` (`settings.ts:380-404`, written at onboarding by `CompanyStep.vue:49-53`). Loans has no settings records yet (`loans/settings/presentation/loansSettings.ts:5-8`). A file-level language would fit invoice and export text, which other people read, better than the UI.
- **Import boundaries.** These rules live in `tests/importBoundaries.spec.ts`, not in `check:import` (`scripts/check-foreign-import.mjs`, which is the foreign-xlsx browser check).
  - `src/shared` may import only `src/shared` and packages (`:128-130`).
  - The shell may not import the apps (`:132-142`).
  - Domain code, including the ruleset outside its `presentation`, may import only its own app's domain and `src/shared/storage/domain/`, `calendar/`, `money/` and `text/` (`:86-91,165-173`).
  - So domain refusals, reasons and traced labels can reach a shared text catalogue only if it sits in one of those four folders, or if the rule grows. Package imports pass every rule, because the spec skips imports with no file target.
