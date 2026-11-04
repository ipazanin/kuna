# Owner benefit from company costs: proposal

Wave 13b, revised to the owner's decisions of 2026-10-22: a shadow owner share copied from a category default into an owner_share cell on each ledger row and owner advance, counted as untaxed owner pay on the cash screens while every official tax figure reads the rows as booked, the Owner analytics, the editing flows and five build stages.

Built on three research lanes: [figures](research/owner-benefit/lane1-figures.md), [tax law](research/owner-benefit/lane2-tax.md) and [screens](research/owner-benefit/lane3-screens.md). Code claims are checked against the HEAD copy at 7128551, with paths relative to it. The wave is built after Wave 12b ([its plan](../platform/storage-boundary-plan.md)) and Wave 13, so paths of files those waves create or rename are estimates and marked so. Every figure in this file is made up.

## The owner's decisions, 2026-10-22

1. **A shadow figure only.** The accountant books the costs in full as deductible business costs. The share is your own estimate of what you enjoy privately, such as the second laptop you did not have to buy, or the personal value of what an AI consultation taught you.
2. **Official tax figures stay untouched:** corporate tax, dividend tax, VAT, payroll, the Taxes tab, the accountant comparison on Year, the forecast, the pay scenarios and the accrual year. No figure for the tax of a correct booking. Owner shows the tax the share avoided against taking the same money as a dividend, and one line saying the benefit is your estimate, not booked. The benefit counts as untaxed pay in gross cost and cost per euro received.
3. **A share counts when the payment was made**, a laptop included. No spreading over depreciation.
4. **Every cash screen shows it:** Overview, Analysis, Transactions and Owner. Operating cost goes down and owner pay goes up by the share. Net stays the same. Transactions marks a row's owner part.
5. **One default per category, with no dates.** Each ledger row has its own `owner_share` cell. When a row gets its category, the app copies the category's default into the cell. From then on the value is the row's own. An "Owner share" dialog with Undo overrides one payment.
6. **Saving a default offers to fill** the rows of that category with no share yet, in one batch with Undo. Rows that hold a share are left alone.
7. **Recategorising copies the new category's default**, even over an override.
8. **Owner advances carry the same cell**, copied from their category the same way.
9. **Built after Wave 13**, so every new ledger row copies its share at import and nothing else writes the column.
10. **Split parts carry their own share.** The splits tab gets an `owner_share` column. The split editor copies each part's category default and offers the override per part. While a row is split, its own ledger cell is ignored and the parts' cells count.

**Assumed unless you say otherwise:**

- A blank share reads as 0. Blank and 0 differ in one place only: the fill offer fills blanks and leaves a 0 alone.
- Only operating categories may carry a default, and a share counts only while its row's category is in operating cost.
- A share is a whole percentage from 0 to 100.
- Shares count only while `owner_pay_module` is on. Off, nothing about shares shows and every figure is as today.
- The "Owner share" action sits on Transactions only, on settled rows, split parts and advances in operating cost. Review gets no new control, because confirming a waiting row copies the default again.

## 1. The law, briefly

Your reading holds as a shadow figure. The company deducts the whole cost, so the private part never paid the corporate tax and the dividend tax that taking the same money out as a dividend would cost: 20.8% of the share at today's 10% and 12%. That saving is what Owner shows.

The law does put a value on one such case. When an employer lets an employee use its property privately, that use is salary in kind, taxed through payroll at market value with VAT and grossed up for contributions and income tax. Sources: ZPDoh Art. 21(3) ("Primicima u naravi smatraju se korištenje zgrada, prometnih sredstava, povoljnije kamate pri odobravanju kredita i druge pogodnosti"), Pravilnik o porezu na dohodak Art. 22(1) and 22(4), and Porezna uprava's opinion KLASA 410-01/14-01/987 of 26 May 2015, which treats private use of a company car by an employee as "dohodak od nesamostalnog rada". The opinion is about a car, and reading it onto a laptop is lane 2's. I loaded all three on 22 October 2026. The app does not compute that tax.

## 2. Storage

### What is reused and what is new

| Concept                                                                                  | Used?                           | Why                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split parts (`src/features/workbook/domain/splits.ts:49-70`)                             | The derivation, not the storage | A split stores amounts, needs two parts, and is refused on a row an asset claims (`src/packs/hr-doo/domain/countedSplits.ts:13-25`), which is every laptop payment. The owner part is derived the way `splitLedger` derives parts. |
| `private-cost-for-owner` (`owner-loan-out`)                                              | No                              | A loan you repay. A share is pay you keep.                                                                                                                                                                                         |
| `non-deductible` role                                                                    | No                              | It feeds the corporate tax add-back, and decision 2 keeps tax untouched.                                                                                                                                                           |
| The categories `vat` column (`workbook.ts:29-30`)                                        | The precedent                   | A per-category fact in a core column, edited in Settings, Categories.                                                                                                                                                              |
| Next 100.00 of company money (`src/packs/hr-doo/domain/scenarios/marginalEuro.ts:42-49`) | Its dividend arithmetic         | Extracted, so Owner and Pay compute the dividend route once.                                                                                                                                                                       |

New: one value object `OwnerShare`, one cell on four kinds (categories, ledger, split parts, owner advances), one category role `owner-benefit`, and the owner part of a row as a derived field beside `split`. Nothing else.

### The category default lives in core

An `owner_share` column on the core `categories` tab, a field `ownerShare: OwnerShare | null` on `Category` (`src/features/workbook/domain/workbook.ts:20-31`). I chose core over a pack-registered column because:

- The ledger cell is core anyway, by decision 5. The copy runs in core write paths: the import, a rule filing rows, Review and Change category. A pack-owned default would need a new seam slot for those four to ask the pack, and 12b's `PackPart` registers whole kinds, not extra fields on a core kind.
- Moving money from operating cost to owner pay is core work: the buckets, `bucketTotals` and the `owner_pay_module` switch are all core (`src/features/settings/domain/profitAndLossLabels.ts:61-66`).
- The `vat` column sets the precedent: a core column that mostly the pack's figures read.

The pack keeps what is its own: the Owner analytics and the dividend comparison, which need the ruleset.

### The ledger column

| Tab              | Column        | Where                                                                                                                                       | Holds                                  |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `ledger`         | `owner_share` | The last column, after `review_reasons` (`src/features/workbook/infrastructure/workbookTemplate.ts:67`), or after `id` once Wave 13 adds it | A whole number from 0 to 100, or blank |
| `categories`     | `owner_share` | After `vat` (`workbookTemplate.ts:82-87`)                                                                                                   | Same                                   |
| `owner-advances` | `owner_share` | After `id` (12b decision 5)                                                                                                                 | Same, on the pack's kind               |

- **Reading.** Readers find columns by name (`workbookTemplate.ts:43-47`), so a Sheet without the column reads every share as blank. A cell that is not a whole number from 0 to 100 reads as blank with a problem naming the row. The row itself still reads, since dropping a bank row would break its balance chain.
- **Writing.** The ledger's write rules let a change touch `category` and `flagged_by` today (`src/features/workbook/application/workbookWriter.ts:102`, `writePlans.ts:31`), and 12b keeps that as the ledger's `changeable` fields. They grow by `ownerShare`. The first write of a share adds the header through 12b's new-column edit, so your live Sheet needs no prompt.
- **Round trip.** The export writes the column like any template column, and `check:round-trip` reads it back (`scripts/round-trip-workbook.mjs:22-37`). The storage contract suite gets a share and a blank share in the ledger, categories and owner-advances fixtures.
- **Identity.** The cell sits on the row it describes, so it needs no reference. It does not depend on the ledger id of "Toward a database" step 1.

### The category the owner parts land in

An owner part cannot keep its source category. Category totals key by slug and take the bucket of the first row they meet (`src/features/spending/domain/categoryTotals.ts:38`), so an owner-pay part of `ai-services` would be summed into the operating line. The research's answer still fits: one owner-pay category picked by the role `owner-benefit`, such as "Benefits from company costs". In an owner-pay category the parts reach owner take, its ring and its monthly chart with no change to `ownerTake` (`src/packs/hr-doo/domain/ownerTake.ts:39`, `:47`). The role is core, declared beside the owner share domain the way receivables declares `revenue` (`src/features/receivables/domain/invoiceMatching.ts:11-14`), because 12b forbids core from importing pack roles.

You add the category once in Settings, Categories. The template and the fake workbook seed it. Without one, shares count as 0 and one workbook problem says why. The categories editor refuses a default while no category carries the role.

### When a row gets its share

Every path that sets a row's category goes through one domain function, 12b's `withVerdict` (today `confirmation`, `recategorisation` and `waitingRowsSettledBy` in `src/features/review/domain/verdictChanges.ts:42-91`). It copies the category's default with the category, so Undo puts both back.

| Path                                                                                                  | Writes                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Statement import, Wave 13 (today's row builder `src/features/imports/domain/importDryRun.ts:212-222`) | The default of the category the rules gave the row. A row with no category gets a blank. |
| A new rule files waiting rows                                                                         | The rule's category's default                                                            |
| Confirm on Review                                                                                     | The default again, so a default changed since import reaches the row                     |
| Recategorise on Review, Change category on Transactions                                               | The new category's default, over any override (decision 7)                               |
| Add advance (`src/packs/hr-doo/presentation/AddAdvanceDialog.vue:46`)                                 | The chosen category's default                                                            |
| Owner share dialog                                                                                    | The value typed                                                                          |
| Fill offer on saving a default                                                                        | The default, on rows of that category with a blank share                                 |

Changing a default never touches a row by itself (decision 5). A category moved out of operating cost must drop its default in the same save. Its rows keep their cells, which count as 0 while the category is outside operating cost.

## 3. How the cash screens count it

**The step.** A core function `ownerPartsOf(booking, benefitCategory)` turns a booking with a share above 0, in an operating category, into two parts: the business part in its own category and the owner part in the benefit category. The owner part is the share of the signed amount, rounded to the cent. The business part is the rest, so the two always add up to the payment. A refund in a shared category gives back its share the same way. Each part carries `ownerPart: { whole, share, sourceCategory }`, as a split part carries `split` (`workbook.ts:84-99`).

**Who sees it.** Today one presented workbook feeds every screen (`src/features/transactions/application/presentedWorkbook.ts:11-19`, `useFilteredLedger.ts:39`). Year must not see the parts, because three of its readers select owner pay by bucket: the forecast hands every owner-pay category to the pay scenario (`src/packs/hr-doo/domain/forecast/forecastYear.ts:437`, `:445`), the scenarios take every owner-pay category out of expenses (`src/packs/hr-doo/domain/scenarios/scenarioCompany.ts:53-62`), and the accrual cost line files owner pay under personnel costs (`src/packs/hr-doo/domain/accrual/costLines.ts:59-61`). So:

- `presentedWorkbook` stays the rows as booked.
- `FilteredLedger` gives the cash screens their rows with the owner parts, in `workbook`, `scoped`, `selected` and `profitAndLossRows`, the advances included. It gains `booked`, the presented workbook without them.
- Year reads `booked` wherever it reads the workbook today (`src/packs/hr-doo/presentation/year/YearScreen.vue:64-175`). That covers Accountant, Statements, Forecast, Plan, Pay, Taxes and Assets.
- Overview's Waiting for you reads `booked`, since its corporate-tax job runs the forecast (`src/features/overview/presentation/waitingForYou.ts:153`, fed at `OverviewScreen.vue:62`).
- `scripts/parity-year-end.mjs:45` keeps `presentedWorkbook`, so the parity script proves Year reads the books.

| Screen                  | What moves                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                | "Every euro earned" moves the share from the operating slice to the owner-pay slice (`src/features/overview/domain/euroSplit.ts:44`). Owner earns rises. Net, Monthly costs and runway stay, since cost counts every bucket (`src/features/workbook/domain/bucketTotals.ts:108-118`). |
| Analysis                | Breakdown lists the business part under its category and "Benefits from company costs" under owner pay. Compare and Over time move operating, owner pay and Owner earns.                                                                                                              |
| Transactions            | A shared row heads its two parts, like a split row. The CSV writes the parts and gains an `owner_share` column.                                                                                                                                                                       |
| Owner, Taken            | Owner take, gross cost and cost per euro received include the parts. New figures in section 5.                                                                                                                                                                                        |
| Owner, Who owes whom    | Nothing. A benefit is owed by nobody.                                                                                                                                                                                                                                                 |
| Review, Invoicing, Year | Nothing.                                                                                                                                                                                                                                                                              |

## 4. The worked example

Made-up 2026, amounts as paid and VAT aside: revenue 50,000, other operating costs 8,000, a laptop of 2,000 paid on 15 March and set to 30% in the Owner share dialog (Equipment has no default), twelve AI consultations of 100 in AI services at a 50% default, owner pay 20,000, taxes on that pay 5,000, corporate tax advances 1,000. The shares come to 600 + 600 = 1,200.

| Figure                                                          | As booked                  | With shares                                                                           |
| --------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| Income                                                          | 50,000                     | 50,000                                                                                |
| Operating cost                                                  | 11,200                     | 10,000                                                                                |
| Equipment, AI services (Breakdown)                              | 2,000, 1,200               | 1,400, 600                                                                            |
| Benefits from company costs (owner pay)                         | 0                          | 1,200, of it 600 in March                                                             |
| Taxes                                                           | 6,000                      | 6,000                                                                                 |
| Owner pay                                                       | 20,000                     | 21,200                                                                                |
| Cost                                                            | 37,200                     | 37,200                                                                                |
| Net                                                             | 12,800                     | 12,800                                                                                |
| Owner earns                                                     | 32,800                     | 34,000                                                                                |
| Owner take                                                      | 20,000                     | 21,200                                                                                |
| Gross cost of the owner                                         | 25,000                     | 26,200, no tax on the 1,200                                                           |
| Cost per euro received                                          | 1.25×                      | 1.24× (26,200 / 21,200 = 1.2358)                                                      |
| Effective tax rate                                              | 12.0%                      | 12.0%                                                                                 |
| Tax avoided against a dividend                                  | none                       | 249.60: 10% corporate tax on 1,200 is 120.00, then 12% of the 1,080.00 left is 129.60 |
| Same money as a dividend, net                                   | none                       | 950.40                                                                                |
| Year: depreciation, profit before tax, corporate tax, after tax | 750, 15,050, 1,505, 13,545 | the same                                                                              |
| Year: dividend capacity, dividend tax on all of it              | 13,545, 1,625.40           | the same                                                                              |
| Forecast, pay scenarios, Taxes tab, PD, VAT, payroll            | as today                   | the same                                                                              |

Year depreciates the laptop at 50% a year from April, 750 in 2026 (lane 1). Its expenses are 8,000 + 750 + 1,200 + 20,000 + 5,000 = 34,950, whatever the shares say.

On Transactions the laptop lists as −2,000 heading −1,400 in Equipment and −600 in Benefits from company costs, "from Equipment, 30%".

## 5. Owner analytics

Everything new sits on Taken, which follows the filter bar.

- **Tiles** go from three to four (`src/packs/hr-doo/presentation/TakenPanel.vue:106` becomes `lg:grid-cols-4`). Owner take gets the caption "€1,200 of it from company costs". The new tile "Benefits from company costs" opens Transactions on the benefit category. Cost per euro received adds to its definition (`TakenPanel.vue:79`): "Benefits from company costs carry no tax, so they make it read cheaper."
- **Owner take by type** and **Owner pay by month** gain the benefit category by themselves.
- **Benefits from company costs** (new card): a ring of each source category's owner part with the share used, or "mixed" when its rows differ. Beside it, the tax avoided against a dividend as a build-up button into the figure dialog, with its two rules, then one line: "Your estimate of private use. The accountant books these costs in full." A link "Set the defaults" opens Settings, Categories.

The corporate rate is the one Year works out for the payment's year (`src/packs/hr-doo/domain/cit/citLiability.ts:56-62`, read the way `waitingForYou.ts:153` reads the forecast), on the booked rows. The dividend rate is `hr.pit.dividend` for the year after, as `marginalEuro.ts:44` reads it. A period across two years sums the years, each at its own rates.

1440 px:

```
[ Who owes whom | Taken ]                              [Filters: 2026  + Add filter]
+------------------+------------------+------------------+------------------+
| Owner take       | Benefits from    | Gross cost of    | Cost per €       |
| €21,200          | company costs    | the owner        | received         |
| €1,200 of it     | €1,200           | €26,200          | 1.24×            |
| from costs       | 13 payments      | €5,000 tax       | gross / take     |
+------------------+------------------+------------------+------------------+
+--------------------------------+------------------------------------------------+
| Owner take by type             | Owner pay by month                             |
|   (ring)  Salary     €20,000   |  stacked bars, Benefits band in March and      |
|           Benefits    €1,200   |  every month after                             |
+--------------------------------+------------------------------------------------+
+---------------------------------------------------------------------------------+
| Benefits from company costs                                                     |
|   (ring)  AI services   50%   €600     Tax avoided against a dividend [€249.60] |
|           Equipment     30%   €600     As a dividend you would net      €950.40 |
|                                        Your estimate of private use. The        |
|   Set the defaults                     accountant books these costs in full.    |
+---------------------------------------------------------------------------------+
```

360 px:

```
[ Who owes whom | Taken ]  [filter 1]
+-----------------+-----------------+
| Owner take      | Benefits from   |
| €21,200         | company costs   |
| €1,200 of it... | €1,200          |
+-----------------+-----------------+
| Gross cost      | Cost per €      |
| €26,200         | 1.24×           |
+-----------------+-----------------+
+-----------------------------------+
| Owner take by type   (ring above) |
| Salary ................. €20,000  |
| Benefits ................ €1,200  |
+-----------------------------------+
| Owner pay by month                |
+-----------------------------------+
| Benefits from company costs       |
|            (ring)                 |
| AI services   50% ......... €600  |
| Equipment     30% ......... €600  |
| Tax avoided against               |
| a dividend           [€249.60]    |
| As a dividend, net      €950.40   |
| Your estimate of private use. The |
| accountant books these costs in   |
| full.                             |
| Set the defaults                  |
+-----------------------------------+
```

The figure dialog goes full screen on a phone (`src/packs/hr-doo/presentation/FigureDialog.vue:22`). Its steps: benefits 1,200.00, corporate tax at 10% 120.00, left after corporate tax 1,080.00, dividend tax at 12% 129.60, tax avoided 249.60.

## 6. Editing

### The Owner share dialog

A row action "Owner share" beside Change category and Split: an icon in the Transactions table (`src/features/transactions/presentation/TransactionsScreen.vue:364`, `:376`), a link in the phone card (`src/features/transactions/presentation/TransactionCards.vue:160-180`), and the same on an owner advance row. Offered on settled bank rows, split parts and advances in an operating category, and on either part of a shared row. Saving writes the one cell through the unit of work, with Undo in the toast.

360 px, full screen as `ChangeCategoryDialog`:

```
+-----------------------------------+
| Owner share                    [x]|
| Computer store · 15 Mar · −€2,000 |
| Equipment                         |
|                                   |
| Share to the owner                |
| [ 30            ] %               |
| [ Use the category's default ]    |
|                                   |
| The company keeps       €1,400.00 |
| You take                  €600.00 |
|                                   |
| Changing the category later sets  |
| the new category's default.       |
+-----------------------------------+
|              [Cancel]  [Save]     |
+-----------------------------------+
```

1440 px, the same content in a centred modal 28 rem wide, Cancel and Save in its footer.

### The default, in Settings, Categories

A column "Owner share" after VAT, a `w-24` input with a "%" slot. The draft checks refuse a value that is not a whole number from 0 to 100, a value on a category outside operating cost, and any value while no category carries `owner-benefit`.

1440 px:

```
Settings  [ General | Categories | ... ]
+------------------------------------------------------------------------------------+
| Category     Shown as     Family     Bucket     Roles     VAT          Owner share |
| ai-services  AI services  operating  operating            reverse-ch.  [ 50 ] %    |
| equipment    Equipment    operating  operating  capital   deductible   [    ] %    |
| owner-benef. Benefits...  owner      owner-pay  owner-b.               –           |
|                                                               [Save categories]    |
+------------------------------------------------------------------------------------+
```

At 360 px the table scrolls sideways, which README "Cards" allows for tab editors only, and the column is the last one.

### The fill offer

When a save sets or changes a default and rows of that category, bank rows or advances, have a blank share, Save opens one question before writing. The answer goes out as one write: the categories and the filled cells together, so one Undo puts all of it back.

360 px:

```
+-----------------------------------+
| Fill the rows without a share?    |
|                                   |
| AI services   50%     12 rows     |
|                                   |
| Rows that already have a share    |
| keep it.                          |
+-----------------------------------+
| [Save and fill 12 rows]           |
| [Save the default only]           |
| [Cancel]                          |
+-----------------------------------+
```

1440 px: the same dialog, the three buttons in one row in the footer, and one line per category when the save changed several.

### Transactions

1440 px:

```
| 15 Mar  Computer store   Shared with the owner, 30%   Counts as its parts   −€2,000.00 |  [pencil]
|           Part 1 of 2    Equipment                                         −€1,400.00 |  [cat] [share]
|           Part 2 of 2    Benefits from company costs, from Equipment        −€600.00  |  [cat] [share]
```

360 px, the split heading card reused (`TransactionCards.vue:102-121`):

```
+-----------------------------------+
| Computer store          −€2,000   |
| [Shared with the owner, 30%]      |
| 15 Mar                   [pencil] |
+-----------------------------------+
|   Equipment             −€1,400   |
+-----------------------------------+
|   Benefits from company   −€600   |
|   costs, from Equipment           |
+-----------------------------------+
```

The heading's pencil opens the Owner share dialog. Change category on either part changes the ledger row, so `categoryChangeOf` returns `ledger` for them.

## 7. Build stages

Five stages after Wave 13, one commit each, in dependency order. Each can deploy on its own: no stage needs a migration, and a Sheet without the columns reads as all blank.

**Proof in every stage:** `npm run check`, `npm run build`, `check:visual` and `check:touch` on the fake build, and on the export `check:round-trip`, `parity:rules`, `parity:year-end` and `parity:payroll`. 12b's figure script prints every figure identical to the commit before the wave, on the export (no column) and on the fake workbook with its shares cleared.

**Stage 1: the share in storage.** About 20 files.

- New `src/features/owner-share/domain/ownerShare.ts`: the `OwnerShare` value object, parsing and the `owner-benefit` role.
- `ownerShare` on `Category`, on the ledger record, on the split part and on the pack's owner advance. The four mappers (the splits tab's included) (12b names, estimated: `workbook/infrastructure/ledgerTab.ts`, `categoriesTab.ts`, `src/packs/hr-doo/infrastructure/ownerAdvancesTab.ts`). The ledger's `changeable` fields. The template's four columns and the seeded category. The fake workbook's category and a few shares. README "The workbook format".
- Proof: unit tests for parsing, blank and 0, and each refusal. The contract suite with the new fixtures on both storages. `check:round-trip` on an xlsx written from the fake workbook, which holds shares.

**Stage 2: the copy on categorisation.** About 12 files.

- `withVerdict` copies the default. The Wave 13 import row builder, the rule filing, Confirm, Recategorise, Change category, Add advance and the split editor's part category all go through it.
- Proof: one unit test per path in section 2's table, recategorising over an override, and Undo putting back category and share together on both storages.

**Stage 3: the cash screens count it.** About 20 files.

- `src/features/owner-share/domain/ownerParts.ts`. `ownerPart` on the transaction and on `Booking`. `FilteredLedger` with the parts and `booked`. Year and Overview's Waiting for you on `booked`. `withSplitHeadings` heads a shared row too (`src/features/transactions/domain/listedRows.ts:65`). Listed advances, `categoryChangeOf`, the CSV. Skipped with the owner-pay module off.
- Proof: the worked example as unit tests on `bucketTotals`, `categoryTotals`, `euroSplit`, `ownerTake` and `ownerCost` (operating 11,200 to 10,000, owner pay 20,000 to 21,200, net 12,800 both, cost per euro 1.25 to 1.24). Rounding that adds up, a refund, a 0% row, a row outside operating, a split row whose parts carry different shares. With shares set on the fake workbook, every figure on Year, Taxes, Accountant, Forecast, Pay and Overview's corporate-tax job matches the run with shares cleared.

**Stage 4: editing.** About 12 files.

- `src/features/owner-share/presentation/OwnerShareDialog.vue`, the row actions in `TransactionsScreen.vue` and `TransactionCards.vue`, the column and draft checks in `CategoriesEditor.vue` and `categoryDrafts.ts`, the fill offer as one write. README "Overview, Transactions, Review and Analysis" and "Settings screen".
- Proof: set, change and clear a share with Undo on both storages. The fill offer writes only blank cells, in one batchUpdate, and Undo restores the default and the cells. The Google request-shape tests. `check:touch` at 360 px.

**Stage 5: Owner analytics.** About 10 files.

- `src/packs/hr-doo/domain/ownerBenefits.ts` (by source category, and the dividend comparison as traced figures). The dividend route moved out of `marginalEuro.ts:42-49` into one function both use. `TakenPanel.vue`, the new card, `packCharts.ts`. README "Taxes and Owner".
- Proof: unit tests give 1,200, 249.60, 950.40 and 1.24× on the example, and the next-euro specs pass unchanged. `check:visual` and `check:touch` at 360 and 1440 px.

## Out of this wave

- The tax a correct booking would cost, as salary in kind or as a hidden profit distribution (decision 2).
- VAT on the private share. The app keeps deducting VAT as booked.
- Lane 2's three corrections to ruleset notes (`owner-pay.ts:938`, `:1002`, `:1010`). They stand on their own and fit a queued fix.
