# H3 lane 3: what Kuna already has for loans

Inventory at 1b3a7c9 of the record storage, money and calendar kernel, editors, charts, import, checks and import boundaries that a first Loans app builds on, with what moves to src/shared, what stays company, and the seams to leave for H4, H5, H6 and H8.

Read against the repo at `1b3a7c9`. Every path below is relative to the repo root, and every line number is from that commit. Background: [the hub proposal](../../../../architecture/hub.md) (rows H3, H4, H5 and H8, and the rule that apps read each other only through published facts) and [the H2 plan](../../../platform/second-storage-plan.md). Loan law, the owner's real data and how other tools present loans are other lanes.

## In short

- **The storage kernel is ready for loans as it is.** A kind is a `recordKind`, a `RecordCodec` and a `WriteRules`, all in `src/shared/storage/domain`. The Loans document, store, first run, export and sync already run on it. What H3 adds is three codecs, three write rules and a real `read` in `src/apps/loans/workbook/infrastructure/loansDocument.ts:17-23`, which today throws for any kind.
- **No migration machinery exists, only a version gate.** A file whose `schema` names a higher version is read and never written. An older app writing a file stamps its own schema. Field names chosen in H3 are therefore close to permanent.
- **No kind references another kind by its UUID today.** Rate periods and payments pointing at their loan's id is new. A write across kinds is already atomic, so a loan and its children can be added or deleted in one write.
- **Nothing computes an annuity or a linear schedule.** The closest pieces are the owner-loan interest (day-by-day balance times an ACT/365-or-366 year, `ownerLoanInterest.ts:34-79`), the depreciation's cumulative rounding so months add up to the year (`depreciationSchedule.ts:153-172`) and the shared exact-then-oldest-first payment matcher (`src/shared/money/settleOpenRows.ts`).
- **A rate type exists only inside the hr-doo ruleset**: `Rate`, whole basis points (`ruleset/schema.ts:8`), so 2.143% cannot be held. The exact rounding helper `dividedRounded` lives in the pack's `payrollArithmetic.ts:14-17`.
- **`Money` is integer cents with no currency, and the page has one active money format** (`moneyFormat.ts:31`), set by the shell for the app on screen (`src/shell/App.vue:51`). Loans shows euros in en-GB until it has a setting (`src/apps/loans/app.ts:33-34`).
- **The write toast with Undo is company-bound.** `useRecordWrites` calls the company store directly (`useRecordWrites.ts:42`) and has 24 importers. Loans needs either a moved, store-taking version in `src/shared` or a copy.
- **The UI kit Loans needs is already shared**: `AppCard`, `ChartCard`, `KpiTile`, `PageTabs`, `PageHeader`, `MoneyText`, `DrillLink`, `ShowAllButton`, `SortableHeader`, ECharts with bar, line and pie. The drill chart card, the tab editor and the empty-ledger gate are company code.
- **Import has generic parts but no schedule reader.** SheetJS loading and the first-sheet grid are shared (`src/shared/xlsx/sheetGrids.ts`). The date and amount cell readers are pure but sit in the company's import domain. The header finder and profile are ledger-shaped. No paste handling exists anywhere.
- **The checks know the empty Loans app by one test id.** `loans-empty` is waited on in `check-pwa.mjs:191,202`, `touch-check.mjs:1524` and `editorFlows.mjs:2604`. `check:figures` reads only the company document. The storage contract suite and the kind-names spec are typed to the company.
- **H5 has a boundary snag.** The owner loan book is computed in the hr-doo pack (`ownerLoans.ts:83`), and the boundary spec forbids company code outside a pack from importing pack code (`importBoundaries.spec.ts:148-150`). A company `facts.ts` outside the pack cannot reach it without a new rule or a pack-side publisher.

## 1. Document and records

### How an app declares its kinds

An app hands the store an `AppDocument` (`src/shared/storage/infrastructure/documentStorePorts.ts:18-22`): the schema version per contributor, the codec of each kind, and `read(copy)`, which turns the document into the app's read model. Loans already has one, with no kinds (`src/apps/loans/workbook/infrastructure/loansDocument.ts:9-23`): schema `{loans: 1}`, a `codecOf` that throws, and a `read` that returns empty records. Its read model is `LoansBooks` (`src/apps/loans/workbook/domain/loansBooks.ts:2-5`).

The company version shows the full shape. `companyDocument.ts:17-20` builds the schema from core plus the installed pack. `workbookRecordsOfDocument` (`:23-25`) reads every kind through `recordsOfDocument(document, kind, codecOfKind)` (`src/shared/storage/infrastructure/documentRecordStorage.ts:35-41`). `readWorkbook` then applies the rules across records and gives the `Workbook` with its problems (`readWorkbook.ts:104-116`). Loans copies this shape: a `loansCodecs.ts` with a `codecOfKind`, a `LoansRecords` of `RecordsRead<…>` per kind, and a `readLoanBook` in the Loans domain.

### How a kind is encoded

- **The kind** is `recordKind<R>(name, one, many, article)` (`src/shared/storage/domain/recordKind.ts:15-17`), a name plus the nouns that toasts and refusals use. Company examples are in `coreKinds.ts:13-22`.
- **The codec** (`recordCodec.ts:13-21`) gives the key, a label for a person, `make(fields, id)` and `fieldsOf(record)`. A kind without a business key uses `withIdField` (`recordCodec.ts:41-54`), which reads and writes the `id` field. The billing plan is the cleanest example: `billingItemOf` and `BILLING_CODEC` (`billingPlanReading.ts:12-27`).
- **Field readers** are shared and refuse with a sentence: `requiredDate`, `optionalDate`, `optionalPeriod`, `positiveMoney`, `optionalMoney`, `requiredChoice`, `wholeNumberOf`, `booleanOf`, `ownId` (`storedFields.ts:104-173`). A refusal throws through `refuse`, and `refusalOr` catches it (`:72-86`).
- **On disk** every value is text or a flag (`recordFields.ts:4-7`). A day is `yyyy-mm-dd`, an amount is decimal text from its cents through `amountText` (`recordFields.ts:10-14`), a blank field is absent (`filledFields`, `:17-19`). Fields and kinds the app does not know are kept through a save (`documentFormat.ts:5`, `withAltered` in `documentRecordStorage.ts:72-83`, tested at `tests/documentStorage.spec.ts:120`). Records cannot nest, so a loan's periods and payments are kinds of their own.
- **The kind's reader** goes in `WriteRules.read` (`writeRules.ts:46`) and decides which records count. Readers refuse every record of a shared id (`idSharing`, `recordsRead.ts:89-95`) and name problems by label (`problemOf`, `:59-61`).

### Versioning and migration

- `schema` holds one version per contributor (README.md:2224). `savedByNewerApp` (`documentFormat.ts:22-24`) marks a file with a higher version or an unknown contributor, and the write path refuses it with `NEWER_FILE` (`documentRecordStorage.ts:108-110`). The store reads such a file and shows "A newer version of Kuna saved this file".
- A write restamps the document with the app's schema (`documentRecordStorage.ts:130`).
- There is no migration step. The company's core and the pack are both still at version 1 (`companyDocument.ts:14`, `hrDooPart.ts:80`). A reader that has to accept an old field shape does so inside the kind's factory.
- For H3: the files that exist hold `{"loans":1}` and no records. A pre-H3 app has no Loans write path at all, so H3 can add kinds at version 1 with no risk to existing files. The first change after H3 that an older app would misread needs a bump.

### Ids

- `newRecordId()` is `crypto.randomUUID()` (`recordId.ts:24-26`). A record holds a `RecordId`, `<kind>:<uuid>`, made by `recordIdOf` (`:10-12`). The file holds the bare UUID in `id` (README.md:478).
- `as RecordId` is allowed only in `recordId.ts`, which the boundary spec checks (`importBoundaries.spec.ts:178`). A factory like `newBillingItem` (`billingWrites.ts:19-28`) is where a new id is made.
- No kind today stores another kind's UUID. References are by business key: a category slug, a client slug, a grant name, or the split's four ledger cells. `keyOfRecordId` is used only inside the storage. A rate period or payment that names its loan would store the loan's bare UUID in a `loan` field and read it back with `recordIdOf(LOAN_RECORDS, text)`. That is new, and it is one helper in the Loans domain.

### The write path

1. A screen calls `store.write(title, work)` (`createWorkbookStore.ts:162`). The work takes `unit.of(rules)` and calls `add`, `change(before, after)`, `remove`, `repair` or `discard` (`repository.ts:5-19`).
2. `checkWrite` (`recordWrites.ts:174`) reads fresh the touched kinds and the kinds their checks read, finds each record by identity and by what the app read, refuses an add whose identity exists, runs `refusals`, and runs the reader on the result. A record the write touches may not drop out or gain a problem (README.md:2057-2085).
3. `apply` stores the whole document (`documentRecordStorage.ts:216-242`). A moved file means the write starts again from a fresh read, at most three times, with backoff (`createWorkbookStore.ts:312-357`). Another device's save landing at the same moment reruns the checks on that save's text (`documentRecordStorage.ts:219-230`).
4. The receipt joins `state.writes`, newest first, held in memory (`createWorkbookStore.ts:342`). `undo` turns the receipt round through the same checks (`:427-431`, README.md:2087). `undoable: false` turns Undo off for a kind (`writeRules.ts:43`).
5. A write may span kinds and is all or nothing. Category writes show cross-kind refusals: `CATEGORY_WRITES` reads ledger rows, rules, split parts and the pack's naming kinds and refuses a rename that would orphan them (`namedRecordWrites.ts:89-113`).

The toast layer is `useRecordWrites` (`src/apps/company/workbook/presentation/useRecordWrites.ts:41-99`). It wraps `store.write` and `store.undo` with a toast that names the records (`recordsChangeInWords`, `rowsInWords.ts:17`), an Undo button for 10 seconds, and "Nothing was written" against "The save may not have finished". It is bound to the company store at line 42.

### What the company does to add a kind

Traced through the billing plan (`grep -rn BILLING_RECORDS src tests`):

| Step                    | Company file                                                                                       | Loans equivalent                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Kind                    | `workbook/domain/coreKinds.ts:20`                                                                  | `src/apps/loans/workbook/domain/loanKinds.ts`             |
| Record type and order   | `workbook/domain/billingPlan.ts:7-30`                                                              | Loans domain                                              |
| Codec and reader        | `workbook/domain/billingPlanReading.ts:12-44`                                                      | Loans domain                                              |
| Codec registry          | `workbook/application/recordCodecs.ts:15-40`                                                       | a Loans `codecOfKind`, passed as `LOANS_DOCUMENT.codecOf` |
| Read model              | `workbook/domain/readWorkbook.ts:81-93`                                                            | `LoansBooks.records`                                      |
| Write rules and factory | `billingPlan/application/billingWrites.ts:10-28`                                                   | Loans application                                         |
| xlsx tab mapping        | `workbook/infrastructure/spreadsheetTab.ts:68`                                                     | none: Loans exports JSON only                             |
| Cross-kind guard        | `settings/application/namedRecordWrites.ts:59,139`                                                 | loan delete against its periods and payments              |
| Specs                   | `tests/billingPlanReader.spec.ts`, `tests/billingPlanWrites.spec.ts`, `tests/recordIds.spec.ts:35` | the same three per kind                                   |
| Contract suite          | `tests/recordStorageContract.spec.ts:415-437` (17 kinds)                                           | needs the harness generalised, see 6                      |
| Fake data               | `workbook/infrastructure/fake/fakeWorkbook.ts`                                                     | `seedFakeLoans.ts`                                        |
| README                  | _The workbook format_ table (README.md:450)                                                        | the _Loans_ section (README.md:1928)                      |

### What each loan kind would need

|                             | Loan                                                                                           | Rate period                                                                                               | Payment                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Identity                    | `withIdField`, UUID                                                                            | `withIdField`, UUID                                                                                       | `withIdField`, UUID                                                                      |
| Reference                   | none (an asset id later, H8)                                                                   | `loan`: the loan's UUID                                                                                   | `loan`: the loan's UUID                                                                  |
| Field readers that exist    | `requiredDate`, `positiveMoney`, `requiredChoice` for the method, `wholeNumberOf` for the term | `requiredDate` for `from`, `optionalDate` for `to`                                                        | `requiredDate`, `positiveMoney`, `optionalMoney` for a split into principal and interest |
| New reader                  | none                                                                                           | a rate field: no shared reader parses `3.05%` (the pack's `rateOf` is private, `companyFacts.ts:225-232`) | none                                                                                     |
| Reader rules across records | none                                                                                           | a loan the file lacks, overlapping or gapped periods (the pattern of `scenarioGuards.ts`)                 | a loan the file lacks, a date before the loan starts                                     |
| Write rules `reads`         | rate periods and payments, to refuse or cascade a delete                                       | loans                                                                                                     | loans                                                                                    |
| Undo                        | yes                                                                                            | yes                                                                                                       | yes                                                                                      |

The closest existing pattern for dated periods inside a parent is the pack's pay scenarios: rows that share a scenario name, each with optional `from` and `to`, guarded against overlap, and a plan row that switches scenario from a date (`switchedScenario.ts:12-23`, `overlapOf` in `scenarioSchedule.ts:76-80`). The closest pattern for a child set edited together is the split editor, which writes all parts of one ledger row in one write (`writeSplit`, `transactions/application/splitWrites.ts:35`).

## 2. Money and dates

### What is shared

- **`Money`** is integer cents with a brand and no currency (`src/shared/money/money.ts:5`). `moneyFromAmount` rounds half away from zero (`:10-20`), `divideMoney` splits into equal parts rounded the same way (`:55-60`), `ratioOf`, `sumMoney`, `addMoney`, `subtractMoney`, `negateMoney`, and `plainAmount` for problem text (`:68-70`).
- **Input**: `typedAmount` takes `12,50` or `12.50`, zero or more, at most two decimals (`typedAmount.ts:8-11`).
- **Format**: one reactive active format per page (`moneyFormat.ts:31-38`), `formatMoney`, `formatWholeMoney`, `formatCompactMoney`, `formatPercent`, `formatDecimal` (`:80-102`). `DEFAULT_MONEY_FORMAT` is EUR in en-GB (`:18`). Each app's `moneyFormat()` is applied by the shell for the app on screen (`appContribution.ts:52-53`, `src/shell/App.vue:51`). 73 files format money through it.
- **Matching**: `fewestMakingUp`, `settleOpenRows` and `settlePayments` (`settleOpenRows.ts:18-85`): each payment first closes the fewest open rows it equals exactly, then fills the oldest open rows. Four files use it: the owner loans and advances, the billing plan against invoices, and the accrual's closed year.
- **Calendar**: `CivilDate` as `yyyy-mm-dd` text that sorts (`civilDate.ts:5`), `civilDate`, `parseCivilDate`, `today`, `addDays`, `daysBetween` (`:56-58`), `weekdaysBetween` with holidays counted as working days (`:61-70`), serial-number conversion. `MonthKey` with `addMonths`, `monthCountBetween`, `monthsFrom`, `firstDayOf`, `lastDayOf` (`monthKey.ts:37-60`). `DateRange` with `rangeContains` and `monthsOfRange` (`dateRange.ts`). `monthLabel` and `shortMonthLabel` (`monthLabel.ts:8-15`). `ledgerWindow.ts` is ledger-shaped and of no use to loans.

### What is missing for loans

- **A day a whole number of months later**, with the day clamped to the month's end (a loan paid on the 31st). It composes from `monthOf`, `addMonths` and `lastDayOf` in a few lines. It is calendar arithmetic, not a loan rule, so it fits `src/shared/calendar`.
- **Day-count conventions.** Only `daysBetween` exists. ACT/365-or-366 is coded inline in the owner-loan interest (`ownerLoanInterest.ts:59-62`). There is no ACT/360 or 30/360.
- **A rate type and its parsing.** See below.
- **An annuity.** Nothing in `src`, `tests` or `scripts` computes `(1 + r)^n` or a payoff. A grep for annuity, amortis, instalment and principal finds only labels in `yearEnd.ts` and the fake workbook.
- **A day formatter.** 32 places build `new Intl.DateTimeFormat('en-GB', { day … })` inline, such as `BillingRowDialog.vue:89`. There is no `dayLabel` beside `monthLabel`.
- **A working-day calendar.** No public holidays exist outside the payroll rules, so "the next working day after a weekend due date" would be new.

### What already computes a schedule, a FIFO or an accrual

| Code                                                               | What it does                                                                                                                                                                          | Use for loans                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ownerLoans` (`packs/hr-doo/domain/ownerLoans.ts:83-129`)          | Loan-out ledger rows become loans, repayments are placed by `settlePayments` with "lent by the repayment's day", each loan gets remaining, status, repaid-on and its repayment shares | The FIFO is shared already. The rest is ledger and category roles, company only.                                 |
| `loanMonths` (`ownerLoans.ts:132-154`)                             | Lent, repaid and balance per month end                                                                                                                                                | The shape of a balance-by-month series. Company only.                                                            |
| `interestOnLoans` and `balanceDays` (`ownerLoanInterest.ts:27-79`) | Balance times days owed after a day up to a day, rounded per loan with `dividedRounded`, over a 365- or 366-day year                                                                  | The mechanics of an accrual between payments. Tied to `TracedFigure`, `RuleCitation` and a calendar-year window. |
| `loanBenefit`, `relatedPartyInterest` (`:99-136`)                  | Croatian benefit in kind and related-party interest                                                                                                                                   | Company law. Must stay.                                                                                          |
| `monthlyCharges` (`depreciationSchedule.ts:153-172`)               | Each month's charge is the cumulative rounded figure less the one before, so months add up to the year                                                                                | The rounding pattern a schedule needs so instalments add up to the principal.                                    |
| `fillRestOfYear` (`billingPlan/domain/fillRestOfYear.ts:30`)       | A monthly series of rows on each month's last day, skipping months already planned                                                                                                    | A pattern for "generate rows from terms". Company only.                                                          |
| `switchedScenario` (`scenarios/switchedScenario.ts:12-23`)         | One scenario until a day, another from it                                                                                                                                             | The pattern for rate periods.                                                                                    |

### Move to `src/shared` or stay

- **Move**: `dividedRounded` (`payrollArithmetic.ts:14-17`, 7 files call it directly) to `src/shared/money`. It is exact integer division rounded half away from zero, which interest on cents needs, and it states no company rule. `overlapOf` (3 files) is a candidate for `src/shared/calendar/dateRange.ts`, since `DaySpan` repeats `DateRange`.
- **Probably write new in Loans, not move**: `Rate` (`ruleset/schema.ts:8`, 17 importers). It is whole basis points, two decimals of a percent. A EURIBOR fixing is published to three decimals, as far as I know (not checked here), so a variable rate of fixing plus margin may not fit. Lane 1 should say which precision bank loans need before H3 picks a unit. `atRate` (17 files) and `percentText` follow whichever unit is picked.
- **Stay**: `ownerLoans`, `loanMonths`, `interestOnLoans`, `loanBenefit`, `relatedPartyInterest`, `shortfallRate`, the depreciation schedule and the billing fill. They read company ledger rows, category roles or Croatian law.
- **Already shared**: `settleOpenRows`, `Money`, the calendar.

Overflow: the largest integer interest step is balance in cents times rate times days, for example 15,000,000 cents times 400 basis points times 31 days, about 1.9e11, far below 2^53. A finer rate unit of a thousandth of a basis point still stays near 1.9e14.

## 3. Editors and screens

### How the company builds a list with an editor

The plain pattern, used by the billing plan and the owner advances, is a list that emits a row and a `UModal` dialog that adds, changes or deletes one record:

- `BillingRowDialog.vue` holds one `ref` per field, filled when the dialog opens (`:39-57`), `errors` as a computed map and `tried` so errors show after the first save (`:45,75-82,132`), `typedAmount` and `parseCivilDate` for parsing (`:70-77`), and reads the record as the app read it before a change (`recordWithId`, `:85-87`). Save calls `writes.write(title, unit => unit.of(BILLING_WRITES).add|change|remove(…))` (`:96-119`). The dialog is full screen on a phone (`:127`).
- `AdvanceDialog.vue` in the pack is the same shape (`:57,92,113,132,149`), and its list is `AdvanceList.vue`.
- The lists take view-model lines, not records. `LoanList.vue` (the owner loans on Owner, Who owes whom) defines `LoanLine` and `LoanRepaymentLine` with plain strings, cents and a route (`LoanList.vue:4-22`) and renders a grid that becomes two columns under 640 px (`:88-124`).

The tab editor is the second pattern, for many rows at once: `FactTabEditor.vue` (generic over a record with an id, `:1-35`), its columns (`factTabColumns.ts:9-19`) and its drafts (`settings/domain/recordDrafts.ts`, with field kinds text, word, date, amount, whole number, percent, flag and IBAN list at `:16`). It drafts from refused records too, so a broken row can be fixed. Clients, assets, grants, accountant lines and employees use it through `FactTabCard.vue`. Every tab editor is allowed to scroll sideways (`visual-check.mjs:435-442`), which a schedule should not need.

### Shared components

- `AppCard` (title, subtitle, actions, a definition popover, a collapse id kept under `kuna.card.<id>`, README.md:356-383).
- `PageHeader` with an actions slot (`OwnerScreen.vue:61-73`).
- `PageTabs`, kept in `?tab=`, the first tab out of the address, an `above` slot for a filter bar (`PageTabs.vue:27-41`, used at `OwnerScreen.vue:78-88`).
- `KpiTile` with label, value, a route, an optional delta, a trend sparkline, a definition and a caption (`KpiTile.vue:23-35`).
- `MoneyText`, `DrillLink`, `ShowAllButton` (first ten, then "Show all"), `SortableHeader`, `InfoPopover`, `SparkLine`, `DonutCard`, `ChartLegend`.
- Layout tokens: `max-w-measure` for a one-list screen, `.wide-pair` for side-by-side cards from 1920 px (`app.css:107`), and `.data-table` for tables (`app.css:67-97`).

### Charts

ECharts 6 through vue-echarts, with only bar, line and pie registered (`src/shared/charts/echarts.ts:16`). `ChartCard` takes an option, a description for a screen reader, empty texts, heights for desktop and phone, a table view's value format, `linkAt` for drills and a collapse id (`ChartCard.vue:34-58`). Chart builders are plain functions that return an option and a description, such as the month-end balance areas with a total line in `cash/presentation/cashChart.ts:22`. The theme, money axis, incomplete-month band and axis tooltip are shared (`chartTheme.ts:73-113`, `chartTooltip.ts:26`). The company's `DrillChart` and `DrillChartCard` add a `DrillTarget` into company Transactions (`filters/presentation/chartDrill.ts:6-12`) and stay company. A loan balance chart uses `ChartCard` with `linkAt` instead.

### Empty states

Nuxt UI's `UEmpty` is used by the company's `LedgerGate.vue:4`, whose texts and actions are about importing statements, so Loans writes its own. `ChartCard` has `empty`, `emptyTitle` and `emptyDescription`. The Loans Overview today is an `AppCard` with two lines and `data-testid="loans-empty"` (`OverviewScreen.vue:17-22`).

### Mobile rules the checks enforce

- Below 640 px: top bar, drawer, a sticky tab row, every control at least 44 px (README.md:316-343). The touch check fails a control under 44 by 44 px or any sideways page scroll (`touch-check.mjs:125,1734-1778`).
- No card wider than its content except the listed tab editors (`visual-check.mjs:435-442`, measured by `overflowingCards` at `:505`). Tables give way by container queries: `@container` on the wrapper and `hidden @md:table-cell` on secondary columns, as Salaries' paydays table does (`SalaryOverTimePanel.vue:39-59`).
- From 768 px, cards whose tops line up must end at the same height (`visual-check.mjs:166-173` with `alignedCards`).
- Nine widths from 360 to 2560, both themes at 360, 430 and 1440 (`visual-check.mjs:163-175`).

### What the Loans screens would reuse

| Screen                    | Reuse                                                                                                                                                                                                                                    | New                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Loan list (Overview)      | `PageHeader` with an "Add loan" action, `AppCard`, `KpiTile` for total owed, next payment and payoff, a list in the `LoanList.vue` style taking view lines, `ShowAllButton`                                                              | the view lines, the empty state                            |
| Loan detail with schedule | `PageTabs` (schedule, payments, rate periods), `ChartCard` with a line builder like `cashChart.ts`, a `.data-table` in an `@container` with principal, interest and balance as droppable columns, `AppCard` collapse with a summary line | the schedule table, the balance chart builder              |
| Payment entry             | the `BillingRowDialog.vue` shape: `UModal` full screen on a phone, `UFormField` errors after the first try, `typedAmount`, `parseCivilDate`, `recordWithId` for the change                                                               | the toast and Undo wrapper, unless `useRecordWrites` moves |
| Rate periods              | the same dialog shape, or `FactTabEditor` if it moves                                                                                                                                                                                    | a percent field parser                                     |

## 4. Import

### What the company has

- **File loading**: `loadImportFile` (`imports/infrastructure/importFiles.ts:12-28`) parses XML as camt, sends anything else to SheetJS, and decodes CSV as UTF-8 or else Windows-1250 (`:31-37`). SheetJS loads lazily (`sheetGrids.ts:18-20`). `readFirstSheet` gives a grid from A1, keeping CSV cells as text so `1.234,56` survives (`sheetGrids.ts:48-53`). `readEveryTab` reads every tab (`:35-42`). Both are already in `src/shared/xlsx`.
- **Cell readers**: `dateOf` reads a date cell's serial or text in `dd.mm.yyyy`, `dd/mm/yyyy`, `mm/dd/yyyy` or `yyyy-mm-dd` (`tabularStatement.ts:222-242`). `moneyOf` reads a number cell, or text by its decimal mark with grouping, a trailing sign and a currency code (`:253-266`). Both are pure and generic, but they sit in the company's import domain (2 importers of the module).
- **Header finding**: `headerRowOf` finds the first row of the first 40 that carries every header a profile names (`:23-31`). `fileShapeOf` guesses the header row and columns from Croatian and English ledger words (`profileGuess.ts:9-19,34`). Both assume ledger columns (date, debit or credit or amount, balance, counterparty).
- **Profiles**: `ImportProfile` is saved as a settings row and maps ledger columns only (`importProfile.ts:20-34`).
- **Checks**: `checkBalances` tests that each row's balance follows from the one before (`tabularStatement.ts:208`), which is the same test a schedule's balance column needs.
- **The dry run and write**: `importDryRun.ts` and `LEDGER_WRITES` are ledger-specific.

### Could a bank schedule come in through these parts

Partly. A table of period, date, instalment, principal, interest and balance in an xlsx or CSV would load through `readFirstSheet` and `loadImportFile`'s CSV decoding, and its cells would read through `dateOf` and `moneyOf`. What would be new:

1. A schedule column mapping (six columns, some optional) and its header words. The ledger `HINTS` and `ImportProfile` do not fit, and a saved profile would need a Loans setting kind that does not exist.
2. The checks: principal plus interest equals the instalment, the balance falls by the principal, the dates step by the loan's period.
3. Where the rows go: stored as a fourth kind (the bank's own plan), or used once to fill the loan's terms and compared against the computed schedule. That is a scope decision for the plan, not something the code settles.
4. A paste path. Nothing in `src` reads pasted text except the IBAN tags field (`IbanTagsField.vue:28`). A `textarea` whose `paste` event hands its text, split by tabs and lines, to the same cell readers needs no clipboard permission in any browser, Firefox included. Whether SheetJS reads tab-separated text through `readFirstSheet`'s string path is unverified.
5. Bank plans often arrive as PDF. Nothing reads PDF text in Kuna (pdf-lib is used to write invoices).

Moving `dateOf`, `moneyOf`, `DateFormat` and `DecimalMark` to `src/shared` costs about 4 files (`tabularStatement.ts`, `importProfile.ts`, `profileGuess.ts`, one spec) and is worth it only if H3 imports schedules.

## 5. Plug-in points for later waves

### H4, the hub dashboard

- `AppContribution` has no tile or waiting-job slot (`src/shared/app/appContribution.ts:37-68`), and the proposal keeps it out until H4 has a reader. The company's waiting card is company presentation (`overview/presentation/waitingForYou.ts`).
- **Leave in place**: the Loans figures as pure functions in the Loans domain, such as the balance on a day, the next payment and the payoff date per loan and for all loans. A tile then calls them, and `KpiTile` already takes a label, value and route.
- **Do not build**: a tile slot, a waiting-job slot, or "a payment is due" as an Overview job.

### H5, company facts shown in Loans

- No `facts.ts` exists in any app, and the boundary spec allows no import across apps at all (`importBoundaries.spec.ts:144-146`). The exception the proposal names ("another app's `facts.ts`, only from one translation file") is not in the spec yet.
- The owner loan book is pack code (`ownerLoans.ts`), and company code outside the pack may not import a pack (`importBoundaries.spec.ts:148-150`). H5 needs either a pack-side publisher through `PackContribution` or a boundary rule for `facts.ts`. That is for H5 to decide.
- The book's drills are company `DrillTarget`s (`ownerLoans.ts:21,35`). A fact handed to Loans would carry a plain route into `/company/...` instead.
- Money format is one per page. Showing company figures inside Loans needs a format that takes its currency explicitly, as the H2 plan already says.
- **Leave in place**: Loans lists and detail screens that take view lines rather than records, the way `LoanList.vue` takes `LoanLine`. A read-only company loan then becomes one more source of lines, marked as such, with no edit actions. A loan direction (you owe, or you are owed) in the Loans model, since the owner owes the company.
- **Do not build**: `facts.ts`, the translation file, or the boundary exception.

### H6, personal transactions matching loan payments

- Matching exists and is shared (`settleOpenRows.ts`). The company's invoice matching by client IBAN is the analogue for "this bank row is that loan's instalment" (`receivables/domain/invoiceMatching.ts`).
- Unknown fields survive a save, so H6 can add a link field to the payment kind later with a schema bump.
- **Leave in place**: the payment as its own kind with its own UUID and a date and amount, so a ledger row can later name it, or it can name a ledger row. Optional lender IBAN or account on the loan only if lane 1 or lane 2 needs it for H3 itself.
- **Do not build**: a ledger reference field, matching, or reading any ledger.

### H8, mortgage equity by asset id

- An asset would name the loan by its UUID, which `withIdField` gives every loan from its first write.
- **Leave in place**: stable loan ids, and a pure "balance on a day" per loan that a later `src/apps/loans/facts.ts` can publish.
- **Do not build**: an asset field, `facts.ts`, or a net worth figure.

## 6. Tests and checks

### Domain specs

Vitest in a node environment over `tests/**/*.spec.ts`, with the pack installed for every spec (`vitest.config.ts`, `tests/setup/installPack.ts`). Domain specs build records from small fixtures and assert cents, with a comment working out each expected figure, as `tests/ownerLoanInterest.spec.ts:28-40` does. Loans specs exist for the first run and the Google return (`tests/loansFirstRun.spec.ts`, `tests/loansGoogleReturn.spec.ts`). H3 adds a reader spec and a writes spec per kind, and a schedule spec with figures worked out by hand: annuity and linear, a rate change mid-term, an early payment, the last instalment absorbing rounding, a payment on the 31st.

### Storage contract and kind names

- `tests/recordStorageContract.spec.ts` runs every kind against both homes, with a fixture per kind and a count of 17 (`:415-437`). Its store type is `WorkbookStore<CompanyBooks, …>` and its harness (`tests/fixtures/writeBack.ts:133,171`) opens the company store. Loans kinds can join only after the harness takes an `AppDocument`.
- `tests/kindNames.spec.ts:11-21` checks the company's names only. A Loans block checks its names are unique and that its `codecOfKind` finds each kind.

### Visual check

`scripts/visual-check.mjs` runs `SCREENS` (`:189`) and `FLOWS` (`:654`) against the fake build. Loans today has three screens and a device card (`:382-401`) and four flows (`:720-723`). Each screen entry names its route, query, title, chart count and the seed texts it must show. H3 adds:

- The Loans Overview with loans, a loan's detail on each tab, and the empty file, in both `?loans=drive` and `?loans=browser`, with the right chart count.
- An editor flow in `scripts/support/editorFlows.mjs` like `advanceFlow` (`:343-367`): add a loan, a rate period and a payment, edit, delete and Undo, at 360 and 1440 in both modes.
- Nothing in `SIDEWAYS_SCROLL_ALLOWED`, unless a tab editor is chosen for rate periods.

### Touch check

`scripts/touch-check.mjs` steps through `SCREENS` (`:136-152`) and collapses a card on each (`:1012-1029`), with named steps for flows. H3 adds the Loans screens and a payment entered and undone by touch. The Loans find step waits for `loans-empty` (`:1511-1534`).

### PWA check

`scripts/check-pwa.mjs:188-202` makes a Loans file in this browser and reloads `#/loans` offline, waiting for `loans-empty` with "kept in this browser". H3 keeps that test id and text for an empty file, or changes the check.

### Fake build

`seedFakeLoans.ts:25-51` writes an empty document for `drive`, `browser` and `other-device`. H3 adds a `fakeLoansDocument` with made-up loans of each method and a rate change, built as records the way `fakeWorkbook.ts` is, keeps an empty variant for the empty state, and keeps the `FAKE-WORKBOOK-ONLY-DO-NOT-SHIP` marker in the browser id (`:14`) that `assert-no-fake-bytes.mjs` looks for. Every seeded id must be fixed, as the company's are (README.md:1874).

### Where a figure check fits

`scripts/figure-digest.mjs` reads only the company document (`:73-84`) and prints a count and a short hash per group of figures, never a figure (`:1-7`). Loans fits as a second input: `--loans <kuna-loans.json>` or `--fake-loans <variant>`, read through `LOANS_DOCUMENT.read`, with groups such as `loans.read.records`, `loans.<loan>.schedule`, `loans.balances`, `loans.next-payment` and `loans.payoff`. A digest only proves that two trees agree. Matching the bank's own plan to the cent is a different check, one that needs the owner's real plan and belongs with lane 2's data.

## 7. Boundaries

What `tests/importBoundaries.spec.ts` lets Loans import:

- Only `src/shared` and `src/apps/loans` (`:144-146`).
- From a Loans `domain` folder, only Loans domain code, `src/shared/storage/domain`, `src/shared/calendar`, `src/shared/money` and `src/shared/text` (`:91,165-173`). Charts, UI and `src/shared/xlsx` are off limits to domain code.
- Storage adapters (`infrastructure` under `src/shared/storage` or `src/apps/loans/workbook`) only from storage code, `app.ts` and fake seeds (`:94-99,181-193`). A Loans screen reaches the file through `src/apps/loans/workbook/presentation`, as it does today.
- An `application` folder imports no `infrastructure`, except the wiring files, among them `loansStore.ts` (`:106,195-197`).

Code Loans would need that today lives only in `src/apps/company`, with its `src` importers:

| Candidate                                                    | Where                                                                  | Importers                        | Note                                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `useRecordWrites`                                            | `workbook/presentation/useRecordWrites.ts`                             | 24                               | Takes the company store at `:42`. Moving it means a store parameter and 24 import lines.                                            |
| `recordsChangeInWords`                                       | `workbook/presentation/rowsInWords.ts`                                 | 1 (plus `useRecordWrites`)       | Pure over `WriteReceipt`. Moves with `useRecordWrites`.                                                                             |
| `dividedRounded`                                             | `packs/hr-doo/domain/payrollArithmetic.ts:14`                          | 7 call it (46 import the module) | Move the one function, leave the module.                                                                                            |
| `Rate`, `atRate`, `percentText`                              | `ruleset/schema.ts:8`, `payrollArithmetic.ts:20,33`                    | 17, 17, few                      | Pack law types. Decide the unit first.                                                                                              |
| `FactTabEditor`, `factTabColumns`, `recordDrafts`            | `settings/presentation`, `settings/domain`                             | 1, 4, 4                          | `recordDrafts` imports the company's `ibanListOf` (`recordDrafts.ts:2`, `iban.ts` has 8 importers). Only if a tab editor is wanted. |
| `dateOf`, `moneyOf`, `DateFormat`, `DecimalMark`             | `imports/domain/tabularStatement.ts`, `importProfile.ts`               | 2                                | Only if H3 imports schedules.                                                                                                       |
| `CURRENCY_ITEMS`, `numberStyleItems`, `currencyProblem`      | `settings/presentation/moneyChoices.ts`, `settings/domain/settings.ts` | 2, 5                             | Only if Loans gets a currency and format setting in H3.                                                                             |
| `overlapOf`                                                  | `scenarios/scenarioSchedule.ts:76`                                     | 3                                | Five lines. Writing it in `dateRange.ts` and pointing the pack at it removes a near duplicate of `DateRange`.                       |
| `DrillChartCard`, `chartDrill`                               | `filters/presentation`                                                 | 10, 8                            | Not needed. `ChartCard` with `linkAt` covers Loans.                                                                                 |
| `LedgerGate`, `SessionChanges`                               | `workbook/presentation`, `review/presentation`                         | 9, 1                             | Company wording and ledger chips. Not needed.                                                                                       |
| The settings machinery (`settingCodec`, `SettingDefinition`) | `settings/domain/settings.ts` (839 lines)                              | 24                               | Too company-shaped to move for one key or two.                                                                                      |

## Reuse map

| Concept                                                   | Existing code                                                             | Reuse or new                                                              | Cost                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Loans document, store, first run, export, sync group      | `src/apps/loans/*`, `pageWorkbookStore.ts`                                | Reuse                                                                     | None                                                 |
| Loan, rate period and payment kinds                       | `recordKind`, `withIdField`, field readers in `src/shared/storage/domain` | Reuse, three new codecs                                                   | Small                                                |
| A record naming its loan's UUID                           | `recordIdOf`, nothing reads a stored UUID reference                       | New helper in the Loans domain                                            | Small                                                |
| Write rules, cross-kind guards, atomic write, retry, Undo | `WriteRules`, `checkWrite`, `createWorkbookStore`                         | Reuse                                                                     | None                                                 |
| Toast with Undo                                           | `useRecordWrites`, `rowsInWords` (company)                                | Move to `src/shared/storage/presentation` with a store parameter, or copy | 25 files to move, or about 100 lines copied          |
| Loans read model and problems                             | `LoansBooks`, `Reading`, `problemOf`                                      | Extend `LoansBooks`, new problems card                                    | Small                                                |
| Money in cents, rounding, input                           | `src/shared/money`                                                        | Reuse                                                                     | None                                                 |
| Exact integer rounding                                    | `dividedRounded` (pack)                                                   | Move one function to `src/shared/money`                                   | 7 files                                              |
| Rate type and percent parsing                             | `Rate` in bp, private `rateOf` (pack)                                     | New in Loans, unit set by lane 1                                          | Small                                                |
| Day stepping by months                                    | `addMonths`, `lastDayOf`                                                  | New helper in `src/shared/calendar`                                       | Small                                                |
| Day count                                                 | `daysBetween`, inline ACT/365-or-366                                      | New conventions as lane 1 requires                                        | Small                                                |
| Annuity and linear schedule                               | none                                                                      | New in the Loans domain                                                   | Medium, most of H3's logic                           |
| Interest between payments                                 | `balanceDays` pattern (pack, private)                                     | New in Loans, same mechanics                                              | Small                                                |
| Rounding so instalments add up                            | `monthlyCharges` pattern                                                  | Copy the pattern                                                          | Small                                                |
| Payment against schedule matching                         | `settlePayments` (shared)                                                 | Reuse if payments are placed on instalments                               | None                                                 |
| Dated rate periods                                        | `switchedScenario`, `overlapOf` (pack)                                    | Pattern, `overlapOf` to shared                                            | Small                                                |
| Cards, tiles, tabs, header, money text                    | `src/shared/ui`                                                           | Reuse                                                                     | None                                                 |
| Balance chart                                             | `ChartCard`, chart theme, `cashChart.ts` pattern                          | New builder                                                               | Small                                                |
| Schedule table                                            | `.data-table`, `@container` pattern                                       | New component                                                             | Small                                                |
| Payment and loan dialogs                                  | `BillingRowDialog.vue` shape                                              | New dialogs                                                               | Small each                                           |
| Rate period editor                                        | `FactTabEditor` (company)                                                 | Dialog, or move the tab editor                                            | Small, or about 5 files to move with their importers |
| Currency and number format                                | `moneyFormat()` on `AppContribution`, company settings                    | Keep EUR in en-GB, or a new Loans setting kind                            | None, or medium                                      |
| Schedule import from a file                               | `readFirstSheet`, `dateOf`, `moneyOf`                                     | Partly reuse, new mapping and checks                                      | Medium                                               |
| Schedule paste                                            | none                                                                      | New                                                                       | Small to medium                                      |
| Fake seed                                                 | `seedFakeLoans.ts`, fake Drive                                            | Extend                                                                    | Small                                                |
| Visual and touch checks                                   | screen lists, `advanceFlow` pattern                                       | Extend                                                                    | Medium                                               |
| PWA check                                                 | `check-pwa.mjs:188-202`                                                   | Keep `loans-empty` or update                                              | Small                                                |
| Figure digest                                             | `figure-digest.mjs` (company only)                                        | Add a Loans input                                                         | Small                                                |
| Storage contract suite                                    | company harness                                                           | Generalise the harness                                                    | Medium                                               |
| Kind names spec                                           | company only                                                              | Add a Loans block                                                         | Small                                                |
| Dashboard tile, waiting job                               | none                                                                      | Leave for H4                                                              | None                                                 |
| Company facts                                             | none, owner loans in the pack                                             | Leave for H5                                                              | None                                                 |
| Ledger matching                                           | `settleOpenRows`, invoice matching                                        | Leave for H6                                                              | None                                                 |
| Asset link                                                | stable loan UUID                                                          | Leave for H8                                                              | None                                                 |

## Risks

- **Field names are close to permanent.** There is no migration step, only a version gate. A name or unit that changes after H3 means a schema bump, a reader of the old shape in each factory, and older phones that refuse to write until they reload.
- **Rate precision.** Basis points hold two decimals of a percent. If lane 1 finds bank rates or EURIBOR fixings quoted to three decimals, reusing `Rate` would round every variable rate.
- **Rounding policy decides whether the schedule matches the bank.** An annuity needs floating-point powers, then cents. Which instalment absorbs rounding, and whether interest is per month or per day, must come from lane 1 and be checked against the owner's real plan, not against a digest.
- **The write toast is company-bound.** Copying `useRecordWrites` into Loans makes two ways of doing the same thing. Moving it touches 24 company files in the same wave.
- **One money format per page.** Loans in another currency than euros, or company figures in Loans (H5), cannot show side by side through `formatMoney` as it is.
- **Deleting a loan has to deal with its children.** No kind references another by UUID yet. Either the delete refuses while periods or payments name the loan, or it removes them in the same write. Undo of a cascade puts every record back, which the receipt already supports.
- **The test harness is company-typed.** The storage contract suite, its fixtures and the kind-names spec need work before Loans kinds can join them, or Loans gets its own smaller suite and the contract stays company-only.
- **Four checks wait on `loans-empty`.** Changing the empty Overview without the checks breaks `check:pwa`, the touch check and the visual flows.
- **A schedule table on a 360 px phone.** Six figure columns must drop to two or three by container width. Only tab editors may scroll sideways, and the visual check fails anything else.
- **H5 cannot reach the owner loan book from a core `facts.ts`** under today's boundary rules. Shaping Loans screens around view lines keeps H3 out of that decision.
