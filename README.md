# Ledgerboard

Company finance dashboards over a workbook of bank transactions, computed in the browser. The
workbook is either a Google Sheet, which stays the system of record, or an Excel file kept in the
browser (Excel mode). There is no backend. It deploys to GitHub Pages at
`https://ipazanin.github.io/ledgerboard/`, with a privacy page at `privacy.html`.

With a Google Sheet, the app asks Google for `drive.file`, which covers files the user picks in the
Google Picker or that the app creates, and for `openid email`, which tells it which account signed
in. The app reads the Sheet and keeps a copy in IndexedDB. It writes only what the user saves, and
only in the Sheet the user picked: `category` and `flagged_by` on ledger rows the user acts on, rows
on the `rules`, `settings`, `owner-advances` and `outgoing-plan` tabs, and the `bucket` of the two
loan categories.
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

## Wide screens

From 1920 px (the `3xl` breakpoint) a dashboard screen sets related cards side by side, or a long
list beside a column of the cards that sum it up: Overview, Period review, Receivables, Billing
plan, Taxes and Owner. The content grows to 160rem beside the sidebar. A screen that is one table,
one list, one form or a long report keeps a 100rem measure instead, so its rows stay readable:
Transactions, Year end, Forecast, Ruleset, Review, Workbook and Settings. The other screens simply
widen. `.wide-pair` in `src/shared/styles/app.css` does the pairing, and the widths are the
`--container-shell`, `--container-measure` and `--breakpoint-3xl` tokens in `tokens.css`. Below
1920 px nothing changes.

## The workbook format

A Google Sheet and an xlsx file share one format. Every column is found by its header name, so
columns may sit in any order, and a column the app does not know is kept on export and ignored
otherwise. Only `ledger` is required. A missing tab or column reads as empty, and missing settings
take their defaults.

| Tab | Columns |
|---|---|
| `ledger` | `date` (a date cell), `account`, `statement`, `counterparty`, `counterparty_iban`, `description`, `amount`, `balance`, `category`, `flagged_by`, `reference`, and the optional camt signals `purpose`, `tx_domain`, `tx_family`, `tx_sub_family`, `creditor_reference`, `instructed_currency` and `review_reasons`, in that order from A to R. An older file's `family`, `bucket` and `month` are columns the app does not know. |
| `categories` | `category`, `family`, `bucket` (one of `income`, `operating`, `taxes`, `owner-pay`, `financing`, `neutral`), `colour`, an optional comma-separated `roles`, an optional `label`, and an optional `vat`: how a purchase in the category splits into cost and VAT, one of `none`, `deductible-25`, `deductible-13`, `deductible-5`, `reverse-charge`, `foreign-vat`, `representation` and `car-50`. A blank `vat` is `none`, and an unknown one is reported and read as `none`. |
| `accounts` | `account`, `iban`, an optional `currency`, and an optional `label` |
| `settings` | `key`, `value`, one row per setting |
| `rules` | `rule`, `order`, `enabled`, the condition columns, `category`, `confidence` (`rule` or `review`) and `note`, as the shadow-accounting Apps Script reads them. A row it would refuse is reported and left out. |
| `invoices` | `number` (text), `client`, `item`, `amount`, `issued` and `due` (date cells, `due` optional), and the optional delivery period `period_from` and `period_to` (date cells, both or neither). A row without a number, client, amount or issue date, or a number used twice for one client, is reported and left out. A period that cannot be read is reported, and the issue date stands for it. |
| `clients` | `client`, `name` and `iban`, one row per IBAN, so a client paying from two accounts has two rows. An IBAN two clients claim is reported and left out the second time. The rules' `counterparty_is_client` reads these IBANs, and a rule using it in a Google Sheet without the tab is refused, as the Apps Script would stop on it. |
| `outgoing-plan` | `item`, `date` (a date cell), `amount` (above zero), `client` and `description`: one row per item to invoice a client, such as a month's fee, a bonus or a re-billed hotel. `date` is the day it becomes billable, the last day of the worked month for a monthly fee. `client` must be on the `clients` tab, or the row is reported and left out. Only these five columns are read, so the Sheet may keep its own formulas beside them, and a row with nothing in them is skipped. |
| `owner-advances` | `date`, `amount` (not zero), `description` and `category`: costs the owner paid privately for the company as positive amounts, and the owner's private shares of company payments as negative ones. The category must be in the `operating` or `taxes` bucket, or the row is reported and left out. |
| `assets` | `asset`, `bought` (a date cell), `in_use` (a date cell, blank means the day it was bought), `cost_net` (above zero, without the VAT that was reclaimed), `group` (`computers`, `equipment`, `car`, `building` or `other`), `doubled` (TRUE for a doubled depreciation rate), `disposed` (a date cell), `funded_by` (a grant on the `grants` tab), `ledger_reference` and `note`. An asset is listed once. A row put in use before it was bought, or disposed before it was put in use, is reported and left out. A grant the `grants` tab lacks is reported and the asset kept. |
| `grants` | `grant`, `received` (a date cell), `amount` (above zero), `fixed_part` and `variable_part` (both or neither, adding up to `amount`), `period_from` and `period_to` (date cells, both or neither), `release` (`fixed-then-assets`, the default, which needs both parts, or `straight-line`, which needs the period), `clawback_year1` and `clawback_year2` (`whole` or an amount), `employment_required_until` (a date cell) and `note`. A grant is listed once. |
| `year-end` | `year`, `statement` (`pl`, `balance`, `tax`, `distribution`, `grant` or `konto`), `line`, `label`, `amount`, `categories`, `aop`, `source` and `note`: the accountant's figures, one row per year, statement and line. `line` is a fixed id per statement, such as `sales`, `total-assets` or `liability`, listed in the template's note and in the Workbook editor, or the account number on a `konto` row. `amount` is the figure as printed, costs as positive numbers. `filed-on`, `paid-on` and `decided-on` take a date cell, `rate` a percentage cell, and `months-of-operation` a whole number. `categories` names the app categories of a `konto` row. When income less expenses differs from `profit-before-tax`, or the asset lines or the equity and liability lines differ from `total-assets`, the total's row is reported and every line kept. |
| `plan` | `year`, `month` (1 to 12, blank for every month), `item` (a category, `owner_pay_scenario`, `dividend` or `purchase`), `amount` and `note`. `amount` is positive for income and costs alike, a cost without the VAT that is reclaimed. An `owner_pay_scenario` row names a scenario from the `scenarios` tab in `amount`. Each year, month and item once. Planned revenue belongs on `outgoing-plan`, so a `revenue` row is reported and left out. |
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
| `billing_monthly_amount` | blank | The fee invoiced for each worked month. "Fill the rest of the year" adds a row of it for every month to December. |
| `billing_monthly_item` | blank | The `item` text of the monthly fee rows on `outgoing-plan`, written as the tab writes it. Needed with the amount. |
| `billing_subscription_amount` | blank | Subscriptions re-billed every month, filled in the same way. |
| `billing_subscription_item` | blank | The `item` text of the subscription rows. Needed with the amount. |
| `billing_bonus_amount` | blank | The bonus agreed for a whole year, shown for reference and never filled in. |
| `billing_bonus_item` | blank | The `item` text of the bonus rows. Needed with the amount. |
| `billing_client` | blank | The client the filled rows are for, by its name on the `clients` tab. |
| `hr_residence_city` | blank | The city or municipality the owner lives in, such as `Grad Zagreb`, which sets the local income tax rates. Settings offers every unit to pick from. A name typed in the workbook is read regardless of case, diacritics and a leading `Grad` or `Općina`, and a name two units share takes the county in brackets, such as `Općina Privlaka (Zadarska)`. Payroll figures need it, so they stay empty while it is blank. |
| `hr_birth_year` | blank | The owner's year of birth, for the youth income tax relief. Blank assumes no relief. |
| `hr_pension_pillar_2` | `TRUE` | Whether the owner pays into the second pension pillar. |
| `hr_dependants` | `0` | Dependants who raise the personal allowance, 0 to 20. |
| `hr_company_registered` | blank | The day the company was registered, as a date cell or text such as `2025-05-12`. It starts the first tax period. |
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

Assets reads `capital-purchase` and `grant`. The accrual engine reads every role from `arrears`
down, as *Accrual year* describes, and the Year end screen shows its figures.

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

## Assets

A pack screen, shown while `owner_pay_module` is on, over the `assets` and `grants` tabs. The
register lists each asset with its yearly rate from `hr.cit.depreciation-rates`, this year's
charge, the depreciation so far and the book value today. An asset's name opens the ledger debit
that paid for it: its `ledger_reference` found in a row's reference or description, or else a debit
on a `capital-purchase` category of its net cost, with or without VAT at the standard rate. Assets
with no payment, and capital purchases on no asset row, are listed under the register. An item at
or below `hr.cit.asset-threshold` is small inventory, written off when put in use.

Depreciation is straight-line from the month after an asset is put in use, each year rounded to the
cent. A chart draws each asset's book value by month until it reaches zero, and a list gives the
depreciation of every year with each asset's charge behind it. Beside it, each grant shows what it
releases per year, what stays deferred, the day its employment condition ends, and what the
clawback terms would take back if employment ended today. When the `year-end` tab has the
accountant's `grant` lines for a year, the residual against them is shown.

"Show doubled rates" puts `rates=doubled` in the address and recomputes the screen at twice the
group rates, which the law allows. Nothing is saved. A table then gives, per year, the change in
depreciation, in the grant released with it, in profit before tax, and in profit tax at that year's
`hr.cit.rate`. A grant released with the depreciation of the assets it paid for rises by the same
amount, so those assets change profit only once the grant's variable part runs out.

## Accrual year

`accrualYear(workbook, year, inputs, rules)` in `src/packs/hr-doo/domain/accrual/` turns the cash
ledger into the accrual view of one year: the profit and loss, the balance sheet at 31 December and
the PD build-up, each line keyed by the `year-end` tab's line ids and each figure traced to its rows
and rules. It also returns the adjustments that lead from the cash view to the accrual view, and the
bridge from the cash net to profit before and after tax.

The bridge starts from net as the screens count it, the bank rows and the owner's advances of the
year. Each step is one adjustment:

- Client payments leave, and revenue by delivery period from the `invoices` tab comes in. A month
  no invoice delivers in, while a later invoice exists, is listed and never filled in.
- Loans to the owner and their repayments leave whatever their bucket, since they are a receivable.
- A grant receipt leaves and its release under the `grants` tab's policy comes in.
- A capital purchase that an asset row claims leaves at its cost without deductible VAT.
  Depreciation and small inventory written off when put in use come in from the `assets` tab. A
  purchase above the asset threshold that no asset row claims stays a cost and is listed.
- Deductible input VAT leaves the cost, by the category's `vat` column, for advances too. VAT paid
  or refunded on a `vat-settlement` category leaves, since it settles the VAT position.
- A cost on an `arrears` category moves to the month before it was paid, so last December's pay
  leaves this year and this December's comes in. A `prepaid-annual` cost is spread by days over the
  twelve months from its payment.
- Corporate tax paid leaves and the year's own tax comes in after profit before tax. Dividends and
  their tax leave.

The cost lines take each category from the `konto` rows of the latest year-end at or before the
year that name it, by the konto's class: 40 and 41 are material costs, 42 personnel, 43
depreciation, 46 other costs, 47 financial expenses, and 44, 45 and 48 the impairment line. A
category on several konto rows goes to the one with the largest amount. A category no konto row
names counts by its bucket. Income other than revenue and grants counts as other operating income,
since no role marks financial income.

The balance sheet holds the assets' book values, revenue delivered and not yet paid, what the owner
owes on loans, private shares and advances (net owed at the year end), the VAT position, cash, costs
paid ahead and work delivered on invoices issued later. Costs paid in arrears after the year are
owed to suppliers, to the owner and employees, or as taxes, by their bucket. Corporate tax owed is
every year's liability less what the ledger paid on it, with earlier years from their `year-end`
liability lines. The grant not yet released is deferred income. Share capital is what the balance
sheet leaves once every other line is in, so it equals the capital paid in only while every other
line is right.

`taxBase` and `citLiability` in `src/packs/hr-doo/domain/cit/` lay the PD out by form line: revenue,
expenses and profit (lines 1 to 3), half of representation with its VAT (6), half of personal
transport (7), fines and private costs on a `non-deductible` category (9, 11 and 24), depreciation
above the allowed rates and caps (18), related-party interest only while the company has a tax
loss (16 and 25), decreases (35), losses brought forward oldest first for five years (37), the base
(38), the rate by the revenue test (43) and the liability (53). An add-back rounds the deductible
part and adds back the rest, the way the accountant splits representation over two konto lines. A
first tax period starts on `hr_company_registered` and has no advances. The next period's monthly
advance is the liability over the months the period touched (59). Advances paid in a later year
come from `inputs.citAdvancesPaid`, which `matchCitPayments` gives. Without them lines 56 to 58 are
left out of such a year.

`citSchedule` beside them lists the corporate tax a year expects to pay: the previous year's balance
due on its filing deadline, and an advance for each month, due by the end of the month after, so
the December advance falls due in January and still counts for its year. From April an advance is
the previous year's line 59, and before April the line 59 of the year before that. A year before
the company was registered has no return, so a first period pays no advances and the next year
starts in April. A closed year's return comes from the `year-end` tab's `liability`,
`balance-due` and `monthly-advance` lines, with the liability over `months-of-operation` when the
tab gives no advance. A later year's return is our own liability.
`matchCitPayments` fills those obligations with the bank rows on `corporate-income-tax` categories,
oldest due date first, since the annual payment and the advances carry one payment code. Each
obligation is paid, due in the month it is matched on, overdue or to come. Payments no obligation
takes are listed, and the advances paid for each year are its line 56.

Each adjustment is `matched` when it agrees with the accountant's own line for it, `explained` when
it follows from the workbook and the rules with nothing to hold it against, `judgement` when it
takes the accountant's figure for a choice the ledger cannot show, and `open` for the gap to the
accountant's profit that nothing explains. For a year whose `year-end` tab holds the figure, the
accountant's choice takes precedence and the difference to ours is the judgement:

- The grant's `released-in-year` line replaces our release, and the deferred balance carries the
  difference into later years.
- Where konto rows whose categories all carry `arrears` hold less than our figure, the fewest
  bookings moved back from the next year whose costs make up the difference exactly stay in the
  month they were paid. The next year keeps them too.
- Konto rows whose categories all carry `representation` set the add-back, since a card payment
  abroad is booked at the day's rate with the rest as an exchange loss.
- Where the cost lines, the receivables or the liabilities add up to the accountant's total, the
  accountant's split over them is taken, and profit does not change. A group whose total differs is
  left as it is, so its lines show what is unexplained.

Output VAT on domestic sales, loans to the company and provisions are not modelled. An invoice
counts as revenue as it stands.

## Forecast

`forecastYear(workbook, year, asOf, rules)` in `src/packs/hr-doo/domain/forecast/` is the year as
it is likely to end, seen on `asOf`. Ledger rows, owner advances and invoices after that day are
left out. Every line has twelve months, and each month says what it rests on:

- `actual`: a month the ledger covers in full, counted as the accrual view counts it. The month of
  the newest booking is still running. What it holds so far is shown and never counted.
- `planned`: the `plan` tab's row for the line and month, else its row for every month. For
  revenue, the `outgoing-plan` rows still to invoice in the month.
- `paid-ahead`: a month that a `prepaid-annual` cost already paid covers.
- `averaged`: the line's average over its last twelve actual months, or fewer for a younger
  ledger, never counting its first part month.
- `scheduled`: depreciation, small inventory, disposals and the grant release, which the asset
  and grant engines give for the whole year, assets bought in it included.

Revenue is the invoices by delivery period. A complete month after the last month any invoice
delivers in is forecast like a later month, so work not yet invoiced does not read as nothing. A
forecast month takes the `expectedInvoices` dated in it, matched against the invoices that deliver
by the last actual month only. So a month invoiced before the ledger closes it still reads its rows
in full, and a row left open in an actual month is not carried forward. A month with no row still
to invoice takes the average. A `plan` row on a revenue category is listed as not counted. A
cost paid in arrears forecasts the last complete month until its payment is in the ledger. A
planned purchase at or below the asset threshold is a cost of its month. One above it, a dividend,
an owner pay scenario and a row on a category taken out of profit are listed as not counted.

The PD build-up runs through `taxBase` and `citLiability`. Line 56 is the advances `matchCitPayments`
finds paid plus those still to come in the year. The forecast gives the balance due on the filing
deadline and the year after's schedule, with the new monthly advance from April. A year before the
forecast year needs its return from the `year-end` tab, or else from its own forecast on the same
day, so the forecast needs `hr_company_registered`. December's revenue is a receivable at the year
end and December's arrears are paid in January. Cash at the year end starts from cash on the
newest booking, with open invoices collected and the VAT position settled, then adds each forecast
month as it is paid. For a year the ledger has not reached, it starts from the year before's
forecast.

`dividendCapacity(year, forecast, workbook, rules)` in `src/packs/hr-doo/domain/dividend/` sets out
what the forecast leaves to pay out: profit after tax, retained earnings at the start of the year,
losses brought forward and what the year has paid out already, the distributable amount, and net
assets after a payout against the share capital. Beside it stand the grant clawback exposure, cash
at the year end with December settled less the tax balance, and what the owner owes. Three options
carry their dividend tax, net, cash, loan and capital consequences: one payout once the members
adopt the statements, set off against what the owner owes, an interim payout now on the profit of
the complete months, with the part the year's profit does not cover taxed as the owner's income,
or keeping the profit in the company. The interim payout is weighed against cash on the newest
booking instead of the year end, less the corporate tax due by the end of that month and the pay
of the last complete month the ledger has not paid yet. When the payout and its tax exceed that,
the option gives the largest payout the cash covers. The figures are for planning with the
accountant, never filing advice.

## Forecast screen

A pack screen at `/forecast?year=2026`, shown while `owner_pay_module` is on, for the year of the
newest booking and the one after. It is seen on the newest booking and needs
`hr_company_registered`. A bar chart gives income, costs and profit before tax by month, with
planned or averaged bars hatched and the running month shaded. The profit and loss and the PD return
are lists whose lines open on their parts, the months a plan row, the billing plan or an average
stands in for, their rows and their rules. The corporate tax card sets each payment the schedule expects beside what the
bank rows paid, with the balance due and the new monthly advance. Dividend capacity switches between
the three payout options with `payout=interim` or `payout=keep` in the address, warns when the cash
on the newest booking does not cover the interim payout, and the year's plan
rows are listed read only, each with why the forecast does not count it where it does not. Taxes
lists the same payments for every year from the first tax period, with overdue payments and payments
no obligation takes called out above them. The figures are for planning with the accountant, never
filing advice.

## Year end

A pack screen at `/year-end?year=2025`, shown while `owner_pay_module` is on, for the years the
`year-end` tab holds. It sets the accountant's profit and loss, balance sheet and PD lines beside
ours on the accrual view and on the cash view. The cash view puts each booking of the year on the
line its category counts on, so its profit and loss lines add up to the cash net, and its balance
sheet holds only cash. A line is `matched` when ours agrees with no adjustment between the two
views, `explained` when it agrees once the adjustments are made, `judgement` when it agrees because
it takes the accountant's figure for a choice the ledger cannot show, and `open` otherwise. Each line
opens on how ours is built, every step drilling to its rows, with the rules behind it.

A waterfall leads from the cash net to profit before and after tax, one bar per adjustment, with
what nothing explains last. Konto lines that share a category are compared as one group beside our
figure for those categories. The tax payment date is checked against a ledger payment of our
balance due, and the distribution decision against our profit after tax. Open items list the
accountant's choices, any gap to the accountant's profit, months no invoice delivers in, purchases
with no asset row, and what loans to the owner and early asset purchases call for, each with what
would settle it. The figures are for planning with the accountant, never filing advice.

## Billing plan

The `outgoing-plan` tab is what is to be invoiced, for any freelancer or small business. The
services in `src/features/billingPlan/domain/` read it with the `invoices` tab:

- `billingTotals`: everything planned, everything invoiced and the difference over all clients,
  with plan rows by the year of their date and invoices by the year they were issued.
- `plannedAgainstInvoiced`: each month's plan rows against what invoices billed of them. An
  invoice lists a month's items together with items left over from before, and may bill next
  month's fee ahead, so no invoice belongs to one row. Each client's invoices, in issue order, take
  the client's rows oldest first, by date and then tab order, the way Receivables lets payments
  fill invoices. An invoice reaches rows dated up to the end of the month after the one it was
  issued in. What it cannot place there is invoiced with no plan row and is not carried to later
  rows. Rows still open are not invoiced yet.
- `itemStatistics`: each kind of item's total, in all and by year, such as how much of the
  billing is the monthly fee, bonuses, re-billed travel, subscriptions or contractors.
- `expectedInvoices`: the rows the given invoices have not billed, by month and client, each
  expected in the month it is dated. The screen passes every invoice, and the forecast the ones it
  counts.
- `fillRestOfYear`: the rows "Fill the rest of the year" adds for `billing_client`, the monthly fee
  and the subscription on the last day of every month from this one to December, skipping a month
  that already has the item for the client. The yearly bonus is never filled in. The rows stay the
  one source the forecast reads, so a filled row is adjusted on the tab.

## Billing plan screen

A core screen at `/billing?year=2026`, after Receivables, seen on the newest booking. Tiles give the
year's planned and invoiced amounts, what of the year's rows is not invoiced yet, and the next
expected invoice. A chart sets each month's plan rows beside what the invoices billed of them, with
what an invoice billed beyond the plan hatched on top, and a bar opens its month in the list below
(`month=2026-10`). The list calls out rows not invoiced yet and invoices with no plan row. Beside it
are the year's items, each with one colour on every chart and list, and Sums, Planned and Actual per
year, over every client, as the Sheet's formula block adds them, so the two can be checked before the
block goes.

The rows of the year can be added, edited and deleted in both modes. "Fill the rest of the year"
previews the rows `fillRestOfYear` would add and appends them. An edit writes only the cells that
changed, so a formula amount left alone stays a formula. A delete clears the row's five cells and
leaves the row and any cells beside it. Both find the row as the app read it, on its own row or on
the one row that holds it, and refuse when none or several do. Undo takes an addition back, puts a
deleted row back at the foot of the tab and an edited row back as it was. The billing terms are on
Workbook, General. Without the tab the screen names the headers to add, and in Excel mode starts one
from its first row.

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

- **Template.** "Download the empty template" writes a blank xlsx in the browser: the fourteen tabs
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
npm run check:visual   # every screen, dark and light, at four widths in local Chrome, and the wide screens at 1920 and 2560, screenshots in visual-check/
npm run check:touch    # touch at 360 and 430 px: top bar and drawer, drills, filter sheet, import, 44 px targets, in visual-check/touch/
npm run check:pwa      # after npm run build: manifest, offline reload, update prompt. Add -- --firefox for Firefox
npm run check:round-trip -- --workbook <file.xlsx>   # import, export and import again, counts only
```

The fake workbook is an 18-month synthetic company: two accounts, one closed by a sweep into the
other, a part-month at each end, one loss month, a reimbursement, two rows waiting for review, a
rules tab that reproduces every row flagged `rule`, and rows a person confirmed that no rule covers
yet. Its `assets`, `grants`, `year-end`, `plan` and `scenarios` tabs hold the two computers it
bought, its start-up grant, made-up 2025 accountant figures that add up, a plan and two owner pay
scenarios. Its `outgoing-plan` tab splits each of the first client's invoices into a month's fee
and its extras, with October planned and not invoiced yet, and has no rows for the second client,
whose invoices are invoiced with no plan row. The Excel-mode variant sets the billing settings. In the fake build a Google Sheet held in memory answers syncs and writes until the page reloads.
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

Review, Owner, Billing plan and the Workbook screen write through one path in both modes. Each write reads the tabs it
touches again, plans on that read, writes, reads them back into the copy on screen, and checks that
what was written is there. A plan that cannot be carried out exactly writes nothing and says why.
In Excel mode the reads and writes go to a working copy that replaces the stored workbook when the
write is complete. The plans live in `src/features/workbook/application/writePlans.ts`, the Google
side in `googleWorkbookWriter.ts`.

- **Ledger rows.** A row is found again by (account, reference), or for a blank reference by
  (account, date, amount, balance, description), so rows the ingest inserted since the last sync do
  not matter. The write is refused when no row or several rows match, when the row's category or
  `flagged_by` changed since the app read it, or when the category is not on the categories tab.
  Only `category` and `flagged_by` are written, each found by its header (I and J in the
  shadow-accounting Sheet), and only where the value changes.
  Confirm writes the `review_label` setting to `flagged_by`. Recategorise writes the category and the
  label. Applying a new rule writes its category and `rule`, only to rows flagged `ai` or
  unclassified. Undo writes the exact previous values back through the same checks. Review lists
  every write of the page's session under "Changes in this session", newest first: ledger rows,
  rules, settings, owner advances, plan rows and the loan bucket. A ledger write, an added advance, a
  plan row added, changed or deleted, and a bucket switch that have not been undone carry Undo there. Rules and settings are changed back on
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
| Confirm, recategorise, undo, apply a rule | `spreadsheets.get` (tab ids), `values.batchGet` of `ledger` and `categories`, `values.batchUpdate` of single cells such as `ledger!I57` and `ledger!J57`, then the same get and batchGet again |
| Add a rule | get, `values.batchGet` of `rules`, `categories` and `clients` (when the Sheet has it), `values.append` to `rules!A:U` with `insertDataOption=INSERT_ROWS` (plus a `values.batchUpdate` of `order` cells when rules are renumbered), get and batchGet again |
| Edit, switch on or off, move a rule | get, batchGet of `rules`, `categories` and `clients` (when the Sheet has it), `values.batchUpdate` of the changed cells such as `rules!C12`, get and batchGet again |
| Save settings | get, batchGet of `settings`, `values.batchUpdate` of `value` cells such as `settings!B4`, `values.append` to `settings!A:B` for a new key, get and batchGet again |
| Add an advance | get, batchGet of `'owner-advances'` and `categories`, `values.append` to `'owner-advances'!A:D`, get and batchGet again. Undo is a `values.batchUpdate` clearing that row's cells |
| Switch the loan bucket | get, batchGet of `categories`, `values.batchUpdate` of `bucket` cells such as `categories!C16`, get and batchGet again |
| Add or fill plan rows | get, batchGet of `'outgoing-plan'` and `clients`, one `values.append` of every new row to `'outgoing-plan'!A:<last header>`, get and batchGet again. Undo clears the rows' five cells with a `values.batchUpdate` |
| Edit or delete a plan row | get, batchGet of `'outgoing-plan'` (and `clients` for an edit), `values.batchUpdate` of the changed or cleared cells such as `'outgoing-plan'!C12`, get and batchGet again |

### Manual test, against a copy of the Sheet first

Run this on a copy (File, Make a copy in Google Sheets, then pick the copy in "Switch data source").
Never run it first on the original.

1. Pick the copy and sync. Note the row number of one `ai` row on Review.
2. Open the row and Confirm it. In the copy, only J on that row changed to your review label. I is
   as before. Press Undo in the toast and check J is back.
3. Recategorise the same row. I and J change, nothing else. Wait for the toast to close, open
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

## Billing parity

`npm run parity:billing -- --workbook <export.xlsx>` compares the app's billing totals with the
formula block the Sheet keeps beside the `outgoing-plan` rows: Total Amount, Invoiced Amount, Not
Invoiced Amount, and the year rows under Planned and under Actual, found by their labels. Each
formula is first run again over the export's own cells, so a figure the export did not recalculate
fails. A figure is `pass` when the app's equals the tab's to the cent, `corrected` with the reason
when the tab's formula reads a range that misses plan rows or adds unrounded formula amounts the
app reads to the cent, and `FAIL` otherwise, which makes the exit code non-zero. The export holds
real company figures, so the script prints only verdicts, differences and row numbers. Keep the
export outside the repository and never copy a figure from the output into it.

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

## Year-end parity

`npm run parity:year-end -- --workbook <export.xlsx> --year 2025` runs the accrual engine over an
xlsx export of the Sheet and compares every line of that year's `year-end` rows with ours. It
prints the bridge's steps with their kinds, then a verdict per line. `pass` means ours equals the
accountant's to the cent with no judgement behind it. `judgement` means it equals because the
engine took the accountant's figure, and names each judgement with the difference it carries.
`recorded` is a decision or a date the ledger cannot give, checked where it can be: `paid-on` needs
a corporate tax payment of our balance due on that day, and the distribution lines must share out
our profit after tax. The verdicts come from the same comparison the Year end screen shows. `FAIL` gives the residual. Konto rows are listed by the categories they share,
with their differences and no verdict, since one category can sit on several of them.

The exit code is non-zero unless the bridge's steps add up from the cash net to our profit before
tax, our profit before and after tax equal the accountant's to the cent, and no line fails. The export holds real company figures, so the script prints only verdicts and
differences. Keep the export outside the repository and never copy a figure from the output into
it.

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
