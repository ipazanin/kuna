# Wave 12 proposal: fewer pages, one home per figure

Fewer pages with one home per figure: navigation, per-page tabs, donuts and build waves.

Nineteen menu items become eight. Every merged page gets inner tabs that open on the job the owner does most often there. Reference cards start collapsed with a one-line summary, and each figure that appears on two or more screens today keeps a single home. Four donuts replace tiles, bars or tables where one snapshot of at most five parts is the whole message.

The wireframes were in a `mockups.html` beside the original proposal, which is not in the repo.

## Failures and limits

- Nothing was built, tested or checked. Another agent is building in the working tree, so the lanes measured the `dist-fake` build of 05:34 today. Card changes made after that are not in the heights below.
- The default fake workbook has no `hr_company_registered`, so Forecast and Pay scenarios figures come from the `?fake=excel` variant and from earlier screenshots.
- Phone heights "after" are estimates. I added up the measured heights of the cards that stay open and counted a collapsed card at 88 px, which is what `billing.months` measures collapsed on a phone.
- `ChartCard` has no `collapse-id` today. Every chart this proposal starts collapsed needs that prop first (wave 1).
- Not verified: that `forecastYear` gives sensible figures for a year that has ended but has no accountant lines yet. The year page relies on it for January to April (see "Year").

## The navigation

|     | Menu item                        | The question it answers                                                                | Absorbs                                                                                |
| --- | -------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | **Overview**                     | How is the company doing, and what waits for me?                                       | Overview, Cash                                                                         |
| 2   | **Transactions**                 | Which rows are behind a figure, and how do new ones get in?                            | Transactions, Import                                                                   |
| 3   | **Review** (with a count)        | Which rows need my decision, and which rules decide the rest?                          | Review, Workbook Rules                                                                 |
| 4   | **Invoicing**                    | What do I bill this month, and who still owes the company?                             | Billing plan, Receivables, Workbook Clients                                            |
| 5   | **Analysis**                     | Where does the money go, and is it getting better or worse?                            | Spending, Trends, Period review                                                        |
| 6   | **Owner**                        | Who owes whom, and what did the owner take?                                            | Owner                                                                                  |
| 7   | **Year**                         | How will this year end, and do our books agree with the accountant's for the last one? | Year end, Forecast, Pay scenarios, Taxes, Assets, Workbook Assets, Grants and Year end |
| 8   | **Settings** (below a separator) | How the workbook and this device are set up, and the law behind the figures            | Workbook General, Categories and Accounts, Settings, Ruleset                           |

Owner and Year belong to the Croatian pack (`ownerPayPack`), as their screens do today. Without the pack the menu has six items.

**Import** becomes the second tab of Transactions, because an import adds rows to the ledger and Transactions is the page for rows. `/import` redirects there, and LedgerGate's first-run link points at it. After a confirmed import the tab says "N new rows wait on Review" with a link.

**Make invoice** lives once, in the Invoicing page header. Overview's "Waiting for you" card says when this month's invoice is not made yet and links to Invoicing.

### Where this keeps or changes the lead's view

- **Billing plan with Receivables: kept.** It is one monthly job with two Make invoice buttons today. The page opens on Invoices, not on the statistics.
- **Spending with Trends and Period review: kept, named Analysis.** Two of the three tabs show income as well as spending, so "Spending" would mislabel them.
- **Year end with Forecast: kept, as one Year page.** The year chip picks the view. The plan editor gets its own tab, because today it sits under 4,700 px of read-only cards.
- **Pay scenarios with Owner: changed, it goes to Year.** It reads `forecastYear` and `dividendCapacity`, uses the year chips, and the plan editor's owner-pay row picks from it. Owner is a monthly look back. See question 1.
- **Taxes into Year: kept, plus an Overview line.** The due-or-overdue check is monthly, so it surfaces in Overview's "Waiting for you" card. See question 2.
- **Ruleset with Review: still no, it goes to Settings.** Review works with categorisation rules, Ruleset is tax law, and both pages use `?rule=` for different ids. One page would hold one key with two meanings.
- **Workbook into Settings: changed, the editors move to the pages that read them.** Rules go to Review, Clients to Invoicing, Assets, Grants and Year-end lines to Year. Settings keeps what every page shares. See question 3.
- **Cash into Overview: kept.** Two of Cash's three tiles are Overview tiles already.
- **Assets into Year: kept, as a tab in both year views.** Year-end work and planning both send the owner to Assets today.
- **Transactions with Import: new.** Import was a one-card page.

## Rules every page follows

- **Inner tabs** use one shared `PageTabs` built on `UTabs` (`variant="link"`, brass underline), as Workbook does today. The tab is `?tab=<value>`, and the default tab stays out of the URL. A click writes with `router.push` and the tabs use manual activation, so Back steps through tabs and arrowing does not flood the history. After a switch the strip scrolls into view if the reader was below it. The browser tab reads "Invoicing, Plan – Ledgerboard". The strip gets an accessible name, and a count shows as a badge and in the label text.
- **Tiles above the tabs** only for figures as of today, each linking to its tab. A figure that follows a period or a year sits inside the tab that holds that control.
- **A FilterBar above the tabs** only when every tab follows it (Analysis). Otherwise it sits inside the panel that uses it.
- **A collapsed card** shows its title and a one-line summary ("16 of 16 paid", "9 groups no rule repeats").
- **New collapse ids** under the new page names (`invoicing.plan-rows`, `year.konto`). Every device then gets the new defaults once. Keeping the old ids would keep each device's stored choice and ignore the new defaults.
- **Long lists** show the first ten, then "Show all N", as Ruleset's watch list already does.
- **Notices** that repeat today (the planning alert, rule confidence lines, missing roles) show once per page, under the header.
- **Editing** stays in modals (plan, scenario, invoice, split, advance). A side panel is used only for Ruleset's rule detail.

## Each page

### Overview

No tabs. FilterBar without a period, as today. No header actions.

| Order | Card                                                           | State                   | Notes                                                                                                                                                                                                                                                      |
| ----- | -------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Headline sentence                                              | shown                   | Drops its runway clause, because the Runway tile says it                                                                                                                                                                                                   |
| 2     | Waiting for you                                                | open, hidden when empty | New. One line per job with something to do: rows to review, reimbursements or private shares to settle, this month's invoice not made, invoices overdue, a tax payment due or overdue. Each line links to its page and tab. It replaces the review notice. |
| 3     | Tiles: Cash on hand, Net last 12 months, Monthly costs, Runway | shown                   | The Runway caption adds the 12-month-cost runway from Cash                                                                                                                                                                                                 |
| 4     | A typical month, three ways                                    | open                    |                                                                                                                                                                                                                                                            |
| 5     | Income and costs by month                                      | open                    |                                                                                                                                                                                                                                                            |
| 6     | Balance at month end                                           | open                    | From Cash. The last 12 months and the month so far, with the Table toggle                                                                                                                                                                                  |
| 7     | Every euro earned                                              | open, donut             | The last 12 months as a donut, replacing the three 100% bars                                                                                                                                                                                               |
| 8     | Accounts                                                       | collapsed               | Cash's account cards in one card. Summary: "2 accounts, 1 closed"                                                                                                                                                                                          |

Duplicates removed:

- **Cash tiles.** Cash on hand and the 3-month runway are the Overview tiles. The 12-month runway moves into the Runway caption.
- **The Net owed line.** It lives on Owner, Who owes whom.
- **Operating cost by category.** It lives on Analysis, Breakdown, Operating group.
- **The review notice's link** went to Transactions, where nothing can be confirmed. Its line in "Waiting for you" goes to Review.

### Transactions

Tabs: **Rows** (default) and **Import**. No header actions.

- **Rows.** FilterBar, group-by and the rows table, unchanged. `?review=1` keeps working.
- **Import.** Statement file, then Profile and Dry run after a file, unchanged. After a confirmed import: "N new rows wait on Review", linking to Review.

### Review

Tabs: **Queue N** (default) and **Rules**. No header actions. The menu item shows the queue count.

| Tab   | Order | Card                                  | State                                                                   |
| ----- | ----- | ------------------------------------- | ----------------------------------------------------------------------- |
| Queue | 0     | FilterBar without a period            | inside the panel                                                        |
| Queue | 1     | N rows to review                      | open. Each row gets a Split button that opens the existing split dialog |
| Queue | 2     | N reimbursements with no cost on file | open, shown only when there are any                                     |
| Queue | 3     | N private shares to move to splits    | open, shown only when there are any                                     |
| Queue | 4     | Changes this session                  | collapsed, as today                                                     |
| Rules | 1     | Rules                                 | open. The Workbook rules editor. `?rule=` reveals the rule              |
| Rules | 2     | Confirmed rows no rule repeats        | collapsed. Summary: "9 groups no rule repeats"                          |

Duplicates removed: the private-share and unaccounted-reimbursement cards leave Owner and live here only. "Make this a rule" and the rules list now open the same editor on the same page.

### Invoicing

Header actions: **Make invoice** (primary). Tiles above the tabs: Next invoice, Outstanding, Overdue, Days to get paid (median).

Tabs: **Invoices** (default), **Plan** and **Clients**.

| Tab      | Order | Card                                                      | State                    | Notes                                                                                  |
| -------- | ----- | --------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| Invoices | 0     | PeriodBar and client select                               | inside the panel         | Receivables' own controls                                                              |
| Invoices | 1     | Every invoice, with the payments that settled it          | open                     | First ten, then Show all. Record invoice in its actions. Make invoice leaves this card |
| Invoices | 2     | What is owed, by how late it is                           | open                     |                                                                                        |
| Invoices | 3     | Days to get paid                                          | collapsed                | Summary: "Median 4 days"                                                               |
| Invoices | 4     | Revenue no client accounts for                            | collapsed, only when any | Summary: "€X from N payers". The tile goes                                             |
| Plan     | 0     | Year chips                                                | inside the panel         |                                                                                        |
| Plan     | 1     | One line: planned, invoiced, not yet invoiced in the year | shown                    | Replaces the three year tiles                                                          |
| Plan     | 2     | Plan rows, year                                           | open                     | Add row, Fill the rest of the year                                                     |
| Plan     | 3     | Month by month, year                                      | collapsed                | As today. A month link reveals it                                                      |
| Plan     | 4     | By item                                                   | collapsed                | The every-year chart and the year list in one card, the list first                     |
| Plan     | 5     | Totals over every client                                  | collapsed                |                                                                                        |
| Clients  | 1     | Clients                                                   | open                     | The Workbook editor, plus the Billing plan and Invoices terms from the General form    |

Duplicates removed: the second Make invoice button. The "Paid by no client" tile, since the card below carries it. Planned, Invoiced and Not yet invoiced in the year move from tiles to the Plan tab's line, because they follow the year chip.

### Analysis

FilterBar above the tabs, since every tab follows the period. Tabs: **Breakdown** (default), **Over time** and **Compare**. No header actions.

| Tab       | Order | Card                                            | State                                                                                               |
| --------- | ----- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Breakdown | 1     | Cost by category                                | open. The Owner pay group heading links to Owner, Taken, and the Taxes group heading to Year, Taxes |
| Breakdown | 2     | Who the company paid most                       | collapsed. Summary: the top payee and its total                                                     |
| Over time | 1     | Income and costs by month, with the zoom slider | open                                                                                                |
| Over time | 2     | Rolling net                                     | open                                                                                                |
| Over time | 3     | Cumulative net                                  | collapsed                                                                                           |
| Compare   | 1     | Profit and loss against the prior period        | open. The FilterBar offers year, quarter and custom, as Period review does today                    |
| Compare   | 2     | By category                                     | open. First ten, then Show all                                                                      |

Duplicates removed: Period review's "By month" chart. Over time draws the same months with the same filter. Overview's operating-cost chart (see Overview).

Kept on purpose: the Taxes and Owner pay groups of Cost by category. Without them the cost breakdown would not add up, so the group headings link to the pages that break them down further.

### Owner

Header actions: **Add advance** (primary, moved up from the bottom of the page) and **Compare pay mixes**, which links to Year, Pay.

Tabs: **Who owes whom** (default) and **Taken**. No tiles above the tabs, because Net owed is all-time and the Taken figures follow the period.

| Tab           | Order | Card                                                               | State            | Notes                                                  |
| ------------- | ----- | ------------------------------------------------------------------ | ---------------- | ------------------------------------------------------ |
| Who owes whom | 1     | Tile: Net owed                                                     | shown            | With its build-up                                      |
| Who owes whom | 2     | "N items wait on Review"                                           | shown when any   | Replaces the two cards that moved to Review            |
| Who owes whom | 3     | Every loan, with the repayments that closed it                     | open             | First ten, then Show all                               |
| Who owes whom | 4     | Costs the owner paid privately                                     | open             | First ten, then Show all. Without the unaccounted list |
| Who owes whom | 5     | Loans to the owner, by month                                       | collapsed        |                                                        |
| Taken         | 0     | FilterBar                                                          | inside the panel |                                                        |
| Taken         | 1     | Tiles: Owner take, Gross cost of the owner, Cost per euro received | shown            |                                                        |
| Taken         | 2     | Owner take by type                                                 | open, donut      | The table becomes the legend                           |
| Taken         | 3     | Owner pay by month                                                 | open             | Loan out and loan repaid become one "Loans, net" band  |

Duplicates removed: the Owner take table (it is the donut's legend now), the loan bands that repeated the loans chart, the private-share card and the unaccounted list (Review), and the Net owed line on Overview.

### Year

Header actions: the year chips. They hold every year with accountant lines, the year just ended until its lines arrive, the current year and the next one. Under the header, once: the planning alert, one line "N figures rest on estimates" linking to Settings, Ruleset, and any missing-role notices.

A year with accountant lines opens the **closed** view. Any other year opens the **open** view. In January to April the year just ended has no lines yet, so it opens in the open view without the Plan and Pay tabs. Today that year is on neither screen.

Without `year` the page opens the current year. A link to a tab the chosen year lacks opens the latest year that has it, so `?tab=statements` alone opens the last closed year.

**Closed view tabs:** **Accountant** (default), **Statements**, **Taxes** and **Assets**.
**Open view tabs:** **Forecast** (default), **Plan**, **Pay**, **Taxes** and **Assets**.

| Tab        | Order | Card                                                                            | State                 | Notes                                                                                                                  |
| ---------- | ----- | ------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Accountant | 1     | Lines at a glance                                                               | open, donut           | Matched, explained, judgement, open of 35. Replaces the four tiles                                                     |
| Accountant | 2     | From the cash net to profit                                                     | open                  | The waterfall                                                                                                          |
| Accountant | 3     | Open items                                                                      | open                  |                                                                                                                        |
| Accountant | 4     | The bridge, step by step                                                        | collapsed             | The text form of the waterfall                                                                                         |
| Statements | 1     | Profit and loss                                                                 | open                  |                                                                                                                        |
| Statements | 2     | Balance sheet at 31 December                                                    | collapsed             | Summary: "N of 14 lines differ"                                                                                        |
| Statements | 3     | Profit tax return, PD                                                           | collapsed             |                                                                                                                        |
| Statements | 4     | Konto lines                                                                     | collapsed             |                                                                                                                        |
| Statements | 5     | The accountant's lines, year                                                    | collapsed             | The Workbook year-end editor                                                                                           |
| Forecast   | 1     | Tiles: Profit before tax, Corporate tax, Profit after tax, Cash at the year end | shown                 | The cash caption loses its runway words                                                                                |
| Forecast   | 2     | "N plan rows not invoiced yet"                                                  | shown when any        | Links to Invoicing, Plan                                                                                               |
| Forecast   | 3     | Month by month                                                                  | open                  |                                                                                                                        |
| Forecast   | 4     | Profit and loss                                                                 | collapsed             |                                                                                                                        |
| Forecast   | 5     | Profit tax return, PD                                                           | collapsed             |                                                                                                                        |
| Forecast   | 6     | Cash by month                                                                   | collapsed             |                                                                                                                        |
| Forecast   | 7     | Plan against actual                                                             | collapsed             |                                                                                                                        |
| Plan       | 1     | Plan for the year                                                               | open                  | The editor. The revenue line links to Invoicing, Plan for the same year                                                |
| Pay        | 0     | "What the scenarios start from"                                                 | header button, dialog | The starting-point card becomes a figure build-up                                                                      |
| Pay        | 1     | Scenario chips and base select                                                  | shown                 |                                                                                                                        |
| Pay        | 2     | Dividend capacity                                                               | open                  | Moved from Forecast, and now collapsible                                                                               |
| Pay        | 3     | Where the profit before owner pay goes                                          | open                  | The 100% bars stay. The four warning cards become badges on each scenario's row                                        |
| Pay        | 4     | Side by side                                                                    | collapsed             | Summary: "4 scenarios, 32 lines"                                                                                       |
| Pay        | 5     | The next 100.00 of company money                                                | collapsed             |                                                                                                                        |
| Pay        | 6     | Scenarios for the year                                                          | collapsed             | The editor                                                                                                             |
| Taxes      | 1     | Tiles: Taxes paid, Effective tax rate                                           | shown                 | For the chosen year                                                                                                    |
| Taxes      | 2     | Corporate income tax, expected against paid                                     | open                  | The only copy                                                                                                          |
| Taxes      | 3     | Payroll cadence                                                                 | collapsed             | Summary: "12 of 12 paid". It opens itself with `reveal` when a month is missed, so a stored "collapsed" cannot hide it |
| Taxes      | 4     | Tax by type                                                                     | open, donut           | The refund shows under the ring. The table becomes the legend                                                          |
| Taxes      | 5     | Tax by type, by month                                                           | collapsed             |                                                                                                                        |
| Assets     | 0     | Doubled-rates switch                                                            | in the tab's top line | Replaces the untitled card                                                                                             |
| Assets     | 1     | Tiles: Book value, Depreciation in year, Deferred, Clawback                     | shown                 |                                                                                                                        |
| Assets     | 2     | Asset register                                                                  | open                  |                                                                                                                        |
| Assets     | 3     | The grant beside it                                                             | open                  | Takes the grant-release line from Forecast                                                                             |
| Assets     | 4     | Book value over time                                                            | collapsed             |                                                                                                                        |
| Assets     | 5     | Depreciation per year                                                           | collapsed             |                                                                                                                        |
| Assets     | 6     | Asset rows, Grant rows                                                          | collapsed             | The Workbook editors                                                                                                   |

Duplicates removed:

- **The corporate tax schedule** leaves Forecast and lives on the Taxes tab.
- **The planning alert** shows once, not on four screens.
- **The confidence lines** on Forecast and Pay scenarios become one line.
- **The grant-release line** moves from Forecast to the Assets tab.
- **The four year-end status tiles** become one donut.
- **Tax on owner pay** leaves the Taxes tiles and stays in the Owner, Taken caption.
- **P&L and PD**, which Forecast and Year end each had, now show once for any year, because the year decides the view.

Kept on purpose: the €2,500 clawback inside Dividend capacity and in a scenario badge. Both are steps of their own figures, not repeats.

### Settings

No header actions. Tabs: **General** (default), **Categories**, **Accounts**, **Ruleset** (pack only) and **This device**.

| Tab         | Order | Card                               | State                                                                                                                                                                                                                          |
| ----------- | ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| General     | 1     | Workbook settings                  | its fieldsets become collapsible sub-cards, the first open. The Billing plan and Invoices terms move to Invoicing, Clients                                                                                                     |
| General     | 2     | Loans to the owner (bucket switch) | shown                                                                                                                                                                                                                          |
| General     | 3     | Rows the app could not use         | open when any, collapsed when none                                                                                                                                                                                             |
| Categories  | 1     | Categories                         | open                                                                                                                                                                                                                           |
| Accounts    | 1     | Accounts                           | open                                                                                                                                                                                                                           |
| Ruleset     | 0     | Search                             | sticky, as today                                                                                                                                                                                                               |
| Ruleset     | 1     | Watch list                         | collapsed. Summary: "21 values to watch"                                                                                                                                                                                       |
| Ruleset     | 2     | Rules by area                      | open. One compact row per rule (name, id, this year's value, confidence badge) under sticky area headings. A click or `?rule=` opens the full rule in a right-hand side panel. The confidence legend moves into an InfoPopover |
| This device | 1     | Data source                        | open                                                                                                                                                                                                                           |
| This device | 2     | Appearance and privacy             | open                                                                                                                                                                                                                           |

## Charts

### Donuts

All four use one new `DonutCard` on `AppCard`: ECharts `PieChart` registered in `echarts.ts`, ring 62 to 82%, start at 12 o'clock, a 2 px surface gap, no slice labels. The total sits in the middle as HTML. The legend is an HTML list with values, percentages and drill links, and it doubles as the table view. Colour follows the entity, never the rank.

| Where                               | Figure                      | Parts                                                                  | Middle                 | Why it beats today's chart                                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------- | ---------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview, Every euro earned         | Last 12 months of income    | Operating, Taxes, Owner pay, Kept (recessive grey)                     | Income, last 12 months | Today three 100% bars repeat the three windows of the typical-month table above them. With the windows left to that table, what remains is one part-to-whole snapshot. When the 12 months lost money, Kept leaves the ring and the middle says how much more went out than came in. |
| Owner, Taken, Owner take by type    | Owner take in the period    | Salary net, bonus, dividend, rent                                      | Owner take less loans  | Today a six-line table. The ring shows the mix at a glance and the table stays as its legend. Loans can be negative, so "Loans, net" sits under the ring and adds up to the tile.                                                                                                   |
| Year, Taxes, Tax by type            | Taxes paid in the year      | Payroll contributions, payroll tax, corporate income tax, dividend tax | Paid                   | Today a table beside a stacked area. The refund cannot be a slice, so "less €X refunded" sits under the ring and reaches the tile's net figure.                                                                                                                                     |
| Year, Accountant, Lines at a glance | The year's accountant lines | Matched, explained, judgement, open                                    | "35 lines"             | Today four tiles. One ring in the status tones shows how far the year is from agreed, and each legend item opens its lines.                                                                                                                                                         |

### Where a donut was considered and not used

- **Pay scenarios.** The 100% bars compare four scenarios across nine parts, which a ring cannot do.
- **Billing by item.** One item is 91.6% of the year, so a ring would be a full circle with slivers.
- **Receivables invoiced against open.** €4,700 against about €94k is a sliver, and the tiles say it.
- **Ageing by client.** A ring loses the client, which is the point of that chart.
- **Cost by category.** It has 11 or more parts.
- **Cash by account.** It has two accounts, which the account list says better.

Nuxt UI's `UChart` is not used. It is a second chart library.

### Charts removed

- **Period review "By month".** Analysis, Over time draws the same months with the same filter.
- **Overview "Operating cost by category".** It is Analysis, Breakdown, Operating group.
- **Owner "Owner pay by category, by month" loan bands.** They become one "Loans, net" band. The loan chart on Who owes whom carries the detail.
- **Year end's four status tiles** become the Lines at a glance donut.

## Links that must keep working

Redirect records go before the catch-all in `router.ts` and keep the query and the hash. Links in the code change to the new targets in the same wave.

| Old link                                              | New place                                             | Notes                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `#/`                                                  | `#/`                                                  | Unchanged                                                                                               |
| `#/cash`, with any filters                            | `#/`                                                  | Drill route `cash` maps to `/`                                                                          |
| `#/transactions?…`                                    | `#/transactions?…`                                    | Unchanged, `review=1` included                                                                          |
| `#/import`                                            | `#/transactions?tab=import`                           | LedgerGate's two links change too                                                                       |
| `#/review`                                            | `#/review`                                            | Unchanged                                                                                               |
| `#/workbook?tab=rules&rule=X`                         | `#/review?tab=rules&rule=X`                           | RuleCoverage's "Open the rule"                                                                          |
| `#/receivables?p=…&client=…`                          | `#/invoicing?p=…&client=…`                            | Invoices is the default tab                                                                             |
| `#/billing`                                           | `#/invoicing?tab=plan`                                |                                                                                                         |
| `#/billing?year=Y`                                    | `#/invoicing?tab=plan&year=Y`                         |                                                                                                         |
| `#/billing?year=Y&month=M#billing-month-M`            | `#/invoicing?tab=plan&year=Y&month=M#billing-month-M` | The anchor must land below the sticky band                                                              |
| `#/billing#billing-rows-card`, `#billing-months-card` | `#/invoicing?tab=plan#…`                              | Same anchors                                                                                            |
| `#/workbook?tab=clients`                              | `#/invoicing?tab=clients`                             | InvoiceRunDialog, Receivables                                                                           |
| `#/spending?…`                                        | `#/analysis?…`                                        | Breakdown is the default tab                                                                            |
| `#/trends?…`                                          | `#/analysis?tab=over-time&…`                          | Drill route `trends`                                                                                    |
| `#/period-review?…`                                   | `#/analysis?tab=compare&…`                            | Drill route `period-review`                                                                             |
| `#/owner`                                             | `#/owner`                                             | Opens Who owes whom. Overview's link no longer exists                                                   |
| `#/year-end?year=Y`                                   | `#/year?year=Y`                                       | Accountant is the default for a closed year                                                             |
| `#/year-end`                                          | `#/year?tab=accountant`                               | The latest year with accountant lines, as today                                                         |
| `#/forecast?year=Y`                                   | `#/year?year=Y`                                       | Forecast is the default for an open year                                                                |
| `#/forecast?year=Y&payout=P`                          | `#/year?year=Y&tab=pay&payout=P`                      | Dividend capacity moved to Pay                                                                          |
| `#/pay-scenarios?year=Y&base=B&compare=C`             | `#/year?year=Y&tab=pay&base=B&compare=C`              | PlanEditor's link, Owner's header link                                                                  |
| `#/taxes?…`                                           | `#/year?tab=taxes`                                    | The period filter does not apply, the current year opens                                                |
| `#/assets?rates=doubled`                              | `#/year?tab=assets&rates=doubled`                     | `forecastView.ts` links `/assets`                                                                       |
| `#/workbook?tab=assets`                               | `#/year?tab=assets`                                   | AssetsScreen's three links                                                                              |
| `#/workbook?tab=grants`                               | `#/year?tab=assets#grant-rows`                        |                                                                                                         |
| `#/workbook?tab=year-end`                             | `#/year?tab=statements#accountant-lines`              | The latest year with lines                                                                              |
| `#/ruleset?rule=X`                                    | `#/settings?tab=ruleset&rule=X`                       | `ruleLink()` in `ruleWording.ts`                                                                        |
| `#/workbook`, `?tab=general`                          | `#/settings`                                          | General is the default tab                                                                              |
| `#/workbook?tab=categories`                           | `#/settings?tab=categories`                           | MissingRoles, Year end                                                                                  |
| `#/workbook?tab=accounts`                             | `#/settings?tab=accounts`                             |                                                                                                         |
| `#/settings` (old Settings screen)                    | `#/settings?tab=device` in code links                 | A bookmark to `#/settings` now lands on General. LedgerGate's switch-source link moves to `?tab=device` |
| `#/gallery`                                           | `#/gallery`                                           | Unchanged, dev and fake builds                                                                          |

Two code changes go with the table:

- `drillLocation` drops the source page's `tab` when the target path differs. Today `queryFor` copies every non-filter key into the drill.
- `ROUTE_PATHS` in `filterStore.ts` becomes a path plus a `tab`.

Query keys that keep their meaning inside a tab are `year`, `month`, `client`, `rule`, `payout`, `base`, `compare` and `rates`. No page has two tabs with the same key meaning different things. `rule` lives on Review and on Settings, which are different pages.

## Phone (390 px)

- **Menu.** The drawer holds eight items with the Review count, and Settings sits below a separator. A bottom tab bar is not used, because it fits four or five items and would be a second navigation model.
- **Tab row.** The tabs sit in one sticky row under the 56 px top bar, with the Filters button at its right end when the page has a FilterBar. Pages with four tabs or fewer use equal segments: Transactions, Review, Invoicing, Analysis, Owner, and Year's closed view. Year's open view and Settings have five, so they scroll inside the strip, with the active tab scrolled into view on load and an edge fade. Today a deep link to Workbook, Grants opens with that tab off-screen.
- **Linked parts.** `LINKED_PART_TOP` (72 px) becomes the measured band height in a CSS variable, used for `scroll-margin-top`. The desktop filter band alone is 88 px.
- **Tiles** stay two by two without sparklines, as today.
- **Donuts.** A 168 px ring sits centred above its legend list, and the legend uses the full width.
- **Side by side** shows the base and one compared scenario, picked with the chips. Today it is 6,426 px tall.
- **Ruleset's rule detail** opens as a full-height sheet.
- **No sideways page scroll.** Only the tab strip scrolls sideways, inside itself.

Estimated phone heights on the default tab:

| Page                                                   | Today           | After       |
| ------------------------------------------------------ | --------------- | ----------- |
| Year 2025, Accountant (was Year end)                   | 15,724          | about 3,300 |
| Year 2026, Forecast                                    | 8,959           | about 1,800 |
| Year 2027, Pay (was Pay scenarios)                     | 11,203          | about 3,200 |
| Settings, Ruleset (was Ruleset)                        | 58,503          | about 5,000 |
| Invoicing, Invoices (was Receivables and Billing plan) | 4,678 and 4,155 | about 3,000 |
| Owner, Who owes whom                                   | 3,875           | about 2,000 |
| Analysis, Breakdown (was Spending)                     | 4,088           | about 2,300 |
| Overview (with Cash)                                   | 2,599 and 1,338 | about 3,000 |

## Build waves

Each wave ends with typecheck, vitest, `check:visual` and `check:touch` in both themes, no sideways overflow at 360, 390 and 430 px, and every row of the links table that the wave touches opened as a deep link. Each wave removes its old menu items and adds the new one, so the menu shrinks step by step. Each updates the README's _Phone layout_ and _Wide screens_ lists.

1. **Shared groundwork.**
   - `PageTabs` in `src/shared/ui`, with Workbook moved onto it to prove it.
   - `collapse-id` on `ChartCard`.
   - `DonutCard` and the `PieChart` registration, shown in the gallery.
   - The redirect mechanism with a unit test that lists every old link.
   - `drillLocation` dropping `tab`, and `ROUTE_PATHS` with tabs.
   - The sticky band height variable and the menu count badge.

   Checks: a new flow that clicks two tabs and presses Back twice, a phone deep link to Workbook's last tab showing it on screen, and the gallery donut in both themes.

2. **Overview and Transactions.**
   - Cash folded into Overview, with "Waiting for you" and the euro donut.
   - The Import tab.
   - Review notice to Review.

   Checks: visits `overview`, `transactions`, `import`, `import-summary` and `welcome`, flows `import-camt`, `import-table`, `split` and `split-tab`, touch Overview drills, and deep links `#/cash` and `#/import`.

3. **Review.**
   - Queue and Rules tabs.
   - Split on queue rows.
   - The private-share and unaccounted cards on Review only.

   Checks: `move-share-review`, a new split-from-Review flow, `workbook-rule-linked` as `#/review?tab=rules&rule=merchant-airline`, and touch Review.

4. **Invoicing.**
   - Invoices, Plan and Clients tabs.
   - One Make invoice.
   - The billing and invoice terms moved from General.

   Checks: `invoices`, `invoice-run`, the billing visits (`billing`, `billing-month`, `billing-2025`, `billing-excel`, `billing-no-tab`, `billing-empty-excel`), the month anchor clear of the sticky band at every viewport, `workbook-clients` redirected, and touch Receivables and Billing.

5. **Analysis.**
   - Breakdown, Over time and Compare tabs.
   - Period review's month chart removed.

   Checks: `trends`, `spending` and `period-review` visits redirected, Overview chart drills landing on the right tab without carrying `tab`, and touch Spending.

6. **Owner.**
   - Who owes whom and Taken tabs.
   - The owner-take donut and Add advance in the header.

   Checks: `owner`, the `move-share` flow retargeted to Review, a new Add-advance-from-header flow, and the donut adding up to the tile.

7. **Year.** It is the largest wave, so it is built in two parts with a review between them.
   - **7a, the closed view:** Accountant, Statements, Taxes and Assets, with the line-status and tax donuts and the year-end, asset and grant editors.

     Checks: `year-end`, `year-end-excel`, `taxes`, `taxes-excel`, `assets`, `assets-doubled`, the `assets` editor flow at its new hash, and `workbook-year-end-excel` and `workbook-grants-excel` redirected.

   - **7b, the open view:** Forecast, Plan and Pay, Dividend capacity moved, the start-from dialog, scenario badges, the phone two-column comparison, and the January-to-April year.

     Checks: `forecast`, `forecast-excel`, `forecast-2027-excel` (payout), the `pay-scenarios` variants, the `scenarios`, `starting-scenarios`, `plan` and `plan-tab` flows, and the corporate-tax overdue state on Taxes.
8. **Settings.**
   - General, Categories, Accounts, Ruleset and This device tabs.
   - Ruleset's compact list with the side panel.
   - The Workbook, Ruleset and old Settings screens removed.

   Checks: `ruleset`, `ruleset-linked`, `settings`, `settings-excel`, the `workbook-*` visits redirected, the `categories` flow, and the Ruleset phone height.

## Questions for the owner

### 1. Where should pay scenarios live?

You suggested putting Pay scenarios with Owner. In Q4 you open Pay scenarios for 2027, compare four mixes, then go to Forecast, scroll to "Plan for 2027" and pick one in the owner-pay row. Pay scenarios reads its company figures from that same forecast.

- **Put it on the Year page, beside Plan.** Picking a mix and putting it in the plan happen one tab apart, under one year chip. Owner keeps a "Compare pay mixes" button. Cost: Owner no longer shows the mixes itself.
- **Put it on the Owner page.** Everything about the owner's pay is on one page. Cost: Owner then mixes a monthly look back (periods) with a yearly plan (year chips), and planning still crosses pages.

Recommendation: the Year page.

### 2. Should Taxes keep its own menu item?

Each month around payroll you check whether the contributions and the corporate tax advance landed. Today that is Taxes, where the answer is at the bottom (Payroll cadence at 837 px, corporate tax at 1,188 px).

- **Make it a tab of Year, and flag what is due on Overview.** The menu stays at eight. A missed or overdue payment shows in Overview's "Waiting for you" card with a link to Year, Taxes, and the tab opens on the due-and-paid cards. Cost: a check with nothing due is two clicks instead of one.
- **Keep Taxes in the menu.** The monthly check stays one click. Cost: nine items, and the corporate tax schedule then needs a home on either Taxes or Year.

Recommendation: a tab of Year with the Overview flag.

### 3. Should the Workbook editors move to the pages that use them?

Today, when an invoice needs a client's address, the invoice dialog sends you to Workbook, Clients. Year end sends you to Workbook, Assets and Year end, and Review sends you to Workbook, Rules.

- **Move each editor to the page that reads it.** Rules go to Review, Clients and the billing and invoice terms to Invoicing, and Assets, Grants and Year-end lines to Year. Settings keeps General, Categories and Accounts. A fix never leaves the page where you found the need. Cost: someone looking for "all the Sheet's tabs" finds them on four pages.
- **Keep every editor on Settings.** All the Sheet's tabs are in one place, as Workbook is today. Cost: the jumps above stay.

Recommendation: move them.

### 4. Should a confirmed row be recategorised from Transactions?

On 19 Oct a few confirmed rows had the wrong category and were refiled by hand in the Sheet. Only rows in the Review queue get the category picker today.

- **Add "Change category" to rows on Transactions.** It writes `category` and `flagged_by` on a confirmed row, which the app never does today. Cost: a new kind of write, and a wrong click changes history the rules learned from.
- **Keep fixes in the Sheet.** Nothing new is written. Cost: you keep leaving the app for this.

Recommendation: add it, as a small change after wave 12, so the regrouping stays a pure UI change.
