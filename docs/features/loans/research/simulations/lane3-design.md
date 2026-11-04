# Loans simulations lane 3: presentation and a design for Kuna

What Croatian bank calculators, HNB's offer list and international loan comparison tools ask, show and get wrong, and a proposal for a Scenarios screen in Kuna Loans built from Kuna's own components, tokens and the Pay scenarios pattern, with a mockup.

The mockup (not published) shows the proposal at 360 px and 1440 px, light and dark from the system setting with a toggle. Every figure in it and below is made up: a €120,000 flat loan from April 2023, 300 instalments, 3.40% fixed then 3.90% variable from March 2028, with a €150 monthly subsidy for its first 60 instalments. Repo references are to HEAD `755e1ed`.

Sibling lanes: [lane 1, the codebase](lane1-codebase.md) and [lane 2, the loan mechanics](lane2-mechanics.md). The Loans screens this builds on are in [lane3-loans-design.md](../../../platform/research/design/lane3-loans-design.md).

## The short version

- Croatian bank calculators answer one question: what does one of our products cost. Each asks for an amount and a term, sometimes a rate type, and shows one instalment, the rate, EKS, total interest and the total to repay. None takes a loan you already have, an extra payment, a subsidy or a rate path you choose. Only RBA puts two options side by side, and it leaves the subtraction to you.
- HNB's offer list is a real comparison, across every bank, with a "compare selected" button. Its EKS is worked out on each bank's largest amount over 20 years, so it compares banks, not your loan.
- The international tools that compare well share four habits: the same rows for every option, a horizon you choose, a stated assumption (rates do not change, fees go on the loan), and a way to keep a calculation to compare later. None marks the best value per row or names scenarios you can come back to.
- Kuna already has the pattern it needs, in Company's Pay scenarios: up to four picked with toggle buttons, a base you choose, a Side by side table with a tick on the best value and the difference to the base under each figure. Loans should copy it, not invent a second one.
- The proposal is one new Loans screen, Scenarios, with a tab per bank loan and one for offers. On it: the picker, a card per scenario, two charts with a line per scenario (owed over time, interest from today), an Against the base card, Side by side, and the list of kept scenarios. A scenario is built in a dialog with its outcome worked out as you type.
- Scenarios need their own colours. Four pass the dataviz validator in both themes only as the loan brass for the base plus blue, pink and dark green, and only with a letter on every line, since two pairs sit in the warning band.
- Two decisions for the owner at the end: how Side by side shows four scenarios on a phone, and what happens to the What if I pay extra panel.

## What the tools do

I loaded every page below in a browser on 29 October 2026. I did not press a Calculate button on any of them, so where a tool shows its results only after one, the result layout is marked unconfirmed. The bank calculators show a worked default on load, so their outputs are confirmed.

### Croatian banks and HNB

| Tool                                                                                                                               | Asks                                                                                                                                                        | Shows                                                                                                                                                                                                                                              | Compares                                                              | Gets wrong                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Zagrebačka banka, housing loan](https://www.zaba.hr/home/financiranje/stambeni-krediti)                                           | Amount, years (5 to 30), a product: fixed rate, green loan, or with repayment insurance                                                                     | Monthly annuity, rate type, rate, EKS, interest, total to repay                                                                                                                                                                                    | No. One product at a time                                             | Its EKS leaves out valuation, the current account, property insurance and accident insurance, so it is not the EKS of another bank's calculator                                                                                                                                         |
| [PBZ, housing loan](https://www.pbz.hr/gradjani/stambeni-krediti/stambeni-krediti.html)                                            | Amount, months (60 to 360), rate type, with or without a mortgage                                                                                           | Annuity, amount, total to repay, term, rate, EKS, the processing fee                                                                                                                                                                               | No                                                                    | EKS "bez dodatnih troškova", on a fixed rate for the whole term. Says so plainly, but the figure is not comparable with OTP's                                                                                                                                                           |
| [Erste, housing loan](https://www.erstebank.hr/hr/gradjanstvo/krediti/stambeni-krediti)                                            | Two modes: annuity for a chosen home, or the most you can borrow. Flat or house, home value, own share, years, fixed or combined, with or without insurance | Annuity, amount, years, rate, EKS, number of annuities, total to repay, total interest                                                                                                                                                             | No. Fixed and combined are a radio choice, one result at a time       | A combined rate shows one annuity, with nothing about the variable years after the fifth                                                                                                                                                                                                |
| [OTP, housing loan](https://www.otpbanka.hr/gradani/stambeni-kredit-u-eurima)                                                      | Amount, months (12 to 360)                                                                                                                                  | Annuity, total interest, fixed rate, EKS, total to repay                                                                                                                                                                                           | No. Combined-rate offers are in the text below, not in the calculator | Its EKS includes a month of account fees, property insurance, an average valuation and two months of interim interest. The most honest EKS of the five, so it looks dearer next to the others                                                                                           |
| [RBA, housing loan](https://www.rba.hr/hr/gradani/proizvodi-i-usluge/krediti-i-financiranje/stambeni-krediti.html#kalkulator)      | Amount, months (60 to 360)                                                                                                                                  | Two columns side by side: fixed 5 years then variable, and fixed for the whole term. Each: annuity, the annuity after the switch, rates, EKS, number of annuities, interest over the term, total to pay. "Pokaži puni izračun" opens the full plan | Yes, two fixed options with the same rows                             | No difference row. Its default shows the combined option cheaper per month (450,57 against 468,46 EUR) but dearer over the term (38 092,92 against 36 673,44 EUR interest), and the reader has to spot it. The variable part assumes today's rate for the 17 years after the fixed ones |
| [RBA, simple calculator](https://www.rba.hr/widget/web/guest/alati/kalkulator-kredita/-/kreditniKalkulator_WAR_calculatorsportlet) | Amount, rate, years                                                                                                                                         | Monthly annuity                                                                                                                                                                                                                                    | No                                                                    | Nothing else: no total, no plan                                                                                                                                                                                                                                                         |
| [HNB, informativna lista ponude kredita potrošačima](https://www.hnb.hr/informativna-lista-ponude-kredita-potrosacima)             | Currency, loan type, rate type, then tick banks                                                                                                             | One row per bank: largest amount, longest term, EKS, reference rate, margin, early repayment fees, for variable, fixed and combined rates. "Usporedi označeno" compares the ticked rows                                                            | Yes, across every bank                                                | EKS is for each bank's largest amount over 20 years for a housing loan, so it ranks offers, not your loan. OTP links to it from its own page                                                                                                                                            |

What the Croatian tools have in common, and what Kuna can do that they cannot:

- They start blank and stay blank. Not one takes the balance, the rate path or the subsidy of a loan already running.
- EKS is the only "compare me" figure, and each bank puts different costs into it. A comparison in Kuna should lead with euros: what you pay from today, with each cost named, and leave EKS to the offer comparison where [lane 2](lane2-mechanics.md) shows how to work it out the same way for every offer.
- Nothing knows about a subsidy, early repayment rules or a variable rate after the fixed years. Kuna's plan engine already handles the first and third, and `whatIf.ts:15-16` carries the 24-month subsidy rule.

### International tools

| Tool                                                                                                                                                        | Asks                                                                                                                                                                             | Shows                                                                                                                                                                                             | Compares                                                                                       | Gets wrong                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [MoneySavingExpert, overpayment calculator](https://www.moneysavingexpert.com/mortgages/mortgage-overpayment-calculator/)                                   | Debt, term, repayment or interest only, rate or monthly payment, a one-off overpayment, a recurring one with its frequency, or both, optionally a savings rate and your tax band | Results only after Calculate, layout unconfirmed                                                                                                                                                  | Against not overpaying, and optionally against putting the money in savings                    | Warns that most fixed deals cap overpayment at 10% a year, but leaves checking it to you                                                    |
| [MoneySavingExpert, compare two mortgages](https://www.moneysavingexpert.com/mortgages/compare-mortgage-rates/)                                             | Debt, term, type, then for each of two mortgages a rate and fees, and "Compare over" 1 to 10 years                                                                               | "The difference in monthly payment and total costs", layout unconfirmed                                                                                                                           | Two, over a horizon you choose                                                                 | States its assumptions: rates do not change and fees go on the loan. Good. Two at most                                                      |
| [calculator.net, mortgage calculator](https://www.calculator.net/mortgage-calculator.html)                                                                  | Price, deposit, term, rate, start, taxes and costs, and under More options extra payments monthly, yearly and one-off, with more one-off rows                                    | Monthly pay, totals, payoff date, a chart of the payment's parts, and one chart over the years with balance, interest paid so far and payments so far, plus the schedule                          | No second scenario                                                                             | Balance and cumulative sums on one axis, so the falling and rising lines cross and read as one story only to someone who knows amortisation |
| [Zillow, loan comparison](https://www.zillow.com/mortgage-calculator/loan-comparison-calculator/)                                                           | Three columns of amount, term (30 or 15 years fixed, 5-year ARM), rate, start date                                                                                               | After "View comparison", unconfirmed                                                                                                                                                              | Three side by side                                                                             | The ARM is a term choice with no rate path behind it                                                                                        |
| [mortgagecalculator.org, loan comparison](https://www.mortgagecalculator.org/calcs/compare.php)                                                             | Rows of amount, rate, term                                                                                                                                                       | Payment and interest per row                                                                                                                                                                      | "Up to 3 loans", per the page. It suggests filling one row and then changing one thing per row | The right idea, a base plus variations, with no difference shown                                                                            |
| [HSH, mortgage comparison](https://www.hsh.com/mortgage-comparison-calculator.html) and [mortgage calculator](https://www.hsh.com/mortgage-calculator.html) | Two loans of amount, rate, term. The bigger calculator adds three prepayment methods                                                                                             | Rows of monthly payment, total payment, total interest, amount, rate, period. The bigger one has "Compare with another loan" and a "View Comparison" count, so you collect calculations as you go | Two, or up to four through the collected comparison                                            | Collecting is the closest any tool comes to keeping scenarios. Whether it survives a reload is unconfirmed                                  |

Bankrate's [loan comparison calculator](https://www.bankrate.com/loans/loans-comparison-calculator/) came up in search but showed a human check, which I did not pass. Unconfirmed, and not used.

## What fits Kuna

- **Same rows, a base, the difference under each figure.** RBA and HSH show that rows line up well. Nobody shows the difference. Pay scenarios already does (`ScenarioComparison.vue:92`).
- **A best mark per row, only where a row has a better way.** A lower instalment is better, an earlier payoff is better, more extra paid in is neither. Pay scenarios marks with a circle-check icon and `text-success` (`ScenarioComparison.vue:88-91`).
- **From today for a loan you have, over the whole loan for offers.** The past is the same in every scenario of one loan, so counting it hides the difference. Offers have no past.
- **Name every assumption where its figure is.** The variable rate after March 2028 is an estimate. The subsidy payback amount is unknown. MSE's stated assumptions are the model.
- **Start from a loan or from blank.** From a loan copies its terms and adds changes. From blank is an offer.
- **Keep and name scenarios.** Only HSH collects calculations, and only for the visit. Pay scenarios names, copies and renames scenarios as records (`ScenarioNameDialog.vue:60-67`).
- **Do not rank by "each extra euro saves" or by total interest across different terms.** An early lump sum saves more interest per euro than a later monthly one simply because it is paid earlier. [Lane 2](lane2-mechanics.md) covers why, and its "money left in your pocket" view at a rate you type is the honest version. I dropped such a row from the mockup.

## The proposal

### Where it lives

- A new Loans screen, **Scenarios**, in the menu under Overview (`app.ts:42` gives `menu: () => [OVERVIEW]` today). [Lane 1](lane1-codebase.md) calls the route `/loans/compare`. Either name works. One screen holds the picking, the comparison and the list, as Pay scenarios does.
- Inside, `PageTabs`: one tab per bank loan, named as the loan, with the count of its scenarios, and an **Offers** tab for scenarios started from blank. The tab is in `?tab=`, the picked scenarios in `?compare=` and the base in `?base=`, as `PayPanel.vue:85-92` does.
- Ways in: **New scenario** in the screen header, a "Compare scenarios" link on the bank loan screen beside What if I pay extra (`BankLoanScreen.vue:175`), and "Save as scenario" on the What if panel itself (see the second decision).
- Informal loans get no scenarios. They have no plan to change.

### What a scenario is, as the screens need it

A scenario from a loan is the loan as it stands plus a list of changes. A scenario from blank is a full set of terms. The screens need four kinds of change, each one card in the editor:

| Change                | Fields                                                                                         | Plan engine today                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Extra payment         | Amount, date, shorter term or lower instalment                                                 | An `ExtraPayment` (`extraPayment.ts:9-15`), as the What if panel uses it (`whatIf.ts:51`)     |
| Regular extra payment | Amount, every month or year, from, until (or until paid off), shorter term or lower instalment | Many `ExtraPayment` values from one rule. Lane 1 lists the generator as missing               |
| Rate change           | From a due date, rate, fixed or variable                                                       | A `RatePeriod` (`ratePeriod.ts:8-16`). The date snaps to a due date, and lane 2's cap applies |
| Move to another bank  | Date, new rate periods, new number of instalments, fees                                        | A full payoff plus a second plan. Lane 1 lists the link between the two as missing            |

A blank scenario has the bank loan dialog's fields (amount, payout, first instalment, instalments, rate periods, optional subsidy) plus fees. The base of a loan's tab is always the loan itself, labelled **As it stands**. It follows the loan: change the loan and the base and every scenario move with it.

### The screen, top to bottom

1. **Header.** "Scenarios", the line "Try changes to a loan, or offers you are weighing, and compare them side by side.", and **New scenario** as the primary button.
2. **Tabs**, as above.
3. **Picker.** One toggle button per kept scenario, with its mark (see Colour), pressed when compared, the others disabled once four are picked, as `PayPanel.vue:143-156` does. Beside it, "Compare against" and a select of the picked ones. The base defaults to As it stands on a loan's tab and to the first picked offer on Offers.
4. **Scenario cards.** One `AppCard` per picked scenario: its mark and name, a one-line description of its changes, a badge when it warns ("Subsidy back"), "Base" on the base. Under a hairline, a `FactGrid` of Paid off, Interest left and You pay in all, each with its difference to the base as the caption ("2 y 7 m sooner", "€10,991.19 less"). The card's top edge is a 3 px rule in the scenario's colour.
5. **Owed over time** and **Interest from today**, two `ChartCard`s with a line per scenario, described under Charts.
6. **Against the base.** Two small horizontal bar groups, interest saved and paid off sooner, one bar per scenario in its colour, the figure in ink at the bar's end. A note for what a bar leaves out, such as fees. This is the "difference against the base" view at a glance. Two groups, two scales, never one axis for both.
7. **Side by side.** The Pay scenarios table, grouped. Instalments: next instalment, highest instalment, the instalment on a date that matters (a move's first month), instalments left, paid off. What it costs: interest left, extra you put in, fees, what the subsidy pays, and the total, You pay in all, which is principal, interest, extra and fees less the subsidy. The tick goes to the best of a line only when one scenario alone holds it. Ties get no tick. A warning icon and words stand in a cell that has a catch ("then paid back"). Under the table, one `UAlert` per warning, worded as the What if panel's (`WhatIfPanel.vue:70-78`).
8. **Your scenarios for (loan).** Every kept scenario of the tab as a row: mark, name, how many changes and its interest against the base, and Edit, Copy and Delete. Compared ones carry their letter, the rest a grey mark and "Not compared". Delete writes at once with an Undo toast, as the patterns say. The base row has no actions.

### Building a scenario

- **New scenario** opens a short `AppDialog`: From a loan you have (with a select of bank loans) or From blank, and a name. Next opens the editor.
- The editor is an `AppDialog` at `width="3xl"`, full screen on a phone. Left: the name, the list of changes, each a bordered block that opens to its fields in a `FormGrid`, and a row of "Add a change" buttons, one per kind. Right: an outcome card against the base, with a two-line sparkline (the base in brass, this scenario in its colour), Paid off, Interest left, Extra you put in and Instalments left, each with its difference, and the subsidy note as an info or warning alert.
- On a phone the outcome card follows the changes and the dialog foot repeats its headline in one line ("C, Aug 2043, €10,440.74 less interest") beside Cancel and Save, so the effect of a keystroke shows without scrolling.
- Figures update on every keystroke. Lane 1 measured four full plans at 7.5 ms, so no debounce. Half-typed values build nothing, as `WhatIfPanel.vue:35-39` does.
- Save writes the scenario and Cancel discards it, as in every Kuna dialog. Deleting from the list writes at once with Undo instead.
- A blank scenario's editor is the bank loan dialog's fields (`RateFields`, `SubsidyFields`, as lane 1 notes from `BankLoanDialog.vue:20-23`) plus fees, with the same outcome card against the base offer.

### Charts

**Owed over time.** Lines from today's balance to each payoff, at each month end, one per scenario, 2 px. Year ticks every 2 years on desktop and every 5 on a phone, as the Loans design lane set. A dashed hairline at the first variable-rate date with "Variable from Mar 2028, an estimate" on desktop, in the footer on a phone. Each line ends at zero with a dot, and the scenario letters sit above the dots, joined when two end in the same month ("A D"). The base draws last, so where a scenario runs on top of it the base stays visible. Tooltip on hover or tap: the month, then each letter with its balance or "paid off".

**Interest from today.** The interest each scenario still pays, added up month by month, flat after its payoff. The letter and total sit at the right edge, pushed apart so close totals do not overlap ("D 41.0k, C 40.4k, B 39.8k"). This answers "how much does each cost me in interest, and when", which the totals alone hide.

**Why not principal and interest per scenario in colour.** That would put green and violet next to four scenario hues on one screen, which fails the colour checks. The split stays in the table and on each loan's own page.

Both charts keep the Table toggle and a written description, as `ChartCard` does. The balance chart is a new builder beside `balanceChart.ts`, since that one draws one plan with a past (lane 1).

### Colour

Scenarios are a new role, so they get their own aliases, read with the existing `tokenColour()` as the loan aliases are. The colour belongs to the slot in the comparison (A to D), and A is the base.

| Token          | Light                       | Dark    | Job                                                        |
| -------------- | --------------------------- | ------- | ---------------------------------------------------------- |
| `--scenario-1` | `var(--loan-ahead)` #b7860f | #be8a1a | The base. The brass already means "the plan still to come" |
| `--scenario-2` | `var(--series-3)` #2a78d6   | #3987e5 | Second                                                     |
| `--scenario-3` | `var(--series-5)` #e87ba4   | #d55181 | Third                                                      |
| `--scenario-4` | `var(--series-6)` #008300   | #008300 | Fourth                                                     |

The dataviz validator with `--pairs all`, since lines cross:

- Light, on #ffffff: lightness and chroma pass. CVD warns, worst #008300 against #b7860f at ΔE 6.1 protan. Normal vision passes, worst ΔE 19.4. Pink is 2.69:1 against white, a contrast warning.
- Dark, on #131a23: CVD warns, worst #008300 against #be8a1a at ΔE 7.6 protan. Normal vision passes, worst ΔE 20.1. Contrast passes.

The warnings are legal only with a second cue. So every scenario carries its letter everywhere its colour shows: picker, cards, legend, line ends, table headers, bars, tooltip. Text stays in ink tokens. The colour is a 14 by 3 px rule beside the letter, never the letter's colour.

What failed, so nobody retries it:

- Blue with violet, as the Loans lane found: ΔE 4.5 deutan, a hard fail. So no violet, and interest's violet stays off this screen.
- Orange with pink: normal-vision ΔE 12.9, a hard fail. Orange with brass fails too, per the Loans lane.
- Pink with the principal green #1baf7a in dark: ΔE 1.6 deutan. That is why the fourth slot is the darker `--series-6`.
- Any four from the series order without brass failed somewhere.

A scenario keeps its slot while it stays picked. Unpicking B leaves C and D their colours, and the next one picked takes the free slot. Colour follows the scenario, never its rank.

### Layout

| Width   | Picker                                     | Cards                                                | Charts                                                                  | Side by side                                                                         |
| ------- | ------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 360 px  | toggles wrap, "Compare against" under them | one column, facts two to a row with the third across | full width, 220 px tall, years every 5                                  | each line's label across, its four figures two by two under it, each with its letter |
| 768 px  | toggles and the select in one row          | two columns                                          | full width, 260 px                                                      | the table, four figure columns                                                       |
| 1440 px | one row                                    | four in a row                                        | side by side in a `DashboardGrid layout="pair"` from 3xl, stacked below | the table                                                                            |

At 360 px the cards make a long first screen. The tick, the difference and the letter keep Side by side readable with all four, which Pay scenarios today does not try (first decision).

### States

- **No scenarios for a loan:** an `EmptyState` "Only the loan as it stands", one line on what a scenario does, **New scenario**, and an outline "Try €5,000 extra next month" that opens the editor with that change filled in.
- **One scenario plus the base:** two cards, two lines, a two-column table. Against the base shows one bar per group.
- **A change dated in the past:** time moves on, so "€10,000 in January 2027" can become history. The change gets a warning in its card, "This date has passed", and the scenario keeps working from the next due date until it is moved or removed.
- **A plan Kuna cannot work out** (a rate period not on a due date, lane 1): the scenario card shows the reason in place of its facts and drops out of the charts and the table, with an alert naming it.
- **The loan is paid off:** its tab stays while it has scenarios, with "Paid off on (date)" in place of the comparison. Offers are unaffected.
- **Loading:** `ScreenSkeleton`, as every Loans screen.

### Accessibility

- Identity is never colour alone: letters everywhere, the best mark is an icon and bold ink, a warning is an icon and words.
- Each chart has a description naming every payoff and total, and the Table toggle.
- The picker toggles carry `aria-pressed` and a group label "Scenarios to compare, up to 4", as Pay's do.
- Every control is 44 px on a phone. The table's figures are not buttons, unlike Pay's, since Loans has no build-up to open yet.

### Components and tokens

| Name                                                                                                                                                                                        | Status                      | Note                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHeader`, `PageTabs`, `AppCard`, `FactGrid`, `ChartCard`, `ChartLegend`, `EmptyState`, `AppDialog`, `FormGrid`, `MoneyText`, `ScreenSkeleton`, `UButton`, `UBadge`, `UAlert`, `USelect` | exist                       | Used as they are                                                                                                                                                                                                                                                                                                                                    |
| `ScenarioComparison` (Company)                                                                                                                                                              | moves to `src/shared/ui`    | The second app to need it, so it moves, as the decision order says. Its cells take a value that is money, a date or a count, and a difference in words. The narrow layout follows the first decision                                                                                                                                                |
| Scenario picker                                                                                                                                                                             | moves to `src/shared/ui`    | Pay's toggle row and "Compare against" select (`PayPanel.vue:143-170`), as one component with the mark as a prop                                                                                                                                                                                                                                    |
| A scenario mark                                                                                                                                                                             | new, small                  | A letter beside a colour rule. Used by the picker, cards, legend and table headers. It could be a mode of `ChartLegend`'s swatch rather than its own component                                                                                                                                                                                      |
| `RateFields`, `SubsidyFields`                                                                                                                                                               | exist in Loans              | Reused by the blank scenario editor                                                                                                                                                                                                                                                                                                                 |
| `--scenario-1` to `--scenario-4`                                                                                                                                                            | new aliases in `tokens.css` | Values in the Colour table, beside the `--loan-*` aliases                                                                                                                                                                                                                                                                                           |
| Scenario balance and interest chart builders                                                                                                                                                | new                         | In `src/apps/loans`, beside `balanceChart.ts`                                                                                                                                                                                                                                                                                                       |
| Words                                                                                                                                                                                       | new                         | In Loans' `words.ts` with Croatian. Suggested: Scenarios "Scenariji", As it stands "Kako je sada", Compare against "Usporedi s", Side by side "Usporedno", Against the base "U odnosu na polazni", Move to another bank "Prelazak u drugu banku", Regular extra payment "Redovita izvanredna uplata". The owner should check the Croatian at 360 px |

Storage is lane 1's question. The design works with either shape. If scenarios live only in the address, the "Your scenarios" card and Copy go, and a name is a query value.

## Decisions for the owner

### 1. How Side by side shows four scenarios on a phone

Affects the Side by side card at 360 px, and Pay scenarios if the table moves to `src/shared/ui`. Today Pay scenarios shows the base beside one picked scenario below 1024 px, chosen with "Beside the base" buttons (`ScenarioComparison.vue:26-35`, `:57-69`). With the sample, a phone shows A and B, and C and D are one tap away.

- **Show all four, two by two (recommended).** Each line's label runs across and its four figures sit in a 2 by 2 grid under it, each with its letter, tick and difference. You see the whole answer while scrolling. Cost: a narrow layout in the shared table, and Pay's phone table changes with it.
- **Base beside one, as Pay does.** The table stays two columns with full labels. Cost: none in the table, but on a phone you never see C and D together, and the cards and charts carry the comparison.

Which should the phone show?

### 2. What happens to the What if I pay extra panel

Affects the bank loan screen. Today it tries one extra payment both ways and Apply turns it into a real one (`WhatIfPanel.vue:54-56`).

- **Keep it, add "Save as scenario" (recommended).** The quick try stays where it is. Save as scenario opens the editor with that extra payment and effect filled in, and Compare scenarios links to the new screen. Cost: one button and one link.
- **Replace it with a link to Scenarios.** One way to try things instead of two. Cost: a quick try now takes a dialog and a screen change.

Which should it be?

## Notes

- Kept or rejected without asking, since they follow the rules above: no "each extra euro saves" row, no EKS in a loan's comparison (offers only, per lane 2), no principal and interest colours on this screen, scenario colours validated and lettered.
- Apply from a scenario: for an extra payment, Edit could offer "Make it real", opening the existing extra payment dialog as the What if panel does. A rate change or a move to another bank stays a scenario until the bank's papers say otherwise, then it is entered as the loan's own rate period. I did not draw it.
- The mockup draws its desktop frames at 60% with CSS `zoom`, which Firefox supports from version 126, and lays the phone and desktop out from one markup with container queries, supported in Firefox from 110.
- Figures in the mockup come from a small script that follows Kuna's plan rules (yearly rate over 12, interest rounded to the cent, a new annuity over the instalments left at each rate change). They are consistent with each other, not with a bank.
