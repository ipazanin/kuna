# Ledgerboard

Company finance dashboards over a workbook of bank transactions, computed in the browser. The
workbook is either a Google Sheet, which stays the system of record, or an Excel file kept in the
browser (Excel mode). There is no backend. It deploys to GitHub Pages at
`https://ipazanin.github.io/ledgerboard/`, with a privacy page at `privacy.html`.

With a Google Sheet, the app asks Google for `drive.file`, which covers files the user picks in the
Google Picker or that the app creates, and for `openid email`, which tells it which account signed
in. The app reads the Sheet and keeps a copy in IndexedDB. It writes only what the user saves, and
only in the Sheet the user picked: `category` and `flagged_by` on ledger rows the user acts on, rows
on the `rules`, `settings` and `owner-advances` tabs, and the `bucket` of the two loan categories.
See *Write-back* below.

On a first run the app asks where the ledger lives: connect a Google Sheet, open an Excel file, or
start from the empty template. Settings has "Switch data source" for the same three choices.

## Google sign-in

There is no backend, so there is no refresh token: Google issues those only through a server-side
code exchange. Instead the app keeps the access token in `localStorage` with its expiry, so a reload
or a new tab within the hour syncs without a click. A token counts as expired a minute before Google
says, and is then removed. Switching to a workbook kept in the browser removes it too, and "Sign out
of Google" in Settings revokes it with `google.accounts.oauth2.revoke` and removes it.

While a token is good, the app syncs on open and whenever the tab becomes visible again, at most
once every ten minutes after the last read or attempt. Without one, the Sync button works as before,
since a new token needs a click to open Google's popup.

The token model returns no ID token, so after the first sign-in the app reads the email address
once from the OpenID Connect userinfo endpoint (`https://openidconnect.googleapis.com/v1/userinfo`,
the `userinfo_endpoint` of Google's discovery document) and keeps it. It is passed as `login_hint`,
so an expired token renews with one click and no account chooser. Sign out forgets it.

## Install and offline

The app is a PWA: a manifest with the brass mark as its icon, and a service worker written into the
production build by `scripts/pwa.ts`. The worker caches every built file of a release, lazy screens,
SheetJS and fonts included, so after one online visit the app opens offline on the workbook this
browser holds. Requests to other origins, Google's scripts and APIs among them, never touch the
cache. A new deploy downloads into its own cache and waits. "A new version of Ledgerboard is ready"
then offers Reload, and other open windows are told the same. Development and the fake build
register no worker. On Android Chrome, install from the browser menu. Firefox on desktop has no
install, and uses the same offline copy in a normal tab.

`public/icons/` holds the SVG marks and the PNGs drawn from them by `node scripts/generate-icons.mjs`.

## Phone layout

Below Tailwind's `sm` breakpoint (640 px) the app switches to a phone layout: a top app bar with the
menu button, the screen's title and the sync or export control, a navigation drawer that slides in
from the left, filters in a bottom sheet behind a button that counts them,
transactions as cards, and charts with fewer axis labels. A tap on a chart shows its tooltip and a
"View rows" action, and a second tap on the same mark drills. Every control there is at least 44 px
square, and the installed app keeps clear of the system bars through the safe-area insets. From
640 px up the layout is the desktop one.

## The workbook format

A Google Sheet and an xlsx file share one format. Every column is found by its header name, so
columns may sit in any order, and a column the app does not know is kept on export and ignored
otherwise. Only `ledger` is required. A missing tab or column reads as empty, and missing settings
take their defaults.

| Tab | Columns |
|---|---|
| `ledger` | `date` (a date cell), `account`, `statement`, `counterparty`, `counterparty_iban`, `description`, `amount`, `balance`, `category`, `family`, `bucket`, `month`, `flagged_by`, `reference`, and the optional camt signals `purpose`, `tx_domain`, `tx_family`, `tx_sub_family`, `creditor_reference`, `instructed_currency` and `review_reasons`. `family`, `bucket` and `month` are filled in on export and ignored on import. |
| `categories` | `category`, `family`, `bucket` (one of `income`, `operating`, `taxes`, `owner-pay`, `financing`, `neutral`), `colour`, an optional comma-separated `roles`, an optional `label`, and an optional `vat`: how a purchase in the category splits into cost and VAT, one of `none`, `deductible-25`, `deductible-13`, `deductible-5`, `reverse-charge`, `foreign-vat`, `representation` and `car-50`. A blank `vat` is `none`, and an unknown one is reported and read as `none`. |
| `accounts` | `account`, `iban`, an optional `currency`, and an optional `label` |
| `settings` | `key`, `value`, one row per setting |
| `rules` | `rule`, `order`, `enabled`, the condition columns, `category`, `confidence` (`rule` or `review`) and `note`, as the shadow-accounting Apps Script reads them. A row it would refuse is reported and left out. |
| `invoices` | `number` (text), `client`, `item`, `amount`, `issued` and `due` (date cells, `due` optional), and the optional delivery period `period_from` and `period_to` (date cells, both or neither). A row without a number, client, amount or issue date, or a number used twice for one client, is reported and left out. A period that cannot be read is reported, and the issue date stands for it. |
| `clients` | `client`, `name` and `iban`, one row per IBAN, so a client paying from two accounts has two rows. An IBAN two clients claim is reported and left out the second time. The rules' `counterparty_is_client` reads these IBANs, and a rule using it in a Google Sheet without the tab is refused, as the Apps Script would stop on it. |
| `owner-advances` | `date`, `amount` (not zero), `description` and `category`: costs the owner paid privately for the company as positive amounts, and the owner's private shares of company payments as negative ones. The category must be in the `operating` or `taxes` bucket, or the row is reported and left out. |
| `assets` | `asset`, `bought` (a date cell), `in_use` (a date cell, blank means the day it was bought), `cost_net` (above zero, without the VAT that was reclaimed), `group` (`computers`, `equipment`, `car`, `building` or `other`), `doubled` (TRUE for a doubled depreciation rate), `disposed` (a date cell), `funded_by` (a grant on the `grants` tab), `ledger_reference` and `note`. An asset is listed once. A row put in use before it was bought, or disposed before it was put in use, is reported and left out. A grant the `grants` tab lacks is reported and the asset kept. |
| `grants` | `grant`, `received` (a date cell), `amount` (above zero), `fixed_part` and `variable_part` (both or neither, adding up to `amount`), `period_from` and `period_to` (date cells, both or neither), `release` (`fixed-then-assets`, the default, which needs both parts, or `straight-line`, which needs the period), `clawback_year1` and `clawback_year2` (`whole` or an amount), `employment_required_until` (a date cell) and `note`. A grant is listed once. |
| `year-end` | `year`, `statement` (`pl`, `balance`, `tax`, `distribution`, `grant` or `konto`), `line`, `label`, `amount`, `categories`, `aop`, `source` and `note`: the accountant's figures, one row per year, statement and line. `line` is a fixed id per statement, such as `sales`, `total-assets` or `liability`, listed in the template's note and in the Workbook editor, or the account number on a `konto` row. `amount` is the figure as printed, costs as positive numbers. `filed-on`, `paid-on` and `decided-on` take a date cell, `rate` a percentage cell, and `months-of-operation` a whole number. `categories` names the app categories of a `konto` row. When income less expenses differs from `profit-before-tax`, or the asset lines or the equity and liability lines differ from `total-assets`, the total's row is reported and every line kept. |
| `plan` | `year`, `month` (1 to 12, blank for every month), `item` (`revenue`, a category, `owner_pay_scenario`, `dividend` or `purchase`), `amount` and `note`. An `owner_pay_scenario` row names a scenario from the `scenarios` tab in `amount`. Each year, month and item once. |
| `scenarios` | `scenario`, `label`, `year`, `component`, `amount`, `from` and `to`: rows that share a scenario name make one owner pay mix for one year. `component` is `salary_gross` (an amount or `floor`), `salary_months` (0 to 12), `nontaxable:<item>` such as `nontaxable:gifts`, `rent_monthly`, `dividend` (an amount or `max`) or `director_basis` (`employee`, `board-only` or `insured-elsewhere`). `from` and `to` are optional date cells in the scenario's year. |

A category or account is shown by its `label`. A blank label shows the name with spaces for hyphens
and a capital first letter, so `ai-services` reads "AI services". Links and filters keep the name.

`flagged_by` values `rule` and `ai` belong to the categoriser: `ai` marks a guess that waits for
review. Any other value means a person set the category. A row with `review_reasons`, such as a
reversal, also waits for review until a person confirms it.

### Settings keys

A blank value means the default. An unknown key is kept and reported. A value that does not hold
falls back to the default and is reported with its row, in the import summary and on the Workbook
screen. The
defaults are how the app behaved before settings existed, so a Sheet without a `settings` tab reads
as before.

| Key | Default | What it does |
|---|---|---|
| `template_version` | `1` | The workbook format. A newer version is reported. |
| `company_name` | blank | Shown under the app name and used in an export's file name. Blank uses the Sheet or file name. |
| `currency` | `EUR` | ISO 4217 code of the ledger's money. One currency per workbook, with at most two decimals. |
| `number_locale` | `en-GB` | How amounts are written, such as `de-DE` for `1.234,56`. Dates and text stay in English. |
| `label_income` | `Income` | What the `income` bucket is called on screen. |
| `label_operating` | `Operating cost` | Same for `operating`. |
| `label_taxes` | `Taxes` | Same for `taxes`. |
| `label_owner_pay` | `Owner pay` | Same for `owner-pay`. |
| `label_financing` | `Financing` | Same for `financing`. |
| `label_neutral` | `Neutral` | Same for `neutral`. |
| `owner_pay_module` | `TRUE` | `FALSE` hides owner pay, owner earns and the Taxes and Owner screens. Rows in the `owner-pay` bucket then count as operating cost, so costs and net do not change. |
| `review_label` | `human` | The `flagged_by` value a person's confirmation will write. `rule` and `ai` are taken. |
| `card_settlement_ibans` | blank | Comma-separated IBANs a card purchase settles against. A row with one as its counterparty reads as a card purchase to the rules. An entry that is not an IBAN is reported and the list stays blank. |
| `hr_residence_city` | blank | The city or municipality the owner lives in, such as `Grad Zagreb`, which sets the local income tax rates. Settings offers every unit to pick from. A name typed in the workbook is read regardless of case, diacritics and a leading `Grad` or `Općina`, and a name two units share takes the county in brackets, such as `Općina Privlaka (Zadarska)`. Payroll figures need it, so they stay empty while it is blank. |
| `hr_birth_year` | blank | The owner's year of birth, for the youth income tax relief. Blank assumes no relief. |
| `hr_pension_pillar_2` | `TRUE` | Whether the owner pays into the second pension pillar. |
| `hr_dependants` | `0` | Dependants who raise the personal allowance, 0 to 20. |
| `hr_company_registered` | blank | The day the company was registered, as a date cell or text such as `2025-06-05`. It starts the first tax period. |
| `hr_cit_return` | `pd` | `pd` for the corporate tax return on the accrual profit, `pd-nn` for the one on cash. |
| `hr_vat_principle` | `invoice` | `invoice` when VAT falls due on the invoice date, `cash` when it falls due on payment. |
| `hr_depreciation_doubled` | `FALSE` | Whether the accountant doubles depreciation rates by default. An asset's `doubled` still applies to it. |

The `hr_` keys are the owner's and the company's own facts for the Croatian d.o.o. pack. Workbook,
General shows them while `owner_pay_module` is on. They belong in the workbook and never in the app.

Bucket labels must differ from each other and from the names of the derived lines (Net, All costs,
Owner earns, Kept). Theme is a per-device choice and not a workbook setting.

## Taxes and Owner

Two screens for a Croatian d.o.o., shown while `owner_pay_module` is on. They pick categories by
the `roles` column, never by name:

| Role | What it selects |
|---|---|
| `revenue` | Client revenue, the base of the effective tax rate |
| `owner-loan-out`, `owner-loan-repaid` | Loans to the owner and their repayments |
| `owner-pay-tax` | Taxes owed because the owner was paid, added to the owner's gross cost |
| `watched` | In the taxes bucket, a tax with a monthly payment calendar |
| `reimbursement` | Reimbursements between owner and company, listed beside owner pay. A payment to the owner on one repays the owner's advances. A payment from the owner on one repays a private cost the company paid for the owner |
| `client-refund` | Money paid back to a client, such as an overpayment, on Receivables |
| `arrears` | Paid in the month after the work, such as salary, its taxes and rent |
| `representation` | Representation, such as a client lunch |
| `personal-transport` | Personal transport costs |
| `capital-purchase` | Purchases kept as assets on the `assets` tab |
| `grant` | Grant receipts, whose terms are on the `grants` tab |
| `profit-distribution` | Dividends and the dividend tax |
| `corporate-income-tax` | Corporate income tax, the annual balance and the monthly advances alike |
| `vat-settlement` | VAT paid to the state or refunded by it |
| `prepaid-annual` | Paid once for a year ahead, such as an annual insurance policy |
| `non-deductible` | Costs the corporate tax never allows, such as fines or private costs |

No screen reads the roles from `arrears` down yet. They mark the categories the year-end and
forecast figures will treat apart from cash.

The effective tax rate is the taxes bucket, paid less refunded, over client revenue. A tax refund
belongs in the taxes bucket. Whether loans count as owner pay is the bucket of the two loan
categories on the `categories` tab, which "Loans to the owner count as owner pay" on Workbook,
General switches between `owner-pay` and `financing`. Repayments are matched to loans first in,
first out, and the loan balance is lent less repaid over the whole ledger, signed. A screen says
which role no category carries, and what it leaves out because of that.

Costs the owner paid privately go on the `owner-advances` tab, from the Sheet or from "Add advance"
on Owner. Each counts as a cost on its date and in its category on every profit and loss figure:
bucket totals, the monthly series, the window averages and runway, category totals, period review,
tax by type, the effective tax rate and the payroll cadence. Transactions lists each one as an
"Owner advance" row with no bank account, the owner as counterparty, and its category and amount as
a cost, so every drill from a figure that counts an advance shows it. They are not bank rows, so
balances, payees, Cash and Review leave them out. An account, counterparty or review filter leaves
them out too, since an advance has no bank account, no ledger counterparty and nothing to review.
Transactions then says how many advances in the period it does not list. "Every owner advance", a
choice among the categories in Add filter, selects all of them and no bank row. Payments to the
owner on a `reimbursement` category repay them oldest first and stay financing.

The tab holds two kinds of row, told apart by the sign of the amount. A positive amount is a cost
the owner paid privately for the company, as above. A negative amount is the owner's private share
of a payment the company made, which the bank row cannot split off since the ledger holds the bank
data as booked. For an order of 45.12 filed as office supplies with 9.71 of it private, the row is
the order's date, -9.71 and office supplies. It takes 9.71 off that cost on that date, and net owed
counts it as lent to the owner until payments from the owner on a `reimbursement` category repay it.
No reimbursement is matched to a private share, so Owner lists the shares in their own group without
a repayment status, and Transactions badges them "Private share".

Net owed, on Owner and Overview, is one signed balance. The owner owes the company the loan balance
plus the private shares, less every payment from the owner on a `reimbursement` category, which
repays a private share or a private cost the company paid for the owner. The company owes the owner
the costs the owner paid, less what it reimbursed. Positive means the owner owes the company. A
private cost the company paid in full counts as lent only when its row is in a category with the
`owner-loan-out` role. Filed as an ordinary cost with no private share, it counts in costs and not
in net owed.

## Receivables

Receivables matches the `invoices` tab against the revenue credits, client by client, the way the
Sheet's `outgoing` tab does for its one client. A credit belongs to the client whose `clients` row
names its IBAN, and one from an IBAN no client names is listed apart and never pays anyone's
invoice. Invoices fill oldest first, by issue date and then by the order they were written. A
payment can fill only invoices already issued on its day, so a credit that arrives before its
invoice is a payment with no invoice on file, and a payment past what is owed is an overpayment on
the newest invoice it reached. Nothing owed is ever negative. Revenue and client refunds are the
categories with the `revenue` and `client-refund` roles.

Ageing counts days past the due date, or past the issue date when an invoice has none, on the day
of the newest booking. Days to get paid is the median over the invoices settled in the period,
with the mean beside it. The matching always runs over the whole ledger. The period picks which
invoices are listed (issued in it, or still open) and which payments count for days to get paid.

## Excel mode

The workbook lives in IndexedDB, under its own id, as the store of record. The app asks the browser
to keep it (`navigator.storage.persist()`, which Firefox shows as a prompt). Clearing the site's data
deletes it, so the exported files are its only other copies.

- **Template.** "Download the empty template" writes a blank xlsx in the browser: the thirteen tabs
  with their headers, a note on every header and every settings key, a default category set for a
  freelancer or a small company, and the default settings. VAT refunds have their own `vat-refund`
  category in the operating bucket, and `tax-refund` in the taxes bucket is for income tax refunds.
- **Import.** Open or drop an xlsx file. It goes through the same workbook reader as a Google Sheet,
  and a summary (transactions, dates, accounts, categories, every problem) shows before anything is
  replaced. A file without a `ledger` tab is refused.
- **Export.** From either mode, "Export to Excel" writes the workbook in the template format as
  `ledgerboard-<company or sheet name>-<yyyy-mm-dd>.xlsx`. Importing an export gives the same
  workbook. When changes have gone a week or more without an export, the sidebar says so.
- **Editing.** In Excel mode the Workbook screen edits the settings, categories, accounts, assets,
  grants and year-end figures, one tab each (`#/workbook?tab=categories` links straight to one),
  with the Sheet's rules: each category once, category, family and bucket filled, and a category or
  account that ledger rows use keeps its name. Assets, grants and year-end rows are checked by the
  same reader as an import, and a row it would leave out cannot be saved. With a Google Sheet,
  categories and accounts are read-only there and edited in the Sheet, because the Apps Script reads
  and checks those tabs. Assets, grants and year-end are read-only there too, and the screen names
  the headers to add when the Sheet lacks one of those tabs. The one exception is the loan
  switch on General, which sets two `bucket` cells. Settings, rules and owner advances are editable
  in both modes, and Review sets a ledger row's category in both. Settings keeps what belongs to this
  device: the data source, Google sign-out, the theme and the privacy notes.

Switching from Excel mode to another source deletes the workbook kept in the browser, once the new
one has been read. SheetJS loads only on the first import, export or template download, as its own
chunk.

## Development

```sh
npm install
npm run dev            # http://localhost:5173/ledgerboard/, talks to Google
npm run dev:fake       # same app on a small synthetic workbook, no Google needed
npm run check          # typecheck and unit tests
npm run build          # production build into dist/, then checks no dev-only code shipped
npm run build:fake     # fake-mode build into dist-fake/, for the visual check
npm run preview:fake -- --port 4173
npm run check:visual   # every screen, dark and light, at four widths in local Chrome, screenshots in visual-check/
npm run check:touch    # touch at 360 and 430 px: top bar and drawer, drills, filter sheet, import, 44 px targets, in visual-check/touch/
npm run check:pwa      # after npm run build: manifest, offline reload, update prompt. Add -- --firefox for Firefox
npm run check:round-trip -- --workbook <file.xlsx>   # import, export and import again, counts only
```

The fake workbook is an 18-month synthetic company: two accounts, one closed by a sweep into the
other, a part-month at each end, one loss month, a reimbursement, two rows waiting for review, a
rules tab that reproduces every row flagged `rule`, and rows a person confirmed that no rule covers
yet. Its `assets`, `grants`, `year-end`, `plan` and `scenarios` tabs hold the two computers it
bought, its start-up grant, made-up 2025 accountant figures that add up, a plan and two owner pay
scenarios. In the fake build a Google Sheet held in memory answers syncs and writes until the page reloads.
Every name, IBAN and amount in it is made up. `?fake=excel` keeps it as an Excel-mode workbook with
changes nine days past their last export, and `?fake=empty` starts with nothing, which is the first
run. The visual check covers both, and the import summary of an xlsx it writes from the fake
workbook. It and the touch check run against a preview of the fake build, so start one first:

```sh
npm run build:fake && npm run preview:fake -- --port 4173
npm run check:visual
npm run check:touch
```

`check:pwa` serves the production build itself and sends every other origin to a dead proxy, so it
needs no preview and makes no call to Google.

## Write-back

Review, Owner and the Workbook screen write through one path in both modes. Each write reads the tabs it
touches again, plans on that read, writes, reads them back into the copy on screen, and checks that
what was written is there. A plan that cannot be carried out exactly writes nothing and says why.
In Excel mode the reads and writes go to a working copy that replaces the stored workbook when the
write is complete. The plans live in `src/features/workbook/application/writePlans.ts`, the Google
side in `googleWorkbookWriter.ts`.

- **Ledger rows.** A row is found again by (account, reference), or for a blank reference by
  (account, date, amount, balance, description), so rows the ingest inserted since the last sync do
  not matter. The write is refused when no row or several rows match, when the row's category or
  `flagged_by` changed since the app read it, or when the category is not on the categories tab.
  Only `category` and `flagged_by` are written, each found by its header (I and M in the
  shadow-accounting Sheet), and only where the value changes. J to L are never written.
  Confirm writes the `review_label` setting to `flagged_by`. Recategorise writes the category and the
  label. Applying a new rule writes its category and `rule`, only to rows flagged `ai` or
  unclassified. Undo writes the exact previous values back through the same checks. Review lists
  every write of the page's session under "Changes in this session", newest first: ledger rows,
  rules, settings, owner advances and the loan bucket. A ledger write, an added advance and a
  bucket switch that have not been undone carry Undo there. Rules and settings are changed back on
  Workbook. The list is held in memory, so a reload clears it.
- **Rules.** The tab after the change must pass every check of `parseRules` in the Apps Script's
  `Rules.gs` (mirrored in `rulesTabRefusals.ts`), against the categories tab as it is now, so a save
  is refused while the tab has any problem. An enabled rule that tests `counterparty_is_client`
  also needs a `clients` tab with `client` and `iban` columns, which `categorisationContext` reads. A new rule is appended. An edited, switched or moved rule
  is found by its id, must still hold what the app read, and only its changed cells are written.
  Moving a rule swaps its order with its neighbour's, so orders stay in steps of 100, and renumbers
  every rule in steps of 100 only when the two share an order.
- **Settings.** Each changed key is set in its `value` cell, or appended as a `key`, `value` row when
  the tab lacks it. A key on two rows, a value that changed since the read, or a value the settings
  reader would not use is refused.
- **Owner advances.** "Add advance" appends one `date`, `amount`, `description`, `category` row,
  the date as a serial number so the cell is a date. "I paid a company cost" writes a positive
  amount and "Part of a company payment was mine" a negative one. It is refused unless the tab has
  those four columns, the amount is not zero, and the category is on the categories tab, as it is now, in the
  operating or taxes bucket. Undo clears the row again, only while one row still holds exactly what
  was written.
- **Loan bucket.** The switch finds each category with the `owner-loan-out` or `owner-loan-repaid`
  role by name on the categories tab and sets its `bucket` cell to `owner-pay` or `financing`. It is
  refused when a category is on no row or several, or its bucket changed since the app read it.
  No other cell of `categories`, and nothing of `accounts`, is ever written.

The requests each Google use case sends, in order. Every write is `valueInputOption=RAW`.

| Use case | Requests |
|---|---|
| Confirm, recategorise, undo, apply a rule | `spreadsheets.get` (tab ids), `values.batchGet` of `ledger` and `categories`, `values.batchUpdate` of single cells such as `ledger!I57` and `ledger!M57`, then the same get and batchGet again |
| Add a rule | get, `values.batchGet` of `rules`, `categories` and `clients` (when the Sheet has it), `values.append` to `rules!A:U` with `insertDataOption=INSERT_ROWS` (plus a `values.batchUpdate` of `order` cells when rules are renumbered), get and batchGet again |
| Edit, switch on or off, move a rule | get, batchGet of `rules`, `categories` and `clients` (when the Sheet has it), `values.batchUpdate` of the changed cells such as `rules!C12`, get and batchGet again |
| Save settings | get, batchGet of `settings`, `values.batchUpdate` of `value` cells such as `settings!B4`, `values.append` to `settings!A:B` for a new key, get and batchGet again |
| Add an advance | get, batchGet of `'owner-advances'` and `categories`, `values.append` to `'owner-advances'!A:D`, get and batchGet again. Undo is a `values.batchUpdate` clearing that row's cells |
| Switch the loan bucket | get, batchGet of `categories`, `values.batchUpdate` of `bucket` cells such as `categories!C16`, get and batchGet again |

### Manual test, against a copy of the Sheet first

Run this on a copy (File, Make a copy in Google Sheets, then pick the copy in "Switch data source").
Never run it first on the original.

1. Pick the copy and sync. Note the row number of one `ai` row on Review.
2. Open the row and Confirm it. In the copy, only M on that row changed to your review label. I and
   J to L are as before. Press Undo in the toast and check M is back.
3. Recategorise the same row. I and M change, nothing else. Wait for the toast to close, open
   "Changes in this session" and press Undo there. Both are back.
4. In the copy, insert an empty row at row 2 of `ledger`. Recategorise another row from the app
   without syncing first. The write lands on the shifted row. Delete the empty row again.
5. Make a rule from a row. Check the back-test lists, save, and check the new row at the bottom of
   `rules`. Press "Apply to the rows still waiting" and check only `ai` or unclassified rows changed.
6. On Workbook, Rules, switch the new rule off and move it. Check `enabled` and `order` changed and no
   other cell did.
7. On Workbook, General, change the company name. Check the `settings` tab.
8. On Owner, add an advance. Check one new row at the foot of `owner-advances`, its date shown as a
   date. Press Undo and check the row is empty again. On Workbook, General, switch "Loans to the
   owner count as owner pay" off and on. Check only the two `bucket` cells of the loan categories
   changed.
9. In the copy, run "Back-test categorisation (writes nothing)" from the Shadow Accounting menu. It
   reads the rules and settings tabs the way the morning ingest does, so it must finish without an
   error. Then repeat steps 2, 3 and 5 on the original, and check the next 06:00 run in Executions.

## Figure parity

`npm run parity:figures -- --workbook <export.xlsx>` computes every figure from an xlsx export of the
Sheet and compares it with the figure the Sheet's own analysis tabs show in the same export. The
invoice figures read the `invoices` and `clients` tabs. An export from before them reads the
register from `outgoing!A3:D` as one client, `nlc`, paying from the IBANs the revenue rules name,
or else from `CLIENT_IBANS` in a `.gs` file of `--scripts <folder>`. It
prints each figure as a match, a correction the app makes on purpose (with the reason), or a
MISMATCH, and exits non-zero on any mismatch. The export holds real bank data. Run it locally, keep
the file outside the repository, and never commit an export or any figure from its output.

## Rules parity

`npm run parity:rules -- --workbook <export.xlsx>` loads the shadow-accounting Apps Script files
(`--scripts <folder>`, by default `~/gdrive/work/dss/dss-finance/shadow-accounting/scripts`) into
`node:vm` and runs their categoriser and the app's rules engine over every ledger row, with the
export's `rules` tab. An export without one is refused, since the Apps Script no longer seeds the tab. It prints
counts and every row where the two differ in category, `flagged_by` or deciding rule, by sheet row
and rule id only, and exits non-zero on any. `--statements <folder>` fills the signal columns of
rows that have none from archived camt files, matched by account and bank reference, for an export
taken before those columns existed.

Each side reads `card_settlement_ibans` from the export's `settings` tab with its own reader, and
the script fails when the two lists differ or the Apps Script refuses the tab. An export without a
`settings` tab gives both sides the `CARD_SETTLEMENT_IBAN` constant of an older `Categorise.gs`, or
none, and says which. The client IBANs come from the export's `clients` tab the same way, read by
`requireClientIbans` when an enabled rule tests `counterparty_is_client`, and the two lists must
agree. A synthetic case follows: one rule, tried first, that files credits from a client, over the
export's clients or, for an export without the tab, two IBANs that sent the ledger money, held in
memory. Both engines run it over every row, and both must refuse it without a `clients` tab.

In development and fake builds, `#/gallery` shows every shared component and chart style with
made-up figures, in whichever theme `?theme=light` or `?theme=dark` pins. The route does not exist
in a production build.

## Payroll parity

`npm run parity:payroll -- --worked 2025-06=<days>` runs the payroll engine in
`src/packs/hr-doo/domain/payroll/` against the accountant's monthly salary workbooks and compares
every line to the cent. By default it reads 2025-06, 2026-01 and 2026-06 under
`~/gdrive/work/dss/dss-finance/payroll` (`--payroll <folder>`, `--months <list>`). Only the mailed
`.xlsx` of a month can be read. A month converted to a Google Sheet is a stub on disk, and the
script lists it as not read.

The worked month and the payment date come from the workbook's title, the city from the note on
the tax line, and pillar II from its own line. A salary noted as the director's minimum base runs
as an agreed gross below the floor, so the engine finds the floor itself. A part month needs its
days worked as `--worked YYYY-MM=<days>`, counted against Monday to Friday of that month with
public holidays included, as the monthly fund of hours counts them. `--dependants` sets the
dependants on the tax card, 0 by default. Rent and refunds of costs listed beside the salary are
not payroll, so they count only in the total cost and in what the employee is paid.

Each line prints as pass, FAIL, or corrected with the reason, and any FAIL makes the exit code
non-zero. The workbooks hold real pay, so the script prints no figure. Never copy a figure from a
workbook into the repository.

Where the law leaves room, the engine follows the accountant: contribution bases come from the
month worked, so a December salary paid in January keeps December's director floor. Income tax
follows the payment date. The low-pay relief reduces only the pillar I base, which is practice and
not statute. A part month keeps the whole personal allowance. Youth relief is never applied in a
month, only in the annual settlement.

## Google configuration

Three variables, read at build time:

| Variable | What it is |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | OAuth web client ID from the Cloud project |
| `VITE_GOOGLE_API_KEY` | API key restricted to the Picker API and the app's origins |
| `VITE_GOOGLE_PROJECT_NUMBER` | Cloud project number, which the Picker uses as its app ID |

For development, put them in `.env.local`, which git ignores. For the deployed build, set them as
repository Actions variables. The deploy workflow passes them to `npm run build`. A fork hosted on
its own GitHub Pages needs its own Cloud project and its own three values, because the OAuth client
only accepts the origins it was created for. Restrict the API key to the Picker API and to the
referrers `https://<you>.github.io/*`, `http://localhost:5173/*` and `https://docs.google.com/*`.
The Picker runs in an iframe on docs.google.com, so without that last entry it reports "The API
developer key is invalid". Firefox sends only the origin as the referrer, so a path such as
`/ledgerboard/*` in the pattern does not match. None of them is a
secret, because all three end up in the page anyway. A missing one fails the first Google call
with an error that names it.

## Content Security Policy

GitHub Pages cannot set headers, so the policy is a `<meta>` tag in `index.html`. Scripts may load
only from this origin and from Google's two script hosts, plus one inline script allowed by its
SHA-256 hash, which picks the theme before the first paint so the loading screen is not the wrong
colour. Editing that script means replacing its hash in the policy. Frames load only from Google's
Picker and sign-in hosts, and requests go only to the Sheets and Drive APIs, the userinfo endpoint and the
token revocation endpoint (`oauth2.googleapis.com`, where `google.accounts.oauth2.revoke` posts).
The manifest and the service worker come from this origin only. Styles allow `'unsafe-inline'`
because Nuxt UI writes its colour variables into an inline `<style>`, and the Google Picker and
Identity Services libraries inject their own. Without it the Picker dialog loses its layout. The
dev server adds `ws://localhost:*` for hot reload.

## Ruleset

The Ruleset screen shows the Croatian law the d.o.o. pack computes with, as `src/packs/hr-doo/ruleset/`
holds it. It reads no workbook, so it stays in the navigation while `owner_pay_module` is off. Rules
are grouped by area: profit tax, owner pay, accounting, VAT and company law. Each rule shows its
value for every version, side by side on a wide screen and one under another on a phone. Rates read
as percentages with up to two decimals, coefficients as factors such as 0.65, money in the app's
money format, flags as yes or no, and table terms as tables (cards on a phone). A value that differs
from the version before is set in bold with a brass mark. Every version carries its confidence mark.
Estimate, pending and unconfirmed versions are coloured, and the Watch list at the top gathers them
with the matters the ruleset has no value for yet. Each source links to the page that was loaded,
in a new tab, with the act, the article, the NN issues and the day it was checked.

The search box matches every word typed against the rule id, title, values, notes, act names,
articles and NN issues. The area buttons narrow the list further.

A table term with more than 60 rows in a version opens on a search of its own and a Show all
button instead of every row. Today that is only the local income tax rates, which open on the unit
`hr_residence_city` names.

### Local income tax rates

`hr.pit.local-rates` holds the lower and higher rate of every one of the 556 cities and
municipalities, with the NN issue of its decision and the day it applies from. A unit listed with NN
114/23 alone adopted no decision and has 20% and 30%. The data is
`src/packs/hr-doo/ruleset/rules/generatedLocalRates.ts`, which is never edited by hand:

```sh
npm run import:local-rates -- --table 2025-01-01=<xlsx> --table 2025-03-01=<xlsx> --table 2026-01-01=<xlsx> --census <xlsx>
```

Each `--table` is a Porezna uprava "Tablica poreznih stopa godišnjeg poreza na dohodak", from
<https://porezna-uprava.gov.hr/hr/porezne-stope-godisnjeg-poreza-na-dohodak/4764>, with the day it
takes effect. A table holds until the next one starts, and the last one until the end of its year.
`--census` is the statistics office workbook of the 2021 census by town and municipality, which
gives each unit its county and population. The unit type follows the statutory ranges: Grad Zagreb,
a county seat (Zakon o područjima županija, gradova i općina, NN 86/06, Art. 3) or a town of more
than 35,000 inhabitants, another town, or a municipality. The script refuses tables whose units or
rates do not line up.

2027 is a copy of 2026 marked unconfirmed until units adopt their 2027 rates by 30 November 2026.
Once Porezna uprava publishes the 2027 table, rerun the script with it and give the 2027 version in
`rules/owner-pay.ts` its rows.

`#/ruleset?rule=<id>` opens the screen with that rule marked, scrolled just below the search bar
and focused, and clears any search. `ruleLink(id)` in `ruleset/presentation/ruleWording.ts` builds
the link, so a screen can send a figure to the rule it rests on. A link to an id the ruleset does
not have says so above the list.

## Licence

MIT
