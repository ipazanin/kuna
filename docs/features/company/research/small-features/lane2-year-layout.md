# Small features, lane 2: the Year page and where company assets live

What the Year page holds per year, why it reads as unorganised, how far the asset register is from Overview, and four layouts with sketches, menu counts and file costs.

Code claims cite the HEAD copy at 7128551, with paths relative to it. Proposals use the Wave 12b target terms from [its plan](../../../platform/storage-boundary-plan.md): records with ids, repositories, and the hr-doo pack owning its records and registering its screens. No real figure, name or IBAN from the export is used. Screenshots come from the fake build (`?fake=excel`, light theme) and are not kept here.

## Summary

- **The asset register is a tab of a page named for a time span.** On a phone it takes the menu, Year, a sideways swipe of the tab row and Assets, because the current year opens with five tabs and Assets sits at 367 to 462 px on a 360 px screen. Nothing on Overview, Analysis, Settings or the closed-year tabs links to it. The only in-app links are three lines inside Forecast's collapsed Profit and loss card.
- **Most of what the Assets and Taxes tabs show ignores the year picker.** Book value, deferred grant, clawback, the book-value chart, depreciation per year, the grant comparison and both editors are the same in every year. So are the corporate tax schedule and the payroll cadence. The year picker frames them anyway, and the tab set around them changes with the year.
- **Recommendation: a Company assets page in the menu, and Year keeps the year-bound jobs.** The menu goes from 8 to 9 items. Year drops to 3 or 4 tabs, which share a phone's width with no sideways scroll. About 11 files, no new browser API. A jump control is worth doing later, at hub level, not as the fix for this.

## Failures and limits

- The fake workbook has no "ended" year (one that has ended without the accountant's lines), so that tab set is read from code only. The queue already notes this gap.
- The sketches for the recommended option are the fake build edited in the browser (title, menu entry, tabs removed). They show the layout, not finished wording.
- The click counts assume the person starts on Overview and knows the register is under Year. Someone who does not know that has no path but trying each page.

## 1. The Year page today

### The year picker and the three tab sets

The header holds one button per year (`src/packs/hr-doo/presentation/year/YearScreen.vue:189-202`). The years are every year with accountant lines, the year before the current one while the ledger reaches into it, the current year and the next (`year/yearChoice.ts:28-36`). The current year is the year of the newest booking (`YearScreen.vue:63-64`), and a link without `year=` opens it (`yearChoice.ts:42-46`).

Each year gets one of three views, and the view decides the tabs (`yearChoice.ts:11-15`, `:33`):

| View   | When                                             | Tabs                                  | Default    |
| ------ | ------------------------------------------------ | ------------------------------------- | ---------- |
| Closed | The year has accountant lines                    | Accountant, Statements, Taxes, Assets | Accountant |
| Ended  | Before the current year, no accountant lines yet | Forecast, Statements, Taxes, Assets   | Forecast   |
| Open   | The current year and the next                    | Forecast, Plan, Pay, Taxes, Assets    | Forecast   |

The default tab is the first in the list (`src/shared/ui/PageTabs.vue:51`, `:65`). A link to a tab the year lacks opens the latest year that has it (`yearChoice.ts:47-48`), and picking a year that lacks the open tab falls back to its first tab (`YearScreen.vue:98-102`). The tab labels and icons are at `YearScreen.vue:44-52`.

Above the tabs, every year shows the planning banner (`YearScreen.vue:207-214`) and any of four notices: estimated rules, missing roles, no `vat` treatment, a blank registration date (`YearScreen.vue:216-236`). On a 360 px phone the tab row starts about 630 px down a 780 px screen (screenshot `year-default-360.png`).

### Every card per tab

| Tab        | Cards, in order                                                                                                                                                                                                                                                                                                                                                                                                        | Follows the year?                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accountant | Lines at a glance, donut (`yearEnd/AccountantPanel.vue:19-29`). From the cash net to profit, waterfall (`:32-35`). Open items (`:43`). The bridge, step by step, collapsed (`:49-57`)                                                                                                                                                                                                                                  | Yes                                                                                                                                                                                                                                                                                                       |
| Statements | Profit and loss, Balance sheet at 31 December, Profit tax return PD, the last two collapsed (`yearEnd/StatementsPanel.vue:41-48`, titles at `yearEnd/closedYearView.ts:30-41`). Konto lines, collapsed (`StatementsPanel.vue:79`). The accountant's lines editor, collapsed when the year has lines (`:91-103`)                                                                                                        | Yes, but the editor holds every year                                                                                                                                                                                                                                                                      |
| Forecast   | Notices (`forecast/ForecastPanel.vue:51-70`). Four tiles (`:72-73`). Month by month (`:76-79`). Profit and loss, PD return, Cash by month, Plan against actual, all collapsed (`:88-134`)                                                                                                                                                                                                                              | Yes                                                                                                                                                                                                                                                                                                       |
| Plan       | Plan for the year: owner pay, costs and other income, purchases, dividend (`forecast/PlanEditor.vue:131-234`)                                                                                                                                                                                                                                                                                                          | Yes                                                                                                                                                                                                                                                                                                       |
| Pay        | Scenario picker and "What the scenarios start from" (`payScenarios/PayPanel.vue:156-175`). Dividend capacity (`:179`, card at `forecast/DividendCard.vue:37-39`). Where the profit before owner pay goes (`PayPanel.vue:192-195`). Side by side, collapsed (`:241-246`). The next 100.00 of company money, collapsed (`:254-259`). Scenarios for the year, collapsed (`:273`, `payScenarios/ScenarioEditor.vue:50-54`) | Yes                                                                                                                                                                                                                                                                                                       |
| Taxes      | Two tiles (`taxes/TaxesPanel.vue:200-201`). Corporate income tax, expected against paid (`:204-210`). Payroll cadence, collapsed (`:259-265`). Tax by type, donut (`:301-313`). Tax by type, by month, collapsed (`:331-341`)                                                                                                                                                                                          | Tiles and both tax-type cards only. The corporate tax card "does not follow the year, as the payroll cadence does not" (`TaxesPanel.vue:149`, `:262`)                                                                                                                                                     |
| Assets     | Doubled-rates switch (`assets/AssetsPanel.vue:337-349`). Four tiles (`:372`, built at `:140-170`). Asset register (`:375-382`) with its notices (`:387-424`). The grant beside it (`:439-441`). Book value over time, collapsed (`:445-458`). Depreciation per year, collapsed (`:463-468`). Asset rows and Grant rows editors (`:477-503`)                                                                            | Only the "Depreciation in YEAR" tile (`:150`), the register's charge column and the deferred tile's caption. The panel says it itself: "Book values and the grant still deferred are as of today, whatever the year" (`:53-56`). The grant comparison lists every year with accountant lines (`:223-229`) |

The fake build shows the same eight Assets headings and the same seven Taxes headings in 2025 and 2026. Measured page heights at 360 px: Accountant 3,690, Statements 4,443, Taxes 3,159, Assets 3,323, Forecast 1,976, Plan 2,240, Pay 3,210.

Screenshots, each at 360 and 1440 px: `2025-accountant`, `2025-statements`, `2025-taxes`, `2025-assets`, `2026-forecast`, `2026-plan`, `2026-pay`, `2026-taxes`, `2026-assets`, `2027-forecast`, `year-default` and `overview`, plus `drawer-360` and `path-year-landing-360`.

### Every path to the asset register

The menu has eight items, with Year seventh and no word about assets (`src/shared/routing/screens.ts:22-31`). I opened every page and tab of the fake build at 1440 px, expanded every collapsed card and disclosure, and listed each link to `tab=assets`, `#asset-rows` or `#grant-rows` (scratch `lane2-paths.mjs`):

| Path                                                                                                           | Where                                                   | Clicks from Overview                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Menu, Year, Assets tab                                                                                         | `screens.ts:29`, `yearChoice.ts:14`                     | Desktop: 2. Phone: 3 taps plus a swipe, since Assets is off-screen at 367 to 462 px (measured on `#/year` at 360 px) |
| Forecast, Profit and loss, a Depreciation, Grant released or Small inventory line                              | `forecast/forecastView.ts:371`, open years only         | Desktop: Year, expand the card, open a line, then its link, so about 4. Not counted click by click                   |
| A bookmark or typed `#/year?tab=assets`                                                                        | `yearChoice.ts:42-48`                                   | 0, if you know it                                                                                                    |
| Overview, Transactions, Review, Invoicing, Analysis, Owner, Settings, Accountant, Statements, Taxes, Plan, Pay | none                                                    | No link                                                                                                              |
| App-wide search                                                                                                | none. Only Transactions and Ruleset have a search field | No path                                                                                                              |

Three places name the assets without linking to them. The open item "A purchase above the asset threshold with no asset row" says it is settled by "An asset row on the assets tab" (`src/packs/hr-doo/domain/yearEnd/yearEndOpenItems.ts:133-141`). The split dialog says an asset "on the assets tab" claims the row (`src/features/transactions/presentation/SplitDialog.vue:169-171`). Analysis links only the taxes and owner-pay groups onward (`src/features/spending/presentation/BreakdownPanel.vue:35-36`), so a capital purchase there drills to rows, not to the register.

## 2. Why it reads as unorganised

**The tabs change with the year.** The same page has three tab sets and two defaults (`yearChoice.ts:11-15`). Taxes is the third tab in a closed year and the fourth in an open one, Assets the fourth or the fifth. The page opens on the current year, so the most common landing is the five-tab set that scrolls on a phone.

**One page holds seven jobs with different rhythms.**

| Job                                 | How often                                                                                   | Follows a year?          |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| Agree the books with the accountant | Once a year, in spring                                                                      | Yes, a closed one        |
| Read and edit the statements        | Once a year                                                                                 | Yes                      |
| Check tax payments landed           | Monthly, from Overview's flag (`src/features/overview/presentation/waitingForYou.ts:43-45`) | The schedule spans years |
| Keep the asset register             | When something is bought, a few times a year                                                | Mostly not               |
| Glance at how the year ends         | Monthly                                                                                     | Yes, an open one         |
| Edit the plan                       | A few times a year                                                                          | Yes                      |
| Compare owner pay mixes             | In Q4                                                                                       | Yes, the next one        |

The page subtitle names two of them: "How the year ends, and whether our books agree with the accountant's for the last one" (`YearScreen.vue:188`).

**A year picker frames content that ignores it.** On Taxes, two of the four cards span every year (`TaxesPanel.vue:149`, `:262`). On Assets, everything but one tile and one column is as of today (`AssetsPanel.vue:53-56`). Switching from 2025 to 2026 there changes almost nothing, which tells the reader the picker is not what organises the page.

**Names do not say what is inside.** "Year" names a time span, not a job, so it gives no hint that the asset register or the scenario editor is there. "Pay" means owner pay scenarios. "Plan" is also the name of a tab on Invoicing (`src/features/invoicing/presentation/InvoicingScreen.vue:29`), where it means the billing plan. "Accountant" and "Statements" both hold the accountant's lines, one as a summary and one line by line. The Assets tab's icon is a package (`YearScreen.vue:51`).

### The Wave 12 proposal's reasoning, held against the result

| Proposal                                                                                                                                                                  | Held?                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Year end with Forecast: kept, as one Year page. The year chip picks the view. The plan editor gets its own tab" ([proposal.md:47](../../../platform/simpler-ui.md))      | Held for the year-bound jobs. The plan editor no longer sits under read-only cards, and the measured phone heights match the estimates (Accountant 3,690 against "about 3,300", Forecast 1,976 against "about 1,800")                                      |
| Pay scenarios beside Plan (question 1)                                                                                                                                    | Held. The plan's owner-pay row links to the Pay tab of the same year (`forecast/PlanEditor.vue:163`)                                                                                                                                                       |
| Taxes as a Year tab with the Overview flag (question 2)                                                                                                                   | Held for the monthly check, since Overview links straight to the card (`waitingForYou.ts:45`). The tab still carries cards that ignore the year                                                                                                            |
| "Assets into Year: kept, as a tab in both year views. Year-end work and planning both send the owner to Assets today" ([proposal.md:53](../../../platform/simpler-ui.md)) | Did not hold. Year-end work names the assets in an open item without a link, and planning links to them only from collapsed forecast lines. Nobody arrives at the register from a job on Year. People look for it by name, and the name is not in the menu |
| The phone tab row: Year's open view has five tabs and scrolls inside the strip ([proposal.md:331](../../../platform/simpler-ui.md))                                       | Held as designed, but the open view is the default, so the scrolling row is the one most people see. Assets, the last tab, starts off-screen                                                                                                               |
| Year's question: "How will this year end, and do our books agree with the accountant's for the last one?" ([proposal.md:34](../../../platform/simpler-ui.md))             | The asset register answers neither question. The proposal's own rule says each page answers one question, and Assets broke it                                                                                                                              |
| An ended year shows the open view without Plan and Pay (proposal.md:178)                                                                                                  | Built differently. The ended year got Statements too (`yearChoice.ts:13`), a third tab set the proposal did not plan                                                                                                                                       |

## 3. Options

No option needs a browser feature the app does not already use, except the jump control. Every sketch uses `PageTabs`, `AppCard`, `KpiTile` and the drawer as they are. Menu counts include the hr-doo pack. Without the pack the menu has six items in every option, since assets, Year and Owner are pack screens.

### A. Company assets, a page of its own

The Assets tab becomes a pack page in the menu, after Year. Its cards stay as they are, in the same order. The page has no year picker: the register's charge and the depreciation tile show the current year, the year of the newest booking, and "Depreciation per year" holds every other year. Year keeps the year-bound jobs: Accountant, Statements, Taxes for a closed year, Forecast, Statements, Taxes for an ended one, and Forecast, Plan, Pay, Taxes for an open one. Every set has four tabs or fewer, so it shares the phone's width (`PageTabs.vue:161`, `:302-313`).

```
360 px                                   1440 px
+----------------------------------+     +-----------+---------------------------------------------+
| =  [#] Company assets   [Export] |     | Overview  | Company assets                              |
|----------------------------------|     | Transact. | What the company owns, what it is worth ... |
| Company assets                   |     | Review  2 | ( ) Show doubled rates      Open the rule   |
| What the company owns, ...       |     | Invoicing | +--------+ +--------+ +--------+ +--------+ |
| ( ) Show doubled rates           |     | Analysis  | |Book val| |Deprec. | |Deferred| |Clawback| |
| +-------------+ +-------------+  |     | Owner     | +--------+ +--------+ +--------+ +--------+ |
| | Book value  | | Deprec. 2026|  |     | Year      | +-----------------------------------------+ |
| +-------------+ +-------------+  |     |>Company   | | Asset register                     [^]  | |
| | Deferred    | | Clawback    |  |     |  assets   | | Asset  Bought  ...  Charge 2026  Book   | |
| +-------------+ +-------------+  |     |-----------| +-----------------------------------------+ |
| +------------------------------+ |     | Settings  | | The grant beside it                     | |
| | Asset register          [^]  | |     |           | | Book value over time            [v]     | |
| | Laptop ...                   | |     |           | | Depreciation per year           [v]     | |
| +------------------------------+ |     |           | | Asset rows  [v]   Grant rows  [v]       | |
+----------------------------------+     +-----------+---------------------------------------------+

Year at 360 px, open year:  [ Forecast | Plan | Pay | Taxes ]   (shared width, nothing off-screen)
```

Real sketches from the fake build: `mock-a-assets-360.png`, `mock-a-assets-1440.png`, `mock-a-year-360.png` (four tabs sharing the width), `mock-a-year-1440.png`, `mock-a-drawer-360.png` (nine items, room to spare).

- **Clicks from Overview:** desktop 1, phone 2.
- **Menu:** 9 items.
- **Also in this change:** the open item and the split dialog link to the page's asset rows, and "the assets tab" in their wording becomes "Company assets", which also stops naming a Sheet tab that Wave 12b turns into a record kind.
- **Hub:** the hub's personal assets are valuations of a flat, a car or an account ([hub lane 3](../../../../architecture/research/hub-lane3-apps.md), line 18), a different record from a depreciated tax asset. "Company assets" keeps the two apart in a hub menu or a jump list, at a cost of one word now.
- **Wave 12b fit:** 12b's contribution has a `screens` slot ([plan.md:227](../../../platform/storage-boundary-plan.md)), and stage 8 moves the asset and grant kinds into the pack ([plan.md:240](../../../platform/storage-boundary-plan.md)). Before 12b stage 1 the page is one more entry in `screens.ts`. After it, one more pack screen. Either order works.
- **Cost, about 11 files.** New: `src/packs/hr-doo/presentation/assets/CompanyAssetsScreen.vue`. Edited: `src/shared/routing/screens.ts`, `src/shared/routing/router.ts`, `year/yearChoice.ts` (drop `assets`), `year/YearScreen.vue` (drop the label, slot and import), `assets/AssetsPanel.vue` (its own year, collapse ids `year.*` to `assets.*`, "on this tab" to "on this page"), `forecast/forecastView.ts:371`, `tests/yearChoice.spec.ts`, `scripts/visual-check.mjs` (6 visits, 2 card exceptions at `:290-291`), `scripts/touch-check.mjs` (4 references), `README.md` (_Assets_, _Year screen_, _Phone layout_, _Wide screens_, _Taxes and Owner_). The two new links add `yearEndOpenItems.ts` and `SplitDialog.vue`.

### B. Year split into a year-end page and a planning page

"Year end" holds Accountant, Statements and Taxes, with the closed and ended years in its picker. "Planning" holds Forecast, Plan and Pay, with the ended year, the current one and the next. An ended year then shows its forecast on Planning and its first accountant lines on Year end, which is cleaner than today's third tab set. Assets still needs a home: as a fourth tab of Year end it stays hidden under a year-end name, so B only fixes the asset search together with A.

```
360 px, Year end                         1440 px, Planning
+----------------------------------+     +-----------+---------------------------------------------+
| =  [#] Year end         [Export] |     | ...       | Planning                 [2025] [2026] [2027]|
| Year end          [2024] [2025]  |     | Year end  | Planning banner, notices                    |
| [Accountant|Statements|Taxes]    |     |>Planning  | Forecast   Plan   Pay                      |
| Lines at a glance (donut)        |     | Company   | +--------+ +--------+ +--------+ +--------+ |
| From the cash net to profit      |     |  assets   | | tiles                                 | |
+----------------------------------+     +-----------+---------------------------------------------+
```

- **Clicks from Overview to assets:** with A, 1 or 2. Without A, Year end then Assets, 2 or 3.
- **Menu:** 9 without a Company assets page, 10 with one.
- **Cost, about 16 files.** A new Planning screen and the forecast, plan and pay state moved out of `YearScreen.vue:127-171`. Two year lists in `yearChoice.ts`. The banner and notices (`YearScreen.vue:207-236`) shown on both pages, so they move into a shared component. Links at `OwnerScreen.vue:35`, `PlanEditor.vue:163`, `forecastView.ts:371`, `BreakdownPanel.vue:35` and `waitingForYou.ts:45`. `screens.ts`, `router.ts`, `tests/yearChoice.spec.ts`, `scripts/support/pageTabFlows.mjs` (`yearTabLinkFlow`), `scripts/visual-check.mjs` (26 Year references), `scripts/touch-check.mjs` (22), `README.md`.
- **Against it:** it reopens a decision you made on 2026-10-21 (Pay on Year, beside Plan), and the year-end page is used in one season.

### C. Year with fixed tabs

One tab list for every year, so nothing moves when the year changes: Forecast, Accountant, Statements, Plan, Pay, Taxes, Assets. A tab with nothing for the year says why, such as "2026 has no accountant's lines yet. They arrive after the year ends." The default stays per view (Accountant for a closed year, Forecast otherwise).

```
360 px                                     1440 px
[Forecast|Accountant|Statem...  >          Forecast  Accountant  Statements  Plan  Pay  Taxes  Assets
 (seven tabs, the strip scrolls,           (in a closed year, Forecast, Plan and Pay are empty states.
  Assets is the last and off-screen)        In an open year, Accountant is)
```

- **Clicks from Overview to assets:** unchanged, 2 on desktop, 3 plus a swipe on a phone.
- **Menu:** 8.
- **Cost, about 7 files:** `yearChoice.ts`, `YearScreen.vue` (empty states), `tests/yearChoice.spec.ts`, `pageTabFlows.mjs`, `visual-check.mjs`, `touch-check.mjs`, `README.md`.
- **Against it:** it fixes only the moving tabs. Every year then has two or three empty tabs, the phone row always scrolls, and Assets is still under Year.

### D. A jump control

A "Jump to" button in the phone top bar beside Export and in the sidebar above the menu opens a search list of every page, tab and named card, such as "Asset register, Year, Assets" or "Payroll cadence, Year, Taxes". It would use Nuxt UI's `UCommandPalette`, which the installed 4.12.0 ships (`node_modules/@nuxt/ui/dist/runtime/components/CommandPalette.vue`) with Fuse.js as a dependency. The app imports none of it today. The search field would carry `enterkeyhint="search"`. MDN: "The `enterkeyhint` global attribute is an enumerated attribute defining what action label (or icon) to present for the enter key on virtual keyboards", with `search` "typically taking the user to the results of searching for the text they have typed". MDN's Baseline line: "Widely available ... It's been available across browsers since November 2021." The browser-compat data behind MDN gives Firefox for Android 94 (`https://bcd.developer.mozilla.org/bcd/api/v0/current/html.global_attributes.enterkeyhint.json`). Without it, the keyboard shows its usual Enter key and nothing breaks.

```
360 px                                   1440 px
+----------------------------------+     +-----------+---------------------------------------------+
| =  [#] Year     [Find] [Export]  |     | [Find...] |                                             |
|----------------------------------|     | Overview  |   +-------------------------------------+   |
| +------------------------------+ |     | ...       |   | asse|                               |   |
| | asse|                        | |     |           |   | Asset register     Year, Assets    |   |
| | Asset register  Year, Assets | |     |           |   | Asset rows         Year, Assets    |   |
| | Asset rows      Year, Assets | |     |           |   | Grant rows         Year, Assets    |   |
+----------------------------------+     +-----------+---------------------------------------------+
```

- **Clicks from Overview to assets:** 2 plus typing, on any width.
- **Menu:** 8.
- **Cost, about 8 files and upkeep:** a dialog component, a list of targets, `AppShell.vue`, `App.vue`, a spec, visual and touch flows, `README.md`. Card titles live in templates, so the target list is hand-kept and drifts when a card is added unless a check compares it with the cards' ids.
- **Against it, now:** it finds a misplaced thing without placing it better. It earns its cost once the hub holds several apps and one search spans them, which 12b's pack seam could feed with each app's targets.

### Comparison

|                        | Assets from Overview (desktop, phone) | Year tabs move with the year?                 | Menu | Files               |
| ---------------------- | ------------------------------------- | --------------------------------------------- | ---- | ------------------- |
| A. Company assets page | 1, 2                                  | Fewer tabs, still three sets, all fit a phone | 9    | about 11            |
| B. Split Year (with A) | 1, 2                                  | No, each page has one set                     | 10   | about 16 plus A     |
| C. Fixed tabs          | 2, 3 plus a swipe                     | No                                            | 8    | about 7             |
| D. Jump control        | 2 plus typing                         | Yes, as today                                 | 8    | about 8 plus upkeep |

## Recommendation

Build A now, named "Company assets", after Year in the menu, with no year picker, and with links from the open item and the split dialog. It answers the search you made, makes every Year tab set fit a phone without scrolling, and costs about 11 files independent of Wave 12b. Leave B and C. Keep D for the hub, where one search across company and personal apps is worth its upkeep.

## Questions for the owner

1. **Give company assets their own menu item?** Today the register is Year, Assets, and on a phone the tab starts off-screen. With its own page it is one tap from the menu, and Year drops to four tabs or fewer. The cost is a ninth menu item, after you settled on eight. I recommend the page.
2. **Call it "Company assets" or "Assets"?** "Assets" matches the short names of the other pages. "Company assets" stays clear once a personal assets app sits beside it in the hub, and in a jump list that spans both. I recommend "Company assets", with the route `#/company-assets`.
3. **Does the page need a year picker?** Only the depreciation tile and the register's charge column follow a year, and "Depreciation per year" already lists every year. Without a picker the page shows the current year's charge and nothing else changes. With one, a closed year's charge is one tap away, at the cost of the year buttons on a page that is otherwise about today. I recommend no picker.
