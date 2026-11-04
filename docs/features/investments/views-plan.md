# Investments views: the mixes, charts, performance and income views

How Kuna's Investments app gets the views the owner chose on 2026-10-31 (the mixes on Holdings with closed positions, a treemap, targets, a past date and checks, sized trade dots and Compare with on price charts, monthly returns, a gain bridge, drivers, the currency effect and an underwater chart on Performance, and a new Income and costs screen), feature by feature with domain functions and worked examples, then in waves for one build agent each, checked against Kuna at 16ce07e, with the decisions only the owner can make.

The owner chose these views on 2026-10-31 from a study of 13 portfolio apps (the roadmap, the entries from "Queued by the owner, 2026-10-31: prices smarter" on). They build on the [Investments plan](plan.md). Kuna was read at `16ce07e` on main, in a clean worktree. Another agent is reworking `src/apps/investments/prices` at the same time: a Prices tab in Investments Settings built from the vendor registry, smart caching, "Import closes" from CSV, a fetch right after an import and the minute-limit retry. This plan assumes that work is on main before Wave 1 starts, and every wave reads the prices code again before its brief. Every figure below is made up.

Nothing here needs a Tax screen, so the [Investments plan](plan.md) decision to leave tax figures out stands. The tax-free calendar and the tax withheld table only list what the records already hold.

## What the owner will see

| Screen                              | New                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Holdings                            | Five mixes at the top (sector, currency, country or region, class, account), a treemap, a target mix with what to buy from a deposit, a date to see the holdings on any past close, the open holdings as today, and closed positions below them                                                          |
| A holding's page                    | Daily closes once imported, buys and sales as sized dots in the positive and negative tones, merged per period with a short tooltip, the average cost at the price's own places, and Compare with any ticker                                                                                             |
| Performance                         | Tabs: Returns (today's cards, with Compare with on the growth chart), Months (a heatmap with a gap-to-index mode), Sources (a gain bridge, what drove the return per holding, the currency effect) and Falls (an underwater chart beside today's risk card)                                              |
| Income and costs, a new menu screen | Tabs: Income (by month and year), Coming (a forecast and calendar), Tax-free (a two-year calendar of lots, with lots at a loss), Withheld (tax withheld by year and country), Costs (per year, with a TER per fund) and Saving (how regularly you invest, and a projection with 3.5% and 4% withdrawals) |
| Overview                            | Portfolio checks, and "Where the money is" drawn as the class mix                                                                                                                                                                                                                                        |
| Settings                            | A Checks tab with each threshold. Finnhub appears on the Prices tab through the registry                                                                                                                                                                                                                 |

## Settled without asking

- **One period function serves three views.** The gain bridge, what drove the return and the currency effect all read `periodGains`. For All it equals the Overview's "Where the gain comes from", which is the strongest spec.
- **Trading fees stay inside** price and realised, as on the Overview, with the same line "Trading fees of €x are inside these figures". Account fees less refunds and exchange fees are the bridge's Fees step.
- **Tax withheld in euros is the converted gross less the converted received,** per payment, so gross, withheld and received always add up. Today each is converted on its own and they can differ by a cent. The worked portfolio's withheld becomes €2.57 instead of €2.56, and its spec changes on purpose.
- **The closed positions table replaces the Show sold switch** and the `sold` lines of `holdingsList`, which go with their words. One way to see what was sold.
- **Heatmap and underwater read the growth line's points** (the first day, each month end and the last day), so the deepest fall agrees with today's Largest fall.
- **The gap to the index is a plain difference in points,** month by month. A year's gap is the difference of the chained year returns, never a sum of months.
- **Compare with keeps nothing in the Investments file.** The pick is in the address (`?compare=twelvedata:QQQ`), the closes go into the prices file as a series, and reopening the chart asks only for the days missing.
- **Fetched facts are asked once** and typed fields always win. The precedence for a sector or a country: the typed fund mix, then the typed field, then fetched fund weights, then Finnhub's profile (the owner, 2026-11-02), then for a share's country the ISIN's first two letters. A fund's ISIN country is its domicile (IE for most UCITS funds), so it never stands in for a fund.
- **Sectors are the eleven GICS sectors.** Alpha Vantage's ETF_PROFILE uses them. Finnhub gives an industry such as "Semiconductors", which a fixed table maps to a sector. Its industry list is unconfirmed until one request.
- **Sector and country mixes are of the holdings,** cash left out, and the ring says "of holdings". Class, currency and account mixes are of the whole value with cash.
- **Performance and Income and costs use `PageTabs`,** kept in `?tab=` beside `?period=`. The period bar applies to every Performance tab but Months, which shows every month since the first deposit.
- **The projection keeps no inputs.** It opens with the monthly saving from Saving's average, 5% a year and 20 years, and says it is before tax and inflation.
- **The holding period of a closed position** is the days held weighted by units over its sales, as Portfolio Performance shows it. First bought and last sold sit beside it.
- **Tokens.** `--invest-buy` and `--invest-sale` alias `--tone-positive` and `--tone-negative`. Three gain steps and three loss steps (`--gain-1` to `--gain-3`, `--loss-1` to `--loss-3`) carry the treemap and the heatmap, each passing 4.5:1 against ink text in both themes.
- **Not in these waves:** look-through to single companies inside funds, alerts, a watchlist, an .ics export, several comparisons at once and allocation over time. Each waits until the owner asks.

## Shared pieces

| Piece                                                             | Where                                                         | Used by                       | Library                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| `ChartCard` gains a `table` slot for charts with no category axis | `src/shared/ui/ChartCard.vue`                                 | treemap                       | Specimen with a slotted table, catalogue row's props |
| `TreemapChart` registered                                         | `src/shared/charts/echarts.ts`                                | treemap                       | none                                                 |
| Gain and loss steps, buy and sale aliases                         | `src/shared/styles/tokens.css`, `tests/tokenContrast.spec.ts` | treemap, heatmap, price chart | Swatches in the gallery's foundations                |
| `countryName(code)` through `Intl.DisplayNames`                   | `src/shared/text/countryName.ts`                              | country mix, tax withheld     | none                                                 |
| `stripeDecal` for an estimate                                     | already in `src/shared/charts/chartTheme.ts`                  | coming income                 | none                                                 |

Every new screen piece below starts in the Investments app. `DonutCard`, `FigureTable`, `SortableHeader`, `PageTabs`, `KpiTile`, `FactGrid`, `MoneyInput`, `ChoiceButtons`, `AppDialog`, `FormGrid`, `EmptyState` and `ShowAllButton` are used as they are. Their Investments counts in the catalogue, `.agents/skills/kuna-design/components.md`, change with each wave, which `tests/designCatalogue.spec.ts` checks.

## Holdings

### H1. The five mixes

- **Where.** The top of Holdings, five collapsible `DonutCard`s in a `DashboardGrid layout="cards"` (`holdings.mix.sector` and so on), with the open holdings card below them across the grid. Holdings stops being a narrow screen. On a phone the cards start collapsed but Sector, each with its largest group as the summary. Overview's "Where the money is" becomes the class mix with a link to Holdings, and `ShareBars.vue` goes.
- **Domain.** `holdingMix(figures, book, facts, mix)` in `holdings/domain/holdingMix.ts` gives `{ group, value, share }` per group, largest first, where `mix` is `sector`, `currency`, `country`, `class` or `account`. `exposureOf(instrument, mix, book, facts)` in `holdings/domain/exposure.ts` applies the precedence above and returns weighted groups. A holding in two accounts splits by its units, the last account taking the rest. Spec: €6,000.00 of a share Finnhub files under Semiconductors and €4,000.00 of a fund weighted 25% information technology, 15% financials, 10% health care and 50% industrials give information technology €7,000.00 (70%), industrials €2,000.00, financials €600.00, health care €400.00. A typed Sector on the share moves its €6,000.00, and a typed fund mix wins over the fetched weights.
- **Records.** New optional fields on `instrument`: `sector` (one of the eleven) and `country` (ISO 3166 code, or a region: World, Europe, North America, Asia and Pacific, Emerging markets). New kind `fund-mix` for a typed mix. Both flagged in the decisions.
- **Components.** `DonutCard` as it is, at most five parts: the four largest groups and one grey "Other and not known". A line under a ring names how many holdings have no sector or country yet, linking to the first. Class and currency parts open Holdings grouped that way, the others have no link. `InstrumentFields.vue` gains a sector select, a country select and the fund mix rows.
- **Words.** By sector / Po sektoru · By country or region / Po državi ili regiji · By currency / Po valuti · By class / Po klasi · By account / Po računu · of holdings / u pozicijama · Other and not known / Ostalo i nepoznato · 2 holdings have no sector yet / Dvije pozicije još nemaju sektor. Sectors (Croatian unchecked): Information technology / Informacijska tehnologija, Financials / Financije, Health care / Zdravstvo, Consumer discretionary / Ciklička potrošnja, Consumer staples / Osnovna potrošnja, Industrials / Industrija, Energy / Energija, Materials / Materijali, Utilities / Komunalne usluge, Real estate / Nekretnine, Communication services / Komunikacijske usluge.
- **Checks.** `investments-holdings` at 360, 640, 768, 1024, 1440 and 1920 px in both themes, and Croatian at 360, with the five rings and the table rearranging at 768, 1440 and 1920. Touch: a class part opens Holdings grouped by class.
- **Fake data.** Typed sectors and countries on two made-up instruments, a typed fund mix on the made-up World ETF, and in Wave 3 a fake Finnhub profile and fake ETF weights.
- **Size.** M for the typed sources (Wave 2H), S for the fetched ones (Wave 3).

### H2. Closed positions

- **Where.** Holdings, a collapsible card "Closed positions" (`holdings.closed`) below the open holdings.
- **Domain.** `closedPositions(figures)` in `holdings/domain/closedPositions.ts`: one row per instrument with nothing held and a sale. Units bought (with units from a spin-off, in the units sold after any split), units sold, cost, proceeds after fees, realised and its share of the cost, income received while held, first bought, last sold and days held weighted by units. Spec: buy 10 at €100.00 with €2.00 fees on 2 Jan 2024, buy 5 at €110.00 with €2.00 on 1 Jul 2024, a €6.00 dividend, sell 15 at €130.00 with €3.00 on 3 Mar 2026 give cost €1,554.00, proceeds €1,947.00, realised €393.00 at 25.3%, income €6.00 and 731 days (791 days for 10 units, 610 for 5).
- **Records.** None.
- **Components.** `FigureTable` with `SortableHeader` from 768 px, two-line rows below it as `HoldingRow` does, `DrillLink` to the holding's page, `ShowAllButton` past ten.
- **Words.** Closed positions / Zatvorene pozicije · Bought / Kupljeno · Sold / Prodano · Proceeds / Primici · Realised / Ostvareno · Income while held / Prihod dok ste držali · First bought / Prva kupnja · Last sold / Zadnja prodaja · Held / Držano · 731 days / 731 dan.
- **Checks.** The card in `investments-holdings` at every width. Touch: a closed row opens its page and Back returns.
- **Fake data.** A made-up "Example Retired Co" in dollars, bought twice, paid a dividend, sold in full.
- **Size.** M.

### H3. Treemap

- **Where.** Holdings, a collapsible `ChartCard` "Map of holdings" (`holdings.map`) after the mixes.
- **Domain.** None new. `treemapChart(figures, tokens)` in `holdings/presentation/` sizes each held holding by value and colours it by its gain on what is held: up to 10%, 10% to 25%, over 25%, each way. Each tile's label carries the name and the signed percent, so colour is never the only cue. Cash is left out. A tile opens its holding. Spec on the worked portfolio: World ETF €1,875.00 at +20.7% (step 2), Stock B €776.79 at +8.6% (step 1).
- **Records.** None.
- **Components.** `ChartCard` with its new `table` slot holding a `FigureTable` (holding, value, weight, gain).
- **Words.** Map of holdings / Karta pozicija · Size is the value, colour the gain on what you hold / Veličina je vrijednost, boja dobit na onome što držite.
- **Checks.** Its card in `investments-holdings`, light and dark, and at 360 px the labels that do not fit hidden. Touch: a tile tap opens its holding.
- **Fake data.** The sample as it is, with one holding at a loss.
- **Size.** M.

### H4. Target mix

- **Where.** Holdings, a card "Target mix" beside the mixes, for the mix that has targets. Set targets opens an `AppDialog` with a percent field per group of that mix and the running total. A `MoneyInput` "If you put in" fills a Buy column.
- **Domain.** `targetGaps(parts, targets, value)` and `depositSplit(parts, targets, deposit)` in `holdings/domain/targetMix.ts`. The gap is target × value − now. A deposit fills shortfalls against the new total, in proportion when it cannot fill them all, the last group taking the rest. Spec: €10,000.00 as stocks €7,000.00, bonds €2,000.00 and cash €1,000.00 against 60, 30 and 10% gives gaps −€1,000.00, +€1,000.00 and €0.00. €2,000.00 buys €200.00, €1,600.00 and €200.00. €1,000.00 buys €0.00, €928.57 and €71.43.
- **Records.** New kind `target`, flagged. Saves and Undo through `useRecordWrites`. Targets that do not add up to 100% are refused.
- **Components.** `AppCard`, `FigureTable`, `MoneyInput`, `AppDialog` with `FormGrid as="form"`.
- **Words.** Target mix / Ciljna raspodjela · Set targets / Postavi ciljeve · Gap / Razlika · If you put in / Ako uplatite · Buy / Kupite · Targets add up to 100% / Ciljevi zajedno trebaju činiti 100 %.
- **Checks.** A `investments-holdings-targets` page at every width and Croatian at 360. Touch: set targets, type 2k into "If you put in", read the Buy column, Undo.
- **Fake data.** Class targets of 70, 20 and 10% on the sample.
- **Size.** M.

### H5. Holdings on a past date

- **Where.** Holdings' header, a date field "On" with Today beside it, kept in `?on=`. The mixes, the treemap, the table and the closed positions all follow it, and the description reads "at the close of 31 Dec 2025".
- **Domain.** None new. The figures are `dayValuer(sources)(day)` from `performance/domain/portfolioPerformance.ts`, the records up to the day at the closes on or before it. Spec: the worked portfolio on 1 Feb 2026 holds 20 Stock B and has realised nothing, and a day before the first record shows the empty state.
- **Records.** None.
- **Components.** `UInput type="date"` as Loans uses it, `UButton` Today.
- **Words.** On / Na dan · Today / Danas · Holdings at the close of {day} / Pozicije na zatvaranju {day}.
- **Checks.** `investments-holdings-on-date` at 360 and 1440 px, both themes, Croatian at 360. Touch: pick a date, then Today.
- **Fake data.** None new.
- **Size.** S.

### H6. Portfolio checks

- **Where.** Overview, a card "Portfolio checks" after the tiles, failing checks first, each line with an icon and a word as well as its colour. Settings gains a Checks tab with a percent field and a switch per check.
- **Domain.** `portfolioChecks(figures, mixes, costs, targets, thresholds)` in `overview/domain/portfolioChecks.ts`. Defaults: the largest holding over 20% of the value, the largest currency over 50%, sector over 30%, country or region over 60%, account over 50%, cash over 10%, the last 12 months' costs over 1% of the average value (from I5), and a target gap over 5 points. Spec: a holding at 34.2% fails 20% with "Example Tech is 34.2% of the value, over 20%", a check switched off is left out, a changed threshold is read from its record.
- **Records.** New kind `check`, only for a threshold the owner changes, flagged.
- **Components.** `AppCard`, `FormGrid` and `USwitch` on the tab.
- **Words.** Portfolio checks / Provjere portfelja · Within / U granici · Over / Iznad praga · {name} is {share} of the value, over {limit} / {name} čini {share} vrijednosti, iznad {limit} · Threshold / Prag. The owner, 2026-11-02: a group's line takes a colon, '{name}: {share} of the holdings, over {limit}' / '{name}: {share} vrijednosti pozicija, iznad {limit}', a single holding keeps '{name} is {share} of the value', and the settings field is labelled with the check's name, without Threshold.
- **Checks.** `investments-overview-sample` shows the card, `investments-settings-checks` at every width. Touch: change a threshold and Undo.
- **Fake data.** The sample fails the holding check. One changed threshold.
- **Size.** M.

## A holding's price chart

### C1. Trade dots, the tooltip and daily closes

- **Where.** The holding's `ChartCard`. Buys are filled dots in `--invest-buy`, sales rings in `--invest-sale`, the legend and the table saying which.
- **Domain.** `priceHistory` in `holdings/domain/priceHistory.ts` merges the trades of each chart point, a day on a daily line and a month on a monthly one, per side, with their euro amount. `markSize(amount, largest)` gives the diameter as 22 px × √(amount ÷ largest), at least 6 px. Daily closes come from a new `PriceBook.closesBetween(instrument, from, to)` once the series has them, month ends otherwise. The average cost shows with the places of the latest close, never fewer than the currency's. Specs: €6,728.10 and €1,682.03 on one chart are 22 and 11 px, €100.00 is 6 px. Five buys in one month merge into one dot whose tooltip reads "Bought 3 units at €517.70 · €1,553.10", "Bought 2 units at €520.00 · €1,040.00", "Bought 1 unit at €515.00 · €515.00", "and 2 more, 7 units, €3,620.00 in all". An average of €517.7123 against closes written to two places shows €517.71.
- **Records.** None.
- **Components.** `ChartCard`, `ChartLegend` with dot and ring marks.
- **Words.** Bought {units} at {price} · {amount} / Kupljeno {units} po {price} · {amount} · Sold … / Prodano … · and {count} more, {units}, {amount} in all / i još {count}, {units}, ukupno {amount} · Daily closes / Dnevne zaključne cijene · Dot size is the amount / Veličina točke je iznos.
- **Checks.** `investments-holding-usd` and `-split` at every width, both themes, Croatian at 360. Touch: tap a dot at 360 px and read the tooltip.
- **Fake data.** Two more made-up buys of Example Tech in September 2026 beside the one there. The fake closes are already daily.
- **Size.** M for the dots and tooltip (Wave 2C), S for daily closes (Wave 4).

### C2. Compare with

- **Where.** A holding's price chart and Performance's growth chart, a "Compare with" button opening a search in an `AppDialog`. With a comparison on, both lines read as percent change from the chart's first day, and the pick shows as a removable chip.
- **Domain.** `percentChange(points)` in `compare/domain/comparedLine.ts`. On Performance the compared closes become euros at the ECB rate of each close's day, as the benchmark's do, and the portfolio's growth line converts from €100 to percent. `symbolSearch(query)` in `compare/application/` asks every vendor whose registry entry offers search, on Search rather than per keystroke, and merges the answers by symbol and exchange, each naming its vendor. Picking a ticker asks its closes from the chart's first day, and the vendor's own splits apply to it. Specs: lines from 100.00 and 50.00 to 110.00 and 60.00 read +10.00% and +20.00% (every change shows two places), and a dollar ticker at 1.10 and 1.20 reads in euros.
- **Records.** None. A new currency joins the ECB demand through `RatesWanted`.
- **Components.** `AppDialog`, `UInput`, a result list, `ChartLegend`.
- **Words.** Compare with / Usporedi s · Search / Traži · No ticker found / Simbol nije pronađen · Change since {day} / Promjena od {day} · Fetching its closes / Dohvaćaju se cijene · Remove / Ukloni.
- **Checks.** `investments-holding-compare` and `investments-performance-compare` at every width, both themes, Croatian at 360. Touch: search, pick, read the percent axis, remove.
- **Fake data.** Fake search answers from Twelve Data, Alpha Vantage and Finnhub, and one made-up compared series.
- **Size.** L.

## Performance

### P1. Monthly returns

- **Where.** Performance, tab Months. A grid of years by months with a year column, and a switch between "Your return" and "Against the index".
- **Domain.** `monthlyReturns(growth)` in `performance/domain/monthlyReturns.ts` from Performance All's growth points: each month's index over the month before, the first month from the first day, years chained, and the gap as portfolio less index in points. Spec: an index of 100, 102, 99.96 and 104.958 gives +2.00%, −2.00% and +5.00%, +4.96% for the quarter. An index up 1% each month gives gaps of +1.0, −3.0 and +4.0 points and +1.93 points for the quarter, not the +2.0 a sum would give.
- **Records.** None.
- **Components.** `ReturnHeatmap.vue` in `performance/presentation/`: a `FigureTable` with cells tinted by the gain and loss steps and the signed figure in each, so it scrolls sideways on a phone and reads as a table.
- **Words.** Months / Mjeseci · Your return / Vaš prinos · Against the index / Prema indeksu · {gap} points / {gap} p. b. · Year / Godina.
- **Checks.** `investments-performance-months` at every width, both themes, Croatian at 360. Touch: switch to Against the index.
- **Fake data.** The sample from January 2023 and its benchmark.
- **Size.** M.

### P2. The gain bridge, what drove the return and the currency effect

- **Where.** Performance, tab Sources, three cards for the period picked: "How the value changed" (a waterfall), "What drove the return" (a bar per holding) and "Currency effect" (a table per holding and for the portfolio).
- **Domain.** `periodGains(sources, period, valuedOn)` in `performance/domain/periodGains.ts` gives the start and end value, put in and taken out, and per holding its price, currency, realised and income parts, plus currency on cash and fees. A lot open at the period's start counts from its value at the start's close and rate, a lot opened inside from its cost. Price is the change in the quote currency at the end's rate, currency the rest of the euro change. Income is shown as gross and tax withheld. Specs: the worked portfolio over All gives price +€427.47, currency −€33.76, realised +€15.06, income +€8.55, tax withheld −€2.57 and no fees, €414.75 in all, which is the Overview's gain. The drivers are World ETF +€321.00, Stock B +€82.83 and currency on cash +€10.92. A euro fund of 10 units at €100.00 at the start, bought 5 at €110.00 with €2.00 fees, sold 3 at €120.00 with €1.00 and an account fee of €5.00, closing at €125.00, gives price +€248.00, realised +€59.00, fees −€5.00, €302.00. 10 dollar units from $50.00 at 1.10 to $55.00 at 1.20 give price +€41.67 and currency −€37.89.
- **Records.** None.
- **Components.** `ChartCard` for the waterfall (stacked bars with a blank base) and for the drivers (horizontal bars, eight holdings and "Others"), `FigureTable` for the currency effect. The tables come from the charts' category axes.
- **Words.** Sources / Izvori · How the value changed / Kako se mijenjala vrijednost · Start / Početak · Put in / Uloženo · Taken out / Isplaćeno · Price / Cijena · Currency / Tečaj · Realised / Ostvareno prodajom · Income / Prihod · Tax withheld / Zadržani porez · Fees / Naknade · End / Kraj · What drove the return / Što je donijelo prinos · Currency effect / Učinak tečaja · Others / Ostale.
- **Checks.** `investments-performance-sources` on All and 1Y at every width, both themes, Croatian at 360. Touch: change the period on the tab.
- **Fake data.** The sample's dollar holdings and its exchange.
- **Size.** L.

### P3. Underwater chart

- **Where.** Performance, tab Falls, a `ChartCard` "Below the peak" beside today's `RiskCard`, which moves to this tab.
- **Domain.** `underwater(growth)` in `performance/domain/underwater.ts`: each point's index over the running peak less 1, the deepest, the one now, and the longest time below a peak from the peak's day to the day it is regained, or to the last day. Spec: 100, 120, 90, 110, 130 and 104 at the month ends from 31 Jan to 30 Jun 2025 give 0, 0, −25.0%, −8.3%, 0 and −20.0%, deepest −25.0% as Largest fall, now −20.0%, longest 92 days from 28 Feb to 31 May.
- **Records.** None.
- **Components.** `ChartCard` with a filled line below zero in `--invest-portfolio`, `FactGrid` for the three figures.
- **Words.** Falls / Padovi · Below the peak / Ispod vrha · Now / Sada · Deepest / Najdublje · Longest below a peak / Najdulje ispod vrha · {days} days / {days} dana.
- **Checks.** `investments-performance-falls` at every width, both themes, Croatian at 360.
- **Fake data.** The made-up benchmark already wobbles. The sample needs one month-end dip, which a larger swing on one series gives.
- **Size.** S.

## Income and costs

A new menu screen after Performance, `income/` with `domain/` and `presentation/`, route `/investments/income`, icon `i-lucide-coins`, words "Income and costs" / "Prihodi i troškovi". The Overview's Income tile opens it.

### I1. Income by month and year

- **Where.** Tab Income. A bar chart of income received per month, and a year table with gross, withheld and received per kind (dividends, interest, other).
- **Domain.** `incomeByMonth(book)` and `incomeByYear(book)` in `income/domain/incomeHistory.ts`, with the withheld rule above and a coupon's paid-back accrued interest left out, as `receivedInEuros` does. Spec: the worked portfolio's dividend gives 2025 gross €8.55, withheld €2.57, received €5.98, and September 2025 €5.98.
- **Records.** None.
- **Components.** `ChartCard`, `FigureTable`.
- **Words.** Income / Prihod · By month / Po mjesecima · By year / Po godinama · Gross / Bruto · Withheld / Zadržano · Received / Primljeno · Dividends, Interest, Other / Dividende, Kamate, Ostalo.
- **Checks.** `investments-income` at every width, both themes, Croatian at 360.
- **Fake data.** Interest in two more months on the sample.
- **Size.** M.

### I2. Coming income, forecast and calendar

- **Where.** Tab Coming. Bars for the next 12 months from the first of this month, announced payments solid and copied ones striped, then a list by month with day, holding, amount and status.
- **Domain.** `incomeForecast(sources, announced)` in `income/domain/incomeForecast.ts`. Each payment of the last 12 months by a holding still held is copied a year on, scaled by the units held now over the units held on its day, at today's rate. An announced payment (Alpha Vantage DIVIDENDS, from Wave 3) replaces the copy of the same holding within 20 days and takes the last payment's withheld share. Spec: $12.00 gross with $1.80 withheld on 15 Jun 2026 on 40 units, with 50 held now, is $15.00 and $2.25 on 15 Jun 2027, €11.38 received at 1.12.
- **Records.** None. Announced payments are fetched facts, see D1.
- **Components.** `ChartCard` with `stripeDecal`, `FigureTable`.
- **Words.** Coming / Očekivano · Announced / Najavljeno · From last year / Prema prošloj godini · next 12 months / sljedećih 12 mjeseci · about {amount} / oko {amount}.
- **Checks.** `investments-income-coming` at every width, both themes, Croatian at 360.
- **Fake data.** The sample's half-yearly dividend, and in Wave 3 one fake announced payment.
- **Size.** M, S for the announced part.

### I3. Tax-free calendar

- **Where.** Tab Tax-free. Every open lot that turns tax-free in the next 24 months, by month: holding, units, bought, cost, value now, gain, with "At a loss" as an icon and a word. The card's summary counts the lots at a loss.
- **Domain.** `taxFreeCalendar(figures)` in `income/domain/taxFreeCalendar.ts` from the open lots and `taxFreeFrom`, each lot's value its share of the holding's value by the one rounding rule. Spec: the worked portfolio's 10 World ETF bought 2 Jan 2025 turn tax-free on 3 Jan 2027, and Stock B's 15 bought 3 Mar 2025 on 4 Mar 2027. At $47.00 and 1.12 that lot is worth €629.46 against €715.00, at a loss of €85.54.
- **Records.** None.
- **Components.** `FigureTable`, `ShowAllButton`.
- **Words.** Tax-free / Bez poreza · Turns tax-free / Postaje bez poreza · At a loss / U gubitku · {count} lots at a loss / {count} kupnje u gubitku.
- **Checks.** `investments-income-tax-free` at every width, both themes, Croatian at 360.
- **Fake data.** The sample's 2026 buy of Example Tech, and the made-up spinco below its cost.
- **Size.** S.

### I4. Tax withheld by year and country

- **Where.** Tab Withheld. A table per year: country from the ISIN's first two letters, gross, withheld, received and the withheld share. Income with no ISIN is one row.
- **Domain.** `withheldByCountry(book)` in `income/domain/withheldByCountry.ts`. No tax is worked out. Spec: in 2025, $100.00 of US dividends with $15.00 withheld at 1.10 and €40.00 from an IE fund with nothing withheld give US €90.91, €13.64, €77.27, 15.0%, and IE €40.00, €0.00, €40.00, 0.0%.
- **Records.** None.
- **Components.** `FigureTable`, `countryName`.
- **Words.** Withheld / Zadržano · Tax withheld at source / Porez zadržan na izvoru · Country, from the ISIN / Država, iz ISIN-a · No ISIN / Bez ISIN-a.
- **Checks.** `investments-income-withheld` at every width, both themes, Croatian at 360.
- **Fake data.** Made-up ISINs with US and IE prefixes on the sample's payers, and one IE fund dividend.
- **Size.** S.

### I5. Costs per year

- **Where.** Tab Costs. A table per year: trading fees, exchange fees, account fees less refunds, fund costs estimated from each fund's TER, the total and its share of the year's average value. A line says fund costs are already inside the fund's price and are never taken off again.
- **Domain.** `yearlyCosts(sources, valuedOn)` in `income/domain/yearlyCosts.ts`. A fund's cost is its TER × the average of its 12 month-end values, zero for a month it was not held. Specs: the worked portfolio's 2025 trading fees are €4.95 (€2.00, $1.00 at 1.05 as €0.95, €2.00) and 2026's €0.85. A fund at €10,000.00 at every month end of 2025 with a 0.20% TER costs €20.00, held only from July €10.00.
- **Records.** New optional field `ter` on `instrument`, in percent a year, flagged.
- **Components.** `FigureTable`, the TER field in `InstrumentFields.vue`.
- **Words.** Costs / Troškovi · Trading fees / Naknade trgovanja · Exchange fees / Naknade konverzije · Account fees / Naknade računa · Fund costs, estimated / Troškovi fondova, procjena · TER / TER · The fund's yearly cost in percent, from its key information document / Godišnji trošak fonda u postotku, iz dokumenta s ključnim informacijama.
- **Checks.** `investments-income-costs` at every width, both themes, Croatian at 360.
- **Fake data.** A 0.20% TER on the made-up World ETF.
- **Size.** M.

### I6. How regularly you invest

- **Where.** Tab Saving. Bars of what was put in each month for the last 24 months, and three tiles: months in a row, the longest run and the average a month over the last 12 complete months.
- **Domain.** `investingRhythm(book, today)` in `income/domain/investingRhythm.ts`, deposits less withdrawals per month. The current month counts once it has a deposit, else the run ends the month before. Spec: on 31 Oct 2026 with €500.00 put in each month from June to September and none in May or October gives 4 months in a row, "October has none yet", and €166.67 a month.
- **Records.** None.
- **Components.** `DashboardGrid layout="tiles"` of `KpiTile`, `ChartCard`.
- **Words.** Saving / Štednja · How regularly you invest / Koliko redovito ulažete · Months in a row / Mjeseci zaredom · Longest run / Najdulji niz · A month, last 12 months / Mjesečno, zadnjih 12 mjeseci · {month} has none yet / U {month} još ništa.
- **Checks.** `investments-income-saving` at every width, both themes, Croatian at 360.
- **Fake data.** €200.00 deposits each month from June to September 2026 on the second made-up broker.
- **Size.** S.

### I7. Projection

- **Where.** Tab Saving, below I6: a monthly saving (`MoneyInput`), a return a year and years, a line of the value by year, and what 3.5% and 4% of the end value give a year and a month.
- **Domain.** `projection(value, monthly, yearlyRate, years)` in `income/domain/projection.ts`, the monthly rate (1 + r)^(1/12) − 1 with each saving at its month's end. Spec: €100,000.00, €500.00 a month, 5% and 20 years end at €468,232.01, 3.5% is €16,388.12 a year or €1,365.68 a month, 4% is €18,729.28 or €1,560.77.
- **Records.** None.
- **Components.** `FormGrid`, `MoneyInput`, `UInput` with `inputmode="decimal"`, `ChartCard`, `FactGrid`.
- **Words.** Projection / Projekcija · Each month / Svaki mjesec · Return a year / Prinos godišnje · Years / Godine · At {rate} a year you could take out / Uz {rate} godišnje mogli biste isplaćivati · Before tax and inflation / Prije poreza i inflacije.
- **Checks.** The tab at every width and Croatian at 360. Touch: type 1k into Each month and read the end value.
- **Fake data.** None new.
- **Size.** S.

## Fetched facts

### D1. Finnhub, fund weights, announced dividends and symbol search

- **Where.** No screen of its own. Finnhub joins the registry (key, sign-up link, 60 calls a minute, a Test), so the Prices tab lists it. The CSP's `connect-src` gains `https://finnhub.io`, and the privacy page names it.
- **Domain.** A `finnhub.ts` vendor offering a profile (`/stock/profile2` by ISIN, else symbol: industry and headquarters country) and search. Alpha Vantage gains `ETF_PROFILE` (sector weights), `DIVIDENDS` and `SYMBOL_SEARCH`, Twelve Data `symbol_search`. The prices file's version 2 adds `facts`, keyed by vendor and symbol with the day asked: `{ "asked": "2026-11-02", "industry": "Semiconductors", "country": "US" }`, `{ "asked": …, "sectors": [["INFORMATION TECHNOLOGY", "0.251"]] }`, `{ "asked": …, "dividends": [["2026-11-14", "2026-12-15", "0.3100"]] }`. An empty answer is kept too, so nothing is asked twice. After the day's closes, the fetch asks Finnhub for each held instrument without a typed sector and country and no fact yet, then Alpha Vantage's ETF_PROFILE for those Finnhub knew nothing about, then DIVIDENDS once a month per holding that paid in the last 13 months, all inside Alpha Vantage's 25 a day after the closes. A `FactsBook` port in `prices/domain/` feeds `exposureOf` and `incomeForecast`. Specs on fake answers: a profile answer is read once and a second fetch asks nothing, ETF weights reach the sector mix, an announced dividend replaces the copied one, a day out of Alpha Vantage calls leaves the rest for tomorrow and says so in the last fetch's line.
- **Records.** None in the Investments file. The prices file's new section is flagged.
- **Components.** None new. The Prices tab is the prices work's.
- **Words.** Finnhub / Finnhub · Company profiles of US shares / Profili američkih dionica · Sector weights of funds / Sektorski udjeli fondova · Announced dividends / Najavljene dividende.
- **Checks.** `investments-settings-prices` lists Finnhub. Touch: type a Finnhub key, Test against the fake responder, remove it.
- **Fake data.** Fake answers for profile2, ETF_PROFILE, DIVIDENDS and the three searches in `fakeVendorAnswers.ts`, and fake facts in the fake prices file.
- **Size.** L.
- **Instrument type from the search answers (the owner, 2026-11-01).** An instrument's type stays optional, and a fetched one fills it until it is typed. Twelve Data's `symbol_search` answers carry `instrument_type` (the docs' example is `Common Stock`, and the `/stocks` type filter lists `ETF`, `Mutual Fund`, `Digital Currency` and others). Alpha Vantage's `SYMBOL_SEARCH` answers carry `"3. type"` (`Equity` on the demo key, `ETF` expected). The fact is kept like the others, `{ "asked": …, "type": "Common Stock" }`, and a fixed table maps the vendor's words to share, fund, bond or crypto. Precedence: the typed type, then the fetched one. A fetched share then takes its ISIN country like a typed one. The dialog's search proposes the type when it fills the symbol. Spec on fake answers: an untyped instrument whose search answer says `Common Stock` reads as a share on the country ring, and a typed Fund wins over a fetched `Common Stock`.
- **Unconfirmed until one request with the owner's keys:** whether Twelve Data's and Alpha Vantage's search answer with a type for the owner's European listings, Finnhub's industry list and whether profile2 answers for funds or non-US listings, ETF_PROFILE's field names and which funds it covers (the owner's European UCITS listings likely not), DIVIDENDS' field names, and whether Twelve Data's "internal non-display usage only" wording on Basic covers showing search results.

## Waves

Every wave branches from main after the prices work merges, since that work may touch `InstrumentFields.vue` and reshapes the registry. Each wave is one build agent (Opus), then an independent review against the library rules and this plan, a fix pass, and the lead's own checks: `npm run check`, `npm run build`, `npm run build:fake`, `npm run check:visual -- --only <its pages> --widths 360,640,768,1024,1440,1920`, `npm run check:touch -- --only <its flows>`, the `design-reviewer` agent on the diff, and `npm run check:figures` on Company's and Loans' fake sets unchanged. CI runs the full suites.

| Wave                   | Holds                                                                                                                                                                                                                                                                                                | After                                | Beside it     | Size |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------- | ---- |
| 1a Records             | `instrument` fields `sector`, `country`, `ter`, kinds `fund-mix`, `target`, `check` with readers, codecs, write rules and the contract test, the instrument dialog's new fields, the withheld rule in `portfolioFigures.ts` and `lots.ts`, and every new made-up record of the fake Investments file | the owner's answers, the prices work | 1b            | M    |
| 1b Shared pieces       | `ChartCard`'s `table` slot, `TreemapChart`, the gain, loss, buy and sale tokens, `countryName`                                                                                                                                                                                                       | the prices work                      | 1a            | S    |
| 2H Holdings            | H1 on typed sources, H2, H5, the Overview's class mix, `ShareBars` and the sold lines gone                                                                                                                                                                                                           | 1a, 1b                               | 2P, 2I, 2C    | L    |
| 2P Performance         | `PageTabs` on Performance, P1, P2, P3                                                                                                                                                                                                                                                                | 1b                                   | 2H, 2I, 2C    | L    |
| 2I Income I            | The Income and costs screen, route and menu, I1, I2 copied, I3, I4                                                                                                                                                                                                                                   | 1a, 1b                               | 2H, 2P, 2C    | L    |
| 2C Trade dots          | C1 without daily closes                                                                                                                                                                                                                                                                              | 1b                                   | 2H, 2P, 2I    | M    |
| 2I2 Income II          | I5, I6, I7                                                                                                                                                                                                                                                                                           | 2I                                   | 3, 2H, 2P, 2C | M    |
| 3 Fetched facts        | D1, then H1's fetched sources and I2's announced payments                                                                                                                                                                                                                                            | 2H, 2I                               | 2I2           | L    |
| 4 Charts               | C1's daily closes, C2 on both charts                                                                                                                                                                                                                                                                 | 2C, 2P, 3                            | 5             | L    |
| 5 Targets, checks, map | H3, H4, H6 with the Settings Checks tab                                                                                                                                                                                                                                                              | 2H, 2I2                              | 3, 4          | L    |

What keeps the parallel lanes apart:

- **1a and 1b.** 1a touches `workbook/`, `holdings/presentation/Instrument*`, the withheld rule's two files, the fake seeds and `tests/recordStorageContract.spec.ts`. 1b touches only `src/shared/`, the gallery and the catalogue.
- **2H, 2P, 2I and 2C.** 2H owns `holdings/domain/holdingsList.ts`, the new `holdingMix.ts`, `exposure.ts` and `closedPositions.ts`, `HoldingsScreen.vue`, `HoldingsTable.vue`, `HoldingRow.vue` and `overview/presentation/WhereTheMoneyIsCard.vue`. 2C owns `priceHistory.ts`, `priceChart.ts` and `HoldingScreen.vue`, and puts its words inside the existing `chart` key while 2H adds new keys after `lots`, so the two edits to `holdings/presentation/words.ts` sit apart. 2P stays inside `performance/`. 2I owns the new `income/`, `app.ts` and `OverviewTiles.vue`.
- **2I2 and 3.** 2I2 adds tabs to `IncomeScreen.vue`. 3 owns `prices/`, the CSP, the privacy page, and touches only `holdings/domain/exposure.ts` and `income/domain/incomeForecast.ts` outside them.
- **3, 4 and 5.** 4 owns `HoldingScreen.vue`, `GrowthCard.vue`, `growthChart.ts`, the new `compare/` and `PriceBook`. 5 owns the target and treemap cards on Holdings, `OverviewScreen.vue` and `settings/presentation/`, none of which 3 touches.
- **Every lane** adds pages to `scripts/visual-check.mjs` and flows to `scripts/touch-check.mjs` and changes counts in `components.md`. Those three conflict at merge, and the lead resolves them by keeping both sides and recounting, which `tests/designCatalogue.spec.ts` confirms.

## Risks

- **Alpha Vantage's 25 calls a day** carry the European closes, fund weights, dividends and search. Closes always go first. Search asks Twelve Data and Finnhub before Alpha Vantage.
- **Fetched sectors may be thin.** Finnhub's free profile covers US companies only. The owner's European funds will need a typed mix, and the mix card names each holding that waits for one.
- **Holdings gets long on a phone.** Five rings, a map and a target card come before the table. They start collapsed there, and the visual check at 360 px is where the order gets judged.
- **The Income and costs screen values every month end** for fund costs, as Performance already does. If it is slow on the owner's file, it shares Performance's `dayValuer` through `usePortfolio`.

## Decisions for the owner

1. **Sector, country and TER on the instrument.** Today a holding's sector or country can only be typed in its note, which no figure reads, and Finnhub covers US shares only. Adding three optional fields lets you correct a fetched sector and type a European fund's TER once. Cost: three fields in the instrument dialog. Recommendation: add all three.
2. **A typed mix per fund, as a new `fund-mix` kind.** A world ETF split 62% US, 6% Japan and so on needs several lines. Options: a new kind with one line per group (instrument, sector or country, group, share), or one text field such as "US 62, JP 6", which would be a small language of its own. Recommendation: the new kind.
3. **Targets as a new `target` kind, on any mix.** You chose stored targets. Options: targets only for class (stocks, bonds, cash), or for any of the five mixes, one mix at a time. The kind is the same either way (mix, group, share). Recommendation: any mix, with class offered first.
4. **Check thresholds as a new `check` kind.** Options: fixed thresholds in the code, a `check` record only for a threshold you change, or a general key and value setting kind like Company's. Recommendation: the `check` kind, written only when you change a default.
5. **Fetched facts live in the prices file.** Finnhub profiles, fund weights and announced dividends are vendor answers like closes. Options: a `facts` section in the prices file (version 2), or Kuna writing them into instrument fields in the Investments file, where they would mix with what you typed and every save would upload them. Recommendation: the prices file.
6. **Donut colours by size.** The library says never to pick a colour by rank, and Investments uses one hue today because six class colours failed the palette check. A sector ring with eleven sectors cannot give each its own colour. Options: the four largest groups take the first four series colours in order of size and the rest is grey "Other and not known", or keep one-hue bar lists instead of rings. Recommendation: the rings, with the rule amended for an open set such as sectors.
7. **A new menu screen, "Income and costs".** It holds six tabs: Income, Coming, Tax-free, Withheld, Costs and Saving. Options: its own screen after Performance, or these as more tabs on Performance, which already gets four. Recommendation: its own screen.
8. **"How regularly you invest" counts what you put in.** Options: deposits less withdrawals each month, which matches the Put in figure and seeds the projection, or buys less sales, which also counts reinvested dividends and sale proceeds. Recommendation: deposits less withdrawals.
9. **The Overview's "Where the money is" becomes the class ring.** Two pictures of the same split (bars on the Overview, a ring on Holdings) would be two ways of doing one thing. Recommendation: the Overview shows the class ring with a link to Holdings, and `ShareBars` goes.

## The owner's answers, 2026-10-31

- Sector, Country and TER are fields on the instrument, filled from Finnhub where it answers and typed where it does not.
- A fund's own mix is a list of rows, a new `fund-mix` kind, checked to add up to 100%.
- Targets are a new `target` kind, on any of the mixes, one mix at a time.
- Check thresholds are a new `check` kind, written only when a default is changed, edited on a Checks tab in Settings.
- Fetched facts live in the prices file (version 2). What the owner typed always wins.
- Open lists colour the four largest slices in size order and the rest grey as "Other and not known". Fixed lists keep fixed colours. The design library's rule is amended for open lists.
- Income, forecast, tax-free calendar, tax withheld, costs, investing habit and projection are tabs on Performance, not a screen of their own. Waves 2P and 2I therefore both add tabs to the Performance screen, so the second of them rebases onto the first and keeps both sets of tabs.
- How regularly you invest counts deposits less withdrawals.
- The Overview's "Where the money is" becomes the class donut, and `ShareBars` goes.
