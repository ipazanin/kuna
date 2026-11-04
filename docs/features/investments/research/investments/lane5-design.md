# Lane 5: how portfolio apps present a portfolio, and Investments in Kuna

What Yahoo Finance, Sharesight, Ghostfolio, Portfolio Performance, Snowball, Delta, Kubera, getquin and a Croatian fund app show and get wrong, and the screens, colours and components an Investments app in Kuna would use, with a mockup.

The mockup shows the Overview, the Holdings list, a holding's page and the Add transaction dialog at 360 px and 1440 px, in light and dark (`?theme=light` or `?theme=dark` pins one). Every figure, holding and account in it is made up.

Kuna was read at `HEAD` `210875f`. Another session is editing the working tree, so every `file:line` below is against `HEAD`, not the tree. Web pages were loaded and checked on 2026-10-30. What could not be loaded says so.

## The short version

- **Every app leads with the same three things:** what it is worth now, what you gained in money, and a percentage. They differ on which percentage. Sharesight shows an annualised money-weighted figure, getquin defaults to a simple return, Ghostfolio shows "return on average investment", Portfolio Performance shows both a time-weighted and an internal rate. Mixing them without saying which is the most common source of confusion, so Kuna names the method in every label.
- **Proposal for the Overview:** four tiles (Value with the last day's change, Total gain in euros with the simple % on what you put in, Yearly return money-weighted, Income this year), then Value over time against what you put in, Where the money is, Where the gain comes from, Movers on the last day and Latest transactions.
- **Holdings:** one row per holding, grouped by class with subtotals. Columns: holding, quantity, price in its own currency, cost, value, gain in € and %, weight, last day. On a phone each row keeps name, value and gain on two lines, and everything else is on the holding's page.
- **A holding's page** splits the gain into price, currency and income (Sharesight and Ghostfolio both do this, and it is the answer to "why did my US share lose money when the price went up"). The price chart is in the quoted currency with the average cost as a dashed line and a dot per buy, which Ghostfolio's holding chart also draws.
- **Daily prices change the words, not the layout.** "Today" becomes "Last day" (the last close against the one before), the page header says which close the figures are at, and a holding whose price is late is named in a notice instead of silently carrying an old price.
- **Entry and import:** a dialog that starts from what happened (buy, sell, dividend, interest or coupon, cash in or out, fee, split), fills the exchange rate from the ECB for the date, and says what the holding looks like afterwards. Import reuses Company's import profiles (`src/apps/company/imports/presentation/ImportPanel.vue:90-97`), with a Yahoo profile built in. The owner's export has no currency column, so the import must ask for each listing's currency or infer it from the exchange suffix.
- **Colour:** the portfolio is blue (`--series-3`) on every chart, anything you compare it with (money put in, a benchmark, your average cost) is dashed grey. Income uses the green, violet and brass trio the Loans charts already validated. Allocation is a single-hue bar list, because five or six class colours fail the colour checks on one screen. The app's identity colour is a new plum, `--app-investments` #8a3f8c light and #d08ad3 dark, which passes Kuna's contrast test values.
- **Three decisions for the owner** at the end: which percentage leads, whether cash is tracked, and what to do with a short sale in a Yahoo export.

## What the comparable apps do

### Yahoo Finance portfolios

Checked: [Track holdings and transactions](https://help.yahoo.com/kb/SLN36348.html), [Overview of Portfolio](https://help.yahoo.com/kb/SLN36784.html), [Add, remove, or edit transactions](https://help.yahoo.com/kb/SLN2312.html), [Download portfolio data](https://help.yahoo.com/kb/SLN15034.html), [Negative lots](https://help.yahoo.com/kb/finance-app-for-ios/understand-negative-lots-transactions-yahoo-finance-portfolio-sln36984.html), the [signed-out portfolios page](https://finance.yahoo.com/portfolios/).

- **First screen:** the signed-out page promises "your portfolio performance" and, in a screenshot's alt text, asset and sector allocation. The signed-in views and their columns sit behind a login, so the exact column set is **unconfirmed**. The export itself shows what a row carries (below).
- **Transactions:** "buy, sell, sell short and buy to cover", lots per purchase, and a separate cash ledger where you "select the transaction type, date, amount, and currency". The portfolio's currency is chosen when it is created.
- **Import and export:** CSV both ways, "only from a desktop browser". Export covers "basic data fields" and the page lists no columns.
- **Gets right:** lots under one row, cash kept apart from holdings.
- **Gets wrong:** short sales used to be negative share lots. Yahoo now converts them to sells, which changes open lots under FIFO, as its own help page shows with 100, 200, −200 and −50 leaving one lot of 50. No documented import format.

### Sharesight

Checked: [Portfolio Investments page](https://help.sharesight.com/show_portfolio), [Portfolio Holding page](https://help.sharesight.com/portfolio-holding-page/), [Performance report](https://help.sharesight.com/performance_report/), [How Sharesight calculates performance](https://sharesight.com/blog/how-sharesight-calculates-your-investment-performance) (17 Feb 2020), [performance page](https://www.sharesight.com/investment-portfolio-performance/), [features](https://www.sharesight.com/features/).

- **First screen:** Portfolio value (with cash), Capital gain, Income, Currency gain, Total return.
- **Holdings columns:** Label, Price, Avg. buy price, Quantity, Value, Capital gains, Income, Currency, Return. Grouping by market (default), currency, sector, industry, investment type, country, custom group, or none, with subtotals per group.
- **Charts:** Growth (stacked or column), Value (line or stacked), Performance Index, Treemap, and Treemap against a benchmark. "Add a benchmark" on the overview, any stock, ETF or fund.
- **Holding page:** total return split into capital gain, dividends and currency gain for the chosen range, the cost base and cost per share, and the next dividend.
- **Method:** money-weighted, "a variation of the Modified Dietz method", annualised only for holdings kept over a year. The capital gain % "is an annualised return", so a 200% gain over three years shows as about 45%.
- **Import:** automatic from "200+ global brokers". CSV is not mentioned on the features page.
- **Gets right:** the three-way split into price, income and currency, which is the clearest way to show a foreign holding in a home currency. Grouping with subtotals.
- **Gets wrong:** an annualised % beside a money figure for the same period reads as "I made 45%" when the money says 200%. Kuna writes "a year" in every annualised label.

### Ghostfolio (open source)

Read in its repo at [`6030cc2`](https://github.com/ghostfolio/ghostfolio/tree/6030cc211bd95880122987fda3a88108e9bf8d6f) (29 Oct 2026), cloned read-only, and its [README](https://github.com/ghostfolio/ghostfolio).

- **First screen:** a performance line chart and the summary, whose labels are Time in Market, Buy, Sell, Invested Capital, Absolute Gross Performance, thereof Dividend, Fees, Absolute Net Performance, Net Performance, Total Assets, Cash, Buying Power, Emergency Fund, Liabilities, Net Worth and Annualized Performance (`apps/client/src/app/components/portfolio-summary/portfolio-summary.component.html`). That is too many for one screen.
- **Holdings columns:** icon, Name, First Activity, Quantity, Value, Allocation, Change, Performance. In "simple" mode only name and performance (`libs/ui/src/lib/holdings-table/holdings-table.component.ts:72-94`). On a phone the Allocation and Performance headers shorten to "%" and "±".
- **Holding page:** "Change with currency effect" and "Performance with currency effect" (`holding-detail-dialog.html:69,90`), Average Unit Price, Market Price, Minimum and Maximum Price, Invested Capital, Dividend, Dividend Yield, Fees, First Activity. The price chart draws the average unit price as a second line (`holding-detail-dialog.component.ts:143`).
- **Analysis page:** Absolute Asset Performance and Absolute Currency Performance shown apart (`analysis-page.html:157,194`), plus Performance, Portfolio Evolution, Investment and Dividend timelines, and a benchmark comparator ("Compare with…").
- **Allocations:** by currency, asset class, holding, sector, continent, market, region, country, account, ETF provider and ETF holding.
- **Ranges:** 1d, wtd, mtd, ytd, 1y, 5y, max, and single years (`libs/common/src/lib/config.ts:82-90`).
- **Method:** only "Return on Average Investment". The TWR and MWR calculators exist as classes whose every method throws "Method not implemented" (`apps/api/src/app/portfolio/calculator/twr/portfolio-calculator.ts:9-11`, same in `mwr/`).
- **Import:** CSV columns are matched by lower-cased header: `date` or `tradedate`, `symbol`, `code` or `ticker`, `type`, `action` or `buy/sell`, `price`, `unitprice`, `tradeprice` or `value`, `qty`, `quantity`, `shares` or `units`, `fee` or `commission`, and a required `ccy` or `currency` (`apps/client/src/app/services/import-activities.service.ts:26-40,241-249,300-311`). By that code, Yahoo's "Trade Date", "Purchase Price", "Transaction Type" and its missing currency column would not import without editing the file. I read this from the code and did not run it.
- **Gets right:** currency effect shown apart from price, average cost on the price chart, a phone mode that drops columns instead of scrolling.
- **Gets wrong:** a summary of 16 labels, and percentages whose method changes by name ("ROAI") without a plain explanation.

### Portfolio Performance (open source, desktop)

Checked: [the site](https://www.portfolio-performance.info/en/), [performance concepts](https://help.portfolio-performance.info/en/concepts/performance/), [performance view](https://help.portfolio-performance.info/en/reference/view/reports/performance/), [calculation panel](https://help.portfolio-performance.info/en/reference/view/reports/performance/calculation/), [statement of assets](https://help.portfolio-performance.info/en/reference/view/reports/statement/), [dashboard widgets](https://help.portfolio-performance.info/en/reference/view/reports/performance/dashboard/), [CSV import](https://help.portfolio-performance.info/en/reference/file/import/csv-import/), [repo](https://github.com/portfolio-performance/portfolio).

- **First screen:** a dashboard the user builds from widgets. Groups: Statement of Assets (Total, Absolute change, Delta, Invested Capital, Ratio, Taxonomies, Actual vs Target Allocation), Performance (TTWROR cumulative and annualised, IRR, Top Contributors, Performance Chart, monthly and yearly return heatmaps), Risk (Maximum Drawdown, Volatility, Sharpe ratio), Earnings (per month, quarter, year, upcoming dividends), Trades.
- **Holdings ("Statement of Assets"):** default columns Shares, Name, Symbol, Quote, Market Value, Share in %, Note. Purchase value by FIFO or moving average, profit and loss against FIFO. Market value converts to the base currency "using the ECB exchange rate from the previous day's close", while "the quote price remains in the currency in which the quote is traded". Columns marked `**` show the foreign-currency figure.
- **Calculation panel:** Initial Value, Capital Gains, Realized Capital Gains, Earnings, Fees and Taxes, Cash Currency Gains, Performance Neutral Transfers, Final Value. This is the clearest "where the gain comes from" of the apps here, and Kuna's card of that name follows it.
- **Import:** a wizard with a mapping row, per-column date and number formats, and saved templates. Portfolio transactions need Date, Value, Shares and one of ISIN, WKN, ticker or name.
- **Gets right:** both TTWROR and IRR, each labelled. Prices in their own currency, values in the base currency. The calculation panel.
- **Gets wrong:** a desktop tool with hundreds of options. Fine for the expert, heavy for a daily glance.

### Snowball Analytics

Checked: [home](https://snowball-analytics.com/), [overview](https://snowball-analytics.com/overview), [XIRR help](https://help.snowball-analytics.com/xirr/).

- **First screen:** Value, Invested ("purchases of all current (unsold) assets + currency"), Total profit ("dividends received, realized PL, fees paid and taxes on dividends"), IRR, and Period profit measured "relative to the value of the portfolio at the end of the previous day".
- **Dividends:** a calendar and a forecast of the year ahead.
- **Benchmark:** S&P 500, NASDAQ, FTSE, TSX and others.
- **Multi-currency:** holdings "in multiple currencies", 25+ currencies.
- **Gets right:** a dividend calendar, and saying that results depend on the cash mode ("All movements" against "Current balance/Not tracked").
- **Gets wrong:** the holdings table columns are not documented, and TWR is not mentioned anywhere I could load.

### Delta (by eToro)

The site returned 403 to my fetch. Checked instead: the [App Store listing](https://apps.apple.com/us/app/id1288676542?l=en-us), version 2026.3.1.

- Stocks, ETFs, crypto, forex and commodities, 150+ fiat currencies, 200+ exchange, broker and wallet connections.
- Free tier: up to 10 assets. PRO: up to 40, PRO+: unlimited, with conflicting prices in the listing.
- **Gets right:** crypto and stocks in one list. **Gets wrong:** caps on the number of assets. Import by file is not mentioned (**unconfirmed**).

### Kubera

Checked: [home](https://kubera.com/), [IRR help](https://help.kubera.com/article/79-irr-of-my-investment-in-kubera), [multi-currency post](https://www.kubera.com/blog/multi-currency-portfolio-tracker) (undated).

- Net worth first, every asset type including gold and property, multi-currency "through every layer", Essentials at $250 a year.
- IRR per asset from Cash In and Cash Out entries, compared "with indices and tickers such as the S&P 500 over the same period". The original amount is kept "as entered" and converted to the portfolio currency.
- **Gets right:** amounts kept in their own currency. **Gets wrong for the owner:** built around connections and a yearly fee, and returns per asset only from entries the user keeps.

### getquin

Checked: [home](https://www.getquin.com/), [return calculation](https://help.getquin.com/en/articles/6259821-return-calculation), [IRR and TTWROR](https://help.getquin.com/en/articles/12556127-difference-between-the-internal-rate-of-return-irr-and-ttwror), [file import](https://help.getquin.com/en/articles/16949483-file-import-using-getquin), [a community post on yield settings](https://app.getquin.com/en/post/NrieqjBGQI/not-all-returns-are-the-same).

- "The simple return is displayed by default", with TTWROR as an option and IRR "only visible for Premium and Wealth customers". Settings, Investment settings, Yield calculation switches it.
- File import of CSV and Excel with "a mapping function". When it cannot read a file itself, it sends the document to OpenAI. Bonds are entered with nominal divided by 100 and the price as a percentage ("99% is entered as 99").
- **Gets right:** the method is a visible setting. Bonds priced as a percentage of nominal. **Gets wrong:** a user's file leaves the device to a third party by default.

### A Croatian view: Erste Funds

Checked: the [Erste Funds App Store listing](https://apps.apple.com/hr/app/id1643497596) by Erste Asset Management d.o.o., version 1.59. Public pages for George's investment view and InterCapital's Genius app did not load or said nothing about the portfolio view (**unconfirmed**).

- The listing offers buying, selling and switching fund units and "povijest transakcija na jednom mjestu".
- A user review says the total "Zbraja EUR i USD bez konverzije", adding euro and dollar funds without converting. That is a review, not a statement by Erste, but it is the exact mistake Kuna's multi-currency rules prevent.

### Side by side

| App                   | Headline %                 | Holdings show price in | Currency effect apart | Benchmark                 | Import by file            |
| --------------------- | -------------------------- | ---------------------- | --------------------- | ------------------------- | ------------------------- |
| Yahoo                 | not documented             | not documented         | no                    | not documented            | CSV, desktop only         |
| Sharesight            | money-weighted, annualised | not stated             | yes                   | yes                       | brokers, CSV not stated   |
| Ghostfolio            | ROAI                       | base currency          | yes                   | yes                       | CSV by header names       |
| Portfolio Performance | TTWROR and IRR             | quoted currency        | yes, `**` columns     | not on the pages I loaded | CSV wizard with templates |
| Snowball              | IRR                        | not documented         | not stated            | yes                       | broker reports            |
| getquin               | simple, TTWROR, IRR (paid) | not stated             | not stated            | yes                       | CSV, Excel, PDF, AI       |
| Kubera                | IRR per asset              | as entered             | not stated            | yes                       | aggregators               |

## What the owner's export means for screens

Structure only, from the owner's `portfolio.csv`. No figure from it is in this file or the mockup.

- 17 columns: Symbol, Current Price, Date, Time, Change, Open, High, Low, Volume, Trade Date, Purchase Price, Quantity, Commission, High Limit, Low Limit, Comment, Transaction Type.
- Transaction Type is BUY, SELL, SHORT or blank.
- Blank rows are not trades: a symbol with only a quote (a watched symbol) or a `$$CASH` row with every field empty.
- Symbols: bare US tickers (and `$$CASH`), others with `.DE` (Xetra) or `.AS` (Amsterdam). No crypto (`-USD`, `-EUR`), currency (`=X`), gold or bond rows.
- Trade Date is `YYYYMMDD`. Date is `YYYY/MM/DD` and Time like `16:00 EDT`, which belong to the quote snapshot, not the trade.
- Commission can be empty. High Limit and Low Limit are always empty. Comment is rarely filled.
- Quantities have up to 6 decimals.
- **No currency column.** Purchase Price is in the listing's currency, so the import must know that `.DE` and `.AS` trade in euros and bare tickers in dollars, and ask when it cannot tell.

So the Yahoo profile maps Symbol, Trade Date, Transaction Type, Quantity, Purchase Price, Commission and Comment, ignores the quote columns, skips blank-type rows with a count (such as "2 rows are not trades: a watched symbol and the cash line"), and stops on SHORT (decision 3). Everything the owner holds outside Yahoo (crypto, gold, bonds, the money market fund, cash in other currencies) comes in by hand or by another profile.

## Lessons Kuna takes

| From                       | Kuna does                                                                           | Kuna avoids                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Sharesight, Ghostfolio, PP | Splits a foreign holding's gain into price, currency and income                     | An annualised % without "a year" next to it                                                   |
| PP                         | A "where the gain comes from" list: on what you hold, realised, income, fees, total | A dashboard the user has to build                                                             |
| PP, Kubera                 | Price in its quoted currency, value and gain in euros                               | Converting the price itself, or adding currencies without converting (the Erste Funds review) |
| Ghostfolio                 | Average cost dashed on the price chart, fewer columns on a phone                    | A summary of 16 labels                                                                        |
| getquin                    | Names the method of each %. Bonds priced in % of nominal                            | Sending files to a third party                                                                |
| Snowball                   | Period figures against the previous close, a dividend calendar later                | Hiding how cash changes the result                                                            |
| Yahoo                      | Lots under one holding, separate cash                                               | Negative lots as short sales                                                                  |
| valore                     | A holding without a price is named and left out of totals, never valued at zero     | Snapshot-only history that cannot give returns                                                |

## The proposal

### The app

- **Name:** Investments, Croatian "Ulaganja". Screens: Overview, Holdings, Transactions, Income, Performance, Tax, then Settings at the foot, as Loans does (`src/apps/loans/app.ts:18-45`).
- **Icon:** `i-lucide-trending-up`.
- **Identity colour:** `--app-investments`, plum. Light #8a3f8c, dark #d08ad3. Brass is Company and teal is Loans (`src/shared/styles/tokens.css:71-73,136-137`), and plum is close to no tone or chart series. Checked with the WCAG formula Kuna's test uses (`tests/tokenContrast.spec.ts:7-8,76-77`): light 5.84, 6.62 and 6.11 against page, card and elevated surface, and 4.77 and 5.37 on its own tile. Dark 7.39, 6.88 and 6.22, and 5.99 and 5.48 on its tile. It passes 4.5:1 as text and 3:1 as a mark. Add it to `APP_COLOURS` in that test (`:22`).
- **Home card figure:** the value, with the last day's change as its line.

### Words

- **Value:** what the holdings and cash are worth at the last close, in euros.
- **Total gain:** value less what you put in, which equals unrealised plus realised plus income less fees. Shown in euros.
- **"+25.4% on the €38,522.22 you put in":** the simple percentage, as a caption. This is the number the owner asked for as "% gain all time", and the caption says what it is measured against.
- **Yearly return:** money-weighted (XIRR), always with "a year".
- **Time-weighted return:** only on Performance, beside the benchmark, since it is the one that compares with an index.
- **Last day:** the last close against the one before. Never "Today", since prices arrive once a day and can be a day late.

The formulas belong to lane 3. These are the labels and where each figure lives.

### Colour

I ran the dataviz palette validator on the candidate sets.

- **Allocation by class with one hue each fails.** Five Kuna series (blue, violet, green, amber, pink) with `--pairs all`: light fails on blue against violet (ΔE 4.5 deutan, 10.5 normal), dark fails on pink against green (ΔE 1.6 deutan). The Loans lane found the same ceiling of three hues on one screen. So allocation is a **bar list in one hue**, each bar labelled with its name, amount and share. It works for six classes, any number of currencies or accounts, and keeps colour free for identity elsewhere. A `DonutCard` stays the Company pattern for at most five parts (`patterns.md:28`), and is not used here.
- **The portfolio is `--series-3` blue** on every chart (value, price, time-weighted return). Anything it is compared with is `--chart-deemphasis`, dashed: money put in, the benchmark, the average cost. Two roles, so no pair fails, and the dash is the second cue.
- **Income by kind** uses the trio the Loans lane validated in both themes: dividends `--series-1` green, coupons `--series-7` violet, interest `--loan-ahead` brass. New aliases `--income-dividend`, `--income-coupon`, `--income-interest` beside the `--loan-*` aliases (`tokens.css:199-201`).
- **Gains are tone, not series.** A gain figure is `MoneyText` with `tone="outcome"` and `sign="always"` (`src/shared/ui/MoneyText.vue:9-19`), green or red with its plus or minus sign. A last-day change also carries an up or down arrow, so colour is never the only cue.

### Overview

1. `PageHeader`: "Overview", and "At the close of Thursday 29 Oct. Prices update once a day, before 07:00." Actions Import and Add transaction.
2. A notice when a price is late or missing, naming the holding: "The Euro money market fund uses the price you entered on 27 Oct. No daily source covers it." Lane 4 found no free feed for Croatian fund prices, so a hand-entered price always shows its date. A holding with no price at all is named and left out, and the Value tile reads "Known value".
3. `DashboardGrid layout="tiles"`, four `KpiTile` (`src/shared/ui/KpiTile.vue:28-34`):
   - Value, with the last day's change as `delta` and a 12-month `trend`.
   - Total gain, caption "+25.4% on the €38,522.22 you put in, since Jan 2021", with a `definition`.
   - Yearly return, caption "a year, money-weighted, all time".
   - Income this year, with the change against the same months of last year.
4. `DashboardGrid layout="cards"`:
   - **Value over time**, full width (`xl:col-span-2`). Value as a blue line with a 10% wash, money put in as a dashed grey step line. Month ends, periods 1Y, 3Y, 5Y, All. Tooltip: value, put in, gain. Year ticks, every year on desktop and every other year on a phone. Table toggle as every `ChartCard`.
   - **Where the money is**: the bar list, switchable between class, currency and account.
   - **Where the gain comes from**: on what you hold, realised, income, fees, total gain.
   - **Movers on the last day**: three up and three down by %, each with its euro change.
   - **Latest transactions**: the last five, with a link to all.

At 360 px the tiles are two by two and cards stack. At 1440 px the tiles are one row, the chart spans both columns and the other cards pair up. From 3xl the pairs become three columns, as the reflow rule demands.

### Holdings

- `PageHeader` "Holdings" with "10 holdings worth €48,298.44 at the close of 29 Oct".
- Toolbar: Group by (class, account, currency, none), Find a holding, Show sold holdings.
- **Wide (from 768 px):** a `FigureTable` with `SortableHeader` (`components.md:39-44`). Columns: Holding (name over symbol, exchange and a note such as "in US dollars" or "price in % of nominal"), Quantity, Price (quoted currency), Cost (€), Value (€, with the foreign value under it), Gain (€ over %), Weight, Last day. Group rows carry subtotals. A footer row totals value, cost and gain.
- **Phone:** two-line rows in the group's order. Line one: name and value. Line two: symbol and quantity, and gain in € and %. The whole row opens the holding.
- Bonds show nominal as the quantity and the price as a percentage. Crypto shows up to 8 decimals in quantity. Gold shows ounces or grams. Cash shows its own currency amount.
- Sold holdings are hidden by default and shown with their realised gain when asked.

### A holding's page

- Back link "Holdings", title, and one line: symbol, exchange, quoted currency, class, account. Actions Change and Add transaction.
- **Hero card** in two halves, like the Loans hero: Value in `text-figure-xl` with the foreign value, shares and close under it, and Total return with its parts (price, currency, income after tax withheld). A `FactGrid` under a hairline: cost, average cost, weight, last day, first bought, dividend yield.
- **Price** `ChartCard`: weekly closes in the quoted currency, average cost dashed, a dot per buy and a hollow dot per sell, periods 1Y, 3Y, 5Y, All. The legend drops Sell when there are no sales. Tooltip on a dot: the trade.
- **Transactions** and **Dividends** as two `FigureTable` cards, each with `ShowAllButton` after ten rows. A foreign trade shows the euro amount with "at 1.0930" under it. A buy whose lot is still open shows the date it turns tax-free, two years after purchase.
- On a phone the hero halves stack, the facts go two by two, and the tables scroll sideways inside `FigureTable` when needed.

### Transactions

- A list grouped by month with filters for kind, holding and account, and the Add transaction and Import buttons.
- **Add transaction** is an `AppDialog` (full screen on a phone) with a `FormGrid`:
  - What happened: Buy, Sell, Dividend, Interest or coupon, Cash in or out, Fee, Split. The fields follow the kind.
  - Holding: search by name, symbol or ISIN, or add a new one. A new holding asks for its class, quoted currency, exchange and price source, prefilled from the price source's lookup where lane 4's source has one.
  - Account, Trade date, Quantity, Price, Fees.
  - Exchange rate, prefilled with the ECB reference rate for the date, labelled "USD per EUR" as the ECB quotes it, and changeable to the broker's rate.
  - A summary: what you pay in both currencies, what you hold afterwards, the new average cost.
  - The primary button names the kind: "Add buy". Writes follow Kuna's Undo toast, not a confirm (`patterns.md:48-51`).
- **Import** reuses Company's import panel and profiles, moved to `src/shared` when Investments needs it (decision order rule 1, `SKILL.md:13-21`). Steps: pick the file, pick or guess the profile (Yahoo built in), map columns, set each new listing's currency and class, preview with "new", "already in Kuna" (same date, holding, quantity and price) and "skipped" counts, then import with Undo.

### Income

- Tiles: income this year, last 12 months, tax withheld this year, and the next expected payment when one is known.
- A `ChartCard` of income per month for 12 months or per year for all time, stacked by kind in the income trio, with the Table toggle.
- A `FigureTable` of payments: date, holding, kind, gross, withheld, net, source country. Grouped by year.
- A dividend calendar and forecast (Snowball, getquin) waits until the price source gives dividend dates. Not in the first wave.

### Performance

- A period bar: 1M, YTD, 1Y, 3Y, 5Y, All, and single years. Company's `PeriodBar` (`src/apps/company/filters/presentation/PeriodBar.vue:4-11`) moves to `src/shared/ui` with these presets, since a second app needs it.
- Tiles: time-weighted return for the period, money-weighted return a year, the benchmark's return, and the difference.
- **Growth of €100** `ChartCard`: the portfolio's time-weighted line in blue and the benchmark in dashed grey, both from 100 at the period start. One axis, never value and percent together.
- **Returns by year** as a `FigureTable`: year, time-weighted, money-weighted, benchmark, gain in €. A monthly heatmap (PP) is left out: a diverging colour scale adds a palette for little gain over the table.
- Benchmark choice in Settings. An all-world index ETF in euros is the obvious default for the owner's mix.

### Tax

The rules are [lane 3's](lane3-maths-and-tax.md): FIFO lots as the law's register, 12% on gains from assets sold within two years of buying and on dividends and interest, JOPPD by the last day of February for the year before, and INO-DOH for foreign income already taxed abroad. The screen shows what those forms need, one year at a time.

- **Gains from sales**: each sale with the FIFO lots it closed, their purchase dates, days held, cost, proceeds and gain or loss, marked taxable or tax-free. Totals: taxable gains, losses that offset them, tax-free gains, and the tax.
- **Income**: dividends, coupons and interest by source country, gross, tax withheld abroad, and net, as the INO-DOH list.
- **What to file**: one card per form with its figures and its deadline. Porezna uprava's [page on capital gains and JOPPD](https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd/6871) (published 19 Jan 2023) says the tax is paid "do posljednjeg dana mjeseca veljače tekuće godine", on gains "umanjene za ostvarene kapitalne gubitke". It still gives the old 10% rate, so Kuna keeps rates in a table by year, never in code.
- **Coming up**: open lots that turn tax-free in the next 90 days, with their date, so a sale can wait for it.
- An export of the year's lines for the accountant or the form.

### Settings

- **Accounts:** broker, bank, wallet or "kept at home" (gold), each with its currency.
- **Base currency:** euro, shown and fixed for now.
- **Prices:** the source per holding (lane 4's daily source, or manual), the last update and any failures, a "Fetch now" button, and the manual price for a holding no source covers (gold coins, Croatian bonds, a fund that publishes late).
- **Exchange rates:** ECB reference rates, shown as their date.
- **Benchmark:** a symbol, with the default above.
- **Cost method:** FIFO, shown and not chosen, since ZPDoh Art. 70(5) requires it ([lane 3](lane3-maths-and-tax.md)). Average cost is shown as the cost of the open lots divided by their quantity.
- **The Investments file** on Drive, as Loans has its file.

### States

- **Empty:** an `EmptyState` with the app mark, "No investments yet", one line on what Kuna does with them, Add transaction and Import from a file.
- **First import done:** the Overview with a notice listing holdings without a price yet and a link to set their source.
- **Loading:** `ScreenSkeleton` in the shape of tiles and cards.
- **Price source failed:** a warning notice with the date of the last good prices. Figures stay at that close and say so.
- **One holding:** tiles stay, since value, gain and return still mean something.

### At 360 px and in Croatian

Croatian runs about a third longer (`patterns.md:75`). The longest phone labels are "Ukupna dobit", "Godišnji prinos" and "Prihod u 2026.", which fit a half-width tile. "Gdje je novac" and "Odakle dolazi dobit" fit a card title. The segmented control "Klasa, Valuta, Račun" fits at 360 px. Holdings on a phone keep two lines whatever the language, since the names truncate with an ellipsis and the full name is on the holding's page.

## Components and tokens

| Name                                                                                                                                                                                                                             | Status              | Where                                        | Note                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--app-investments`                                                                                                                                                                                                              | new, light and dark | `tokens.css` beside `--app-loans`            | #8a3f8c, #d08ad3, added to the contrast test                                                                                                                                                      |
| `--income-dividend`, `--income-coupon`, `--income-interest`                                                                                                                                                                      | new aliases         | `tokens.css` beside `--loan-*`               | the validated Loans trio                                                                                                                                                                          |
| `--invest-portfolio`, `--invest-reference`                                                                                                                                                                                       | new aliases         | `tokens.css`                                 | `--series-3` and `--chart-deemphasis`                                                                                                                                                             |
| `PageHeader`, `KpiTile`, `AppCard`, `DashboardGrid`, `ChartCard`, `FigureTable`, `SortableHeader`, `FactGrid`, `ShowAllButton`, `EmptyState`, `AppDialog`, `FormGrid`, `MoneyText`, `SparkLine`, `InfoPopover`, `ScreenSkeleton` | exist               | `src/shared/ui`                              | used as they are                                                                                                                                                                                  |
| `ChartLegend` with the `dashed` mark                                                                                                                                                                                             | exists              | `src/shared/ui/ChartLegend.vue:3`            | for money put in, the benchmark and the average cost                                                                                                                                              |
| `PeriodBar`                                                                                                                                                                                                                      | moves to shared     | from `src/apps/company/filters/presentation` | Investments presets added                                                                                                                                                                         |
| Import panel and profiles                                                                                                                                                                                                        | move to shared      | from `src/apps/company/imports`              | a Yahoo profile, a currency step                                                                                                                                                                  |
| `ShareBars`                                                                                                                                                                                                                      | new                 | `src/shared/ui`                              | the one-hue bar list of name, amount and share, with a specimen. Company's breakdowns could use it later                                                                                          |
| Unit price and quantity formatting                                                                                                                                                                                               | new                 | `src/shared/money`                           | `MoneyText` takes integer cents (`moneyFormat.ts:87`), but a fund price has 4 decimals, Bitcoin 8 and an exchange rate 4. Lane 2 decides the number type, the screens need one formatter for each |
| `HoldingRow` (phone)                                                                                                                                                                                                             | new, in the app     | `src/apps/investments/holdings/presentation` | two-line row, moves to shared only if a second app needs it                                                                                                                                       |
| `HoldingHero`                                                                                                                                                                                                                    | new, in the app     | `.../holdings/presentation`                  | value and total return with its parts                                                                                                                                                             |

## Decisions for the owner

### 1. Which percentage leads the Overview

The Overview's second tile. Today Yahoo shows you a gain and a percentage without saying how it is worked out. In the mockup, €38,522.22 put in over five years has grown to €48,298.44: the simple figure says +25.4%, money-weighted says +8.9% a year.

- **Simple % on what you put in (recommended).** The tile reads "+€9,776.22" with "+25.4% on the €38,522.22 you put in", and a separate tile shows the yearly money-weighted return. Matches what you asked for and what brokers show. Cost: two numbers to explain, which the captions do.
- **Only the yearly return.** One percentage, "+8.9% a year". Fair across five years of monthly buys, but it does not answer "how much % am I up".
- **Time-weighted return.** Comparable with an index, but it ignores when you added money, so it can disagree with the euro gain in sign. Better on Performance beside the benchmark.

Which should lead the Overview?

### 2. Whether cash at the broker is tracked

Decides what "you put in" means and whether the Overview's value includes broker cash. Yahoo keeps cash apart, and your export's cash line is empty.

- **No cash ledger (recommended to start).** Every buy counts as money in, every sale and income as money out. Cash balances, if you want them, are holdings you update by hand. Cost: dividends left at the broker are not part of the value until you add them as cash.
- **Cash per account.** Deposits and withdrawals are entered, buys and income move the account's cash. Value is exact, as at the broker. Cost: every deposit and withdrawal must be entered, and an import without them shows negative cash.

Should Kuna track cash per account from the start?

### 3. A short sale in a Yahoo export

A Yahoo export can hold a row with Transaction Type SHORT. Yahoo itself has turned negative lots into sells.

- **Skip it and list it (recommended).** The import says how many short sales it skipped and names each, and you enter it by hand if it still matters. Cost: none for the rest of the file.
- **Import it as a sale.** Works only if you held the shares at that date. Otherwise the holding goes negative.
- **Support short positions.** A new kind with its own gain rules. Cost: rules and screens for a rare row.

What should the import do with it?

## Settled without asking

- **Holdings group by class by default,** with subtotals, as Sharesight groups by market.
- **No dividend calendar or forecast in the first wave.** It needs dividend dates from a source.
- **No monthly return heatmap.** The table of years carries the same answer without a diverging palette.
- **No donut for allocation.** The colour check fails beyond three hues on one screen.
- **"Last day", never "Today",** since prices are the previous close.
- **The exchange rate field reads "USD per EUR",** as the ECB quotes it, so it can be copied from a statement without inverting.

## Sources

All loaded and checked on 2026-10-30 unless marked.

- Yahoo Help: [SLN36348](https://help.yahoo.com/kb/SLN36348.html), [SLN36784](https://help.yahoo.com/kb/SLN36784.html), [SLN2312](https://help.yahoo.com/kb/SLN2312.html), [SLN15034](https://help.yahoo.com/kb/SLN15034.html), [negative lots](https://help.yahoo.com/kb/finance-app-for-ios/understand-negative-lots-transactions-yahoo-finance-portfolio-sln36984.html), [portfolios landing page](https://finance.yahoo.com/portfolios/). The signed-in view: **unconfirmed**.
- Sharesight: [Investments page](https://help.sharesight.com/show_portfolio), [Holding page](https://help.sharesight.com/portfolio-holding-page/), [Performance report](https://help.sharesight.com/performance_report/), [calculation blog post](https://sharesight.com/blog/how-sharesight-calculates-your-investment-performance), [performance](https://www.sharesight.com/investment-portfolio-performance/), [features](https://www.sharesight.com/features/).
- Ghostfolio: [repo at 6030cc2](https://github.com/ghostfolio/ghostfolio/tree/6030cc211bd95880122987fda3a88108e9bf8d6f), read locally.
- Portfolio Performance: [site](https://www.portfolio-performance.info/en/), [performance](https://help.portfolio-performance.info/en/concepts/performance/), [calculation](https://help.portfolio-performance.info/en/reference/view/reports/performance/calculation/), [statement of assets](https://help.portfolio-performance.info/en/reference/view/reports/statement/), [dashboard](https://help.portfolio-performance.info/en/reference/view/reports/performance/dashboard/), [CSV import](https://help.portfolio-performance.info/en/reference/file/import/csv-import/).
- Snowball: [home](https://snowball-analytics.com/), [overview](https://snowball-analytics.com/overview), [XIRR](https://help.snowball-analytics.com/xirr/).
- Delta: [App Store](https://apps.apple.com/us/app/id1288676542?l=en-us). delta.app returned 403: **unconfirmed**.
- Kubera: [home](https://kubera.com/), [IRR help](https://help.kubera.com/article/79-irr-of-my-investment-in-kubera), [multi-currency](https://www.kubera.com/blog/multi-currency-portfolio-tracker).
- getquin: [home](https://www.getquin.com/), [return calculation](https://help.getquin.com/en/articles/6259821-return-calculation), [IRR and TTWROR](https://help.getquin.com/en/articles/12556127-difference-between-the-internal-rate-of-return-irr-and-ttwror), [file import](https://help.getquin.com/en/articles/16949483-file-import-using-getquin), [community post](https://app.getquin.com/en/post/NrieqjBGQI/not-all-returns-are-the-same).
- Erste Funds: [App Store](https://apps.apple.com/hr/app/id1643497596). George and InterCapital Genius portfolio views: **unconfirmed**.
- Porezna uprava: [capital gains and JOPPD](https://porezna-uprava.gov.hr/hr/oporezivanje-kapitalnih-dobitaka-i-izvjescivanje-putem-obrasca-joppd/6871), published 19 Jan 2023. Its 10% rate is out of date, see lane 3 for the current law.
- valore: cloned read-only at `6e2fd62`, README and `OverviewPanel.vue`.
- Kuna at `210875f`: `.agents/skills/kuna-design/` (SKILL, components, patterns), `src/shared/styles/tokens.css`, `src/shared/ui/MoneyText.vue`, `src/shared/ui/KpiTile.vue`, `src/shared/money/moneyFormat.ts`, `src/apps/loans/app.ts`, `tests/tokenContrast.spec.ts`, `src/apps/company/filters/presentation/PeriodBar.vue`, `src/apps/company/imports/presentation/ImportPanel.vue`. Design lanes: [design plan](../../../platform/design-plan.md), [Loans design lane](../../../platform/research/design/lane3-loans-design.md).
