# Loans simulations, lane 1: the codebase

What the Loans plan engine, figures, charts, storage, routes and words already give a loan simulation and comparison feature, what a scenario needs that is missing, the two storage shapes and their costs, where a comparison screen sits, and how fast the engine is, read against the repo at 755e1ed.

Read against the repo at `755e1ed` (HEAD), not the working tree another agent is editing. Every path is under `src/apps/loans/` unless it says otherwise. All figures here are made up.

## Short version

- **The engine already simulates.** `loanPlan(loan, periods, extraPayments)` is a pure function of plain values (`bankLoans/domain/loanPlan.ts:60`). Nothing in it reads the store, a record id or today. An offer the file does not hold, a rate path, a regular overpayment and a later start date are all just different arguments. The what-if panel already uses it this way, building throwaway plans with a made-up extra payment (`bankLoans/domain/whatIf.ts:48-64`).
- **The figures and most of the charts take a plan, not a stored loan.** `splitOfRows`, `paymentsByYear`, `paymentsAfter`, `payoffDate` and `balanceOn` (`bankLoans/domain/loanFigures.ts:12-112`) give every number a comparison needs except fees and an effective rate. `bankLoanFigures`, `planYears` and `bankLoanMonths` take a `BankLoanBook`, which an unsaved scenario can fill in with an empty late-instalment list (`bankLoans/presentation/bankLoanView.ts:32`, `:104`, `:137`).
- **Missing:** fees of any kind, an effective rate, a term change part-way through a loan, a refinance that links two plans, a generator for a rate path or a regular overpayment, a chart that draws several plans at once, and Croatian words for the what-if and plan cards, which still hard-code English.
- **Storage, plainest first.** Keeping scenarios in the page, with the inputs in the address the way Pay scenarios keeps its choice, changes no storage, no sync and no record contract. Keeping them in the Loans file means new record kinds, about ten files and three test registries. Reusing the `bank-loan` kind with a flag would leak offers into the Overview totals and the home card. Which shape to build is the owner's call (see the last section).
- **Navigation.** A `/loans/compare` screen joins `screens` and `menu()` in `app.ts:35-42`, with ways in from the bank loan page and the Overview header.
- **Speed.** A 360-instalment plan takes about 0.6 ms on the machine measured, and four full scenarios with their figures and chart rows about 7.5 ms. The engine needs no debounce. Give each scenario its own `computed` so a keystroke rebuilds one plan, not all of them. The unmeasured cost is the chart redraw.

## The plan engine

`loanPlan` (`bankLoans/domain/loanPlan.ts:60-120`) walks the instalments once:

- The first instalment is the annuity of the principal over every instalment at the first period's rate (`:70`). `annuity` works in exact BigInt integers (`bankLoans/domain/yearlyRate.ts:42-54`) and `monthlyInterest` is the balance times the yearly rate over 12, rounded half up (`yearlyRate.ts:33-35`). Rates are whole millionths, so 3.18% is `31_800` (`yearlyRate.ts:5`).
- A rate period is looked up by the exact due date it starts on (`loanPlan.ts:61`, `:106`). A new rate recomputes the instalment over the instalments left, so the end date holds (`:107-110`). A period whose `from` is not a due date is ignored silently by the engine. Only the reader refuses it (`workbook/domain/readLoanBook.ts:125`). A rate path generator must snap to due dates.
- The engine throws when no period starts at the first instalment (`loanPlan.ts:63-66`). The reader avoids the throw by giving such a loan a null plan (`readLoanBook.ts:139-154`). A scenario editor must do the same check before it calls the engine.
- An extra payment lowers the balance on its date, after an instalment due that day (`:75-85`, `:117`). It is capped at the balance (`:80`), which is what a full payoff in a refinance needs. Its effect lands at the next instalment: `lower-instalment` recomputes the annuity (`:98-99`), `shorter-term` keeps the instalment and counts how many it still takes (`:100-103`, `instalmentsToRepay` at `:30-40`).
- Interim interest is one row before the first instalment that leaves the balance alone (`:87-91`).
- The subsidy pays a fixed amount of each instalment it covers, or the whole payment when that is less, and leaves principal, interest and balance alone (`:43-46`, `:114-116`).
- Every row carries `payment`, `principal`, `interest`, `subsidy`, `yourShare` and `balance` (`:12-27`). Money is whole cents throughout.

The engine has one repayment shape: monthly annuities on the first instalment's day (`dayMonthsLater` at `:94`). No equal-principal (linear) plan, no other frequency, no grace period beyond the interim interest row.

## The what-if and its panel

`whatIfExtraPayment` (`bankLoans/domain/whatIf.ts:48-64`) builds the plan as it stands, then one plan per effect with a made-up extra payment whose id is `recordIdOf(EXTRA_PAYMENT_RECORDS, 'what-if')` (`:51`). It reports the payoff, months saved, interest saved and the next instalment (`:53-59`). It also carries the one contract rule a refinance or early payoff must respect: repaying during the subsidy or up to 24 months after its last covered instalment means paying the subsidy back (`:15-16`, `:61-63`).

Two things a comparison should not copy as they are:

- `interestSaved` sums `row.interest` whoever pays it (`whatIf.ts:39-41`), so it includes interest the subsidy would have paid. A comparison of what the owner pays should lead with `yourShareOf` (`loanFigures.ts:75-77`).
- `whatIf.ts` keeps private `instalmentCount` and `interestOf(plan)` helpers (`:35-41`), while `loanFigures.ts:90-92` exports an `interestOf(split)` with the same name and a different argument. A scenario outcome function should replace the private pair, not add a third way.
- It rebuilds the base plan on every call (`whatIf.ts:49`), although the screen already holds it as `book.plan`.

`WhatIfPanel.vue` parses the amount and date on every keystroke into a `typed` value that is null while either is wrong (`bankLoans/presentation/WhatIfPanel.vue:35-39`), runs the what-if in a `computed` (`:41-45`), and its Apply opens the extra payment dialog filled in (`:54-56`, wired at `BankLoanScreen.vue:175`). Its strings are English literals in the template (`WhatIfPanel.vue:50-52`, `:60-107`), not `words.ts` entries.

## The figures

`loanFigures.ts` works on plan rows only:

| Function                                                                  | Gives                                                                                               | Line       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| `balanceOn`                                                               | owed on a day, zero before the drawdown                                                             | `:12-15`   |
| `nextPayment`, `payoffDate`                                               | next instalment, last row's date                                                                    | `:18-25`   |
| `splitOf`, `splitOfRows`                                                  | principal and interest, each split into what you pay and what the subsidy pays, plus extra payments | `:42-62`   |
| `paymentOf`, `subsidyShareOf`, `yourShareOf`, `principalOf`, `interestOf` | the sums a comparison row shows                                                                     | `:65-92`   |
| `paymentsByYear`                                                          | the split per calendar year                                                                         | `:100-107` |
| `paymentsAfter`                                                           | the split of everything after a day                                                                 | `:110-112` |
| `paidSoFar`                                                               | what is paid by a day, late instalments counted from the day paid                                   | `:117-131` |
| `ratePeriodOn`, `subsidyLastCovered`                                      | the period in force on a day, the subsidy's last due date                                           | `:134-141` |

`bankLoanView.ts` turns a `BankLoanBook` into screen figures: owed, paid back, next payment, subsidy end, payoff, instalments left, this year's interest, still to pay (`:14-62`). `planYears` groups the plan by year and marks a future row at a variable rate as an estimate (`:104-134`, estimate at `:111`). `bankLoanMonths` gives the month-end balance from drawdown to payoff (`:137-142`).

For a comparison, the useful figures over each scenario are already there: first instalment, payoff, instalment count, interest and your share over the whole plan, what the subsidy pays, and the yearly split. For an offer that starts later, compare from a common day with `paymentsAfter` rather than over each plan's own life, since `balanceOn` and `bankLoanFigures` treat days before the drawdown as nothing owed (`loanFigures.ts:13`, `bankLoanView.ts:40`).

## The charts

- `balanceChart` (`balances/presentation/balanceChart.ts:48-137`) draws one loan: a solid line up to the current month and a dashed one after, with Today, extra payment dots and a variable-rate note. It is built for one plan with a past and a future, so a comparison needs a new builder with one line per scenario. `yearStep` (`:32-35`), `axisTooltip`, `moneyAxisLabel` and the tokens carry over.
- `paymentsChart` (`bankLoans/presentation/paymentsChart.ts:34-122`) stacks one bar per year. It fits "where one scenario's payments go" as it is. A side-by-side "total cost per scenario" bar would be a new, smaller builder on the same `STACK` order and `stripeDecal` (`:26`, `:46-47`).
- Series colours come from `chartTokens().series`, eight categorical slots assigned in order, never cycled (`src/shared/charts/chartTokens.ts:29-30`, `:72`). That caps a comparison at eight lines before colour runs out, which is more than a person compares.
- `ChartCard` re-renders through vue-echarts whenever its `option` changes (`src/shared/ui/ChartCanvas.vue:111`).

## The storage

- The file is one JSON document, `kuna-loans.json`, with schema `{ loans: 1 }` (`workbook/infrastructure/loansDocument.ts:11`). Its read decodes six kinds and runs `readLoanBook` over them (`loansDocument.ts:22-25`).
- The six kinds are declared in `workbook/domain/loanKinds.ts:9-14`, their codecs listed in `workbook/application/loansCodecs.ts:10`, and their parts in `LoansRecords` and `LOAN_PARTS` (`readLoanBook.ts:19-48`).
- Each kind has a reader and codec in its own file, such as `workbook/domain/bankLoanReading.ts:44-87` (a loan is at most 600 instalments, `:11`, `:52`) and `ratePeriodReading.ts:20-41`.
- `readLoanBook` applies the rules across records and builds each plan on read (`readLoanBook.ts:111-197`). Plans are never stored (README "Loans", lines 2083-2084 at HEAD).
- Writes go through `WriteRules` per kind (`bankLoans/application/bankLoanWrites.ts:16-48`). A write that would leave out or newly doubt a record of a dependent kind is refused (`workbook/application/loanWriteGuards.ts:23-38`). Deleting a bank loan removes everything that names it in one write (`bankLoanWrites.ts:51-56`).
- The document storage copies every kind the file holds before applying changes (`src/shared/storage/infrastructure/documentRecordStorage.ts:111`), so a kind an older app does not know survives its saves. A file whose schema is newer than the app's is read and never written (`documentRecordStorage.ts:108-110`, `src/shared/storage/infrastructure/documentFormat.ts:22-24`).
- Sync: Loans has no steps of its own. Its group is the file alone, with Undo through the store (`sync/presentation/loansSyncGroup.ts:7-15`).
- The storage contract is `tests/recordStorageContract.spec.ts`. It lists the Loans write rules (`:592`), asserts there are six (`:614`) and needs a fixture per kind (`LOANS_FIXTURES` from `:462`). `tests/kindNames.spec.ts:35-44` checks every declared kind has a codec and a part. `tests/fixtures/writeBack.ts:116` finds a kind's part by name.
- `check:figures` digests the Loans groups through `loansGroups` (`scripts/figure-digest.mjs:285`), importing `whatIfExtraPayment` and the view functions (`:96-102`).

## Routes, screens and words

- `app.ts:18-44` registers Overview, bank loan, informal loan, Settings and Start as screens, and the menu is Overview alone (`menu: () => [OVERVIEW]`, `:42`). The router turns every app's `screens` into hash routes (`src/shell/routing/router.ts:34`, `:45`).
- Loan pages name a loan by its bare UUID in `?loan=` (`overview/presentation/loanLinks.ts:9-29`).
- Every presentation folder has a `words.ts` with an `en` object and an `hr: Translation<typeof en>` beside it, picked by `language` (`words.ts:6-14`, `bankLoans/presentation/words.ts:7-265`). `Translation` forces Croatian to supply `one`, `few` and `other` wherever English has a counted phrase (`src/shared/text/translation.ts:20-28`), and `plural` picks the form (`:33-36`).
- `WhatIfPanel.vue` and `PlanCard.vue` bypass this with English literals (`PlanCard.vue:35`, `:45-46`, `:62-139`). The design plan holds language stage 2 until after the Loans redesign ([design plan](../../../platform/design-plan.md)). A new screen should start with its own `words.ts`, and moving the what-if strings into one belongs in the same wave if the comparison absorbs the panel.

## What a scenario needs that is missing

| Need                            | What exists                                                                                                                                                                                                                                                                                            | What is missing                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A loan not stored yet, an offer | `loanPlan` reads only plain fields of `BankLoan` (`loanPlan.ts:60-71`). An in-memory loan with a made-up id works today, as the what-if's extra payment does (`whatIf.ts:51`). The term inputs and their checks exist in `BankLoanDialog.vue:73-123`, `RateFields.vue:6-17`, `SubsidyFields.vue:8-22`. | A form that does not write, and a check that a first rate period exists before the engine is called. The dialog's checks repeat the reader's (`bankLoanReading.ts:44-65`), so an offer editor would be a third copy unless the typed-terms check moves to one place.                             |
| Fees                            | Nothing. Interim interest is the only charge outside instalments (`bankLoan.ts:6-9`).                                                                                                                                                                                                                  | An upfront fee, a monthly account or insurance cost, and an early repayment fee. None changes the balance, so they belong beside the plan as dated costs rather than as a new `PlanRow` kind, which would ripple through `splitOf` (`loanFigures.ts:42-47`), the chart stack and the plan table. |
| An effective rate               | Nothing.                                                                                                                                                                                                                                                                                               | A rate that equates the money received with every payment and fee. That needs an iterative solver, which the repo does not have. Its legal definition belongs to another lane.                                                                                                                   |
| A different start date          | The plan is date-driven from `drawdown` and `firstInstalment` (`loanPlan.ts:94`).                                                                                                                                                                                                                      | Comparing over a common window: `paymentsAfter(plan, day)` gives it, but no view picks the day.                                                                                                                                                                                                  |
| A rate path for a variable rate | Any number of `RatePeriod` values, each recomputing the instalment (`loanPlan.ts:106-110`). The plan marks future variable rows as estimates (`bankLoanView.ts:111`).                                                                                                                                  | A generator from "index path plus margin, reset every 6 or 12 months" to periods snapped to due dates. Nothing reads an index today, since a variable rate's index and margin are free text in `note` (`ratePeriod.ts:7`).                                                                       |
| A regular overpayment           | Any number of `ExtraPayment` values, sorted and applied by date (`loanPlan.ts:62`, `:75-85`).                                                                                                                                                                                                          | A generator, such as 100.00 every month from a date, or a yearly lump. Stored as facts this would be one record per month for years, so it belongs in the scenario, not in `extra-payment` records.                                                                                              |
| A refinance                     | An extra payment capped at the balance ends a plan (`loanPlan.ts:80`, `:96`). `balanceOn` gives the amount (`loanFigures.ts:12-15`). The subsidy payback rule exists in `whatIf.ts:61-63`.                                                                                                             | A link from the old plan to a new one whose principal is the old balance plus fees, a merged cash-flow timeline of both, a break-even month, and the old lender's early repayment fee.                                                                                                           |
| A term change                   | `instalments` is fixed for the life of the loan. A rate change spreads over `last - number + 1` (`loanPlan.ts:99`, `:109`). `shorter-term` only shortens (`:100-103`).                                                                                                                                 | An event that sets the instalments left from a due date. That is a change inside the engine loop at `loanPlan.ts:106-110`. A refinance into a new loan at the same rate and no fee gives the same figures and needs no engine change.                                                            |
| Several plans on one chart      | One-plan builders only.                                                                                                                                                                                                                                                                                | A multi-line balance builder and a per-scenario cost bar.                                                                                                                                                                                                                                        |

## Two shapes for scenarios

### In the page

The scenario lives in component state. Its inputs can also go into the address, the way Pay scenarios keeps the compared scenarios and the base so "a reload or a shared link keeps them and nothing is written" (`src/apps/company/packs/hr-doo/presentation/payScenarios/PayPanel.vue:71-91`), or into local storage beside the existing per-device keys such as `kuna.workbook-file.<app>` (README "Loans", line 2009 at HEAD).

- **Storage:** none. With local storage, one key per device that another device never sees.
- **Sync:** none. Nothing reaches Drive.
- **Record contract:** untouched. `LOANS_KINDS` stays at six.
- **Checks:** unit tests on the new domain functions (scenario outcome, generators, multi-plan chart builders), a figures group in `loansGroups` over the fake sample, and a visual and touch flow for the screen on `?loans=sample`.
- **Consequence:** an offer typed on the laptop is not on the phone. A long rate path or fee list makes the address long but the hash router carries it.

### In the Loans file

Scenarios become records. The plain way is new kinds, such as a `loan-scenario` with its terms as flat fields and child kinds for what repeats (its rate path, its fees, its overpayment rule), each naming the scenario the way `rate-period` names its loan (`workbook/domain/loanReference.ts:8-14`).

- **Storage:** a kind in `loanKinds.ts`, a domain type and a reader with codec per kind, the codec in `loansCodecs.ts:10`, a part in `LoansRecords`, `LOAN_PARTS` and `loansRecordsOf` (`readLoanBook.ts:19-48`), cross-record rules and a scenarios list on `LoanBook` (`readLoanBook.ts:72-78`), and `WriteRules` per kind. A scenario that names a stored loan as its base needs `removeBankLoan` to delete it too, or `BANK_LOAN_WRITES` to refuse (`bankLoanWrites.ts:21`, `:51-56`). The schema can stay at `{ loans: 1 }`, since older apps keep kinds they do not know (`documentRecordStorage.ts:111`).
- **Sync:** nothing new. The records ride the same document and save, with Undo through `useRecordWrites`.
- **Record contract:** each new kind joins `LOANS_WRITES` (`tests/recordStorageContract.spec.ts:592`) with a fixture in `LOANS_FIXTURES`, the count at `:614` moves, `tests/kindNames.spec.ts` follows from `LOAN_PARTS`, `tests/loanReaders.spec.ts` gains reader cases, the fake sample (`workbook/infrastructure/fake/fakeLoans.ts`) gains a scenario, and the README kinds table gets the new rows.
- **Checks:** everything the page shape needs, plus the contract suite over both homes.
- **Consequence:** offers survive reload and reach every device, and they go out in the export.

Reusing `bank-loan` with an offer flag looks cheaper but changes what a bank loan means. The Overview totals, the tiles and the home card read every bank loan (`overview/presentation/OverviewScreen.vue:35-40`, `overview/presentation/owedTotals.ts:21-27`, `home/presentation/loansHomeCard.ts:17-23`), as do `figure-digest.mjs` and the late instalment checks, so every one of them would need a filter. Planned overpayments as `extra-payment` records on a real loan would change that loan's plan on read (`readLoanBook.ts:139-154`).

## Where a comparison screen sits

- **Route and menu:** a `COMPARE` screen at `/loans/compare` in `screens` and in `menu()` (`app.ts:35-42`), so the sidebar and the phone drawer show Overview and Compare. The checks that screenshot each app's menu will move with it.
- **Ways in:** a button by the what-if on the bank loan page (`bankLoans/presentation/BankLoanScreen.vue:175`) opening `/loans/compare?loan=<uuid>` with the loan as the base, and one beside the add buttons in the Overview header (`OverviewScreen.vue:57-60`) for offers with no loan behind them.

Shared components that fit:

| Component                                                                                           | Use on the screen                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardGrid` (`src/shared/ui/DashboardGrid.vue:15`)                                              | `tiles` for the headline differences, `pair` for chart beside chart, `cards` for one card per scenario                                                                                                                                                                                                        |
| `KpiTile` (`src/shared/ui/KpiTile.vue:23-37`)                                                       | "Interest saved" or "Paid off sooner" against the base, with a `KpiDelta` and `higherIsBetter: false` for costs (`KpiTile.vue:2-9`)                                                                                                                                                                           |
| `ChartCard` (`src/shared/ui/ChartCard.vue:35-72`)                                                   | the multi-line balance chart and the cost bars, with its built-in table view                                                                                                                                                                                                                                  |
| `FigureTable` (`src/shared/ui/FigureTable.vue:1-11`)                                                | the comparison grid, measures down and scenarios across. Its container breakpoints drop columns on a phone. Pay scenarios' comparison shows the base beside one picked scenario below `lg` (`src/apps/company/packs/hr-doo/presentation/payScenarios/ScenarioComparison.vue:12-35`), a pattern worth copying. |
| `FactGrid` (`src/shared/ui/FactGrid.vue:4-19`)                                                      | each scenario card's instalment, payoff, interest and your share                                                                                                                                                                                                                                              |
| `ProgressMeter` (`src/shared/ui/ProgressMeter.vue:2-23`)                                            | each scenario's cost split, subsidy striped. `PaymentSplitFigures.vue:14-18` already pairs a meter and facts for one `PaymentSplit` and can be reused per scenario as it is.                                                                                                                                  |
| `FormGrid` and `AppDialog` (`src/shared/ui/FormGrid.vue:8-13`, `src/shared/ui/AppDialog.vue:13-23`) | the scenario editor, reusing `RateFields` and `SubsidyFields` from `BankLoanDialog.vue:20-23`                                                                                                                                                                                                                 |

## Performance

Measured with Node 24 on an Apple M4 Max, importing the HEAD sources directly, on a made-up 150,000.00 loan with a five-year subsidy. Each figure is the mean of 50 to 200 runs after warm-up.

| Work                                                  | 240 instalments | 360 instalments |
| ----------------------------------------------------- | --------------- | --------------- |
| Plan, one fixed rate                                  | 0.38 ms         | 0.56 ms         |
| Plan, a new rate every year after year 5              | 0.40 ms         | 0.62 ms         |
| Plan, 100.00 extra every month, shorter term          | 1.07 ms         | 1.62 ms         |
| Plan, 100.00 extra every month, lower instalment      | 1.24 ms         | 2.47 ms         |
| What-if panel (three plans)                           | 1.16 ms         | 1.89 ms         |
| `bankLoanMonths` (balance chart rows)                 | 0.46 ms         | 0.81 ms         |
| One scenario: plan, figures, month rows, yearly split | 0.88 ms         | 1.56 ms         |
| Four scenarios, one with monthly overpayments         | 4.3 ms          | 7.5 ms          |

What this means:

- The engine needs no debounce. A phone is slower than this machine by an unmeasured factor. Even at several times slower, rebuilding one scenario stays well under a frame.
- Give each scenario its own `computed` over its own inputs. Vue then rebuilds only the edited one, so a keystroke costs one plan, not four. Parse into a value that is null while the input is wrong, as `WhatIfPanel.vue:35-39` does, so half-typed amounts build nothing.
- Reuse `book.plan` for the base instead of rebuilding it per call, as `whatIf.ts:49` does today.
- `bankLoanMonths` is the slowest figure because `balanceOn` filters the whole plan for every month (`loanFigures.ts:14`, `bankLoanView.ts:141`). One walk over the rows would make it linear if several 360-month lines ever lag.
- The cost not measured here is ECharts redrawing several 360-point lines on each change (`ChartCanvas.vue:111`). If that lags on a phone, debounce the chart's input alone by a short delay and leave the figures live. The repo has no debounce helper today.

## Decisions this lane leaves open

- **Where scenarios live.** In the page with the inputs in the address, gone from other devices, against new kinds in the Loans file, kept everywhere at the cost of the storage work above. Reusing `bank-loan` with a flag is the option to avoid.
- **Fees and an effective rate.** Whether the first version compares on interest and what you pay only, or also takes fees and works out an effective rate, which needs a solver.
- **Term change.** Whether to model it as a refinance into the same bank, which needs no engine change, or as an event inside the plan.
