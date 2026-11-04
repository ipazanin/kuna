# Owner benefit from company costs: screens and editing flows

Lane 3: the Owner screen today, where the default share and the per-row override would be edited, the proposed Owner analytics at 360 and 1440 px, and what the other screens show.

Read from the HEAD copy at 7128551. Paths are relative to it. Checks on the live export come from a scratch script, `counts.mjs`, run with `node --import scripts/support/typescriptResolve.mjs` from the HEAD copy. It prints counts and category slugs only.

## The short answer

- Count the owner part of a shared cost as a part of its row in a new owner-pay category with a new role, the way a split part counts today. Net, cash and balances do not move. Operating cost drops and owner pay rises by the same amount, which is what you described.
- Keep the Year screen on the books as booked. Its accrual view, PD, forecast and pay scenarios all read the owner-pay bucket in ways that would misfile an owner part (see "Year" below).
- Set the default in Settings, Categories as a new column. Override it per row with a new "Owner share" row action beside Change category and Split, opened from Transactions and from a row on Review.
- On Owner, fold the figures into the Taken tab: one new tile, a new slice in "Owner take by type", a new band in the monthly chart, and one new pair of cards, "Benefits by category" and "What the shares change".
- The laptop is the hard case. All 12 equipment payments on the export are claimed by an asset row, and the split editor refuses such a row. The override therefore cannot be a split.

## 1. Owner today

### The screen

`OwnerScreen.vue` (in `src/packs/hr-doo/presentation/`) has two tabs, Who owes whom and Taken (`OwnerScreen.vue:22-25`), in `PageTabs` (`:69-76`). The header holds Add advance and Compare pay mixes (`:53-63`). Compare pay mixes opens Year, Pay for the year after the newest booking (`:35`). One `MissingRoles` line under the header names the four roles both tabs need (`:38-47`, `:68`).

### Taken, which follows the filter bar

All in `TakenPanel.vue`:

| Card                                  | Figure                                                                                                                           | Where                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Tile "Owner take"                     | `ownerTake().total`: the owner-pay bucket over the period, loans in when they are in that bucket                                 | `:58-66`, domain `ownerTake.ts:37-51`                             |
| Tile "Gross cost of the owner"        | take plus the `owner-pay-tax` categories                                                                                         | `:67-73`, `ownerCost.ts:27-41`                                    |
| Tile "Cost per € received"            | gross over take                                                                                                                  | `:74-80`, `ownerCost.ts:39`                                       |
| "Owner take by type" (DonutCard)      | each owner-pay category paid out on balance, loans and negatives under the ring, then the take and the reimbursements outside it | `:82-93`, `:111-141`, ring from `packCharts.ts:88-110`            |
| "Owner pay by month" (DrillChartCard) | the owner-pay categories by month, loans as one "Loans, net" band                                                                | `:95-97`, `:143-152`, `ownerTake.ts:54-78`, `packCharts.ts:55-63` |

The tiles sit in `grid-cols-2 lg:grid-cols-3` (`:106`) and the ring and chart in one row from `xl` (`:110`).

### Who owes whom, all time with no filters

All in `OwedPanel.vue`: the Net owed tile (`:78-91`) and this year's Benefit in kind tile when a loan had a balance (`:92-106`) in `grid-cols-2 lg:grid-cols-4` (`:177`), the line about reimbursements with no cost on file (`:181-188`), `LoanBenefitCard` (`:190`, the card in `LoanBenefitCard.vue:67-103`, each year a `BuildUpButton` that opens `FigureDialog`, `:93`, `:101`), then in `.wide-pair` "Every loan" (`:193-220`) and "Costs the owner paid privately" (`:222-243`), and "Loans to the owner, by month", collapsed (`:246-259`).

### Owner pay elsewhere

- **Overview:** "Every euro earned" has an owner-pay slice (`euroSplit.ts:44`, named in `overviewCharts.ts:22`). The typical month emphasises Net and Owner earns (`OverviewScreen.vue:45`). Owner earns is net plus owner pay (`bucketTotals.ts:117`). Cost is operating plus taxes plus owner pay (`bucketTotals.ts:49`, `:109`), so the Monthly costs tile and runway (`OverviewScreen.vue:76-77`, `:134-135`) count every bucket.
- **Analysis, Breakdown:** cost by category under the buckets, the owner-pay group linking to Owner, Taken (`BreakdownPanel.vue:34-37`, `:61-64`). Category totals are keyed by the category slug alone, taking the bucket of the first row they see (`categoryTotals.ts:38-40`).
- **Analysis, Compare:** profit and loss line by line, owner pay and Owner earns among the lines (`ComparePanel.vue:30`, `:105`).
- **Year, Pay:** scenarios take the owner-pay bucket and the `owner-pay-tax` taxes back out of profit and set their own pay (README line 650). The forecast puts the planned pay in place of the owner-pay categories (README lines 571-574). Dividend capacity shows the loan benefit per option (`forecastView.ts:408`).
- **Year, Accountant:** Open items (`AccountantPanel.vue:43-47`, built in `closedYearView.ts:92`) already carry the loans' benefit in kind as an item to settle.

## 2. What exists that a share could reuse

| Concept                                                                              | What it means today                                                                                           | Reuse for the owner part                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split part (`splits.ts:17-34`, `splitLedger` `:49-70`)                               | A part of a bank row in its own category. The row keeps its day, balance and order. Figures count the parts   | The shape fits: an owner part is a part of the row. But a stored split needs two parts and refuses an asset-claimed row (README line 397, `SplitDialog.vue:80-83`), and a stored split cannot say "0%, no share here". So the owner part should be derived the way `splitLedger` derives parts, and stored as a share, not as split rows |
| `private-cost-for-owner` (owner-pay bucket, `owner-loan-out` role)                   | The owner's private share of a payment, owed back. Live: 1 split part in it                                   | Wrong meaning. The loan book counts it as lent until repaid. A benefit is kept as pay. If you want some shares repaid instead, that is today's split, unchanged                                                                                                                                                                          |
| `non-deductible` role                                                                | Costs the PD adds back in full (`taxBase.ts:79-87`)                                                           | The tax side of the "booked as private use" reading only. Not a screen concept                                                                                                                                                                                                                                                           |
| `reimbursement` role                                                                 | Settles a cost between owner and company                                                                      | Not related. A benefit settles nothing                                                                                                                                                                                                                                                                                                   |
| Loan benefit in kind (`ownerLoanInterest.ts`, `LoanBenefitCard.vue`)                 | Pay in kind worked out from the loan book, shown by year with a build-up                                      | The pattern to copy for the tax figure: a traced figure, a `BuildUpButton`, a `FigureDialog`, and a Year open item                                                                                                                                                                                                                       |
| Owner advance (`owner-advances` tab)                                                 | A cost the owner paid privately. Live: 7, of which 2 in `ai-services`                                         | A shared category's default should reach advances too, since they count as costs in their category. The override then needs a field on the advance                                                                                                                                                                                       |
| Asset register                                                                       | Claims the payment row. Live: 13 assets, 7 `computers`. All 12 `equipment` debits are claimed (counts script) | The laptop's share applies to the claimed payment row on the cash screens. Whether it should also follow the depreciation is a question below                                                                                                                                                                                            |
| "Every owner advance" filter choice (`filterState.ts:47-52`, `AddFilterMenu.vue:43`) | A pseudo category that selects every advance                                                                  | The pattern for an "Every owner share" filter choice, if the owner part has no category of its own                                                                                                                                                                                                                                       |

The owner part needs a category of its own. Category totals key by slug and take one bucket per slug (`categoryTotals.ts:38-40`), so an owner part that kept `ai-services` with the owner-pay bucket would be summed into the operating line. A new owner-pay category picked by a new role, such as `owner-benefit`, keeps every existing total right, as the README asks for categories (README "Taxes and Owner": roles, never names). The part then carries the category it came from, as a split part carries `whole` (`workbook.ts:90-99`), so Owner can group by it.

## 3. The tax readings, as the screens would show them

"Capital gains tax" in Croatian terms is _porez na dohodak od kapitala_, which covers both a dividend and a hidden profit distribution. The ruleset already has both.

| Reading                             | What it says                                                                                                                                                                                                                                                                                                                                  | Figure on Owner                                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Tax the full booking saved       | Booked as a company cost, the owner part lowered profit, so the corporate tax (10% below the revenue threshold, `profit-tax.ts:226-243`) and the dividend it would have been paid as (12%, `owner-pay.ts:967-989`). For the same company money X: X as a benefit reaches the owner whole, X as a dividend reaches the owner as X × 0.9 × 0.88 | "Tax saved against a dividend": X × (0.10 + 0.90 × 0.12) = 20.8% of X at the low rate                                                                                                     |
| B. Tax a correct booking would cost | Private use of company assets by a member is capital income at 36%, and the cost is not deductible (`owner-pay.ts:991-1013`, `profit-tax.ts:512-530`). The rule's own note leaves open whether the 36% is on the value or on top, and the add-back rule says no add-back where income tax was paid                                            | "Tax if booked as private use": 36% of X, plus 10% of X only if the add-back also applies. Unconfirmed, for the accountant                                                                |
| C. Benefit in kind through payroll  | The same value taxed as salary in kind, the way the loan benefit is (README "Taxes and Owner")                                                                                                                                                                                                                                                | Contributions and income tax through `payrollMonth`. Not proposed unless the accountant says this is the route. Which of B and C reaches a member who is also the employee is unconfirmed |

None of these moves a ledger figure. They are figures on Owner, and B is an open item on Year, Accountant.

## 4. Where to set the default share

| Option                                             | What you do                                                                                                                                                                                        | Cost                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A column on Settings, Categories** (recommended) | A "Share to owner" field per category, as `vat` is, stored in a new `owner_share` column on the categories tab, read like `hr_owner_loan_interest` (`30%` or `0.3`, `settings.ts:447-452`, `:768`) | One draft field (`categoryDrafts.ts:6-20`, `:80-98`), one input in `CategoriesEditor.vue:93-197`, one check in `categoryDraftErrors` (`:32-65`). The table already scrolls sideways at 360 px, which the README allows only for tab editors (README line 132) |
| A "Default shares" card on Owner                   | A list of the operating categories with a percent each and one Save                                                                                                                                | Mobile friendly, but a second editor for a categories column. One way per thing says no                                                                                                                                                                       |
| A settings key per category                        | `owner_share_ai-services = 30%`                                                                                                                                                                    | Grows the settings tab with keys that belong to a category                                                                                                                                                                                                    |

The share applies only to categories in the operating bucket, and to taxes never. The editor should refuse a share on any other bucket, and anything outside 0% to 100%.

## 5. Where to override it per row

Today `categoryChangeOf` decides where a row's category changes: on the ledger row, in the split editor for a part, nowhere for a row still waiting or an advance (`categoryChange.ts:9-19`). The row actions are icon buttons in the table (`TransactionsScreen.vue:336-382`) and link buttons in the phone card's details (`TransactionCards.vue:142-183`). Review's queue item has Confirm, Recategorise, Make this a rule and Split in one wrapping row (`ReviewQueueItem.vue:135-176`). Change category writes `category` and `flagged_by` on the ledger row through the row write path with Undo (`ChangeCategoryDialog.vue:55-68`).

| Option                                                   | What you do                                                                                                                                                                                                                                                                                                                          | Cost                                                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **An "Owner share" row action and dialog** (recommended) | On a row in a shared category, or any operating row, a third action opens a small dialog: the category's default, a percent field, "Use the category's share", and what the company keeps and what the owner takes. Review shows a line under the row ("30% to the owner, the AI services share. Change") that opens the same dialog | One dialog shaped like `ChangeCategoryDialog`, one action in each of the two row layouts, one line on the queue item. It works on an asset-claimed row and on a 0% override, which a split cannot do |
| A share field per part in the split editor               | Split the row and mark one part as the owner's                                                                                                                                                                                                                                                                                       | Refused on the laptop (asset claim), needs two parts, and cannot express 0%                                                                                                                          |
| Recategorise to an owner-benefit category                | Move the whole row                                                                                                                                                                                                                                                                                                                   | All or nothing. No percentage                                                                                                                                                                        |

Where the override lives is a storage question for the domain lane. The screens need one thing from it: the override names one booking, a ledger row, a split part or an owner advance. In the database shape of wave 12b, that is a field on the booking itself (an `owner_share` cell beside `category` on the ledger, on a split part and on an advance), or one `owner-shares` record kind with an `id` that references the booking. The first is one cell write, as Change category already does on the ledger. The second keeps the ledger's columns to the Apps Script's A to R. On a split, the share field goes on each part in the split editor, so the split editor stays the one place a part changes. On an advance, it goes in Add advance and the advances editor.

## 6. Proposed Owner analytics

All on Taken, since the share is a period figure and Taken already follows the filter bar. A third tab would hold four cards and split the owner take across two tabs.

**Tiles** (`grid-cols-2 lg:grid-cols-4`, as Who owes whom):

1. **Owner take**, now with the owner parts. Caption: "€X of it from company costs". Definition adds one sentence.
2. **Benefits from company costs** (new). The owner parts over the period. Caption: "N rows in K categories". Opens Transactions on "Every owner share".
3. **Gross cost of the owner**, unchanged formula, so it rises by X with no tax on top.
4. **Cost per € received**. It reads cheaper with benefits in, and its definition should say so, as it already does for loans (`TakenPanel.vue:79`).

**"Owner take by type"** gains one slice, "Benefits from company costs", in its own token. Live there are 4 non-loan owner-pay categories, so the ring reaches the five-part limit of `DonutCard`. Past five, `categorySeries` folds the rest into "Other categories" (`packCharts.ts:38-46`).

**"Owner pay by month"** gains a "Benefits" band, stacked like the others.

**"Benefits by category"** (new DonutCard): each source category's owner part, in tab order through `categorySeries`, so a category keeps its slot on every visit. The list gives the share used ("30%", or "mixed" when rows were overridden) and opens the rows. Under the list: "N rows set by hand. Set the shares" linking to `#/settings?tab=categories`.

**"What the shares change"** (new AppCard): as booked against with the shares, then the tax lines, each a `BuildUpButton` into `FigureDialog` with its steps and rules.

1440 px, Taken:

```
[Filters: Last 12 months  + Add filter]
+--------------+--------------+--------------+--------------+
| Owner take   | Benefits from| Gross cost   | Cost per €   |
| €41,200      | company costs| of the owner | received     |
| €2,100 of it | €2,100       | €47,900      | 1.16x        |
| from costs   | 31 rows, 4   | €6,700 tax   | Gross / take |
+--------------+--------------+--------------+--------------+
+-----------------------------+------------------------------------------+
| Owner take by type          | Owner pay by month                       |
|   (ring)  Salary      62%   |  stacked bars, Benefits band on top      |
|           Rent        18%   |                                          |
|           Benefits     5%   |                                          |
|  ...      Loans, net  -€x   |                                          |
+-----------------------------+------------------------------------------+
+-----------------------------+------------------------------------------+
| Benefits by category        | What the shares change                   |
|   (ring)  AI services  30% €|              As booked  With shares      |
|           Equipment    30% €|  Operating   €…         €… (−€2,100)     |
|           Telecom      50% €|  Owner pay   €…         €… (+€2,100)     |
|  4 rows set by hand.        |  Net         €…         same             |
|  Set the shares             |  Tax saved against a dividend   €437 ..  |
|                             |  Tax if booked as private use   €756 ..  |
+-----------------------------+------------------------------------------+
```

(Figures in the sketch are made up.)

360 px, Taken: the tab row with the Filters button as an icon and its count, since "Who owes whom" and "Taken" run past 16 characters (README "Phone layout"). Then:

```
+-----------------+-----------------+
| Owner take      | Benefits from   |
| €41,200         | company costs   |
| €2,100 of it... | €2,100          |
+-----------------+-----------------+
| Gross cost      | Cost per €      |
| €47,900         | 1.16x           |
+-----------------+-----------------+
+-----------------------------------+
| Owner take by type                |
|            (ring)                 |
| Salary ................... €25,5k |
| Benefits ................. €2,100 |
+-----------------------------------+
| Owner pay by month (260 px tall)  |
+-----------------------------------+
| Benefits by category              |
|            (ring)                 |
| AI services   30% ........ €1,200 |
| Equipment     30% ........   €600 |
| 4 rows set by hand. Set the shares|
+-----------------------------------+
| What the shares change            |
| Operating cost                    |
|   €38,000 -> €35,900              |
| Owner pay                         |
|   €39,100 -> €41,200              |
| Net             unchanged         |
| Tax saved against a dividend  €437|
| Tax if booked as private use  €756|
+-----------------------------------+
```

The comparison is a `dl`, one line per figure with the change under it, so it never scrolls sideways. Each tax amount is a `BuildUpButton`, which a phone already lays out as a 44 px target (`BuildUpButton.vue:46-52`), and `FigureDialog` goes full screen on a phone (`FigureDialog.vue:22`).

Who owes whom does not change. A benefit is not owed either way.

## 7. What the other screens show

Cash and the ledger stay untouched: the bank row keeps its amount and balance, as a split row does (`splits.ts:44-48`).

- **Transactions:** a row with a share lists like a split row: the bank row as booked, badged "Shared with the owner, 30%", with its two parts under it, the business part in its category and the owner part in the benefit category with "from AI services" under its name. It reuses `withSplitHeadings` and every drill. A row both split and shared shows each part's own owner part under it. The CSV writes the parts.
- **Analysis, Breakdown and Compare:** the business part only under Operating, and the owner parts as one "Benefits from company costs" line under the owner-pay group. Net does not move. Owner earns rises by X.
- **Overview:** "Every euro earned" moves X from the operating slice to the owner-pay slice. Net, Monthly costs and runway do not move, since cost counts every bucket (`bucketTotals.ts:49`).
- **Year:** stays on the books as booked. `YearScreen.vue:54` reads `useFilteredLedger`, which today feeds every screen the same presented workbook (`useFilteredLedger.ts:39`). If the owner parts went into that workbook, the accrual view would put them on a cost line through the konto mapping by bucket, the forecast would replace them with the planned pay (README lines 571-574), and the scenarios would take them out of profit (README line 650). So the parts need their own step after `presentedWorkbook`, which the cash screens apply and Year does not. On Year, Accountant, an open item "Private use of company costs" carries reading B for the closed year, with its build-up, as the loan benefit does. Pay could say under the scenarios "€X of benefits from company costs this year, outside every scenario". That one is optional.

## 8. Every new control at 360 px

| Control                        | At 360 px                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner share dialog             | `UModal` full screen, as `ChangeCategoryDialog.vue:76`. The row's chip and amount, a percent `UInput` with `inputmode="decimal"` and a "%" trailing slot, size `lg` for 44 px, "Use the category's 30%" as a full-width outline button, then two lines: "The company keeps €70.00", "The owner takes €30.00". Cancel and Save in the footer |
| Transactions row action        | A third link button "Owner share" in the card details beside Change category and Split (`TransactionCards.vue:162-183`). The row wraps, and each is an `inline-target`                                                                                                                                                                      |
| Transactions part badge        | The "Shared with the owner, 30%" heading uses the split heading card (`TransactionCards.vue:102-121`), with the pencil opening the share dialog                                                                                                                                                                                             |
| Review line                    | One text line with an inline "Change" link under the amount, not a fifth button in `ReviewQueueItem.vue:135-176`                                                                                                                                                                                                                            |
| Categories editor column       | A `w-24` input with "%" in the sideways-scrolling table, as every column there                                                                                                                                                                                                                                                              |
| Split editor share             | A percent field under each part's category, on its own line at 360 px                                                                                                                                                                                                                                                                       |
| Add advance share              | One more field in the dialog, under the category                                                                                                                                                                                                                                                                                            |
| Owner tiles, rings, comparison | As sketched above. Rings sit above their lists (`DonutCard.vue`, phone rule), the comparison is a stacked list                                                                                                                                                                                                                              |

## Questions for the owner

1. **Laptop over time.** For the laptop, should the 30% count when you paid for it, or spread with its depreciation over the years? The cash screens count the payment in its month today.
2. **Which tax figure.** Should Owner show the tax the full booking saved against taking it as a dividend (about 21% of the share), the tax a correct booking as private use would cost (36%, unconfirmed), or both?
3. **Repaid or kept.** Is every share a benefit you keep, or should some be repaid like today's private cost for the owner? Repaid shares stay what they are today: a split part in the loan category.
4. **Advances.** Should a category's share also reach the costs you paid privately, such as the two AI services advances?
5. **Which categories may carry a share.** Only operating categories, or also taxes and others?
6. **Where to edit the default.** A column on Settings, Categories, which scrolls sideways on a phone, or a short list on Owner? I recommend the column.
