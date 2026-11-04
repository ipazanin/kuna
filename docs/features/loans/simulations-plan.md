# Loan scenarios: try changes to a loan, compare offers

How Kuna Loans gets a Scenarios screen that tries extra payments, rate changes and a move to another bank against a loan, and compares offers you are weighing, from three research lanes checked against 755e1ed, with the one decision it needs from the owner.

From three lanes in `research/simulations/`: [the codebase](research/simulations/lane1-codebase.md), [the loan mechanics](research/simulations/lane2-mechanics.md) and [the design](research/simulations/lane3-design.md), with the mockup (not published). Read against the repo at `755e1ed`. Every path below is under `src/apps/loans/` unless it says otherwise. Every figure is made up, except HPB's public representative examples.

The plan engine already does most of the work. `loanPlan` is a pure function of plain values (`bankLoans/domain/loanPlan.ts:60`), so a scenario is the loan's own inputs plus some changes, run through the same engine. I ran lane 2's worked examples through the HEAD engine and every figure came out to the cent. What is new is a scenario type, a way to keep scenarios, one screen, an editor, and two figures the app has no way to work out today: the effective rate of an offer and what is left over when spare money earns interest.

This wave waits for language stage 2, since both touch the Loans words files. It starts when the owner has reviewed this plan and answered the one decision at the end.

## What the owner asked, 2026-10-29

"For Loans app I want you to also add feature for different loan simulations and comparisons. Add it to the queue, with research and detailed implementation."

## What you will see

- **A Scenarios screen in the Loans menu,** under Overview. One tab per bank loan, named after the loan, and an **Offers** tab for loans you are weighing but do not have.
- **On a loan's tab,** the loan as it stands is always **A**, in the brass the bank loan screen uses for the plan still to come. Pick up to three of your scenarios beside it, **B** to **D**, and choose which one the others are compared against.
- **A card per scenario** with when it is paid off, the interest left and what you pay in all, each with the difference to the base under it ("2 y 7 m sooner", "€10,991.19 less").
- **Two charts,** "Owed over time" and "Interest from today", one line per scenario with its letter at the line's end.
- **Against the base:** how much less you pay and how much sooner each scenario is paid off, as short bars.
- **Side by side:** next instalment, highest instalment, instalments left, paid off, interest left, extra you put in, costs, what the subsidy pays and **You pay in all**. A tick marks the best of a line when one scenario alone holds it. The figure under each is the difference to the base. On a phone each line keeps all four figures, two by two.
- **"What your savings earn"**, an optional rate above the table. Fill it in and a last line shows how much each scenario leaves you ahead or behind by the earliest payoff date, counting what the spare money would have earned. It answers "pay extra now, or keep the money", which interest saved alone gets wrong.
- **Four kinds of change:** an extra payment, a regular extra payment ("€150.00 every month from April 2030"), a rate change from a due date, and a move to another bank (date, new rate, new number of instalments, costs). A move shows the month its costs are paid back.
- **An editor** with the changes on the left and the outcome against the base on the right, worked out as you type. On a phone the outcome follows the changes and the dialog's foot repeats its headline beside Save.
- **Offers:** an offer has the bank loan form's fields (amount, payout, first instalment, instalments, rate periods, an optional subsidy) plus its costs. Offers are compared over the whole loan, with **Kuna's estimate of the EKS** beside the one the bank printed, when you type that in.
- **Warnings where the figure is:** "B means paying the subsidy back" with the date and what the subsidy has paid so far. "This date has passed" on a change dated before today. "Variable from Mar 2028, an estimate" on the charts.
- **What if I pay extra stays** on the bank loan screen, with **Save as scenario** and a link to Scenarios. Its "Interest saved" becomes the interest you no longer pay, leaving out what the subsidy would have paid.
- **Nothing on the Overview, the tiles or the home card changes.** Scenarios and offers are never counted as loans.

## Settled without asking

- **The screen is called Scenarios, at `/loans/scenarios`.** It holds the comparison and the list, as Pay scenarios does. The menu entry is the way in from the Overview, so the Overview header gets no extra button.
- **Informal loans get no scenarios.** They have no plan to change.
- **A loan's scenarios are compared from today, offers over their whole loan.** The past is the same in every scenario of a loan, so counting it hides the difference. Offers have no past.
- **A on a loan's tab is always the loan as it stands, always shown.** Letters and colours stay with a scenario while it stays picked: unpicking B leaves C and D as they are, and the next pick takes the free slot. Changing the base moves the "Base" mark, not the letters.
- **A change dated before today counts from the first due date after today,** with "This date has passed" on its card. A regular extra payment drops the payments before today. A loan's scenario never rewrites the past, so "owed today" is the same in every column.
- **A move happens on a due date, after that day's instalment,** as a rate period does. The old loan then needs no interim interest. The new loan's first instalment falls one month later, with no interim interest, and the number of instalments starts at the old loan's instalments left. Lane 2 shows a longer new term is the classic refinance trap, so the honest comparison is the default and a longer term is a choice you make.
- **A term change with the same bank is a move with no costs.** It gives the same figures and needs no change inside the engine loop (`loanPlan.ts:106-110`).
- **One move per scenario.** Two refinances are two scenarios.
- **Costs belong to the loan that charges them:** an offer's, or the new loan's after a move. Each has a one-off amount, a monthly amount and a yearly amount. They are paid on their dates and never borrowed. A housing loan signed since 20 October 2017 has no processing fee and no early repayment fee (lane 2), so the old loan's side of a move has no cost field.
- **Costs and the EKS are in the first version.** Lane 2 shows a refinance or an offer is only compared honestly with every one-off cost counted. Its EKS method reproduces all four of HPB's printed rates (I re-ran it against the HEAD engine), so the solver is small and proven. It is labelled "Kuna's estimate", shown on offers only, and leaves the subsidy out, as the bank's EKS does.
- **Lead with what you pay.** "You pay in all" is principal, interest, extra and costs, less what the subsidy pays. Against the base shows the difference in it, so costs and the subsidy are already inside and the bar needs no footnote.
- **The subsidy payback is left out of the total, and named.** Kuna does not know the amount, and lane 2 could not confirm from the law that a voluntary early repayment triggers it. The warning gives the last day the contract's rule covers and what the subsidy has paid by the change's date, as the most it could be.
- **No tick on interest or the total across offers of different terms.** A shorter term always shows less interest (lane 2). The card says so and points to the savings rate. Loan scenarios keep their ticks, since "Extra you put in" sits on its own line beside them.
- **No "each extra euro saves" line** (lane 3 dropped it, lane 2 explains why it misleads).
- **No rate cap figure and no index-plus-margin generator.** Kuna stores a variable rate's index and margin only as free text (`workbook/domain/ratePeriod.ts:7`), and the HNB cap moves twice a year. A rate change takes the rate you type, repeated for a path, with "+1 point" and "+2 points" quick fills over the rate in force on that date. Its hint says the law caps a variable EUR housing loan rate at each reset.
- **No subsidy extension change.** How APN recalculates is unconfirmed (lane 2). When an extension happens, the real subsidy record is edited.
- **An offer's interim interest is the bank's figure or none,** as on the bank loan form. Day counting for a mid-month drawdown is unconfirmed (lane 2), so Kuna does not guess.
- **No "Make it real" from a scenario.** Nobody asked for it. What if I pay extra keeps its Apply.
- **What if I pay extra stays and gains Save as scenario** (lane 3's recommendation). The quick try stays one card away, and scenarios are one tap further.
- **Its "Interest saved" becomes interest you pay.** Today it sums interest whoever pays it (`bankLoans/domain/whatIf.ts:39-41`), so a payment during the subsidy claims savings the subsidy would have had. One way of counting across the panel and the screen.
- **On a phone, Side by side shows all four, two by two** (lane 3's recommendation). The table moves to `src/shared/ui`, so Pay scenarios' phone table changes the same way and its "Beside the base" buttons go (`company/packs/hr-doo/presentation/payScenarios/ScenarioComparison.vue:26-35`, `:57-69`). One table, one narrow layout.
- **Scenario colours** are four aliases, `--scenario-1` to `--scenario-4`: `--loan-ahead`, `--series-3`, `--series-5` and `--series-6`, the only set lane 3 found to pass the palette check in both themes. Two pairs sit in the warning band, so the letter is on every mark. Text stays in ink.
- **"Against the base" bars are plain HTML,** as the mockup draws them. Two short groups need no chart engine.
- **No debounce.** Four full scenarios take about 7.5 ms on the machine lane 1 measured. Each compared scenario gets its own `computed`, so a keystroke rebuilds one plan. If the charts lag on the owner's phone, debounce the chart input alone.

## How it is built

A new feature folder, `scenarios/`, with `domain/`, `application/` and `presentation/`, beside `bankLoans/`.

### The scenario

`scenarios/domain/loanScenario.ts` holds the types.

```ts
/** What a loan charges beside its instalments, paid on its own dates. */
export interface LoanCosts {
  readonly upfront: Money
  readonly monthly: Money
  readonly yearly: Money
}

/** A scenario starts from a bank loan in the file, or from an offer's own terms. */
export type ScenarioStart = { readonly kind: 'loan'; readonly loan: RecordId } | { readonly kind: 'offer'; readonly terms: OfferTerms }

export interface LoanScenario {
  readonly id: RecordId
  readonly name: string
  readonly start: ScenarioStart
  readonly changes: readonly ScenarioChange[]
}
```

`OfferTerms` is `BankLoan`'s `lender`, `principal`, `drawdown`, `firstInstalment`, `instalments`, `interimInterest` and `subsidy` (`workbook/domain/bankLoan.ts:22-33`), plus `costs: LoanCosts` and `bankEks: YearlyRate | null`. `ScenarioChange` is a union of the four changes below, each with a `kind`.

| Change                | Fields                                                                                         | Reaches the engine as                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Extra payment         | `date`, `amount`, `effect`                                                                     | One `ExtraPayment` (`workbook/domain/extraPayment.ts:9-15`)                                                    |
| Regular extra payment | `from` (a due date), `every` (`month` or `year`), `until` (a date or none), `amount`, `effect` | One `ExtraPayment` on each due date from `from`, every month or every 12th, up to `until` or the last due date |
| Rate change           | `from` (a due date), `rate`, `rateType`                                                        | One `RatePeriod` (`workbook/domain/ratePeriod.ts:8-16`)                                                        |
| Move to another bank  | `on` (a due date), `lender`, `rate`, `rateType`, `instalments`, `costs`                        | The old plan up to `on`, then a second `BankLoan` drawn on `on`                                                |

An offer's rate periods are rate changes, the first at its first instalment.

### Working a scenario out

`scenarioPlan(start, changes, today)` in `scenarios/domain/scenarioPlan.ts` returns a `ScenarioPlan` or a refusal with its reason. `start` is a `BankLoanBook`'s loan, rate periods and extra payments for a loan scenario (`workbook/domain/readLoanBook.ts:54-60`), or an offer's terms turned into a `BankLoan` with a made-up id, the way the what-if makes its extra payment (`whatIf.ts:51`). In order:

1. **Dates before today, loan scenarios only.** A change dated before `today` counts on the first due date after it and is marked `passed`. A regular extra payment drops its payments before today instead.
2. **Rate changes** become rate periods with made-up ids. One on a date the loan already has a period on replaces it. A `from` that is not a due date of the plan it applies to refuses the scenario ("3 Mar 2028 is not a due date of Home loan"). The engine would silently ignore it (`loanPlan.ts:61`, `:106`), and only the reader refuses one today (`readLoanBook.ts:125`).
3. **Regular extra payments** become extra payments on due dates. A payment due on an instalment's day lands after that instalment (`loanPlan.ts:117`), and any after the balance reaches zero are dropped by the engine (`loanPlan.ts:79`).
4. **A move.** `on` must be a due date of the plan it leaves, before its payoff. The old part is `loanPlan` over the loan with the periods and extra payments up to `on`, keeping the rows dated on or before `on`. The balance after them is the new loan's principal. The new loan is drawn on `on`, its first instalment `dayMonthsLater(on, 1)`, its instalments from the move, with no interim interest and no subsidy, a period at its first instalment at the move's rate, and the scenario's rate changes and extra payments after `on`. The scenario's rows are the old part then the new loan's rows. No row pays the old balance off, since the new bank pays it, so each euro you pay counts once and the balance line never drops to zero at the move.
5. **Offers** need a rate change at their first instalment, or they are refused with the reason the bank loan screen gives (`bankLoans/presentation/words.ts:12-13`). This is the check `loanPlan` would otherwise throw on (`loanPlan.ts:63-66`).
6. **Costs** become dated costs: the one-off amount on the drawdown or on `on`, the monthly amount with every payment that loan schedules (its interim interest and each instalment), and the yearly amount on the drawdown or `on` and every 12 months after, once per started year of instalments. These timings reproduce HPB's printed EKS (stage 7).

`ScenarioPlan` holds `rows: PlanRow[]`, `costs: { date, amount }[]`, the rate periods each part used (for the estimate marks) and the move's date, or null. The subsidy needs nothing: it pays by instalment number (`loanPlan.ts:43-46`), so it stops when the old loan's instalments stop.

### Its figures

`scenarioOutcome(plan, from)` in `scenarios/domain/scenarioOutcome.ts`, where `from` is today for a loan's scenario and null for an offer's whole loan:

| Figure                    | How                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next instalment           | The first instalment row after `from`                                                                                                             |
| Highest instalment        | The largest instalment after `from`, marked an estimate when it falls in a variable period                                                        |
| Instalment after the move | The new loan's first instalment, null without a move                                                                                              |
| Instalments left          | Instalment rows after `from`                                                                                                                      |
| Paid off                  | `payoffDate` (`bankLoans/domain/loanFigures.ts:23-25`)                                                                                            |
| Interest, extra, subsidy  | `interestOf`, `extra` and `subsidyShareOf` of `paymentsAfter(rows, from)`, or of `splitOfRows(rows)` for an offer (`loanFigures.ts:60-112`)       |
| Costs                     | The dated costs after `from`                                                                                                                      |
| You pay in all            | `yourShareOf` of the same split, plus the costs (`loanFigures.ts:75-77`)                                                                          |
| Variable from             | The first instalment after `from` in a variable period, as `bankLoanView.ts:111` marks one                                                        |
| Subsidy payback           | When the scenario's earliest extra payment or move falls on or before `subsidyRepaidUntil(loan)`: that date and the subsidy paid up to the change |

`subsidyRepaidUntil(loan)` moves the 24-month rule out of `whatIf.ts:15-16` and `:61-63` into `loanFigures.ts` beside `subsidyLastCovered` (`:139-141`), so the what-if and the scenarios share one rule.

`moveBreakEven(withMove, withoutMove)` gives the first month end after the move by which what you have paid since the move, costs included, is no more than the same scenario without the move would have cost. It takes the two outcomes' rows and costs. The caller builds the scenario without its move.

`whatIfExtraPayment` (`whatIf.ts:48`) takes the `BankLoanBook` and reads its `plan` instead of rebuilding it (`:49`). It builds each tried payment as a one-change scenario and reports interest saved as the difference in interest you pay (`PaymentSplit.interest`). Its private `instalmentCount` and `interestOf` go (`:35-41`), which also ends the clash with `loanFigures.ts`'s `interestOf` of a split (`:90-92`).

### Comparing

`compareScenarios(outcomes, base, tab)` in `scenarios/presentation/scenarioComparison.ts` gives the columns and the lines, shaped like `comparedScenarios` (`company/packs/hr-doo/presentation/payScenarios/payScenariosView.ts:205-245`):

- **Instalments:** next instalment, highest instalment, instalment after the move (only when a compared scenario moves), instalments left, paid off.
- **What it costs:** interest left, extra you put in, costs, subsidy pays, You pay in all (the total).
- **Offers add** instalments in all in place of instalments left, Kuna's EKS estimate, and the EKS the bank printed when any offer has one.
- **Each line has a better direction:** lower, earlier, fewer or none. Extra you put in, subsidy pays and the bank's EKS have none. A line every scenario holds at zero drops. A tick only marks a best one scenario alone holds (`payScenariosView.ts:218-219`). On Offers, when instalment counts differ, interest and the total carry no tick.
- **Cells carry formatted text:** the figure, `best`, and the difference to the base ("−€5.33", "2 y 7 m sooner", "−31"), null in the base's column.

`useScenarioCompare(tab)` in `scenarios/presentation/` reads `?tab=`, `?compare=`, `?base=` and `?savings=`, as Pay scenarios keeps its choice in the address (`PayPanel.vue:71-91`). `?compare=` keeps a scenario's slot while it stays picked, with an empty entry for a freed slot. Each compared scenario is its own `computed` over its plan, outcome and month rows.

### The charts

- `scenarioMonths(plan, from)` gives each month end's balance and the interest from `from` so far, in one walk over the rows. `bankLoanMonths` calls `balanceOn` for every month, which filters the whole plan each time (`bankLoans/presentation/bankLoanView.ts:137-142`, `loanFigures.ts:14`).
- `scenarioBalanceChart` and `scenarioInterestChart` in `scenarios/presentation/scenarioCharts.ts` draw one 2 px line per scenario in its `--scenario-N` through `tokenColour` (`src/shared/charts/chartTokens.ts:79-82`). The base draws last. Letters sit at the line ends, joined when two end in the same month. The interest chart puts each letter and total at the right edge, pushed apart so close totals do not overlap. A dashed hairline marks the first variable month on a wide screen, and the footer notes it on a phone. Year ticks use `yearStep` (`balances/presentation/balanceChart.ts:32-35`), with `axisTooltip` and `moneyAxisLabel` as the balance chart uses them.
- Both sit in `ChartCard` with its table view and a written description naming every payoff and total (`src/shared/ui/ChartCard.vue`).

### Left over, at what your savings earn

`leftOver(plans, base, savingsRate)` in `scenarios/domain/leftOver.ts`. The horizon is the earliest payoff among those compared. For each scenario, add up everything you pay up to the horizon (your share of each row plus its costs), each grown at the savings rate over 12, monthly, for the whole months to the horizon, and add what the scenario still owes then. A scenario's figure is the base's sum less its own. Above zero, it leaves you that much more. Lane 2's example, 150,000 at 3.5% over 240 or 360 instalments, gives the 30-year loan −10,225.36 at 2%, 0.11 at 3.5% and +12,600.07 at 5% against the 20-year one with the HEAD engine, which is lane 2's "about 10,200 worse, even, about 12,600 better".

### The effective rate

`effectiveRate(principal, drawdown, rows, costs)` in `scenarios/domain/effectiveRate.ts` solves for X so that the principal on the drawdown equals every payment and cost discounted at (1 + X) to the power of minus t. t is whole months over 12 plus the days left over 365, from the drawdown (lane 2, from Directive 2014/17/EU Annex I). Bisection between 0 and 100%, rounded half up to two decimals, returned as a `YearlyRate`. Rows count their full payment, so the subsidy stays out. Floating point is fine here, since the figure is an estimate and money stays in cents everywhere else.

### Keeping scenarios (if the owner picks the Loans file)

Two new kinds in `workbook/domain/loanKinds.ts:9-14`.

| Kind              | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loan-scenario`   | `name`, `loan` (the bare UUID of the bank loan it changes, blank for an offer). An offer also has `lender`, `principal`, `drawdown`, `first_instalment`, `instalments`, the optional interim interest pair and subsidy fields as on `bank-loan`, `upfront_costs`, `monthly_costs`, `yearly_costs` and the optional `bank_eks`. A scenario of a loan with offer fields, or an offer missing one, is refused.                              |
| `scenario-change` | `scenario` (the scenario's bare UUID), `change` (`extra-payment`, `regular-extra-payment`, `rate-change` or `move`), then by change: `date`, `amount`, `effect` for an extra payment. `date` (the first), `every` (`month` or `year`), optional `until`, `amount`, `effect` for a regular one. `date`, `rate`, `rate_type` for a rate change. `date`, `lender`, `rate`, `rate_type`, `instalments` and the three cost fields for a move. |

- **Reading.** A reader and codec per kind in `workbook/domain/`, like `extraPaymentReading.ts:13-34`. A `scenario` field read the way `namedLoanId` reads `loan` (`workbook/domain/loanReference.ts:8-14`). The codecs join `LOANS_CODECS` (`workbook/application/loansCodecs.ts:10`). Two parts join `LoansRecords`, `LOAN_PARTS` and `loansRecordsOf` (`readLoanBook.ts:19-48`), and `LoanBook` gains `scenarios` (`:72-78`).
- **Rules across records,** in `readLoanBook`: a scenario names a bank loan that counts ("names no bank loan in the file"), a change names a scenario that counts, and a scenario has at most one move. Due-date rules wait for the scenario to be worked out, since moving a loan's first instalment moves its due dates, and a write to a real loan must never be refused over a scenario.
- **Writes** in `scenarios/application/scenarioWrites.ts`: `LOAN_SCENARIO_WRITES` and `SCENARIO_CHANGE_WRITES`, shaped like `bankLoanWrites.ts:16-48`. The editor's Save writes the scenario and replaces its changes in one write, so one Undo puts it back. Copy writes a new scenario with copies of its changes. Delete removes both, with an Undo toast.
- **Deleting a loan** deletes its scenarios and their changes in the same write: `removeBankLoan` (`bankLoans/application/bankLoanWrites.ts:51-56`) removes them, and `BANK_LOAN_WRITES` reads the scenario kinds and lists the scenario part among its dependents (`:13`, `:21`), so a write that would leave one naming nothing is refused (`workbook/application/loanWriteGuards.ts:23-38`).
- **No leak into the loans.** The Overview, its tiles and the home card read `bankLoans` only (`overview/presentation/OverviewScreen.vue:35-40`, `home/presentation/loansHomeCard.ts:17-23`).
- **The schema stays `{ loans: 1 }`** (`workbook/infrastructure/loansDocument.ts:11`). An older app keeps kinds it does not know (`src/shared/storage/infrastructure/documentRecordStorage.ts:111`). If an older app on another device deletes a loan, its scenarios stay, and the new app reports them as naming no bank loan.
- **Sync needs nothing.** The records ride the same file and save (`sync/presentation/loansSyncGroup.ts:7-15`).

If the owner picks this device only, the table above becomes the shape of one JSON value under `kuna.loan-scenarios` in local storage, read and written in `scenarios/infrastructure/scenarioDrafts.ts` with every access in try/catch and the same readers. Copy and Delete stay, Undo goes, and stage 4 shrinks to that file and its test.

### Screens and components

| Piece                    | Where                                                     | What                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route and menu           | `overview/presentation/loanLinks.ts:9-11`, `app.ts:35-42` | `SCENARIOS_ROUTE = '/loans/scenarios'` and `scenariosLink(loan)`. A `SCENARIOS` screen with `i-lucide-scale` in `screens`, and `menu: () => [OVERVIEW, SCENARIOS]`.                                                                                                                                                                                                                              |
| `ScenariosScreen.vue`    | `scenarios/presentation/`                                 | `PageHeader` with New scenario, `PageTabs` (one per bank loan with a plan, then Offers, each with its count), `ScreenSkeleton` while the file opens. A loan without a plan shows the bank loan screen's warning. A paid-off loan keeps its tab while it has scenarios, with "Paid off on (date)".                                                                                                |
| `ScenarioCompare.vue`    | same                                                      | One tab: the picker, the cards in `DashboardGrid layout="cards"`, the two charts in `layout="pair"`, Against the base, the savings field and Side by side, then the list. With no scenarios, `EmptyState` "Only the loan as it stands" with New scenario and "Try €5,000 extra next month".                                                                                                      |
| `ScenarioCard.vue`       | same                                                      | Mark, name, one line of its changes, badges ("Base", "Subsidy back"), a `FactGrid` of paid off, interest left and you pay in all with differences, a 3 px top rule in its colour. A scenario Kuna cannot work out shows its reason in place of the facts and drops out of the charts and the table, with an alert naming it.                                                                     |
| `AgainstBaseCard.vue`    | same                                                      | Two bar groups, "You pay less" and "Paid off sooner", one bar per scenario, the figure in ink at its end.                                                                                                                                                                                                                                                                                        |
| `ScenarioList.vue`       | same                                                      | "Your scenarios for (loan)": every kept scenario with its mark or "Not compared", its changes and what it changes against the base, and Edit, Copy and Delete.                                                                                                                                                                                                                                   |
| `ScenarioMark.vue`       | same                                                      | A letter in ink beside a 14 by 3 px rule in the scenario's colour. Only Loans letters its scenarios, so it stays in the app.                                                                                                                                                                                                                                                                     |
| `NewScenarioDialog.vue`  | same                                                      | From a loan you have (a select of bank loans) or From blank, and a name. Next opens the editor.                                                                                                                                                                                                                                                                                                  |
| `ScenarioEditor.vue`     | same                                                      | `AppDialog` at `width="3xl"`, full screen on a phone. The name, the changes as bordered blocks that open to their fields in a `FormGrid`, an Add a change row, and the outcome card with a two-line sparkline and four facts. Due-date fields are lists of due dates, as `RatePeriodDialog.vue:38-39` builds one. The phone foot repeats the headline ("C, Aug 2043, €10,440.74 less interest"). |
| `OfferTermsFields.vue`   | same                                                      | The offer's terms with `RateFields` and `SubsidyFields` (`bankLoans/presentation/BankLoanDialog.vue:20-23`) and the three cost fields. The field parsing and errors move out of `BankLoanDialog.vue:73-123` into `useLoanTermsFields`, which both forms use, so the checks are not copied a third time.                                                                                          |
| `ScenarioComparison.vue` | moves to `src/shared/ui/`                                 | From `company/packs/hr-doo/presentation/payScenarios/`. Cells take formatted text, `best` and a difference. A `#column` slot lets Loans put the mark in the header. Below 640 px each line's label runs across and its figures sit two by two under it, each with its column's name. Pay passes its build-up through `@open(line, column)`, since its figures open a dialog and Loans' do not.   |
| `ScenarioPicker.vue`     | `src/shared/ui/`                                          | Pay's toggle row and "Compare against" select (`PayPanel.vue:143-171`), with an optional mark slot and the most picked as a prop (`PayPanel.vue:44`). Pay adopts it.                                                                                                                                                                                                                             |
| `WhatIfPanel.vue`        | `bankLoans/presentation/`                                 | Gains Save as scenario (opens the editor with the payment and its effect filled in, and Save goes to Scenarios with it picked) and a Compare scenarios link. Its English strings (`:60-107`) move into `bankLoans/presentation/words.ts`.                                                                                                                                                        |
| Tokens                   | `src/shared/styles/tokens.css:198-200`                    | `--scenario-1` to `--scenario-4` beside the `--loan-*` aliases. No new colour value, so the contrast test stays as it is.                                                                                                                                                                                                                                                                        |

The two shared components each get a row in `.agents/skills/kuna-design/components.md` and a gallery specimen, as `tests/designCatalogue.spec.ts` requires.

### Words

A new `scenarios/presentation/words.ts` with `en` and `hr: Translation<typeof en>`, as every Loans folder has (`bankLoans/presentation/words.ts:7`, `:132`, `:265`). Counted phrases supply `one`, `few` and `other` (`src/shared/text/translation.ts:20-28`). Lane 3's Croatian to start from, checked at 360 px:

| English               | Croatian                   |
| --------------------- | -------------------------- |
| Scenarios             | Scenariji                  |
| As it stands          | Kako je sada               |
| Compare against       | Usporedi s                 |
| Side by side          | Usporedno                  |
| Against the base      | U odnosu na polazni        |
| Move to another bank  | Prelazak u drugu banku     |
| Regular extra payment | Redovita izvanredna uplata |

`PlanCard.vue` keeps its English (`:35`, `:45-46`, `:62-139`) until language stage 2 reaches it, since this wave does not touch it.

## Stages

Each stage is one commit, checked locally with lint, format, typecheck, vitest, both builds and the targeted visual and touch flows, then pushed a few at a time, since CI runs the full suites and takes over an hour. UI stages run as workflows: an Opus agent builds, an independent Opus reviewer checks against the library rules and this plan, a Sonnet agent fixes mechanical findings, and I verify and commit. The design reviewer reports no Critical finding on stages 3, 5 and 6.

1. **The scenario and its figures.** `loanScenario.ts`, `scenarioPlan.ts`, `scenarioOutcome.ts` with `moveBreakEven`, `subsidyRepaidUntil` moved into `loanFigures.ts`, and `whatIfExtraPayment` rebuilt on them. Touches `bankLoans/domain/whatIf.ts`, `loanFigures.ts`, `WhatIfPanel.vue` (the new argument), `scripts/figure-digest.mjs:297`. Proved by `tests/loanScenarios.spec.ts` on lane 2's examples, HPB's four 2025 rows added to `tests/loanPlan.spec.ts`, `tests/loanWhatIf.spec.ts` on interest you pay, and `check:figures` with only the what-if group changed.
2. **Comparison and charts as functions.** `scenarioComparison.ts`, `useScenarioCompare.ts`, `scenarioMonths`, `scenarioCharts.ts`, the four tokens. Proved by `tests/loanScenarioComparison.spec.ts` (directions, single-best ticks, the Offers term rule, slots kept through an unpick) and the two builders in `tests/loanCharts.spec.ts`.
3. **The shared table and picker.** `ScenarioComparison.vue` and `ScenarioPicker.vue` into `src/shared/ui`, the two-by-two narrow layout, Pay adopting both, catalogue rows and specimens. Proved by `tests/payScenariosView.spec.ts` unchanged, Company's figure digests unchanged, the Pay flow at `scripts/touch-check.mjs:946-952` rewritten to find four figures per line at 360 px, `tests/designCatalogue.spec.ts`, and Pay's screenshots at 360, 768 and 1440 px.
4. **Keeping scenarios.** The two kinds, readers, codecs, parts, cross-record rules, writes, `removeBankLoan`, the fake sample with three scenarios for Home loan (an extra payment, a regular one, a move) and two offers (`workbook/infrastructure/fake/fakeLoans.ts`), the README kinds table ("six kinds" at README line 2070 becomes eight) and a Scenarios paragraph. Proved by `tests/recordStorageContract.spec.ts` (both kinds in `LOANS_WRITES` at `:592`, fixtures from `:462`, the count at `:614` from 6 to 8), `tests/kindNames.spec.ts`, reader cases in `tests/loanReaders.spec.ts`, write cases in `tests/loanWrites.spec.ts`, and `check:figures` with the Overview and home groups unchanged.
5. **The Scenarios screen.** Route, menu, screen, compare, cards, charts, Against the base, Side by side, list, states, words in both languages. Proved by new visual pages `loans-scenarios`, `loans-scenarios-offers`, `loans-scenarios-empty` and `loans-scenarios-croatian` on `?loans=sample`, the menu checks moved for the second entry, touch flows for the picker, the base select and Delete with Undo, and a `loans.scenarios` group in `loansGroups` (`scripts/figure-digest.mjs:285`).
6. **The editor and the what-if.** New scenario, the editor, the four change blocks, the offer fields with `useLoanTermsFields`, Save, Copy and Delete, Save as scenario and the link on the what-if, its words. Proved by the editor in `loansDialogsFlow` at every width, a touch flow that types a regular extra payment at 360 px and reads the foot's headline change, and the bank loan dialog's existing flows unchanged.
7. **Stop for the owner's review** on the live site.
8. **Left over and the EKS.** `leftOver.ts`, `effectiveRate.ts`, the savings field in `?savings=`, the line in Side by side, the EKS lines on Offers. Proved by `tests/leftOver.spec.ts` on lane 2's 20 against 30 years at 2%, 3.5% and 5%, and `tests/effectiveRate.spec.ts` on HPB's four rows and a cost-free 3.00% loan at 3.04%.

## Proof

- `loanPlan` reproduces HPB's four 2025 representative examples, €120,000 over 360 instalments: 498.83, 511.77, 538.18 and 551.66 a month, with 59,580.75, 64,235.92, 73,747.32 and 78,598.28 of interest. I ran these through the HEAD engine.
- `effectiveRate` gives HPB's printed 3.38%, 3.21%, 3.98% and 3.80% with lane 2's timings: drawdown on 1 January, interim interest a month later, 360 instalments from the month after, 2.00 up front, 33.18 a year for 30 years, 1.89 a month on the two client rates (2.89% and 3.09%) and 5,472.00 of credit insurance up front on the two insured rates (2.89% and 3.49%). Which row carries which fee follows from the 0.60-point client and 0.20-point insurance gaps, and the build stage re-reads it from HPB's sheet. A bisection over the HEAD engine's rows gave all four.
- Lane 2's made-up examples pass with the HEAD engine as they stand. Extra 10,000 on 100,000 over 240 at 3.5%: 579.96 for 207 instalments and 9,191.13 saved, or 521.96 for 240 and 3,918.56 saved. 100,000 over 300 at 3.70% is 511.41, then 622.15 at 5.70% or 518.79 at 3.84% a year later. A move from 120,000 at 4.2% to 3.4% over 216 instalments with 1,500.00 of costs saves 49.14 a month, pays its costs back in month 31 and cuts interest from 51,222.18 to 40,607.01.
- Company's figure digests unchanged on the four fake sets and the live file. Loans' unchanged apart from the what-if group and the new scenario groups.
- The Overview, its tiles and the home card show the same figures with scenarios and offers in the sample.
- The Scenarios screen matches the mockup at 360, 768 and 1440 px in both themes, and in Croatian at 360 px.
- No design reviewer finding marked Critical.

## Decisions for the owner

### Where scenarios are kept

This affects the Scenarios screen's list of kept scenarios and the Offers tab. Say you type a made-up offer from Bank Jadran on the laptop in the evening: 140,000.00 at 2.95% over 300 instalments with 800.00 of costs. The next day at the bank you open Kuna on the phone to hold it against the offer they hand you.

- **Keep them in the Loans file.** The offer is on the phone, in the export and in Drive's backups, and every save has Undo like any other record. Offers sit in the same file as your loans but are never counted as one. Cost: two new record kinds, about a dozen files, the storage contract test and the README kinds table (stage 4). Company already keeps Pay scenarios in its file this way (`company/packs/hr-doo/domain/hrDooKinds.ts:15`).
- **Keep them on this device only.** Stored in this browser's local storage. Nothing about the Loans file changes. Cost: the phone does not have the laptop's offer, a cleared browser or a private window loses them, Delete has no Undo, and Kuna keeps scenarios two different ways across its apps. Stage 4 shrinks to one file.

Recommendation: keep them in the Loans file. Which should it be?

## The owner's answer, 2026-10-30

- **Where scenarios are kept:** in the Loans file, as recommended.
- **The review stop in stage 7 is skipped.** The owner reviews the queue together later, so stage 7 becomes a report and stage 8 follows straight on.
