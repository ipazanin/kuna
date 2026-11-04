# Hub overview plan

Build plan for the hub overview, a Kuna screen at #/overview with the personal figure Investments less loans, the next loan payment and what the owner could take out of the company now after tax, plus a fourth payout option on Year's Pay tab, checked against Kuna at 7d73c5e.

The hub overview from [the proposal](../../architecture/hub.md) (decision 5, and H4 in its roadmap), built to the owner's answers of 4 Nov 2026. Kuna was read at `7d73c5e`, and every `path:line` is against that commit. Paths under `packs/hr-doo/` mean `src/apps/company/packs/hr-doo/`. Every figure is made up.

## Summary

- A Kuna screen of its own, **Overview** at `#/overview`, beside Kuna settings in the home's menu and linked from the home at every width.
- The lead figure is **Investments less loans**: Investments value plus what others owe you, less what you owe. It is never called net worth. A line says what it leaves out: bank accounts and property, which no app keeps yet, and holdings without a price.
- **You owe** carries the next loan payment as its caption.
- **Company** shows one owner figure and never the company's cash: **what you could take out now**, the cash that would reach your account if the company paid out its kept profit today, after the 12% dividend tax and with your loan to the company settled first. Its caption says what settled the loan first, or why the figure is nothing. It is never added to the personal figure.
- That figure is a fourth payout option on Year's Pay tab, **Kept profit paid out now**, made by the existing `payoutOption`. The overview reads that same option through a new pack slot, `ownerTakeOut`. The interim advance option stays and now settles the owner loan first too.
- A failed Loans or Investments read holds the personal figure back. A file still opening shows a placeholder. An app not set up counts as nothing and is named with its Set up link.
- No stored data changes. No app imports another, and the boundary spec stays as it is.

## What the owner sees

The home's menu, from 1024 px, lists the apps, then Overview and Kuna settings set apart. Below 1024 px the home has no menu (`src/shell/home/HomeScreen.vue:13`), so an **Overview** button sits under the page header, above the app cards, as Kuna settings sits under them (`HomeScreen.vue:23`). On the overview screen a phone has the menu button, since the drawer shows everywhere but the home (`src/shell/App.vue:97`).

### The worked example

| Tile                   | Figure      | Caption                                                                                       |
| ---------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Investments less loans | −€54,500.00 | Leaves out bank accounts and property, which no app keeps yet, and 1 holding without a price. |
| Investments value      | €40,000.00  |                                                                                               |
| Owed to you            | €500.00     |                                                                                               |
| You owe in all         | €95,000.00  | Next €650.00: On 15 Dec, Example house loan                                                   |
| You could take out now | €1,224.00   | After €3,000.00 settles your loan to the company                                              |

The first four come from Loans and Investments and add up: 40,000.00 + 500.00 − 95,000.00 = −54,500.00. The last sits in its own card, "The company's money, kept apart from the sum", and links to Year's Pay tab with the new option open.

The company figure in that example: 2025's year-end figures leave €10,800.00 of kept profit, and €6,000.00 was paid out in February 2026, so €4,800.00 is left. The cash that may leave is €72,495.00, so the cap does not bite. Dividend tax at 12% is €576.00, the net €4,224.00. You owe the company €3,000.00, which the net settles first, so €1,224.00 reaches your account. These are the figures of the `steadyStudio` fixture (`tests/dividendCapacity.spec.ts:28-30`, `:110-117`).

### When an app has nothing to give

| A personal app is                    | The overview                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Not set up (`firstRun()`)            | Counts it as nothing and lists it under the tiles with its Set up link.                                                                                                                                                                                |
| Set up with nothing to show (`null`) | Counts it as nothing.                                                                                                                                                                                                                                  |
| Opening                              | The lead tile shows the pulsing placeholder the home card uses (`src/shell/home/HomeAppCard.vue:37`). Parts that are ready still show.                                                                                                                 |
| Failed                               | The lead tile reads "Loans did not open, so nothing is added up", with a link into the app. The other parts still show.                                                                                                                                |
| In another currency than the other   | The lead tile reads "Not added up: the apps keep different currencies", and each part shows in its own format. Unreachable today, since Loans and Investments are fixed to euros (`src/apps/loans/app.ts:49-50`, `src/apps/investments/app.ts:80-81`). |

A cached copy shown while signed out, or after a failed sync, counts as ready, as on the home cards (`src/shared/app/homeCardFigures.ts:9-11`). Company not set up, opening, failed, owner pay switched off or with no registration date changes only the company card, which then says why it has no figure.

## The rules

### Investments less loans

- **Owner:** a new pure function `personalNet` in `src/shared/app/personalNet.ts`. It adds every `has` part and subtracts every `owes` part of the apps that answer with figures. It waits while any personal app is opening, holds back on any failure, and refuses when the apps' `moneyFormat().currency` differ. It never reads a company part, since the contract keeps company parts in their own field.
- **Investments value:** `portfolioFigures(...).value` (`src/apps/investments/holdings/domain/portfolioFigures.ts:44-45`), through the one computed in `usePortfolio` (`src/apps/investments/holdings/presentation/usePortfolio.ts:28`). Holdings without a price are counted from `figures.unpriced` (`portfolioFigures.ts:46-47`).
- **You owe, owed to you:** `owedTotals` (`src/apps/loans/overview/presentation/owedTotals.ts:23-28`).
- **Next payment:** `upcomingPayments(plannedLoans(...), informalLoans, day, 1)[0]` (`src/apps/loans/overview/domain/loansTogether.ts:81`), worded with `nextPaymentCaption` (`src/apps/loans/overview/presentation/loansOverview.ts:107-111`), as the Loans Overview does (`src/apps/loans/overview/presentation/OverviewScreen.vue:49-51`, `:128`). The amount is `yourShare`.

### What you could take out now

The new option `kept-now` in `dividendCapacity` (`packs/hr-doo/domain/dividend/dividendCapacity.ts:120-225`):

1. **Kept profit.** The retained earnings of the newest year whose year-end figures are on the year-end tab, through `equityBroughtForward` (`packs/hr-doo/domain/accrual/accrualBalanceSheet.ts:272-293`), less losses brought forward, less every profit payout the ledger booked since the start of that year. A dividend the plan still has to pay comes off only once the year it is paid from has its year-end figures on the tab, so only when the tab holds last year. Until then its own year's profit covers it. No year-end figures at all gives nothing, worded "Nothing yet: no year-end figures from the accountant". When the tab holds last year, as in the example, this equals `retainedEarnings − lossesBroughtForward − paidOutInYear`.
   - Example: in February 2027 the tab holds 2025, which left €10,800.00, and €6,000.00 was paid out in 2026. The 2027 plan pays €30,000.00 in June out of 2026's profit. The kept profit is €4,800.00, since the planned €30,000.00 waits for 2026's year-end figures. A payout the ledger has booked in 2027 would still come off.
2. **Gross**, the smallest of the kept profit (never below nothing) and the cash that may leave, `interimCash(...).largestPayout` (`dividendCapacity.ts:349-363`): cash on the newest booking, less corporate tax due by the end of its month, overdue included, less the last complete month's pay the ledger has not paid. Nothing else is held back.
3. **Tax, net, set-off** through `payoutOption` (`dividendCapacity.ts:252-293`) with `setsOff: true`: 12% dividend tax (rule `hr.pit.dividend`, `packs/hr-doo/ruleset/rules/owner-pay.ts:950`), the net, and the part of the net that settles what the owner owes (`owedByOwnerOn`, `packs/hr-doo/domain/dividend/owedByOwner.ts:11-16`).
4. **Paid to the owner**, a new field `paidToOwner` on every `PayoutOption`, made in `payoutOption` as net less set-off. The overview leads with it.

The option exists only for the year of the newest booking. For any other year it reads "Only for {year}, the year of the newest booking" with nothing paid, as the interim option does once a year has ended (`dividendCapacity.ts:306-317`). It runs from the newest booking to 31 December, like the interim option.

The interim advance option keeps its gross, and changes from `setsOff: false` (`dividendCapacity.ts:338`) to `setsOff: true`. Its cash warning tests the cash that actually leaves the bank, the dividend tax plus what is paid to the owner, not the gross, since the part that settles the loan needs no cash. The kept profit paid out now keeps its cap on the whole gross.

On the Pay tab the kept-now option shows its kept profit, and says when the cash cap cut the payout down, as "Kept profit €4,800.00, cash allows €2,000.00".

## Stages

One commit for the whole wave, checked with lint, format, typecheck, vitest, both builds, `check:figures` on every fake set and the live files, and the targeted visual and touch checks. The stages are the order to build in.

### 1. The kept-now option and the interim set-off

- Changed: `packs/hr-doo/domain/dividend/dividendCapacity.ts`
  - `PayoutOptionId` (`:30`) gains `kept-now`.
  - `PayoutOption` (`:32-62`) gains `paidToOwner`, made in `payoutOption` (`:252-293`).
  - `DividendCapacity` (`:91-111`) gains `keptProfit`, worked out beside `retainedEarnings` (`:133-141`).
  - A `keptNowPayout` beside `interimPayout` (`:300-342`), built by `payoutOption`. `options` (`:223`) becomes `[afterAdoption, keptNow, interim, keep]`.
  - `interimPayout` passes `setsOff: true` (`:338`).
  - `interimCash` (`:349-363`) reads the last complete month's pay from the forecast that holds that month. In January the last complete month is the year before's December, and `monthOfLine` throws for a month outside its line (`packs/hr-doo/domain/forecast/forecastLines.ts:193-199`), which would fail the whole Forecast tab (`packs/hr-doo/presentation/forecast/forecastView.ts:86-97`). It then forecasts the year before, as `openingEquity` already does (`dividendCapacity.ts:378`).
- Changed: `packs/hr-doo/domain/dividend/words.ts` (English from `:21`, Croatian from `:80`): the option's label, the kept profit's lines, "Nothing yet", "Only for {year}" and "Paid to the owner".
- `tests/dividendCapacity.spec.ts`:
  - The interim case (`:89-107`) now settles the loan: set-off €3,000.00, cash out €39,501.00 (tax €5,100.12 plus net €37,400.88 less €3,000.00), cash left €32,994.00 (€72,495.00 less €39,501.00), owed after €0.00, benefit in kind €0.00. Gross, tax, shortfall and retained after stay as they are.
  - New, kept-now on `steadyStudio` at 19 Oct 2026: kept profit €4,800.00, gross €4,800.00, tax €576.00, net €4,224.00, set-off €3,000.00, paid to the owner €1,224.00, cash out €1,800.00, `cashNow` not null.
  - The cash cap: the same books with €2,100.00 in the bank and €100.00 falling due give a gross of €2,000.00.
  - Year-end figures for 2024 only, seen in 2026: the kept profit starts from 2024's lines and takes off the payouts of 2025 and 2026.
  - No year-end figures gives nothing, and so does a year other than the newest booking's.
  - In January 2027, with December 2026's pay unpaid, the pay is held back and the Forecast tab does not fail.
- Not changed: `scenarioCompany`'s `retainedBroughtIn` (`packs/hr-doo/domain/scenarios/scenarioCompany.ts:70-71`) stays the pay scenarios' figure. It carries a forecast of years the accountant has not closed, which the kept profit leaves out, so the two change for different reasons.

### 2. Year's Pay tab shows the fourth option

- Changed: `packs/hr-doo/presentation/forecast/words.ts` `payouts` (`:23`, `:265`): "Kept profit paid out now", "Isplata zadržane dobiti sada".
- Changed: `packs/hr-doo/presentation/payScenarios/PayPanel.vue:50`: `PAYOUTS` lists `kept-now`, so `?payout=kept-now` holds (`:86`).
- Changed: `packs/hr-doo/presentation/forecast/forecastView.ts` `payoutView` (`:378-404`) shows `paidToOwner` after the set-off line. `PAYOUT_NAMES` (`:71`) takes the new key from the words.
- `DividendCard.vue:59-69` already wraps its buttons, so four fit. The visual check proves it at 360 px.

### 3. The pack slot

- Changed: `src/apps/company/packs/packContribution.ts`
  - `PackContribution` (`:47-64`) gains `ownerTakeOut(workbook: Workbook, asOf: CivilDate): OwnerTakeOut | null`, where `OwnerTakeOut` is a label, the cents, a caption or null, and a route.
  - `NO_PACK` (`:67-78`) returns null.
- New: `packs/hr-doo/presentation/ownerTakeOut.ts`. It runs `forecastYear` and `dividendCapacity` for the newest booking's year and returns the `kept-now` option's `paidToOwner` and the route `/company/year?year={year}&tab=pay&payout=kept-now`. Its caption reads "After {setOff} settles your loan to the company" when something is set off, else the dividend tax, and when the figure is nothing it says why: no year-end figures, nothing kept, or no cash free. No registration date, or a `RangeError` from the forecast, gives a reason line in place of the figure.
- Changed: `packs/hr-doo/hrDooPack.ts:29`: `ownerTakeOut: (workbook, asOf) => ownerTakeOut(hrDooWorkbook(workbook), asOf)`, beside `waitingJobs`.
- New: `tests/ownerTakeOut.spec.ts`: `steadyStudio` gives €1,224.00 with "After €3,000.00 settles your loan to the company". Books where the owner owes nothing give a caption without the loan. No registration date gives its reason.

### 4. The overview contract and the personal sum

- Changed: `src/shared/app/appContribution.ts`. Beside `AppHomeCard` (`:44-52`), a `HubFigures` type and an optional `hubFigures(): HubFigures | 'opening' | 'failed' | null` on `AppContribution` (`:55-91`). `HubFigures` holds:
  - `counted`, the parts that add up, each a label, cents, `side: 'has' | 'owes'`, a caption or null, and a route,
  - `apart`, parts shown beside the sum and never in it, with the same fields but no side,
  - `leavesOut`, lines naming what the app's parts leave out.
- New: `src/shared/app/personalNet.ts`, the one owner of the sum, as under the rules.
- New: `tests/personalNet.spec.ts`: Investments €40,000.00 and Loans owing €95,000.00 with €500.00 owed back give −€54,500.00. Loans not set up gives €40,000.00 and names it. Loans opening waits. Loans failed holds back and names it. A part in USD beside one in EUR refuses. An `apart` part never moves the sum.
- Changed: `scripts/figure-digest.mjs`. A `hub.personal` group, printed only when a Loans and an Investments input are both given (`:9-14`), runs `personalNet` over the same totals `loans.totals` (`:410-419`) and `investments.portfolio` (`:465-466`) digest.

### 5. Each app gives its figures

- **Loans.** New `src/apps/loans/home/presentation/loansHubFigures.ts`: owed to you as `has` when above nothing, you owe as `owes` with the next payment as its caption, both linking to `/loans`. The totals for a day move from `loansHomeCard.ts:18-22` into one `owedOnDay(book, day)` in `owedTotals.ts`, which the card and the hub figures both call. Changed: `src/apps/loans/app.ts` (`:51`), `src/apps/loans/home/presentation/words.ts` (the caption "Next {amount}: {caption}").
- **Investments.** New `src/apps/investments/home/presentation/investmentsHubFigures.ts`: the value as `has` labelled "Investments value", linking to `/investments`, and the unpriced holdings in `leavesOut`. The opening and empty-file checks of `investmentsHomeCard.ts:33-39` move into one function both call, so the card and the hub never disagree on when the figures are ready. Changed: `src/apps/investments/app.ts` (`:82`), `src/apps/investments/home/presentation/words.ts`.
- **Company.** New `src/apps/company/home/presentation/companyHubFigures.ts`: through `homeCardFigures`, the booked workbook from `presentedWorkbook` (`src/apps/company/transactions/application/presentedWorkbook.ts:13-17`), as Year reads it (`packs/hr-doo/presentation/year/YearScreen.vue:60-62`), its newest booking (`src/apps/company/workbook/domain/workbook.ts:259`), and `shownPack(settings).ownerTakeOut(...)` in `apart`. Company core may import the pack seam, as the Overview's waiting jobs do (`src/apps/company/overview/presentation/waitingForYou.ts:13`, `:42`), so the boundary spec holds. Changed: `src/apps/company/app.ts` (`:68`).
- New fake variant `?loans=failed` in `src/apps/loans/workbook/infrastructure/fake/seedFakeLoans.ts` (`:33-50`): a Drive choice, no cached copy, and the file trashed, so the first read fails, as `?investments=binned` trashes its file (`src/apps/investments/workbook/infrastructure/fake/seedFakeInvestments.ts:79-82`).
- Specs: `tests/owedTotals.spec.ts` covers `owedOnDay`. `tests/companyHomeFigures.spec.ts` stays as it is. `tests/importBoundaries.spec.ts` passes unchanged.

### 6. The overview screen

- Changed: `src/shell/routing/screens.ts:4-16` gains `OVERVIEW_SCREEN`, path `/overview`, icon `i-lucide-layout-grid`. Changed: `src/shell/routing/router.ts:32-35` gains its route with its title. No app owns `/overview`, since apps own only paths under their id (`router.ts:88-93`).
- Changed: `src/shell/App.vue:48`: the home's `apart` lists Overview before Kuna settings. The comment on `apart` in `src/shell/ui/ScreenNavigation.vue:38` becomes "Kuna's own screens, or the app's Settings".
- Changed: `src/shell/home/HomeScreen.vue:17-25`: an Overview button under the `PageHeader`, `lg:hidden` like Kuna settings (`:23`), with `data-testid="home-overview"`.
- New: `src/shell/overview/OverviewScreen.vue` and `src/shell/overview/words.ts`. A `PageHeader`, then `DashboardGrid layout="tiles"` with a `KpiTile` (`src/shared/ui/KpiTile.vue`) for the sum and one per counted part, each part's `to` its app's Overview. Under them the leave-out line and the apps not set up. Then an `AppCard` for the company's money with one `KpiTile`. Money is formatted with each app's `moneyFormat()`, and the sum with the format the personal apps share. No new shared component.
- The screen calls each app's `hubFigures()` in one computed, so the company's forecast runs only while the overview is open.

## Checks

### check:figures

- **Changes:** every `year.<year>.forecast` group on each fake company set and the live file, since `dividendCapacity` is digested there (`scripts/figure-digest.mjs:300`). The causes are the new option, `paidToOwner` on every option, and the interim set-off.
- **New:** `hub.personal`, when a Loans and an Investments input are both given.
- **Must stay identical:** every other Company group, `year.<year>.pay-scenarios` (`:302`) and the `owner.*` groups (`:275-288`) among them, and every `loans.*` and `investments.*` group. Run the digest before and after and list the moved groups in the commit.

### Visual check

Locally `npm run check:visual -- --only overview,home,year-pay --widths 360,640,1024`, since CI keeps catching overflow at 640 and 1024 px. CI runs all nine widths (`scripts/visual-check.mjs:326-336`). Expected figures are worked out in the check with `owedTotals`, `portfolioFigures`, `personalNet` and `dividendCapacity` on the same fake sets, as `fakeInvestmentsShows` does (`:366-391`).

- `overview` on `?loans=sample&investments=sample` with the default company fake, and `overview-croatian`.
- `overview-loans-opening` on `?loans=opening&investments=sample`: the placeholder on the lead tile.
- `overview-loans-failed` on `?loans=failed&investments=sample`: the held-back line naming Loans.
- `overview-investments-only` on `?investments=sample`: the sum from Investments alone and Loans listed with Set up.
- `overview-fresh` on `?fake=empty`: every app listed with Set up and no company card figure.
- `year-pay-kept-now` and its Croatian twin on `#/company/year?tab=pay&payout=kept-now`, beside the interim pages (`:1302-1318`).
- `home` and `home-croatian` (`:883-884`) also show "Overview" and "Pregled".

### Touch check

At 360 and 430 px (`scripts/touch-check.mjs:196`):

- `home-top-bar` (`:399-421`) also finds the home's Overview button visible.
- New `overview`: tap the home's Overview button and land on Overview. Tap Investments value and land on the Investments Overview, then Back. Tap You owe and land on the Loans Overview, then Back. Tap You could take out now and land on Year's Pay tab with `payout=kept-now` in the address. Each tile is at least 44 px tall.
- The Pay step (`:691-697`) also taps "Kept profit paid out now" and reads its label.

## New strings

Croatian runs a third longer, so every one is checked at 360 px.

| English                                                                                   | Croatian                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Overview                                                                                  | Pregled                                                                             |
| Your money across Loans and Investments, and what the company could pay you.              | Vaš novac u Kreditima i Ulaganjima te što vam tvrtka može isplatiti.                |
| Investments less loans                                                                    | Ulaganja umanjena za kredite                                                        |
| Leaves out bank accounts and property, which no app keeps yet.                            | Ne uključuje bankovne račune ni nekretnine, koje još nijedna aplikacija ne vodi.    |
| {n} holding(s) without a price                                                            | {n} ulaganje (ulaganja) bez cijene, through the plural helper                       |
| Investments value                                                                         | Vrijednost ulaganja                                                                 |
| Next {amount}: {caption}                                                                  | Sljedeća rata {amount}: {caption}                                                   |
| Not set up: {app}                                                                         | Nije postavljeno: {app}                                                             |
| {app} did not open, so nothing is added up.                                               | Datoteka aplikacije {app} nije se otvorila, pa se ništa ne zbraja.                  |
| Not added up: the apps keep different currencies.                                         | Nije zbrojeno: aplikacije vode različite valute.                                    |
| The company's money, kept apart from the sum.                                             | Novac tvrtke, izvan zbroja.                                                         |
| You could take out now                                                                    | Možete isplatiti sada                                                               |
| After {amount} settles your loan to the company                                           | Nakon što {amount} zatvori vaš dug prema tvrtki                                     |
| After 12% dividend tax                                                                    | Nakon 12 % poreza na dividendu                                                      |
| Kept profit paid out now                                                                  | Isplata zadržane dobiti sada                                                        |
| Kept profit of the years before {year}, paid out now, set off against what the owner owes | Zadržana dobit iz godina prije {year}., isplaćena sada i prebijena s dugom vlasnika |
| Paid to the owner                                                                         | Isplaćeno vlasniku                                                                  |
| Nothing yet: no year-end figures from the accountant                                      | Još ništa: nema godišnjih podataka računovođe                                       |
| Only for {year}, the year of the newest booking                                           | Samo za {year}., godinu najnovije knjižbe                                           |

## Unconfirmed

- **A d.o.o.'s interim advance.** ZPD Art. 10.a taxes an advance on profit the year does not cover as income, and PravPD Art. 35.a (its 2010 wording, NN 123/10) says to pay one only where special regulations allow it, up to an interim income statement. ZTD Art. 221 allows an advance on dividend in a d.d. only, after the business year ends. The d.o.o. articles were not reachable on zakon.hr. The interim option stays as built and keeps its shortfall warning. The kept-now option pays only profit of closed years, so it does not rest on this.
- **ZTD Art. 406, 407 and 441** were not reloaded for this plan. The ruleset cites them from its load of 18 Oct 2026 (`packs/hr-doo/ruleset/rules/company-law.ts:98-200`).
- **PravPD Art. 35.a's current wording** was not loaded, only the 2010 amendment that added it.
- **"Adopted"** has no record in Kuna. The plan reads it as the year-end tab holding the accountant's lines for that year, which may come before or after the members' decision.
- **Last December's pay in January.** Whether the year's forecast already carries it, through its carried projection, was not checked. If it does, stage 1 reads it from there instead of forecasting the year before.
- **The cash cap is cautious.** The part of the net that settles the loan needs no cash, but the kept-now gross is capped by all the cash that may leave, as the owner's answer says. The overview can read up to the set-off below what the cash would allow. The interim warning tests the cash that leaves instead.
- **A loss in a year the accountant has not closed.** In January 2027 with 2025 on the tab and 2026 forecast at a loss, kept-now still offers 2025's kept profit. Whether a d.o.o. may pay retained profit of a closed year before a later year's loss is fixed is the same open ZTD question as the interim advance. `capitalProtected` uses the year-end forecast, which carries that loss, so it may flag some of these cases.
- **Digest identity** of the groups that must stay the same is expected from the code, not run.

## Sources

Loaded on 4 Nov 2026.

- Zakon o porezu na dobit, consolidated to NN 151/25, Art. 10.a read verbatim, https://www.zakon.hr/z/99/zakon-o-porezu-na-dobit. Not the official gazette.
- Pravilnik o izmjenama i dopunama Pravilnika o porezu na dobit, NN 123/2010, Art. 35.a read verbatim, https://narodne-novine.nn.hr/clanci/sluzbeni/2010_11_123_3191.html.
- Zakon o trgovačkim društvima, consolidated, Art. 221 read through the fetch tool's summary, https://www.zakon.hr/z/546/zakon-o-trgovackim-drustvima. The page text ends before the d.o.o. articles.
- [The owner monthly net design](../company/owner-monthly-net.md), for the tile beside Monthly net pay and the loan rule.

## The owner's answers, 2026-11-04

- Show the personal figure with a note on what it leaves out, and do not call it net worth.
- A planned dividend lowers the kept profit only once the year it is paid from has its year-end figures on the tab. Booked payouts since the closed year still count. (Answered after review.)
- The interim cash warning tests the dividend tax plus what is paid to the owner, not the gross. (Answered after review.)
- The overview is a screen of its own, not the top of the home.
- The next loan payment is a caption under You owe.
- Company shows owner figures only: what the owner could take out now after tax, from closed years' profit only, less this year's payouts.
- The cash reaching the owner's account leads, with a caption naming the part that settles the owner loan.
- Hold back only what Year does today: corporate tax due this month and last month's unpaid pay.
- Year's Pay tab gets the fourth option, kept profit paid out now, made by `payoutOption` with 12% dividend tax, `setsOff: true` and the cash cap. The overview shows that same option through `ownerTakeOut`.
- The interim advance option stays and settles the owner loan first.
- The lead's defaults: a failed read holds the personal figure back, opening shows a placeholder, and an app not set up counts as nothing.
