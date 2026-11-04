# Category colours, and what only the Sheet can change

Where category colour comes from and shows today, a colour picker that works in the Firefox Android PWA, and an inventory of every tab, column and settings key against what the app can edit.

Checked against the code at 7128551 (the HEAD copy), the shadow-accounting Apps Script in its Drive folder, and your export through a scratch script that prints counts only. Paths below are relative to the repo unless they name the Apps Script.

## The short answer

The app does not use a category's colour anywhere. The `colour` column is read and written, but every chart, chip and dot paints by the category's bucket or by its place in a list. The template's own note on the column says so: "Your own note of a colour, such as #dce9f9. The app does not use it." (`src/features/workbook/infrastructure/workbookTemplate.ts:79`). The only thing that reads the column is the Apps Script, which colours the category cells of the Sheet's ledger with it.

So editing the colour on Settings, Categories today changes nothing you can see in the app. That is almost certainly what the owner ran into.

## 1. Category colours today

### Where the colour comes from

- **The tab.** `categories.colour`, read as plain text with no check (`workbookReader.ts:160`) into `Category.colour: string` (`workbook/domain/workbook.ts:26`).
- **The defaults.** The template seeds one pastel per family: `#d7f0e5` income, `#dce9f9` operating, `#f9dcdc` taxes, `#e4e1f6` owner, `#f6e1ee` financing, `#ececec` neutral (`workbookTemplate.ts:256-310`). The Apps Script seeds the same backgrounds once, when the tab is missing (`Code.gs:36`, `Data.gs:38`). The fake workbook copies them (`fakeWorkbook.ts:58-115`).
- **Your live Sheet.** Every category row has a valid `#rrggbb`, but there is only one distinct value per family. Income, taxes, operating and neutral each have their own. Owner pay and financing share `#e4e1f6`.

### Where colour shows, and what it really follows

| Place                                                | Colour follows                                                     | Code                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Category chip on rows and groups                     | bucket                                                             | `CategoryChip.vue:18`, `TransactionCards.vue:135`, `TransactionsScreen.vue:208`, `TransactionGroupHeading.vue:53-55` |
| Category picker and the Add filter menu              | bucket                                                             | `CategoryPicker.vue:69,76`, `AddFilterMenu.vue:76`                                                                   |
| Analysis, Cost by category bars                      | bucket                                                             | `BreakdownPanel.vue:71`                                                                                              |
| Analysis, payee category strip                       | bucket                                                             | `PayeeCategories.vue:86`                                                                                             |
| Profit and loss charts, Overview ring, forecast      | bucket                                                             | `profitAndLossChart.ts:27`, `overviewCharts.ts:20-23`, `forecastChart.ts:120-121`                                    |
| Year, Taxes: Tax by type ring and chart              | place in the list of tax categories that moved in the year         | `TaxesPanel.vue:68-72`, `taxByType.ts:49`, `packCharts.ts:28-46`                                                     |
| Owner, Taken: owner take ring and chart              | place in the list of owner pay categories that moved in the period | `TakenPanel.vue:47-48`, `packCharts.ts:55-64`                                                                        |
| Settings, Categories: the swatch in the colour field | the `colour` text                                                  | `CategoriesEditor.vue:160-164`                                                                                       |
| The Sheet's ledger, column I                         | the `colour` text, as a conditional format                         | `Code.gs:222`, `Code.gs:281-317`                                                                                     |

The bucket colours are the first five chart slots (`tokens.css:161-169`). The two by-category charts take slots in order (`packCharts.ts:28-31`). Two side effects worth knowing:

- **The colour of a tax or owner pay category changes with the period.** `packCharts.ts:33-35` says the colour comes "from its place in the tab's list, so a filter that hides one never repaints the others". But both callers pass only the categories that moved in the period (`taxByType.ts:49`, `TakenPanel.vue:47`). A tax category with no payment in one year shifts every tax after it to the next slot.
- **The same orange means two things.** `tokens.css:161` says "operating is the same orange wherever it appears". On Year, Taxes the first tax category also takes slot 2, which is that orange. In the fake build, Payroll contributions is orange on Year, Taxes while Operating cost is orange on Analysis (screenshots `year-taxes-1440-dark.png` and `analysis-360-light.png`).

A stored per-category colour fixes both, since the colour would follow the category whatever the period.

### How the editor edits it

`CategoriesEditor.vue:160-164`: a `UInput` with the placeholder `#hex`, 7rem wide, with a 12 px swatch in its leading slot painted with whatever was typed. There is no picker and no check. `CategoryField` lists category, family, bucket and vat, but not colour (`categoryDrafts.ts:22`), so `categoryDraftErrors` never looks at it, and the save trims and writes it as typed (`categoryDrafts.ts:91`).

### A blank or bad value

- **In the app:** nothing happens, since nothing reads it. In the fake build I typed `blue` into one row and `#12345` into another. The editor showed no error and Save stayed enabled (`categories-1440-light-bad-values.png`). The swatch shows blue for `blue` and nothing for `#12345`.
- **In the Sheet:** the Apps Script keeps only values matching `^#[0-9a-f]{6}$` (`Code.gs:302`), so a blank, a name or a short hex leaves the cell uncoloured, with no report. A changed colour shows only after the next refresh (`Code.gs:283`).

### Light and dark

The live pastels are cell backgrounds made for dark text on a white Sheet. As colours on the app's surfaces they are near white. I ran the dataviz palette validator on the five live values:

- Light card `#ffffff`: lightness 0.92 to 0.94, chroma 0 to 0.03 ("reads gray"), contrast 1.18 to 1.29 against the card. Fails every check.
- Dark card `#131a23`: contrast passes, but the same lightness and chroma failures, and neighbours sit at ΔE 3.1 to 3.8. They read as five near-white squares (`categories-360-dark-colour-column.png`).

The app's eight chart slots have a separate step per theme (`tokens.css:85-92` light, `tokens.css:144-151` dark), read at runtime per theme (`chartTokens.ts:45-51`). In fixed order they pass in both themes, with a contrast warning in light for green, amber and pink (2.2 to 2.8 against white). With every pair compared, which is what free choice per category gives you, they fail: red and orange are ΔE 7.1 apart in either theme, and under colour blindness dark green and orange (light) or pink and green (dark) nearly merge.

### Screenshots

In a scratch `shots/` folder, from the fake build:

- `categories-360-light.png`, `categories-360-dark.png`: the editor as a phone opens it. The colour column is off screen.
- `categories-360-light-colour-column.png`, `categories-360-dark-colour-column.png`: after scrolling the table sideways. The table is 1380 px wide in a 326 px card, and the colour column starts about 690 px in.
- `categories-1440-light.png`, `categories-1440-dark.png`: the desktop editor.
- `categories-1440-light-bad-values.png`: `blue` and `#12345` typed, no error, Save enabled.
- `analysis-*`, `transactions-*`, `owner-taken-*`, `year-taxes-*`: where colour shows today, at 360 light and 1440 dark.

### What the owner's screenshot likely showed

The image did not reach us. In order of likelihood:

1. **Settings, Categories on the owner's phone:** a row of `#hex` text boxes with tiny, near-white swatches, a long way to the right in a sideways-scrolling table. "Configure color inside the app" reads like a request for a real picker here.
2. **A chart or list where categories the owner thinks of as different share a colour:** every operating category is the same orange on Analysis and Transactions.
3. **The Sheet's ledger with its coloured category cells:** the only place the colours show, which the owner would want in the app.

Whichever it was, the current field falls short in five ways: changing it has no effect in the app, you type a hex code instead of picking, nothing checks the value, on a phone the field is buried mid-table, and the live values are too pale to work as chart colours.

## 2. A colour picker

### Browser support

**`<input type="color">` is not good enough on Firefox for Android.** MDN's compatibility data for `html.elements.input.type_color` marks Firefox for Android as partial support from version 27, with the note: "Firefox for Android doesn't allow the user to choose a custom color, only one of the predefined ones." (loaded from mdn/browser-compat-data, `html/elements/input/color.json`). The bug it links, [1796343 "Add advanced color picker"](https://bugzilla.mozilla.org/show_bug.cgi?id=1796343), is NEW in "Firefox for Android :: Browser Engine". Its description says the picker "has a nice picker" but "its limited to only selecting predefined colors."

The same data gives `list` (the attribute that would offer our own swatches) in Firefox 110 with the note "Not available on macOS and Android", and `accepts_css_colors` from Firefox 143 on desktop only. MDN's page itself says: "The element's presentation may vary substantially from one browser and/or platform to another—it might be a basic textual input that automatically validates to ensure that the color information is entered in the proper format, or a platform-standard color picker, or some kind of custom color picker window." It also says: "If you don't specify a value or if the value is invalid or otherwise not supported by the browser, the value defaults to `#000000`, which is opaque black." ([MDN, `<input type="color">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color)).

So on the owner's phone the native input would show Firefox's own preset grid, which does not match the app's palette, and a blank colour would come back as black.

**Nuxt UI 4.12.0 has `UColorPicker`** (`node_modules/@nuxt/ui/dist/runtime/components/ColorPicker.vue`). It is a saturation square and an 8 px hue track driven by pointer events (`ColorPicker.vue:113-116`), with `touch-none` on both, so a finger drag works without scrolling the page. Against it:

- No keyboard support and no ARIA role or label. The thumbs are plain divs (`ColorPicker.vue:192-213`).
- The hue track is 8 px wide and the thumbs 16 px (`node_modules/@nuxt/ui/dist/shared/ui.Ba0YYeuK.mjs:2167-2171`), far below the app's 44 px rule for phone controls (README "Phone layout").
- It offers any colour, which brings back the problem the validator found: two free picks can be indistinguishable on a chart, and nothing adjusts a free colour for dark mode.

It is not imported anywhere in the app today.

### Recommended design

**A swatch picker with nine named choices, plus "Bucket colour", plus an optional custom hex.**

- **The swatches:** the eight chart slots and the recessive grey, named in plain words: Green, Orange, Blue, Amber, Pink, Dark green, Violet, Red, Grey. These are the only colours that are already stepped per theme and validated against both card surfaces.
- **Bucket colour** (blank in the tab) keeps today's behaviour, so nothing changes until a category gets a colour.
- **Storage:** the slot's light hex, such as `#2a78d6` for Blue. The app turns a stored value that equals a slot's light hex into that slot's token (`--series-3`), so dark mode gets the dark step. The Apps Script keeps colouring the Sheet, since the value is a valid `#rrggbb`. `tokens.css:171` already says every series step is light enough for dark ink, so the Sheet's black text stays readable on those backgrounds.
- **Custom:** a hex text field, checked as `#rrggbb` with an inline error, behind a "Custom" choice. It shows as typed in both themes. No native input, since on Firefox Android it cannot pick a custom colour.
- **The control:** in the editor row, a 44 px swatch button with the colour's name in its accessible label, opening a `UPopover` with a `URadioGroup` of swatches. Both are already in use (`FilterChipRow.vue:87`, `DevicePanel.vue:140`). The radio group gives arrow-key movement and `role="radiogroup"` from reka-ui. Each swatch is a 44 px target, in a 5 by 2 grid on a phone.
- **A shared colour:** dozens of categories cannot each have their own of nine colours, and the dataviz rule is that a chart never invents a tenth hue. The picker allows repeats, and says "Also used by Software and Travel in Operating cost" under a swatch that another category in the same bucket already uses. The rings and their lists name every part, so a repeat stays readable.
- **What changes where:** I recommend using the category colour on the two by-category charts first (Year, Taxes and Owner, Taken, rings and stacked charts), where colour is identity today and currently shifts with the period. Whether chips, dots and the Cost by category bars switch from bucket colour to category colour is a question for the owner, below.

In the Wave 12b target terms: `Category.colour` becomes a small value object in the core domain (a slot, a custom `#rrggbb`, or none), parsed by the category's domain factory. An invalid value reads as none and is reported, the way an unknown `vat` is today (README "The workbook format"), so it never refuses the whole category. The categories `WriteRules` refuse a colour that is not a slot or `#rrggbb`. The editor saves through `unit.of(CATEGORIES).change(before, after)`. Categories are a core kind, not part of the hr-doo pack.

**Size: medium.** The picker component, the value object and its check, the mapping to tokens, two pack chart call sites, the editor hint, tests, and the visual and touch checks on the editor at 360 px. Larger if chips and bars switch too.

### Spots worth opening

1. `src/features/settings/presentation/CategoriesEditor.vue:160` for the field today.
2. `src/packs/hr-doo/presentation/packCharts.ts:28` for how the two by-category charts pick colours.
3. `src/shared/styles/tokens.css:85` for the palette and its dark steps.
4. The Apps Script's `Code.gs:281` for what the Sheet does with the column.

## 3. What only the Sheet can change

### Every tab, by use on the live export

What the app edits on each tab of the export, and where. `plan`, `scenarios` and `dismissed` are missing from it, and the app adds each with its header on first use after asking.

| Tab                       | Edited in the app                                                                            | Where, and with what                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ledger`                  | `category` and `flagged_by` only. Rows are added by Import. Every other column is the bank's | Review (Confirm, Recategorise, rules), Transactions (Change category, Import)                                                  |
| `year-end`                | every column, add and delete                                                                 | Year, Statements, "The accountant's lines": a table of fields with choices for statement and line (`factTabColumns.ts:80-109`) |
| `rules`                   | every column, add, switch off, move. **No delete**                                           | Review, Rules: a form with a condition list (`RuleForm.vue:88-178`)                                                            |
| `categories`              | every column, add and delete. **Colour is text and unused**, roles are free text             | Settings, Categories: a table of fields (`CategoriesEditor.vue`)                                                               |
| `outgoing-plan`           | every column, add, edit, delete, fill a year                                                 | Invoicing, Plan: a dialog (`BillingRowDialog.vue:143-173`)                                                                     |
| `settings`                | see the next table                                                                           | Settings, General. Invoicing, Clients. Transactions, Import                                                                    |
| `invoices`                | every column, add, edit, delete, make                                                        | Invoicing: a dialog (`InvoiceDialog.vue:178-233`)                                                                              |
| `assets` (company assets) | every column, add and delete                                                                 | Year, Assets, "Asset rows": a table of fields (`factTabColumns.ts:30-43`)                                                      |
| `splits`                  | every column, through the split editor                                                       | Transactions, Split                                                                                                            |
| `owner-advances`          | **add only.** No edit or delete, only Undo in the session                                    | Owner, Add advance (`AddAdvanceDialog.vue:112-130`)                                                                            |
| `accounts`                | every column, add and delete                                                                 | Settings, Accounts: a table of fields                                                                                          |
| `clients`                 | every column, add and delete                                                                 | Invoicing, Clients: a table of fields (`factTabColumns.ts:46-56`)                                                              |
| `grants`                  | every column, add and delete                                                                 | Year, Assets, "Grant rows" (`factTabColumns.ts:58-71`)                                                                         |
| `plan`                    | every row kind                                                                               | Year, Plan: dialogs                                                                                                            |
| `scenarios`               | every column, rename, copy, starting set                                                     | Year, Pay: dialogs                                                                                                             |
| `dismissed`               | add and delete                                                                               | Review, Rules: Dismiss and Restore                                                                                             |

### Settings keys

| Keys                                                                                                     | Edited in the app              | Where, and with what                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `company_name`, `currency`, `number_locale`, `review_label`, `card_settlement_ibans`, `owner_pay_module` | yes                            | Settings, General, workbook card: text fields, a currency menu, a switch (`GeneralSettingsForm.vue:182-222`)                     |
| `label_income` to `label_neutral`                                                                        | yes                            | Settings, General, bucket labels card: text fields (`GeneralSettingsForm.vue:316-324`)                                           |
| the nine `hr_` keys                                                                                      | yes                            | Settings, General, facts card: a searchable city menu, text fields, selects, switches (`GeneralSettingsForm.vue:241-300`)        |
| the seven `billing_` keys                                                                                | yes                            | Invoicing, Clients, terms: amount and item fields, a client select (`InvoicingTermsForm.vue:41-44,158`)                          |
| the 21 `invoice_` keys                                                                                   | yes                            | Invoicing, Clients, terms: text fields and text areas (`InvoicingTermsForm.vue:97-118`). The folder is also picked in the Picker |
| `import_profile_<name>`                                                                                  | save and change. **No delete** | Transactions, Import: the profile editor (`ProfileEditor.vue:74-125`)                                                            |
| `template_version`                                                                                       | no, and needs none             |                                                                                                                                  |
| an unknown key                                                                                           | reported only. **No delete**   |                                                                                                                                  |

A settings save sets a key's value or appends a row, and never removes one (README "Write-back", Settings).

### What still needs the Sheet, by difficulty

Ranked by how much it matters on your data.

1. **Category colour has no effect in the app.** Medium. Section 2.
2. **Adding an optional column a tab lacks.** Your `categories` and `accounts` tabs have no `label` column, so "Shown as" on either editor is refused with the column to add (README "Settings screen"). The same holds for any optional column, and a tab the editors need but the Sheet lacks only gets its headers named. Small once Wave 12b stage 3 lands, since that stage adds a column-add edit to both grid adapters for the `id` column. Medium before it.
3. **Deleting a rule.** No rule is switched off today, so this is tidiness more than need. A rules change is "appended" or "edited" only (`rulesTabChange.ts:18-21`), and the tab mirrors `Rules.gs`. Medium now, small after Wave 13 retires `Rules.gs` and rules become ordinary records.
4. **Editing or deleting an owner advance.** A mistyped advance stays wrong after the session ends. Small: the dialog exists, and the write path already supports change and delete for the tab (`OWNER_ADVANCE_ROWS`, `ownerAdvanceRows.ts:28`). In 12b terms it is a pack kind with an `id`, so it gets edit and delete by id.
5. **Roles and the year-end `categories` cell are free text.** No typo check against the roles the app knows (`PACK_ROLES`, `packRoles.ts:5`) or the categories list. Small: a multi-select.
6. **Deleting a settings key**, such as an import profile you no longer use or a key the app reports as unknown. Small: a remove in the settings write and a bin on the profile.
7. **The Sheet's own presentation:** the ledger's category dropdown, a data validation "set up by hand in the Sheet" (README line 1258), and the banding, tab colours and category colours the Apps Script rebuilds (`Code.gs:204-232`). No editor needed. A new category already appears in the dropdown, since it reads the categories tab.

Not workbook data, and better left out of "configurable":

- **The chart palette and bucket colours** live in `tokens.css` and are validated as a set. Making them editable would be large and would undo that check.
- **The ruleset** (rates, caps, thresholds) is the law, shown read-only on Settings, Ruleset.
- **The theme** is a device choice, already on Settings, This device.

### Written only by the bank or the Apps Script

Only the `ledger` rows, columns A to H and K to R, come from statements, through the Apps Script or Import. They need no editor. The app writes `category` and `flagged_by` there (README, opening section). The Apps Script also writes the ledger's formatting each morning and seeds `categories` once when the tab is missing (`Data.gs:38`). Every other tab is kept by a person, and the app edits all of them.

## Questions for the owner

1. **What did your screenshot show?** The Categories editor on the phone, a chart where categories share a colour, or the Sheet's coloured ledger cells?
2. **Where should a category's colour show?** On the two by-category charts only (Year, Taxes and Owner, Taken), which I recommend first, or also on the category chips and dots and the Cost by category bars, where bucket colour shows today. Switching those means 17 operating categories share nine colours where today they share one.
3. **Palette only, or palette plus a custom hex?** Palette only keeps every colour checked for both themes. Custom adds a field that shows the same hex in light and dark.
4. **The Sheet's ledger cells:** a palette colour makes them saturated instead of pastel. Fine, or should the Apps Script paint a light tint of the stored colour?
5. **Your current pastels:** clear them to "Bucket colour" in one save, or pick a palette colour per family as the starting point?
