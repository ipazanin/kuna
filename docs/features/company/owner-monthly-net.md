# Owner monthly net, profit included

Design for an Owner tile that adds the profit still in the company, after corporate and dividend tax, to the owner's monthly net over the Owner period: what exists, the calculation, the edge cases and the decisions left to the owner.

Read-only design on `ledgerboard` at c6acc20. Paths are under `src/packs/hr-doo/` unless they start with `src/`. It builds on [Owner page with a time filter](owner-period.md), which has landed.

## What exists

- **The Owner period.** One filter bar sits above both tabs (`presentation/OwnerScreen.vue:79-81`). Taken computes its tiles from `profitAndLossRows`, the rows every chip but the period selects (`src/features/transactions/application/useFilteredLedger.ts:35-36`, `:66`), and each domain function cuts them to the period.
- **Monthly net pay tile** (`presentation/TakenPanel.vue:112-120`). The owner take without loans (`domain/ownerTake.ts:62`) over the period's months (`domain/ownerTake.ts:72-75`). Those are the period's months inside the ledger, with the month so far counted as one (`src/features/filters/domain/periodPresets.ts:48-52`). A rolling period stops at the last complete month. Dividends paid in the period are in it, because the dividend category sits in the owner-pay bucket with the `profit-distribution` role (`domain/packRoles.ts:22`, fake roles at `src/features/workbook/infrastructure/fake/fakeWorkbook.ts:48-50`).
- **Net share of gross cost tile** (`presentation/TakenPanel.vue:103-111`, `domain/ownerCost.ts:30-46`). Take without loans over itself plus the `owner-pay-tax` rows. The dividend tax category carries that role, so a dividend's tax lowers the share. Corporate tax stays out. This design leaves the tile alone.
- **Profit by month.** `forecastYear` (`domain/forecast/forecastYear.ts:166-191`) builds a year from complete months of the ledger, counted as the accrual view counts them, and plans the later months. Its `profitBeforeTax` line holds twelve months (`:314`). Owner salary and its taxes are costs in it. Dividends and their tax are taken out of profit and loss (`domain/accrual/accrualYear.ts:240`).
- **Corporate tax.** `citLiability` picks the rate by the year's revenue, which for the open year is the forecast's full-year revenue (`domain/cit/citLiability.ts:51-67`). Rule `hr.cit.rate` in `ruleset/rules/profit-tax.ts:226-244` sets 10% below €1,000,000 of revenue and 18% at or above it, from 2025 with no end date. The year-end bridge (`domain/accrual/accrualYear.ts:53-64`) gives a closed year's profit before and after tax and the gap to the accountant's figure, always for a whole year.
- **Dividend tax.** Rule `hr.pit.dividend` in `ruleset/rules/owner-pay.ts:973-995` sets 12%, withheld at payout, with no allowance and no contributions, from 2025 with no end date.
- **"As a dividend you would net" exists.** The Benefits card (`presentation/OwnerBenefitsCard.vue:66-97`) runs `dividendComparison` (`domain/ownerBenefits.ts:92-111`) on the benefits year by year. Each year goes through `dividendRoute` (`domain/dividend/dividendRoute.ts:22-37`): corporate tax at the rate Year's forecast gives that year, seen on the newest booking, then dividend tax at the rate of the year after. A period across years sums each year at its own rates.
- **The open year.** The interim payout on Year already works out profit so far. It takes profit before tax up to the last complete month and taxes it at the forecast year's rate (`domain/dividend/dividendCapacity.ts:301-326`). The running month never counts. Distributable profit adds retained earnings and takes off what the year paid out (`:132-142`, `:374-401`).
- **Owner loans.** `ownerLoans` matches loan-out and loan-repaid rows into loans (`domain/ownerLoans.ts:24-52`, `:83`). `owedInPeriod` cuts the book at the period's last day (`domain/owedInPeriod.ts:61-66`). `owedByOwnerOn` nets loans against costs the owner paid, never below nothing (`domain/dividend/owedByOwner.ts:11-16`). The payout after adoption sets the net dividend off against it before any cash goes out (`domain/dividend/dividendCapacity.ts:258-261`).

## The calculation

**Monthly net, profit included** is the owner's pay without loans and without dividends, per month, plus the period's profit after corporate and dividend tax, per month.

1. Pay part: the owner take without loans, as today, less the `profit-distribution` categories.
2. Profit part: for each calendar year the period touches, add up `profitBeforeTax` over the period's complete months in that year. Run each year's sum through `dividendRoute` at that year's rate. That is `dividendComparison` fed with profit by year instead of benefits by year, with the rate cache the Benefits card already keeps.
3. Add the two parts, each over its months.

Dividends paid leave the pay part because every dividend is profit of the months that earned it. Counting profit as earned and the dividend as paid would count the same euro twice. A dividend paid in May 2026 out of 2025 profit counts in the 2025 view and never in the 2026 one. So no dividend has to be matched to the year it came from, and earlier years' retained earnings and dividends need no attribution of their own. They count when the filter covers the years that earned them.

"Left in the company" is the period's profit after both taxes less what has already been paid out of it, as of the newest booking. The formula never needs it, since profit as earned holds both parts. The build-up shows it as one line.

**Worked example**, made-up figures, filter January to June 2026, six complete months:

| Line                                                         | Amount     |
| ------------------------------------------------------------ | ---------- |
| Salary, net                                                  | €6,000     |
| Dividend paid in May out of 2025 profit, net                 | €8,800     |
| Monthly net pay today, €14,800 over 6 months                 | €2,467     |
| Profit before tax, after the salary and its taxes            | €30,000    |
| Corporate tax at 10%, forecast 2026 revenue under €1,000,000 | −€3,000    |
| Dividend tax at 12% of €27,000                               | −€3,240    |
| Profit part, net                                             | €23,760    |
| **New figure, (€6,000 + €23,760) over 6 months**             | **€4,960** |

The 2025 view, May to December, has €12,500 profit before tax. It counts €12,500 less €1,250 corporate tax less €1,350 dividend tax, so €9,900 from profit. The May 2026 dividend took €8,800 of that. The other €1,100 is the net of the €1,250 still retained.

**Loans.** The owner owes €2,000 on 30 June, read with `owedInPeriod` on the period's last day. The payout at the year end settles it first, so €2,000 of the €23,760 goes against the loan and €21,760 comes as cash. The owner already holds the €2,000, so the figure stays €4,960. The loan shows only as a line in the build-up.

**The tile.** One figure, "€4,960" with the caption "€1,000 pay and €3,960 from profit, a month". The build-up opens a `FigureDialog`, as the Benefits card's tax avoided does. It lists pay without dividends, the dividends left out, profit before tax by year, corporate tax, dividend tax, paid out already, left in the company, and what of it settles the open loan. Each line drills to its rows or to Year.

**Edge cases.**

- _A period with a loss._ `dividendRoute` takes a negative amount, so a €6,000 loss reads −€4,752 (decision 2).
- _No complete month of profit yet_, such as a quarter in its first month. The profit part is nothing, the caption says "No complete month of profit yet", and the tile reads pay alone.
- _All time._ Every year from the first in the ledger through the open year's last complete month. Profit earned before the ledger began has no month in it and stays out, and the caption says "since the ledger began".
- _No `hr_company_registered`._ The forecast cannot run. The tile reads "–" with the note and link the Benefits card shows (`presentation/OwnerBenefitsCard.vue:132-135`).

## Decisions for the owner

1. **Add a tile, or change Monthly net pay?** In the example the page shows €2,467 and €4,960 side by side, or €4,960 alone.
   - _Add a tile:_ Monthly net pay keeps what reached the owner in cash, and both definitions say why they differ. The tile grid (`presentation/TakenPanel.vue:145`) needs new column counts.
   - _Replace it:_ one figure, but the cash view goes.
   - I recommend adding a tile.
2. **How should a loss count?** A quarter with a €6,000 loss.
   - _Through the same taxes, −€4,752:_ a loss carried forward lowers later corporate tax, the formula has no branch, and four quarters add up to the year.
   - _In full, −€6,000:_ easier to say, but it overstates the loss and the quarters no longer add up.
   - I recommend the same taxes.
3. **Which months does each part divide by?** On "2026" seen on 8 October, pay covers January to October, October counting as one, and profit covers January to September.
   - _Each part over its own months:_ pay over 10, profit over 9. The profit part does not drop each time a month starts. The build-up names both spans.
   - _Both over 10:_ one divisor, but the profit part reads a tenth low until October closes.
   - I recommend each part over its own months.
4. **Which corporate tax?**
   - _The rate on profit before tax,_ as the Benefits card and the interim payout do: one rule for open and closed years. It leaves out the PD add-backs, such as half of representation, so the tax reads slightly low. A closed year's gap to the accountant stays on Year end.
   - _Each year's own liability spread over its profit:_ it catches add-backs and losses brought forward. For the open year it rests on the forecast of months not yet booked, and it is a second way to tax a dividend beside the Benefits card.
   - I recommend the rate.
5. **Should the profit part follow the account and category chips?** With only the salary category chosen, the pay part is salary alone.
   - _Period only:_ profit is the company's whatever else is filtered, and a line says so, as on Who owes whom.
   - _Every chip:_ the profit of one account or category is nothing the owner can take.
   - I recommend the period only.

## Files it touches

`domain/ownerTake.ts` gains the pay without dividends. `domain/ownerBenefits.ts` keeps `dividendComparison` and renames `BenefitYear` to a plain amount by year, since profit uses it too. A small domain function gathers profit before tax by year over the period's complete months. `presentation/TakenPanel.vue` gets the tile and its build-up, and the rate cache moves up from `OwnerBenefitsCard.vue` so both share it. Tests take the worked example, the loss, the empty period and all time, and the visual check covers the new grid.
