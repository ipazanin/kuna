# Accountant workbooks read from Drive: proposal

Wave 14 (Wave 5 item 4c): the app reads the VAT and salary workbooks from vat-returns/ and payroll/ under Wave 13's drive.readonly, parses them in the hr-doo pack, and shows two cards on Year, Taxes with badges against figures the app already computes. Nothing is written. Four build stages, about 40 files.

Built on a research lane over the workbooks (lane 1). Code is cited at HEAD 8666d7e, or the working tree where marked. Files that Wave 12b's stage 7 and Wave 13 create are named as their plans name them, or marked as estimates. Every figure in this file is made up.

## What you asked and what is decided

- Wave 5 item 4c: VAT and salary parsers in TypeScript with anonymised fixtures, an Accountant view with bank reconciliation badges. Exit: every filed period parses, and the parsed prepayment matches `Rekapitulacija` for 2026-09.
- Wave 14 (plan): the app reads the workbooks where the mail scripts file them, `vat-returns/` and `payroll/YYYY/YYYY-MM/`, xlsx directly and Google Sheets through export. No `AccountantCells.gs` mirror. It lives where Wave 12's layout puts it, likely Year or Taxes.
- Wave 13 (decided 2026-10-21): `drive.readonly` as a one-time incremental grant, token in page memory only, `drive.file` kept for writes. Wave 14 adds no scope.

## How it works today

The September 2026 return lands as `vat-returns/2026-09-pdv.xlsx` on 14 October. To check it, you open the file and read "Pretplata za prijenos u buduća razdoblja" off `Rekapitulacija`. The app has nothing to set beside it, although it already computes the same balance: `vatPosition` (`src/packs/hr-doo/domain/accrual/accrualBalanceSheet.ts:207`) feeds the closed year's balance sheet (`:103`) and the forecast's cash events, and nobody sees it month by month.

For payroll, Year, Taxes has a Payroll cadence card (`src/packs/hr-doo/presentation/taxes/TaxesPanel.vue:259-299`) that marks a month paid when any contribution row landed. It cannot say whether the 10 October payments are what the accountant computed. That check exists only as `npm run parity:payroll`, a script with its own reader of the salary workbook (`scripts/parity-payroll.mjs:64`).

Lane 1 ran the comparison on your export: the app's VAT position equals the accountant's carry to the cent on every readable return, the sales lines match the invoices tab, and every readable salary month closes on the bank rows of its payout week. The badges would show green on your data from day one.

## The design

**In plain terms.** You open Year, Taxes. If the page holds Wave 13's Drive read access, the app lists the two folders, downloads each period's xlsx or exports its Google Sheet to xlsx, parses it in the pack, and shows two cards for the year: **VAT returns**, one row per period, and **Payroll from the accountant**, one row per worked month. Each row carries badges against what the app computes from the ledger and the invoices. A badge that differs opens Transactions on the rows it compared. A file the parser cannot read shows "Could not read" with its tab and row. Nothing is written to the Sheet or to Drive.

```
1440 px, Year 2026, Taxes
+----------------------------------------------------------------------------------+
| VAT returns                                                 [Read the files]     |
| Period   Sales     Input VAT   Carried forward   Ours        Badges             |
| 2026-09  5,000.00  12.40       1,234.56          1,234.56    [Carry ok] [Sales ok]|
| 2026-08  ...                                                                     |
| 2026-07  No return filed                                                         |
+----------------------------------------------------------------------------------+
| Payroll from the accountant                                                      |
| Worked   Paid      Gross I   To the state   To you    Badges                     |
| 2026-09  12 Oct    1,200.00  540.00         860.00    [Bank ok] [Rules ok]       |
| 2026-08  10 Sep    ...                                [Bank ok] [Part month]     |
+----------------------------------------------------------------------------------+

360 px: one card per period, figures stacked, badges on one line below.
```

### What each badge compares

| Badge | Workbook                                                | App                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carry | `Pretplata za prijenos u buduća razdoblja`              | `vatPosition` through the period, with the `vat-settlement` rows to the period as signed (a refund positive, as `accrualBalanceSheet.ts:103` passes them)                                                          |
| Sales | each `Treće zemlje usluge I` line                       | the invoice with that number: same amount, delivery month (`period_from`) in the period                                                                                                                            |
| Bank  | `- Država`, `Porez na dohodak`, and pension plus health | rows of the taxes bucket with role `owner-pay-tax` and without `profit-distribution`, within 5 days of the title's payout date. The exclusion matters: a dividend-tax row lands in a payout week once on your data |
| Bank  | `- <employee>` less `Zakup` and `Refundacija`           | one owner-pay bank row of that week with that amount, as booked before any split. Rent and net salary share bucket and roles, so it is found by amount, not category                                               |
| Rules | every line, as `parity-payroll.mjs:178-204` compares    | `payrollMonth` with the workbook's gross, city and pillar II. A part month shows "Part month", since the days worked are nowhere in the app. Question 3                                                            |

No badge per purchase line and none on a month's input VAT alone. Purchase lines match several ledger rows (repeat subscriptions), and the month's input VAT differs by cents that cancel in the carry (lane 1).

### Domain, in the pack

New folder `src/packs/hr-doo/domain/accountant/`. The concepts are new: the `year-end` tab holds yearly figures you type from the accountant's package and lives in the Sheet. These are monthly figures read from files and never stored, so they are not a record kind.

- `accountantFile.ts`: the period and kind a Drive name stands for (`YYYY-MM-pdv`, `YYYY-MM-salary`, with or without `.xlsx`), and the choice when one period has both an xlsx and a Sheet: the xlsx wins, and a difference between the two is a problem.
- `vatReturn.ts` and `vatReturnReading.ts`: tabs to a `VatReturn` or a refusal naming tab, row and reason. `Rekapitulacija` read by label inside its two sections (10, 12 and 14 row shapes exist), detail totals found by the form code in column E (`I.5.`, `III.3.`, `II.10./III.10.`, `II.13./III.13.`), and the summary checked against the detail totals. An unknown tab is refused, so a new kind of supply fails loudly.
- `salaryWorkbook.ts` and `salaryWorkbookReading.ts`: the reader from `parity-payroll.mjs:53-100`, moved. Input is the core `CellGrid` (`src/features/imports/domain/tabularStatement.ts:15`). A pack domain may import a core domain.
- `vatReconciliation.ts` and `payrollReconciliation.ts`: the badges above, each a traced figure with its drill. They reuse `vatPosition`, `payrollMonth` and `packRoles.ts`. No new role.

### Application

`src/packs/hr-doo/application/accountantDocuments.ts`: a port `AccountantFolders` (list a folder path, read a file's tabs as grids) and `readAccountantDocuments(port, folders)`, which lists, picks one file per period, parses, and returns the returns, the salary months and the problems. It imports no infrastructure, which wave12b's stage 7 boundary forbids for an application folder.

### Infrastructure

- `src/shared/google/driveClient.ts`: `downloadFile` (`files.get` with `alt=media`), and `version` in the listed fields. `exportAsXlsx` (`:42`) gets its first caller.
- `src/shared/xlsx/sheetGrids.ts`: `gridOf` and the lazy SheetJS import moved out of `src/features/workbook/infrastructure/workbookFile.ts:30,64`, plus a read of every tab. `workbookFile.ts` imports it. Stage 7 closes workbook infrastructure to outside importers, so the move is needed, and it removes a second copy.
- `src/packs/hr-doo/infrastructure/googleAccountantFolders.ts`: the port over Wave 13's Drive token and folder-by-path helper (estimated names). The payroll folder takes one listing per month folder, since Drive lists one level at a time.
- `src/packs/hr-doo/infrastructure/fake/fakeAccountantFolders.ts`: the anonymised fixtures for fake mode.
- `hrDooPack.ts` picks the Google or the fake adapter by mode and hands it to the Taxes cards, as invoicing wires its Google side. No new slot in the core seam.

### Settings, the one write

Two pack keys in the pack's `PackSettings` (working tree `src/features/workbook/domain/packPart.ts:31`): `hr_vat_returns_folder`, default `work/company/company-finance/vat-returns`, and `hr_payroll_folder`, default `work/company/company-finance/payroll`, as Wave 13 does for the statements folder. Edited on Settings, General and saved through `store.write` with the settings kind, which keeps no Undo. No repository, record kind or contract-suite fixture is added, because nothing else is stored.

### Presentation

`src/packs/hr-doo/presentation/taxes/VatReturnsCard.vue`, `PayrollReturnsCard.vue`, `accountantView.ts` (rows, badge words, drills) and `useAccountantDocuments.ts` (asks for the Drive grant through Wave 13's button, holds the result for the page). `TaxesPanel.vue` gains the two cards. Months follow the Year picker: VAT by the period, payroll by the worked month.

### What goes away

- `AccountantCells.gs`, never built, option (b), plan open question 5 and the plan's section "Accountant workbooks: how they reach the app". The planning session rewrites that section.
- The reader and comparisons in `scripts/parity-payroll.mjs`. The script becomes `parity:accountant`, which runs the pack's parsers and badges over the folders and prints pass or fail per period. One script, not two.

## Build stages

One commit per stage. Stages 1 and 2 need neither Wave 13 nor a screen, so they can be built now beside Wave 13 and ship as their own deploy. Stages 3 and 4 need Wave 13's token and folder helper.

**Proof in every stage:** `npm run check`, `npm run build`, `check:pwa`, `check:import`, and on the export `check:round-trip`, `parity:rules`, `parity:year-end` and `parity:accountant`. Stages 3 and 4 add the full `check:visual` and `check:touch` on the fake build.

**Stage 1: parsers and fixtures.** About 12 files.

- The six domain files of `accountant/` without the reconciliations, specs with anonymised grids built in code: the three `Rekapitulacija` shapes, the part-month and full-month salary shapes, text and number `R.b.`, a refused unknown tab, a missing label, a summary that disagrees with its detail tab.
- `parity:accountant` replacing `parity:payroll`, `package.json`, README "Development" checks.
- Proof: every VAT and salary xlsx parses, and with your downloads of the Sheets, every period.

**Stage 2: the badges.** About 6 files.

- `vatReconciliation.ts`, `payrollReconciliation.ts` and specs: the refund sign, the dividend-tax week, a part month, a missing period, a payout split after booking.
- Proof: `parity:accountant` passes every carry, sales, bank and rules check, apart from the one stated correction.

**Stage 3: reading Drive.** About 10 files.

- `downloadFile` and `version`, `src/shared/xlsx/sheetGrids.ts` with `workbookFile.ts` on it, the Google and fake adapters, `accountantDocuments.ts`, the two settings keys (pack settings, template, fake workbook, README settings table).
- Proof: request-shape tests for list, download and export. `check:round-trip` with the keys set. The fake adapter's files parse.

**Stage 4: the cards.** About 10 files, plus 3 if the last read is kept on the device (question 4).

- The two cards, `accountantView.ts`, `useAccountantDocuments.ts`, `TaxesPanel.vue`, touch and visual flows at 360 and 1440 px, README "Taxes" and the Google calls table.
- Proof: the cards on the fake build in both themes, a differing badge drills to its rows, "Could not read" names tab and row.

### What needs your hands (for the planning session)

1. **Before stage 1's full proof, optional:** download the hand-converted Google Sheets as xlsx (File, Download, Microsoft Excel) into the `accountant/` folder beside your exports, named as in Drive with `.xlsx`. Some periods have only a Sheet. Without them the first proof of those layouts is the app's own read in stage 4.
2. **Google Cloud:** nothing new. Confirm that Wave 13 added `drive.readonly` on the consent screen's Data Access page.
3. **Apps Script:** no change, no push.
4. **Live Sheet:** no edit. The folder keys default to today's paths and are written only if you change them.
5. **After the stage 4 deploy:** grant Drive read in Firefox on desktop and in the installed app on the phone, open Year, Taxes for 2025 and 2026, and compare the badges with `parity:accountant`. This is also the first check that Drive's download and export pass Firefox's CORS, which no Google page states.

## Questions for you

### 1. Where the two cards show

Affects the Year page. Today the September return has no place in the app at all, and Year's "Accountant" tab is the closed-year comparison with the year-end package.

- **Put them on Year, Taxes (recommended).** Taxes is on all three year views (`src/packs/hr-doo/presentation/year/yearChoice.ts:11-15`) and already holds Payroll cadence, so VAT and payroll sit beside the tax payments they check. Cost: the 4 card files, no new tab.
- **Add a Year tab "Returns".** A sixth tab on the open year, fifth on the others, with only these two cards. Cost: 2 more files, and one more tab to pick on the phone.
- **Give them their own menu page.** The menu goes from 8 items to 9, against Wave 12's trim. Cost: about 4 more files (route, page, menu entry, check flows).

### 2. Whether the payment-order XMLs are read too

Affects the payroll card. Each month folder also holds the XML the bank imports. Today nothing reads it. Lane 1 matched each of its transfer lines to exactly one ledger row, and it covers rent, which the salary workbook may not.

- **Workbooks only (recommended).** The state and net shares already close on the payout week by role and amount. Rent stays unchecked, as today. Cost: none beyond this proposal.
- **Read the payment orders as well.** A "Paid as ordered" badge per transfer, rent included, and the badge holds even when the amounts repeat month to month. Cost: about 6 more files (a pain.001 parser with fixtures, its listing, a third badge, specs).

### 3. Whether the app checks the accountant's payroll arithmetic

Affects the payroll card. Today only `npm run parity:payroll` on your laptop compares each salary line with the pack's ruleset. Its 2026-09 run passes, but a new year's rates would show up only if someone runs it.

- **Show a Rules badge in the app (recommended).** January's workbook in 2027 turns the badge red the day it lands if the ruleset lacks the new rates, which also feed the forecast and pay scenarios. A part month shows "Part month". Cost: about 2 files, since the comparison moves into the pack in stage 2 anyway.
- **Keep it in the script.** The card shows bank badges only. Cost: none, and the comparison stays in `parity:accountant`.

### 4. When the files are read, and whether the result is kept

Affects Taxes on the phone and offline. The Drive token lives in page memory only (Wave 13), so every new page session needs one grant click, or a redirect on the phone, before anything can be read.

- **Read when you open Taxes, keep the last read on this device (recommended).** The cards show the last result at once with its date, and re-read only files whose Drive `version` changed. Cost: about 3 files (a small IndexedDB table, cleared at sign-out with the workbook cache).
- **Read when you open Taxes, keep nothing.** The cards stay empty until you grant, every session. Cost: none.
- **Read on every sync, with Wave 13's statements.** Fresh everywhere, including a possible Overview job later. Cost: about 7 files, a sync slot in the pack seam, and about 20 Drive listings added to every sync.

## Assumed unless you say otherwise

- A VAT period inside the company's months with no file shows "No return filed". A deliberate gap shows that way too. The carry badge still works for the next period, because `vatPosition` is cumulative.
- A corrected workbook replaces the filed one under a new Drive id. The app reads whatever the folder holds now.
- The badges are read-only. No "accept the accountant's figure" action.

## Risks

- **The Sheets are unverified.** Some workbook files are Google Sheets converted by hand, and some periods have nothing else. Their content is not on disk. A conversion that turned numbers into text or renamed a tab fails the parser loudly per period. Your downloads, or the stage 4 read, settle it.
- **The accountant changes the layout.** Labels, section headers and form codes are the anchors, not row numbers, and an unknown tab is refused. A new layout costs a fixture and a parser change.
- **Real data in fixtures.** Fixtures are grids with made-up figures and names. `parity:accountant` prints pass or fail only, as `parity-payroll.mjs` does now.
- **Restricted scope.** `drive.readonly` shows the unverified-app screen and caps the app at 100 new users while unverified (https://support.google.com/cloud/answer/7454865). That is Wave 13's choice, unchanged here.
- **Firefox CORS** on `alt=media` and `export` is untested until your stage 4 run.

## What stays out

- Incoming invoices, IP1 forms and the mail bodies.
- Payment-order XMLs, unless you pick them in question 2.
- An Overview job for a differing badge.
- Year-end checks from the monthly files, such as the December carry against the closed year's VAT receivable.
- Any write to Drive or the Sheet beyond the two folder keys.

## The owner's decisions, 2026-10-23

1. The VAT return and payroll cards go on Year, Taxes.
2. Workbooks only. The payment-order XMLs are not read.
3. A Rules badge in the app checks the accountant's payroll lines against the ruleset.
4. The files are read when Taxes opens, and the last read is kept on the device. Only files whose Drive version changed are read again.
