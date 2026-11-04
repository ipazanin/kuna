# Small features: category colours and the Year page

Proposal for the owner: a swatch colour picker per category, the Sheet-only edits that move into the app, and a Company assets page that leaves Year with its year-bound jobs. Build stages, proofs and queue placement against Wave 12b.

Checked against the code at 7128551 (paths relative to the repo) and your export through a scratch script that prints counts only. The detail behind each part is in [lane 1](research/small-features/lane1-configurable.md) and [lane 2](research/small-features/lane2-year-layout.md). Screenshots of the fake build were taken and are not kept here.

## The owner's decisions, 2026-10-22

1. **Nine swatches.** A pop-up of the app's nine chart colours, checked for both themes and shifted for dark mode, with "Bucket colour" for blank. No custom hex for now.
2. **A category's colour shows wherever one category is drawn:** chips, dots, the category picker, Cost by category and the by-category charts. Whole-bucket charts keep bucket colours.
3. **All five Sheet-only edits come in one wave after Wave 12b:** colour, adding the label column, editing and deleting owner advances, roles as a multi-select, removing a settings key. The fix for the tax and owner take charts changing colour with the period goes in the same wave. Rule deletion follows with Wave 13.
4. **The Year page and assets stay as they are for now.** Part B is parked.

## Summary

- **Category colour does nothing in the app today.** The editor writes it, but every chip, dot and bar paints by bucket, and the template says "The app does not use it." Only the Apps Script reads it, to colour the Sheet's ledger cells.
- **Recommended picker:** a pop-up of nine named swatches (the app's eight chart colours plus grey) and "Bucket colour". No native colour input, because Firefox for Android can't pick a custom colour with it.
- **Sheet-only edits:** five small items fit one wave right after Wave 12b. Deleting a rule waits for Wave 13.
- **Year:** the asset register is the last of five tabs on a page named for a time span, off-screen on a phone, and almost nothing links to it. Recommended: a Company assets page in the menu, and Year keeps three or four tabs that fit a phone's width.
- **Order:** the Year change lands between Wave 12b's first and second deploys. The colour picker and the other Sheet-only edits land after Wave 12b and before Wave 13b, which adds a column to the same Categories editor. One chart colour fix can land any time.

## A. Category colours and in-app configuration

### What happens today

- The `colour` column is read as plain text with no check (`src/features/workbook/infrastructure/workbookReader.ts:160`) into `Category.colour: string` (`src/features/workbook/domain/workbook.ts:26`). The template's note says: "Your own note of a colour, such as #dce9f9. The app does not use it." (`src/features/workbook/infrastructure/workbookTemplate.ts:79`).
- The editor field is a 7rem text box with the placeholder `#hex` and a 12 px swatch (`src/features/settings/presentation/CategoriesEditor.vue:160-164`). Colour is not a checked field (`src/features/settings/domain/categoryDrafts.ts:22`), so `blue` or `#12345` saves without an error.
- Chips, dots and bars use the bucket colour, and the bucket colours are the first five chart slots (`src/shared/styles/tokens.css:161-169`).
- **A defect:** the Tax by type and owner take charts pick a colour by place in a list (`src/packs/hr-doo/presentation/packCharts.ts:28-47`). The comment says this is "so a filter that hides one never repaints the others" (`packCharts.ts:34-36`). But both callers pass only the categories that moved in the period (`src/packs/hr-doo/domain/taxByType.ts:49`, `src/packs/hr-doo/presentation/TakenPanel.vue:47`). So a tax category with no payment in one year shifts every tax after it to the next colour.
- **Your Sheet:** every category colour is a valid `#rrggbb`, but there are only a few distinct values, one pastel per family. They are cell backgrounds for dark text, so on the app's cards they read as near-white squares (lane 1, "Light and dark").
- The Apps Script turns each distinct `#rrggbb` into a conditional format on the ledger's category cells and skips anything else (the Apps Script's `Code.gs:281-317`, the check at `:302`). Wave 13 keeps the ledger formatting in the Apps Script, so this keeps working.

### Browser support for a colour picker

The native `<input type="color">` does not fit on your phone. MDN's compatibility data for `html.elements.input.type_color` gives Firefox for Android partial support from version 27, with the note: "Firefox for Android doesn't allow the user to choose a custom color, only one of the predefined ones." ([browser-compat-data, `html/elements/input/color.json`](https://raw.githubusercontent.com/mdn/browser-compat-data/main/html/elements/input/color.json)). The bug it links, [1796343 "Add advanced color picker"](https://bugzilla.mozilla.org/show_bug.cgi?id=1796343), is still NEW in "Firefox for Android", "Browser Engine". The same data gives the `list` attribute, which would offer our own swatches, as "Not available on macOS and Android", and `accepts_css_colors` as not supported on Firefox for Android.

MDN's page adds two more limits: "The element's presentation may vary substantially from one browser and/or platform to another", and "If you don't specify a value or if the value is invalid or otherwise not supported by the browser, the value defaults to `#000000`, which is opaque black." ([MDN, `<input type="color">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color)). So on your phone it would show Firefox's own preset grid, which doesn't match the app's palette, and "Bucket colour" (blank) would come back as black.

Nuxt UI 4.12.0 ships `UColorPicker`, but its hue track is 8 px wide and its thumbs 16 px (`node_modules/@nuxt/ui/dist/shared/ui.Ba0YYeuK.mjs:2163-2171`), below the app's 44 px rule for phone controls (README "Phone layout"), and the component has no ARIA role or label. It also allows any colour, which brings back colours too pale to read and nothing to adjust them for dark mode.

The recommended picker needs no new browser feature. It uses `UPopover` and `URadioGroup`, both already in the app (`src/features/filters/presentation/FilterChipRow.vue:87`, `src/features/settings/presentation/DevicePanel.vue:140`). reka-ui 2.11.0's radio group renders `role: "radiogroup"` inside a roving focus group, so arrow keys move between swatches (`node_modules/reka-ui/dist/RadioGroup/RadioGroupRoot.js:85-93`).

### The picker

```
Settings, Categories, one row               The pop-up at 360 px (252 px of swatches in a 326 px card)
 software | Software | operating | [##]     +--------------------------------------+
                                    44 px   | Colour of Software                   |
                                            | ( ) Bucket colour, orange today      |
                                            | [Green] [Orange] [Blue] [Amber] [Pink]|
                                            | [Dk green] [Violet] [Red] [Grey]     |
                                            | Blue. Also used by Travel.           |
                                            +--------------------------------------+
```

- **Nine swatches**, named in plain words: Green, Orange, Blue, Amber, Pink, Dark green, Violet, Red, Grey. They are the eight chart slots and the recessive grey, each with its own light and dark step (`tokens.css:85-92`, `:144-151`), already read per theme at runtime (`src/shared/charts/chartTokens.ts:45-51`). Each is a 44 px target, five by two on a phone.
- **Bucket colour** is blank in the tab and keeps today's look, so nothing changes until you pick.
- **A repeat is allowed.** 17 operating categories can't each have their own of nine colours. The pop-up names the other categories in the same bucket that already use a swatch, so a repeat is a choice, not an accident.
- **Stored as the slot's light hex**, such as `#2a78d6` for Blue. The app maps it to the slot's token, so dark mode gets the dark step, and the Apps Script keeps colouring the Sheet because the value is a valid `#rrggbb`. The Sheet's cells turn saturated instead of pastel. `tokens.css:171` says "Every series step is light enough for dark ink in both themes", so the black text stays readable. A spec reads `tokens.css` and fails when the TypeScript palette and the tokens disagree.
- **Your current pastels** read as Bucket colour, since they are not palette colours. They stay in the Sheet untouched until you pick a swatch for that category.
- **In Wave 12b terms:** `CategoryColour` is a small value object in the core domain (a palette slot, or the bucket's), parsed by the category's domain factory from stage 6. The categories write rules refuse a changed colour outside the palette. A saved row whose old Sheet colour the save doesn't change keeps it. Categories are a core kind, not part of the hr-doo pack.

### What only the Sheet can still change

Ranked by how much it matters on your data. Every other tab and settings key already has an editor (lane 1, "Every tab, by use on the live export"). Only the ledger's statement columns come from the bank, and they need none.

| #   | Gap                                                                                                                                                               | Size                                                                                                                                | When     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Category colour has no effect in the app                                                                                                                          | medium                                                                                                                              | Wave 12c |
| 2   | An optional column the tab lacks can't be added from the app. "Shown as" on Categories and Accounts is refused with the column to add (README "Settings screen")  | small after 12b stage 3, which adds a new-column edit to both grid adapters ([plan](../platform/storage-boundary-plan.md), stage 3) | Wave 12c |
| 3   | An owner advance can be added but not edited or deleted (`src/packs/hr-doo/presentation/AddAdvanceDialog.vue`, the write at `:94` adds only)                      | small after 12b stage 8, when it is a pack kind with an `id`                                                                        | Wave 12c |
| 4   | Roles are free text, with no check against the roles the app knows (`src/packs/hr-doo/domain/packRoles.ts:5`)                                                     | small                                                                                                                               | Wave 12c |
| 5   | A settings key can't be removed, such as an unused import profile or a key the app reports as unknown. A settings save only sets or appends (README "Write-back") | small                                                                                                                               | Wave 12c |
| 6   | A rule can't be deleted, only switched off. A rules change is "appended" or "edited" (`src/features/rules/domain/rulesTabChange.ts:17-21`)                        | medium now, small once Wave 13 retires `Rules.gs`                                                                                   | Wave 13  |

Left out of "configurable" on purpose: the chart palette and bucket colours (validated as a set in `tokens.css`), the ruleset (the law, read-only on Settings, Ruleset), and the Sheet's own formatting, which the Apps Script rebuilds and which follows the categories tab by itself.

### Build stages, one commit each

**A1. Tax and owner take colours stop changing with the period.** A fix, independent of the rest.

- Files: `src/packs/hr-doo/presentation/packCharts.ts` (slots from the bucket's full category list, then the moved ones picked out), `src/packs/hr-doo/presentation/taxes/TaxesPanel.vue`, `src/packs/hr-doo/presentation/TakenPanel.vue`, a new `tests/packCharts.spec.ts`.
- Proof: the spec shows a tax category with no payment in the period leaves every other category's colour alone. `npm run check`, then `check:visual --only` and `check:touch --only` on Year, Taxes and Owner, Taken.

**A2. The colour picker on Settings, Categories.**

- Files: new `src/features/workbook/domain/categoryColour.ts` (palette, parse, slot to token), new `src/shared/ui/ColourSwatchPicker.vue`, `CategoriesEditor.vue`, the categories write rules and drafts (`categoryDrafts.ts` today), `workbookTemplate.ts:79` (the note says the app paints with it), `src/features/workbook/infrastructure/fake/fakeWorkbook.ts` (a few palette colours, a few blanks), `tests/categoryColour.spec.ts`, a palette-against-tokens spec, `tests/settingsEditors.spec.ts`, `scripts/support/editorFlows.mjs`, `scripts/touch-check.mjs`, README "The workbook format" and "Settings screen".
- Proof: unit specs for parse and refusal, the editor flow picks a swatch and saves one cell, the touch check measures nine 44 px targets in the pop-up at 360 and 430 px with arrow-key movement, `check:round-trip` on the export shows the pastels untouched.

**A3. The colour shows where one category is drawn.** Its scope depends on question 2.

- Files: `packCharts.ts` (the category's colour first, the A1 slot when blank), and if you choose the wider scope `src/features/transactions/presentation/CategoryChip.vue`, `CategoryPicker.vue`, `AddFilterMenu.vue`, `TransactionGroupHeading.vue`, `TransactionCards.vue`, `TransactionsScreen.vue`, `src/features/spending/presentation/BreakdownPanel.vue`, `PayeeCategories.vue`, the visual check's expectations, README.
- Proof: the visual check in both themes at 360 and 1440 px on Transactions, Analysis, Year, Taxes and Owner, Taken, with one fake category given each palette colour.

**A4. Add a missing optional column from the editor.** The refusal on "Shown as" becomes an "Add the label column" action through 12b's new-column edit, with the same confirm as adding a tab.

- Files: `CategoriesEditor.vue`, `AccountsEditor.vue`, `src/features/settings/presentation/FactTabEditor.vue`, `useSettingsSave.ts`, specs against both storages, README.
- Proof: on the fake Sheet with an old categories tab, one write adds the header and the label, and a second sync shows no refusal.

**A5. Edit and delete an owner advance.** `AddAdvanceDialog.vue` opens with an advance to edit, and `AdvanceList.vue` gets a bin, both through the pack's repository by `id`. Proof: `tests/ownerWrites.spec.ts`, the editor flow, Undo of a delete.

**A6. Roles as a multi-select** of the roles core and the pack declare, with an unknown role shown as a refused chip. Files: `CategoriesEditor.vue`, the categories drafts, `tests/settingsEditors.spec.ts`. Proof: a typo such as `revenu` shows as unknown and blocks the save.

**A7. Remove a settings key.** A bin on an import profile (`src/features/imports/presentation/ProfileEditor.vue`) and on each unknown key the app reports. Files: the settings write rules, `settings.ts`, the editor, specs. Proof: removing a profile deletes its one row, and the next sync no longer offers it.

### Where it fits in the queue

- **A1 can land any time.** Its three files are outside Wave 12b's in-flight work, and no 12b stage changes how the charts pick colours.
- **A2 to A7 wait for Wave 12b to finish**, as one small wave (call it 12c) before Wave 13. Wave 12b stage 6 rebuilds the editors to draft from records, stage 7 replaces the save path with `unit.of(CATEGORIES).change(...)`, and the colour's value object belongs in the category factory stage 6 creates. Built before 12b, each piece would be built twice. The working tree already has `categoryDrafts.ts` and `workbookReader.ts` open for 12b. A4 needs stage 3's column edit, and A5 needs stage 8's pack kinds.
- **Before Wave 13b**, which adds an `owner_share` column to the same Categories editor. The 44 px swatch button takes less of the phone's sideways-scrolling table than today's 7rem text box, which helps once that column joins.

## B. The Year page

### The problem

The asset register is the fifth tab of Year in an open year, which is the default (`src/packs/hr-doo/presentation/year/yearChoice.ts:11-15`, `:42-46`). On a 360 px phone the Assets tab sits off-screen at 367 to 462 px, so it takes the menu, Year, a sideways swipe and Assets: **3 taps and a swipe**, against **2 clicks** on desktop. The menu has no word about assets (`src/shared/routing/screens.ts:22-31`). Only collapsed Profit and loss lines on Forecast link there (`src/packs/hr-doo/presentation/forecast/forecastView.ts:371`). The open item "A purchase above the asset threshold with no asset row" and the split dialog name "the assets tab" without linking to it (`src/packs/hr-doo/domain/yearEnd/yearEndOpenItems.ts:139`, `src/features/transactions/presentation/SplitDialog.vue:169-170`).

The page also doesn't hold together. It has three tab sets that change with the year (`yearChoice.ts:11-15`). Its subtitle names two jobs, "How the year ends, and whether our books agree with the accountant's for the last one" (`src/packs/hr-doo/presentation/year/YearScreen.vue:188`), and the register answers neither. The year picker barely touches it: "Book values and the grant still deferred are as of today, whatever the year" (`src/packs/hr-doo/presentation/assets/AssetsPanel.vue:53-56`). Only the "Depreciation in YEAR" tile (`AssetsPanel.vue:150`) and the register's charge column follow the year.

### Recommended layout: a Company assets page

The Assets tab becomes its own page, after Year in the menu, named "Company assets" at `#/company-assets`, so it stays distinct from the personal assets app the hub will add later. Its cards keep their order. It has no year picker: the tile and the charge column show the current year (the year of the newest booking, as on Year, `YearScreen.vue:63-64`), and "Depreciation per year" holds the others.

Year keeps the year-bound jobs, and every tab set has four tabs or fewer, so the phone shares the row's width with no swipe (`src/shared/ui/PageTabs.vue:161`, `:302-313`):

| Year view      | Tabs                          |
| -------------- | ----------------------------- |
| Closed         | Accountant, Statements, Taxes |
| Ended          | Forecast, Statements, Taxes   |
| Open (default) | Forecast, Plan, Pay, Taxes    |

After the change: **1 click on desktop, 2 taps on a phone.** The open item, the split dialog and the Forecast lines link to the page, and their wording says "Company assets" instead of naming a Sheet tab.

At 360 px:

```
Menu                    Company assets                      Year, open year
+------------------+    +--------------------------------+  +--------------------------------+
| Overview         |    | =  Company assets     [Export] |  | =  Year               [Export] |
| Transactions     |    |--------------------------------|  |--------------------------------|
| Review         2 |    | What the company owns, what it |  | Year   [2025] [2026] [2027]    |
| Invoicing        |    | is worth and what it costs     |  | Planning banner, notices       |
| Analysis         |    | ( ) Show doubled rates         |  | [Forecast| Plan | Pay | Taxes] |
| Owner            |    | +------------+ +------------+  |  |  four tabs share the width     |
| Year             |    | | Book value | | Deprec.2026|  |  | +----------------------------+ |
|>Company assets   |    | +------------+ +------------+  |  | | four tiles                 | |
|------------------|    | | Deferred   | | Clawback   |  |  | | Month by month             | |
| Settings         |    | +------------+ +------------+  |  | +----------------------------+ |
+------------------+    | Asset register           [^]  |  +--------------------------------+
                        | The grant beside it            |
                        | Book value over time     [v]  |
                        | Depreciation per year    [v]  |
                        | Asset rows [v]  Grant rows [v] |
                        +--------------------------------+
```

At 1440 px:

```
+----------------+--------------------------------------------------------------------------+
| Overview       | Company assets                                                           |
| Transactions   | What the company owns, what it is worth and what it costs in the year    |
| Review       2 | ( ) Show doubled rates                                   Open the rule   |
| Invoicing      | +--------------+ +--------------+ +--------------+ +--------------+      |
| Analysis       | | Book value   | | Deprec. 2026 | | Deferred     | | Clawback     |      |
| Owner          | +--------------+ +--------------+ +--------------+ +--------------+      |
| Year           | +-------------------------------------------+ +-----------------------+  |
|>Company assets | | Asset register                       [^] | | The grant beside it   |  |
|----------------| | Asset   Bought   Cost   Charge 2026  Book | |                       |  |
| Settings       | +-------------------------------------------+ +-----------------------+  |
|                | Book value over time [v]   Depreciation per year [v]                     |
|                | Asset rows [v]             Grant rows [v]                                |
+----------------+--------------------------------------------------------------------------+

Year at 1440 px, open year:   Forecast   Plan   Pay   Taxes          [2025] [2026] [2027]
```

Mock-ups from the fake build: `mock-a-assets-360.png`, `mock-a-assets-1440.png`, `mock-a-year-360.png`, `mock-a-year-1440.png` and `mock-a-drawer-360.png` in `small-features/shots-lane2/`.

Taxes stays on Year, since Overview's flag links straight to its cards (`src/features/overview/presentation/waitingForYou.ts:43-45`), and you chose that on 2026-10-21. Two of its cards span every year (`src/packs/hr-doo/presentation/taxes/TaxesPanel.vue:147-150`, `:262`), which is the one loose end left.

### Alternatives

- **Keep Assets on Year and add links to it:** 3 files, but the tab stays off-screen on a phone and the menu still never says "assets".
- **Split Year into a year-end page and a planning page:** about 16 files plus a Company assets page anyway, and it reopens Pay beside Plan, which you settled on 2026-10-21.
- **Fixed tabs for every year:** about 7 files, seven tabs with two or three empty in any year, and Assets still last and off-screen.
- **A "Jump to" search over pages and cards:** about 8 files plus a hand-kept target list. It finds a misplaced thing without placing it better. Worth doing later in the hub, where one search spans several apps.

### Build stage, one commit

**B1. Company assets page.**

- Files: new `src/packs/hr-doo/presentation/assets/CompanyAssetsScreen.vue`, its registration as a pack screen in `src/packs/hr-doo/hrDooPack.ts` (12b stage 1's `screens` slot, [plan](../platform/storage-boundary-plan.md) "The pack seam"), `year/yearChoice.ts` (drop `assets`), `year/YearScreen.vue` (drop the label, slot and import), `assets/AssetsPanel.vue` (its own year, collapse ids `year.*` to `assets.*` at `:378-496`, "this tab" to "this page" at `:344`), `forecast/forecastView.ts:371`, `yearEnd/yearEndOpenItems.ts:139` and `SplitDialog.vue:169-170` (links and wording), `tests/yearChoice.spec.ts`, `tests/yearEndOpenItems.spec.ts`, `scripts/visual-check.mjs` (`:142-146`, `:231`, `:497`), `scripts/touch-check.mjs` (`:89`, `:407-425`, `:793`, `:973-974`), README "Assets", "Year screen", "Phone layout" and "Wide screens". About 15 files.
- Proof: `npm run check` with `yearChoice.spec.ts` asserting no view lists `assets`, `npm run build:fake`, `check:pwa`, and the full `check:visual` and `check:touch`: the page at 360, 430 and 1440 px in both themes, the drawer's nine items as 44 px targets, Year's tabs sharing the width with no overflow in all three views, and the three links landing on `#asset-rows` or the register. No figure changes, so the parity runs are not needed.

### Where it fits in the queue

**After Wave 12b's first deploy (stages 1 to 3), while you accept the ids notice and before stage 4.** Stage 1 is open in the working tree now and edits `screens.ts`, `router.ts` and the new `hrDooPack.ts`, the same files B1 would touch. Landing B1 before stage 1 means moving the new page into the pack a second time. After stage 1 it is one more entry in the pack's `screens`. The pause for the notice is a natural gap, and B1 changes no storage, so it doesn't interact with the ids. Stage 5 later rewrites `sheetRow` in `AssetsPanel.vue` wherever the panel lives.

## Questions for the owner

### 1. How do you pick a category's colour?

Settings, Categories, on your phone. Today you type a hex such as `#dce9f9` into a text box near the right end of a sideways-scrolling table, and nothing checks it.

- **Pick from nine swatches:** every colour is checked for both themes and stepped for dark mode. Your current pastels read as Bucket colour until you pick. Cost: medium (A2).
- **Pick from nine swatches, or type a custom hex:** any colour you like, checked as `#rrggbb`. A custom colour shows the same in light and dark, and a pastel like today's reads as a near-white square on a light card. Cost: A2 plus a field and its check.
- **Use the phone's own colour picker:** on Firefox for Android it offers only Firefox's preset grid, which doesn't match the app's colours, and a blank comes back as black. Cost: small, but it doesn't work for you.

I recommend the nine swatches. Adding a custom hex later is a small change if you miss it.

### 2. Where should a category's colour show?

Analysis, Cost by category, and the category chips on Transactions. Today Software and Travel are both orange, because every operating category paints with the operating bucket's colour.

- **Only on the two by-category charts** (Year, Taxes and Owner, Taken): chips and bars keep bucket colours. Cost: small (A3 touches one file).
- **Wherever one category is drawn:** chips, dots, the category picker and the Cost by category bars use the category's colour, and a category left on Bucket colour looks as it does today. Charts of whole buckets, such as the Overview ring and Profit and loss, keep bucket colours. Cost: about 9 more files and their visual checks.

I recommend wherever one category is drawn, since a colour you pick and then never see on Transactions would feel broken.

### 3. Which Sheet-only edits come into the app first?

Owner, Taken. Today a mistyped owner advance stays wrong once the session's Undo is gone, and fixing it means opening the Sheet.

- **All five small items in one wave after Wave 12b:** colour, adding the label column, editing and deleting owner advances, roles as a multi-select, removing a settings key. Rule deletion follows in Wave 13. Cost: about seven commits, each small once 12b has landed.
- **Colour only now, the rest when you hit them:** the picker ships alone and the other four wait. Cost: A2 and A3.
- **Colour and the label column:** the two gaps visible on your Sheet today. Cost: A2 to A4.

I recommend all five as Wave 12c. Each is small once 12b's repositories exist, and that leaves only rule deletion for the Sheet.

### 4. Where does the asset register live?

The menu, Year. Today, looking for assets on your phone takes the menu, Year, a sideways swipe of the tab row and Assets, and the menu never mentions assets.

- **Give company assets their own page:** one tap from the menu, called "Company assets" at `#/company-assets`, and Year drops to four tabs or fewer that fit a phone. The menu grows from 8 to 9 items. Cost: about 15 files, one commit.
- **Keep Assets on Year and add links to it:** the open item, the split dialog and the forecast lines link there. The tab stays off-screen on a phone. Cost: 3 files.
- **Split Year into a year-end page and a planning page:** each page gets one tab set, but assets still need a page of their own, and Pay moves away from your 2026-10-21 layout. Cost: about 16 files on top of the page.

I recommend the Company assets page, with no year picker, landing between Wave 12b's first and second deploys.
