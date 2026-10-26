# Ledgerboard

Company finance dashboards over a workbook of bank transactions, computed in the browser. The
workbook is one JSON document, `ledgerboard-company.json`, in a Google Drive folder the user picks,
or the same document kept in this browser. There is no backend. It deploys to GitHub Pages at
`https://ipazanin.github.io/ledgerboard/`, with a privacy page at `privacy.html`.

With the file on Drive, the app asks Google for `drive.file`, which covers files the user picks in
the Google Picker or that the app creates, and for `openid email`, which tells it which account
signed in. To find new bank statements in Drive it also asks for `drive.readonly`, whose token it
holds in the page's memory only. See *Google sign-in*. The app reads the file and keeps a copy in
IndexedDB. It writes only that file, its revisions and a `backups` folder beside it, and only what
the user saves or a sync files, as *Write-back* describes. An xlsx file opens as the same document,
and "Export to Excel" writes one. Making an invoice also files its PDF in the Drive folder the user
picks for invoices, and, only for a user who turns the mail draft on, asks for `gmail.compose` to
save a Gmail draft. See *Invoices*.

## Google sign-in

There is no backend, so there is no refresh token: Google issues those only through a server-side
code exchange. Instead the app keeps the access token in `localStorage` with its expiry, so a reload
or a new tab within the hour syncs without a click. A token counts as expired a minute before Google
says, and is then removed. Switching to a workbook kept in the browser removes it too, and "Sign out
of Google" on Settings, This device revokes it with `google.accounts.oauth2.revoke` and removes it.

While a token is good, the app syncs on open and whenever the tab becomes visible again, at most
once every ten minutes after the last read or attempt, on a device that leaves "Sync as the app
opens" on, as *Sync* describes. Without one, the Sync button works as before, since a new token
needs a click to open Google's popup.

The kept token carries only those scopes, since the app asks for it with `include_granted_scopes`
off. The `gmail.compose` grant of *Invoices* comes as a second token, which lives in the page's
memory for its hour and is never stored, because it can send mail as well as save drafts. Sign out
forgets it too.

The Drive read grant is a third token. The Apps Script files the bank statements in a Drive folder,
and `drive.file` cannot see files another app made, so the app asks for `drive.readonly` to find the
new ones, and to read the accountant's workbooks on Year, Taxes. That token can read every file in Drive. It is asked for alone, with
`include_granted_scopes` off, so it can neither write the file nor send mail, and it lives only in
the page's memory. Each open of the books on Drive while online first sends the tab to Google with
`prompt=none`, which shows no screen there and comes straight back with the token. The tab leaves
by replacing the page, so Back from the app does not land on a page that asks again. The token only
lists and downloads the statements and the accountant's workbooks. The file is read and written with the kept `drive.file` token
alone, so a sync that files statements always holds a token that can write them, and a sync after
the kept token ran out still needs the tap that asks for it. A load that is Google's answer to that
sign-in asks once more the same way, so on a phone one tap on Sync brings back both tokens. What the
sign-in picks up, such as the sync, waits until the tab is back from that second trip, and runs
whether Google gave the Drive read token or not. Any other load that is Google's answer never asks
again. When Google answers with an error instead, such as `consent_required` before the first
consent, the tab notes it in session storage and opens without going to Google until the tab is
closed. Then only "Allow access" in the sync control asks, with Google's consent screen if it needs
one: in the popup on a desktop, by the redirect on a phone. The control shows it after a sync whose
statements or accountant step found no Drive read token on the page, as *Sync* describes. A token
that ran out after an hour is asked for again the same way, since a silent ask in the middle of a
session would reload the page. A device whose "Sync as the app opens" is off skips the silent ask
on open, so its first sync shows "Allow access". A workbook
kept in this browser, the fake build and an offline open never go to Google, and sign out forgets this token too, with
the read of Year, Taxes this device kept.
`driveReadAccess()` in `src/shared/google/googleAuth.ts` says where the page stands: the token
held, not asked yet (or run out), or consent needed.

On a phone or in the installed app, the rule being the media query `(pointer: coarse), (display-mode:
standalone)`, the app signs in without the popup. Google's popup opened its cookie screen zoomed out
there, so the whole tab goes to Google with the OAuth 2.0 implicit flow (`response_type=token`) and
comes back to the app's own address with the token in the fragment. The app reads the fragment
before the router starts, checks the one-time `state` it kept in `localStorage`, takes the token
out of the address and returns to the screen and tab the person left. A wrong or missing `state`
keeps no token and says so. After the sign-in a Sync carries on, and so does Connect, which opens
the Picker. Anything else that needed the token, such as a write, did not run and is tapped again.
The Gmail grant goes the same way with `include_granted_scopes=true`. The invoice dialog is gone
once back, so a toast asks to make the invoice again, which then uses the Gmail token this page
now holds. Nothing is filed or written before the grant is asked for. The Drive read grant asked
from "Allow access" goes the same way with `include_granted_scopes=false`, and the sync starts by
itself once back, whether Google gave the token or not, so a refusal leaves "Allow access" in the
control and shows no message. The silent asks show no message of their own either way. A sync that
picks up after a sign-in is the tap on Sync carried on, so without the Drive read token it ends in
"Allow access" too.

The token model returns no ID token, so after the first sign-in the app reads the email address
once from the OpenID Connect userinfo endpoint (`https://openidconnect.googleapis.com/v1/userinfo`,
the `userinfo_endpoint` of Google's discovery document) and keeps it. It is passed as `login_hint`,
so an expired token renews with one click and no account chooser. Sign out forgets it. A return
from a sign-in by redirect waits for the email before the silent Drive read ask leaves, for up to
five seconds, and then goes on without it.

## Sync

A sync is an ordered list of steps, run one after another: the books, then the statements, then the
pack's steps, the accountant's folders today. The Sync button, the sync on open and on a return to
the tab, LedgerGate's Sync and Try again, and the way back from Google all run the same sync,
`createSync` in `src/features/sync/application/sync.ts`, through `useSync` in
`src/features/sync/presentation/`. A workbook kept in this browser has no sync, and its statements
come in on the Import tab.

Each step names the Google scope it needs and whether the settings turn it on:

| Step | Scope | On when |
|---|---|---|
| Books | `drive.file` | Always, for a file on Drive |
| Statements | `drive.readonly` | `statements_sync` is TRUE, the default |
| Accountant | `drive.readonly` | The Croatian pack shows and `hr_accountant_sync` is TRUE, the default |

A step that is off does not run and is not counted. Whether a step is on is decided again once the
books are read, so a switch another device saved counts in the same sync. A tap during a save waits
for the save and then syncs, and a tap during a sync joins it, so one sync runs at a time. A step
whose scope the page holds no token for does not run and needs access. A step that fails leaves
the others running. Google turning a step's token away inside the step makes that step, and the
later steps of the same scope, need access. A failed read of the books skips every later step.

The states of a step are in `src/features/sync/domain/syncRun.ts`: off, queued, running with a line
such as "Filing 4 rows", done with a line such as "Nothing new", waiting for you, such as with a
statement it held, needing access, failed with the message, or skipped because the books could not
be read. The run is page state and never stored.

The sync control shows one of four things:

- While a sync runs, the step and its place among the steps that are on, such as "Statements 2/3".
  The button takes no tap, and a screen reader hears the step and its line as they change.
- "Allow access" while a step needs access. The tap asks Google for the Drive read token of *Google
  sign-in*, with its consent screen when it needs one, and syncs again.
- "1 problem", or the count, while a step failed or waits for you. The tap opens the steps of the
  last sync, in a popover from 640 px and in a bottom sheet on a phone: each step's line, with Undo
  or a link where the step left one, and "Sync again".
- Otherwise how long ago the books were read. The tap syncs.

A missing permission shows only there and in its step's line, never in a toast, an Overview line or
a card. From 1024 px a button beside Sync in the sidebar opens the steps of the last sync too.
Settings, This device has a Sync card with the same steps and the "Sync as the app opens" switch.

**Sync as the app opens** is a switch of each device, on by default. Only an off is kept, in
`localStorage` under `ledgerboard.auto-sync`. While it is on and a kept token is good, the app
syncs on open and whenever the tab becomes visible again, at most once every ten minutes after the
last read or attempt (`src/features/sync/application/autoSync.ts`). Off, the open also skips the
silent trip to Google for the Drive read token, so the device waits for a tap on Sync, and its first
sync shows "Allow access".

### The statements step

`useStatementSync` in `src/features/imports/presentation/` makes the step. It runs
`fileNewStatements` in `src/features/imports/application/statementSync.ts` after the books are read:

1. Finds the folder the `statements_folder` setting names, a path from My Drive, one folder name at
   a time, and lists the files of the folders inside it, one per year. A missing folder, or two
   folders of one name, stop the step with the folder named. The app never makes or changes a
   folder there.
2. Skips each file the ledger holds by its name. The fetch names a statement `<label>-<account>.xml`,
   and a file whose label the ledger holds for that account is never downloaded. A file named by its
   label alone, or another way, is read every time. So a sync with nothing new downloads nothing.
3. Downloads the rest, reads each as Import reads a camt.053 file, and runs one dry run over all of
   them against the ledger just read. A file that does not read is held with the reason.
4. Adds every statement the dry run accepts, with no refusal and no account to start, in one write
   through `LEDGER_WRITES`: the same path, the same checks and the same Undo as Import. A statement
   it refuses, or that waits for its account to start, is held. The dry run leaves the account where
   it was, so nothing after a held statement is filed for that account, and other accounts still are.
5. When the write is refused, such as for rows another device's sync filed since the read, reads the
   file again and runs the dry run once more. A second refusal is shown on Import, and nothing is
   written.

What the step did is page state and never stored: the statements it filed, the ones it held, and a
folder it could not read. Its line says what it filed with how many of the new rows wait on Review,
such as "Filed statement 028, 2 rows, 1 on Review.", then the notes of each statement, such as a gap
in the statement numbers whose balances still join, and how many statements were not filed. Undo
sits on the line, and in "Changes in this session" on Review. The line links to Review while filed
rows wait there, and to Import while a statement was held, which makes the step wait for you. A
sync that files nothing says "Nothing new" and adds nothing to "Changes in this session". No toast
says any of it. Overview then says how many statements were not filed and links to Import, which
shows each one. A save Google turns away still reads the file again, and the line says "Not filed.
Sync again."

### The accountant step

The pack adds it through `syncSteps` on its contribution. `readAccountantFiles` in
`src/packs/hr-doo/presentation/taxes/useAccountantDocuments.ts` reads the two folders for Year,
Taxes, as *Year screen* describes, and keeps the read on this device. Its line says how many
workbooks it read. A folder that could not be listed makes it wait for you, with a link to Year,
Taxes.

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
transactions as cards, and charts with fewer axis labels. A screen's inner tabs make one row that
sticks under the top bar, with the Filters button at its right end when the tab has filters, and
the row counts in the band a link lands below. Transactions, Review, Invoicing, Analysis, Owner and
a closed or ended year on Year share the phone's width between their tabs. An open year and Settings have five, so their row scrolls inside itself. When the tab labels run past 16 characters together,
the Filters button keeps its icon and its count, and the word stays for a screen reader. A tap on a chart shows its tooltip and a
"View rows" action, and a second tap on the same mark drills. Every control there is at least 44 px
square, and the installed app keeps clear of the system bars through the safe-area insets. From
640 px up the layout is the desktop one.

The top bar's sync control is one rounded 44 px button with the icon and how long ago the last sync
was, such as "3 h ago", on one line. A screen reader hears the full time of that sync with it.
While a sync runs its icon turns and it says the step and its place, such as "Statements 2/3", and
a screen reader hears the step's line too, such as "Filing 3 rows", as does the sidebar's status
line from 1024 px up. "Allow access" and "1 problem" take the button's place as *Sync* describes,
and the steps of a problem open in a bottom sheet. The menu shows beside Review how many
rows wait there, whatever the filters. For a workbook kept in this browser the Export button in the top bar has the same
rounded 44 px shape.

The bars that stay at the top while a screen scrolls, the top bar below 1024 px and a screen's
filter or search bar, are measured as one band, kept in the `--sticky-band` CSS variable. Every
element with an id takes it as its `scroll-margin-top`, so a link to a part of a screen, such as a
month on the Plan tab of Invoicing, lands just below the band at any width, or as high as the foot
of a short page lets it.

## Wide screens

From 1920 px (the `3xl` breakpoint) a dashboard screen sets related cards side by side, or a long
list beside a column of the cards that sum it up: Overview, the Invoices and Plan tabs of Invoicing,
the Compare tab of Analysis and the Who owes whom tab of Owner. The content grows to 160rem beside the sidebar. A screen that is one table,
one list, one form or a long report keeps a 100rem measure instead, so its rows stay readable:
Transactions, Year, Review and Settings. The other screens simply
widen. `.wide-pair` in `src/shared/styles/app.css` does the pairing, and the widths are the
`--container-shell`, `--container-measure` and `--breakpoint-3xl` tokens in `tokens.css`. Below
1920 px nothing changes.

## Cards

Every card on a screen is `AppCard` in `src/shared/ui/`: a raised surface with a header of title,
subtitle, actions and an optional definition behind an info button. Charts use it through
`ChartCard`, and tiles use the bare surface without a header. A chart takes the same collapse id,
summary and start state as any card. `DonutCard` shows one snapshot of at most five parts as a
ring, 62 to 82% of its radius from 12 o'clock, with the total in the middle as page text. The
list beside it gives each part's value and share and opens its rows, so it is the chart's table
too. A part may carry a note in place of its share, and the card may set more content beside the
list, whose rows keep the list's height and dividers from the same top, and a chart beside the ring,
which a phone sets under it. Each part keeps the colour of what it stands for, such as its bucket, never one picked by its
rank. A phone sets the ring above the list. A card with a long list or table, such
as plan rows, invoices, rules or a tab editor, has a toggle at the end of its header. Collapsed,
it shows its title and one summary line, such as the row count or a total. Each card opens
expanded unless its screen says otherwise, and this device remembers the choice in `localStorage`
under `ledgerboard.card.` and the card's id, such as `invoicing.months`. Without storage the card keeps
its state until the page reloads. A link into a collapsed card, such as a tile that opens a month,
opens it first and is not remembered. A long list, such as the invoices on Invoicing or the
categories on Analysis, Compare, shows its first ten entries, then "Show all" with the count. Tiles and short summaries do not collapse. A chart that is reference rather than the point of its
screen may.

A card fits its content without sideways scroll. Where two cards would not fit side by side, they
stack. A table in a narrow card gives way first: names and descriptions wrap, a change, a category
or a due date moves under its row's name, and a secondary column such as the account, the family or the month strip drops out
below a container width (Tailwind's `@container` variants, so a card answers to its own width, not
the window's). Only the tab editors, where every column is an input, scroll sideways, and
`check:visual` fails on any other card that does. A popover stays inside the window and opens
beside the row it belongs to, not over it, where there is room.

## Overview, Transactions, Review and Analysis

**Overview** says how the company is doing and what waits. The headline gives the newest complete
month's income and costs. "Waiting for you" lists, across the whole workbook and whatever the
filters, each job with something to do, with a link to the page that does it: statements the last
sync could not file, or a statements folder it could not read (Transactions, Import), rows to review
(Review), invoices the billing plan expects by this month that are not made yet (Invoicing, Plan, on
the oldest month) and invoices past their due date (Invoicing). The pack's jobs follow:
reimbursements with no cost on file (Review), a complete month in which a watched tax such as the
payroll contributions had no payment, and a corporate tax payment due this month or overdue (both
Year, Taxes, at their cards). The pack's jobs need the `owner_pay_module`, and the corporate tax one
`hr_company_registered`. A job already late has a red dot, and the card is gone when nothing waits.
`waitingJobs` in `src/features/overview/presentation/waitingForYou.ts` builds it, and the pack's
jobs come from `src/packs/hr-doo/presentation/packWaitingJobs.ts`. Below it sit the tiles (cash on hand, net over
the last 12 months, monthly costs, and runway at the last three months' cost with the twelve months'
in its caption), the typical month three ways, income and costs by month, the balance at each month
end over the last 12 months and the month so far, and "Every euro earned" as a ring of the last 12
months: each cost bucket and what was kept. A loss keeps nothing, so the ring then splits every euro
spent and its middle says how much more went out than came in. "Accounts", collapsed, gives each
account's newest balance.

**Transactions** has two tabs. Rows is the filtered list of every row behind the figures, and Import
adds a statement, as *Import* describes. A click on any figure opens Rows with the filters that
reproduce it. A row shared with the owner, as *Owner share* describes, heads its two parts the way a
split row does, badged with the share, and the owner's part says its share and the category it comes
from, such as "30% to owner, from Equipment". "Change category" on either part, or on a row a rule or a person settled, files the row in another category: it
writes the row's `category` and `flagged_by` with the review label, and the new category's owner share, as Review's Recategorise does,
with Undo in the toast and under "Changes in this session". Before the write the dialog names the
rule that files such rows elsewhere, since the row then shows on Review's Rules tab among that
rule's exceptions, and the toast opens the rule. A row still waiting is settled on Review. On a
part of a split row the action opens the split editor, since the `splits` tab holds the parts'
categories.

While `owner_pay_module` is on, "Owner share" sits beside Change category and Split, as an icon in
the table and a link in the phone card. It is offered on a settled bank row, a part of a split row
and an owner advance, each only in an operating category. On a shared row the heading's pencil and
either part open it for the row as booked, and Split sits on the heading alone, since it divides the
payment as booked. `ownerShareChangeOf` in `src/features/transactions/domain/` is the one rule for
where it is offered. Its dialog takes a whole percentage from
0 to 100, or blank for none, and "Use the category's default" puts in the category's default, blank
when it has none. Under the field it shows what the company keeps and what you take: the payment
split by the share, the owner's part rounded to the cent and the company's the rest, so the two add
up. Save writes the one `owner_share` cell of the ledger row, the split part or the advance, with
Undo in the toast. `OwnerShareDialog` in `src/features/owner-share/presentation/` is the dialog, and
`writeOwnerShare` in `src/features/owner-share/application/ownerShareWrites.ts` the write.

**Review** has two tabs. Queue, with its count, holds the filters, the rows that wait for a person,
the reimbursements with no cost on file and "Changes in this session", collapsed. A row of the queue
opens to Confirm, Recategorise, Make this a rule and Split, which opens the split editor of
*Split rows*. Rules holds the rules tab, tried from the top, where `?rule=` marks a rule and opens its
card, and "Confirmed rows no rule repeats", collapsed, over the whole ledger. Each group there can
be made a rule or dismissed. A dismissal is a row on the `dismissed` tab, so the group stays hidden
as new rows join it, and "Dismissed suggestions (N)" lists each one with Restore, which deletes its
row. Both write through the record path with Undo.

**Analysis** says where the money goes and whether it is getting better or worse. One filter bar sits
above its three tabs, since each follows it, and on a phone its Filters button ends the tab row.
Breakdown holds cost by category under the buckets against the period before, with the taxes and
owner pay groups linking to the screens that break them down further in the Croatian pack, and "Who
the company paid most", collapsed, with the top payee in its summary. Over time charts every month
of the ledger with income above zero and costs below, its slider setting the period, then the
rolling net and, collapsed, the cumulative net. Compare sets a year, quarter or custom range
against the equal period before it, so its bar offers only those and reads a rolling period as the
last complete quarter: profit and loss line by line, and each category's change, ten at a time.

## The workbook format

The file's records and an xlsx file share one format: a record's fields are the columns of its
tab, as *The file* under *Write-back* describes. Every column is found by its header name, so
columns may sit in any order, and a column the app does not know is kept and ignored otherwise. Only `ledger` is required. A missing tab or column reads as empty, and missing settings
take their defaults.

| Tab | Columns |
|---|---|
| `ledger` | `date` (a date cell), `account`, `statement`, `counterparty`, `counterparty_iban`, `description`, `amount`, `balance`, `category`, `flagged_by`, `reference`, and the optional camt signals `purpose`, `tx_domain`, `tx_family`, `tx_sub_family`, `creditor_reference`, `instructed_currency` and `review_reasons`, in that order from A to R, then the optional `owner_share` as *Owner share* describes, and `id`, which every row gets when the books move into the file. |
| `categories` | `category`, `family`, `bucket` (one of `income`, `operating`, `taxes`, `owner-pay`, `financing`, `neutral`), `colour` (a swatch of the palette as its light hex, such as `#2a78d6` for Blue, or blank for the bucket colour), an optional comma-separated `roles` from the roles core and the pack pick categories by (*Taxes and Owner* lists them), an optional `label`, and an optional `vat`: how a purchase in the category splits into cost and VAT, one of `none`, `deductible-25`, `deductible-13`, `deductible-5`, `reverse-charge`, `foreign-vat`, `representation` and `car-50`. A blank `vat` is `none`, and an unknown one is reported and read as `none`. An optional `owner_share`, the default a row filed in the category takes. |
| `accounts` | `account`, `iban`, an optional `currency`, and an optional `label`. An account named on more than one row is reported on each and read from none. |
| `settings` | `key`, `value`, one row per setting. A key on more than one row is reported on each and takes its default. |
| `rules` | `rule`, `order`, `enabled`, the condition columns, `category`, `confidence` (`rule` or `review`) and `note`. A row the reader refuses, such as one with an order that is not a number or a filled column no rule can test, is reported and left out, and so is every row of an id used on more than one row. Rules are tried by `order`, then by id. |
| `invoices` | `number` (text), `client`, `item`, `amount`, `issued` and `due` (date cells, `due` optional), and the optional delivery period `period_from` and `period_to` (date cells, both or neither). A row without a number, client, amount or issue date is reported and left out, and so is every row of a number used twice for one client. A period that cannot be read is reported, and the issue date stands for it. |
| `clients` | `client`, `name` and `iban`, one row per client. `iban` holds every IBAN the client pays from, separated by commas, such as `HR12 3456, HR98 7654`, each read without its spaces and once. A client named on more than one row is reported on each and read from none, and with it go the payments matched to its invoices and its `outgoing-plan` rows, until its IBANs are in one row and the others are deleted. An IBAN on two clients is reported on both and counts for neither, so no payment from it counts as a client's. The rules' `counterparty_is_client` reads these IBANs, so without the tab it matches no row. The optional invoice columns are `address`, `country`, `tax_id`, `invoice_mail`, `mail_language` (a language tag such as `en` or `hr`, blank for English) and `reverse_charge` (TRUE or FALSE, blank for FALSE). A language the browser does not know is reported and read as blank, and a `reverse_charge` that is neither TRUE nor FALSE is reported and read as FALSE. |
| `outgoing-plan` | `item`, `date` (a date cell), `amount` (above zero), `client` and `description`: one row per item to invoice a client, such as a month's fee, a bonus or a re-billed hotel. `date` is the day it becomes billable, the last day of the worked month for a monthly fee. `client` must be on the `clients` tab, or the row is reported and left out. Only these five columns and `id` are read. |
| `owner-advances` | `date`, `amount` (above zero), `description`, `category` and the optional `owner_share`: costs the owner paid privately for the company. The category must be in the `operating` or `taxes` bucket, or the row is reported and left out. A negative amount, the owner's private share of a company payment, is reported and left out, since that share is a part on the `splits` tab, as *Split rows* describes. |
| `assets` | `asset`, `bought` (a date cell), `in_use` (a date cell, blank means the day it was bought), `cost_net` (above zero, without the VAT that was reclaimed), `group` (`computers`, `equipment`, `car`, `building` or `other`), `doubled` (TRUE for a doubled depreciation rate), `disposed` (a date cell), `funded_by` (a grant on the `grants` tab), `ledger_reference` and `note`. An asset is listed once, or every row of its name is reported and left out. A row put in use before it was bought, or disposed before it was put in use, is reported and left out. A grant the `grants` tab lacks is reported and the asset kept. |
| `grants` | `grant`, `received` (a date cell), `amount` (above zero), `fixed_part` and `variable_part` (both or neither, adding up to `amount`), `period_from` and `period_to` (date cells, both or neither), `release` (`fixed-then-assets`, the default, which needs both parts, or `straight-line`, which needs the period), `clawback_year1` and `clawback_year2` (`whole` or an amount), `employment_required_until` (a date cell) and `note`. A grant is listed once, or every row of its name is reported and left out. |
| `year-end` | `year`, `statement` (`pl`, `balance`, `tax`, `distribution`, `grant` or `konto`), `line`, `label`, `amount`, `categories`, `aop`, `source` and `note`: the accountant's figures, one row per year, statement and line, or every row of the key is reported and left out. `line` is a fixed id per statement, such as `sales`, `total-assets` or `liability`, listed in the editor on Year, Statements, or the account number on a `konto` row. `amount` is the figure as printed, costs as positive numbers. `filed-on`, `paid-on` and `decided-on` take a date cell, `rate` a percentage cell, and `months-of-operation` a whole number. `categories` names the app categories of a `konto` row. When income less expenses differs from `profit-before-tax`, or the asset lines or the equity and liability lines differ from `total-assets`, the total's row is reported and every line kept. |
| `plan` | `year`, `month` (1 to 12, blank for every month), `item` (a category, `owner_pay_scenario`, `dividend` or `purchase`), `amount`, `note`, and the optional `date` (a date cell) and `group`. `amount` is positive for income and costs alike, a cost without the VAT that is reclaimed. A category is listed once per year and month, or every row of it is reported and left out. A `dividend` needs its month. A `purchase` needs `date`, the day it is bought and put in use, and `group`, one of the `assets` tab's groups, and takes its month from the date. Its `note` says what it is, and two purchases may share a day. An `owner_pay_scenario` row names a scenario from the `scenarios` tab in `amount` and leaves `month` blank: without a `date` it holds from 1 January, and a second row with a `date` switches to another scenario from that day. Planned revenue belongs on `outgoing-plan`, so a `revenue` row is reported and left out. The rules across rows are the plan guards of *Forecast*. |
| `splits` | `date` (a date cell), `account`, `row_amount` and `row_balance`, which find one ledger row, then the part's `amount`, `category` and the optional `note` and `owner_share`: one row per part of a bank row that paid for more than one thing. The parts of a row share its four key cells, as *Split rows* describes. |
| `dismissed` | `kind` (`not-covered` or `exception`), `key`, the optional `category` and the optional `dismissed_on` (a date cell): one row per group of "Confirmed rows no rule repeats" that a person dismissed on Review. `key` is the group's counterparty as counterparty filters key it, `iban:` and the IBAN or `name:` and the folded name, so the group stays hidden as new rows join it. An exception adds `|` and the id of the rule it differs from, so dismissing it leaves the same counterparty's exceptions to other rules in view. `category` is where most of its rows were on the day. A row without a kind or a key is reported and left out, and so is every row of a kind and key dismissed twice. |
| `scenarios` | `scenario`, `label`, `year`, `component`, `amount`, `from` and `to`: rows that share a scenario name make one owner pay mix for one year. `component` is `salary_gross` (a month's gross or `floor`), `nontaxable:<item>` such as `nontaxable:occasional-gift` (a year's amount of a tax-free item), `rent_monthly` (a month's rent), `dividend` (an amount or `max`) or `director_basis` (`employee`, `board-only` or `insured-elsewhere`). `from` and `to` are optional date cells in the scenario's year. A tax-free item is paid with the salary of the month its `from` falls in, January when blank, and a dividend once the year's statements are adopted, so their `to` is not read. The label is read from the rows that give one, and reads blank when they give it differently. A scenario whose rows name two years is reported and left out whole, and the same component for the same days on two rows leaves out both. |
| `employees` | `employee`, `name`, `iban`, `residence_city`, `pension_pillar_2`, `dependants`, `birth_year`, `agreed_gross`, `from`, `to` and `director`: one row per person the company pays a salary, for the Croatian d.o.o. pack. `employee` is a short name in lower case. `name` is the name as the accountant's salary workbook titles the employee's tab, compared regardless of case and diacritics. `iban` is the account or accounts the salary is paid into, separated by commas, and an IBAN two employees name counts for neither. `residence_city` is the city or municipality, such as `Grad Zagreb`, which sets the local income tax rates, read regardless of case, diacritics and a leading `Grad` or `Općina`, with the county in brackets for a name two units share, such as `Općina Privlaka (Zadarska)`. A blank city is reported and the row kept, and the payroll leaves it out. A city the ruleset does not know is reported and the row left out. `pension_pillar_2` and `director` are TRUE or FALSE, blank for FALSE. `dependants` is a whole number from 0 to 20, blank for 0, and `birth_year`, for the youth income tax relief, a year or blank for no relief. `agreed_gross` is the full-time monthly gross of the contract, more than zero, which *Salaries screen* works a month without a payslip out on, and blank for a director paid at the floor. `from` (a date cell) is the first day of the employment and required, and `to` the last, blank while it lasts. `director` marks a member of the company who is its director, whose salary has the director floor: the owner, whose pay *Pay scenarios*, *Forecast* and the payroll check of *Year screen* work out on this row. An employee is listed once, or every row of the name is reported and left out, and so is every director row when more than one row is marked so. |

The rows of `outgoing-plan`, `owner-advances`, `assets`, `year-end`, `plan`, `splits` and
`dismissed` carry an `id`, the tab's last column: a version 4 UUID the app makes, written as text.
Every row the app adds there gets one, and a tab without the column gets it in the same write. A
row without an id is reported by its label and left out, and so is every row of an id that more
than one row holds, as a copied row does. A split part left out this way leaves out its whole
split. The problem on Settings names the row, so a person who typed it into a file by hand can
give it an id there, any text no other row of the tab holds, or delete it and add it in the app.

Every record is known by its key or its id, never by its row: a ledger row by its account and
reference, or for a row without a reference by its account, day, amount, balance and description,
a category, an account, a client, a grant, an employee or a setting by its name, a rule by its id, an invoice by its client
and number, a `scenarios` row by its scenario, component and days, and
a row of the seven tabs above by its id. A write finds its rows that way, lists and links key on it,
and a problem names its record by a label, such as an invoice's number, an asset's name, a plan
row's item, client, day and amount, or a ledger row's day, counterparty, amount and balance. The
Settings screen and an import list problems by tab and label. Two ledger rows that share their key
both still count, each with a problem, and a split on either of them is left out, so the row counts
whole.

Nothing depends on where a row sits on its tab, so moving rows changes no figure. The ledger's
booking order comes from the balances: within one account and day each entry's balance is the one
before plus its amount, and the first opens at the account's closing balance of the day before
where it can. When the balances allow two orders the reference decides, and accounts that share a
day follow each other by name. A day whose balances do not chain is ordered by reference and
reported on the entry it then closes with, since its closing balance is a guess. Other ties go by
fields too: invoices of one day by number, billing plan rows of one day by item, amount and
description, owner advances of one day by amount and description, the parts of a split larger
first, and konto lines by their number. A key used on more than one row of a tab is never read
from the first of them, as the table says for each tab. `bookingOrder` in
`src/features/workbook/domain/` derives the ledger's order.

A category or account is shown by its `label`. A blank label shows the name with spaces for hyphens
and a capital first letter, so `ai-services` reads "AI services". Links and filters keep the name.

A category wears its `colour` wherever one category is drawn: its chip and dot on Transactions and
Review, the category picker, the Add filter menu, the bars of Cost by category and the payee strip on
Analysis, and the charts by category on Year, Taxes and Owner, Taken, in light and dark. The palette
is the eight chart slots and the recessive grey of `tokens.css`, each with its own dark step, named
Green, Orange, Blue, Amber, Pink, Dark green, Violet, Red and Grey. A blank colour, or any other
colour, reads as the bucket colour with no problem and stays in the tab as it is until a save picks
a swatch. A chart by category gives such a category the next chart slot that no category of its
bucket was given, in the order of the tab, so a category with nothing in the period never repaints
the others. Charts of whole buckets, such as Overview's ring and the profit and loss, keep the
bucket colours. `SWATCHES` in `src/features/workbook/domain/categoryColour.ts` lists the palette,
and `tests/categoryPalette.spec.ts` fails when it and `tokens.css` disagree.

`flagged_by` values `rule` and `ai` belong to the categoriser: `ai` marks a guess that waits for
review. Any other value means a person set the category. A row with `review_reasons`, such as a
reversal, also waits for review until a person confirms it.

### Owner share

`owner_share` is the part of a company cost the owner enjoys privately, such as the private use of
a laptop the company paid for, as a whole percentage from 0 to 100. It sits on four tabs: a
category's default, and the share of a ledger row, a split part and an owner advance. A blank cell
holds no share, which is not the same as 0. A cell that is not a whole number from 0 to 100 reads as
blank, and a problem names its row, which still reads. A Sheet without the column reads every share
as blank.

A record takes its category's default whenever the app sets its category, in the same write, so one
Undo puts back the category and the share together: a new row of an import or a sync, the rows a
new rule files, Confirm and Recategorise on Review, Change category on Transactions, and an advance
on Owner or a part in the split editor that is new or moves to another category. Confirm copies the
default again, so a default changed since the row was filed reaches it, and a new category's default
replaces any share the row held. An advance or a split part keeps its share while an edit keeps its
category. Only a category in the operating bucket holds a default, and only while a category
carries the `owner-benefit` role, such as "Benefits from company costs" in the owner-pay bucket,
which an empty start seeds. The role sits on one category only, in the owner-pay bucket. The
categories write refuses a new default that breaks either, and a role that breaks the last rule,
except an Undo. A default left on a category moved out of operating, or held while no category
carries the role, counts as 0, so the write lets it stand. That way a save with the owner-pay
module off, where the share column is hidden, is never refused over a share. `src/features/owner-share/domain/ownerShare.ts` holds
the share, its role, `filedIn`, the copy every path goes through, and `movedTo`, which copies only
when an edit moves the record. A default is set on Settings, Categories, which offers to fill the
rows without a share, and one record's share with "Owner share" on Transactions, as *Settings
screen* and *Overview, Transactions, Review and Analysis* describe.

The share is your own estimate, never booked. The accountant books the cost in full, so Year, its
Taxes, Accountant, Forecast and Pay tabs, Overview's corporate tax job, Who owes whom on Owner and
the parity scripts read the rows as booked, and a share changes none of their figures. The cash
screens count it: Overview, Analysis, Transactions and the Taken tab of Owner. There a bank row, a
split part or an owner advance with a share above 0 in the operating bucket counts as two parts. The
owner's part is the share of the signed amount, rounded to the cent, in the `owner-benefit` category.
The business part is the rest, in the row's own category, so the two add up to the payment and a
refund gives its share back. Operating cost goes down and owner pay goes up by the owner's parts,
while all costs and net stay as they were. A split row's own share is ignored, and each part counts
with its own. `ownerPartsOf` in `src/features/owner-share/domain/ownerParts.ts` makes the parts, and
`useFilteredLedger` gives the cash screens the workbook with them and the rest the workbook as booked,
`booked`. A filter on a category also selects the owner's part of a row filed in that category,
so a row shared in full, which has no business part, still shows under it. The part still counts in
the benefit category, so totals by category do not change, and a screen filtered to the category
counts it as owner pay. With `owner_pay_module` off nothing about shares shows and every figure is as booked.
While rows hold a share and no single owner-pay category carries the role, every share counts as 0
and Settings, General says why.

### Settings keys

A blank value means the default. An unknown key is kept and reported, and "Remove the key" beside it
on Settings, General takes its row off the tab. A key on two rows has no Remove there, since a write
refuses it, and the line says to keep one row in the workbook first. A value that does not hold
falls back to the default and is reported with its key, in the import summary and on Settings,
General. The
defaults are how the app behaved before settings existed, so a Sheet without a `settings` tab reads
as before.

| Key | Default | What it does |
|---|---|---|
| `template_version` | `1` | The workbook format. A newer version is reported. |
| `company_name` | blank | Shown under the app name and used in an export's file name. Blank uses the file name. |
| `currency` | `EUR` | ISO 4217 code of the ledger's money. One currency per workbook, with at most two decimals. |
| `number_locale` | `en-GB` | How amounts are written, such as `de-DE` for `1.234,56`. Dates and text stay in English. |
| `label_income` | `Income` | What the `income` bucket is called on screen. |
| `label_operating` | `Operating cost` | Same for `operating`. |
| `label_taxes` | `Taxes` | Same for `taxes`. |
| `label_owner_pay` | `Owner pay` | Same for `owner-pay`. |
| `label_financing` | `Financing` | Same for `financing`. |
| `label_neutral` | `Neutral` | Same for `neutral`. |
| `owner_pay_module` | `TRUE` | `FALSE` hides owner pay, owner earns and the Owner, Year and Salaries screens. Rows in the `owner-pay` bucket then count as operating cost, so costs and net do not change. While the tab holds no value for it, Settings, General says so and its Save writes the value shown, as for `statements_folder`. |
| `review_label` | `human` | The `flagged_by` value a person's confirmation will write. `rule` and `ai` are taken. |
| `card_settlement_ibans` | blank | Comma-separated IBANs a card purchase settles against. A row with one as its counterparty reads as a card purchase to the rules. Review's rule coverage groups such a row by the merchant after ` · ` in its counterparty, and a rule made from it tests `counterparty_contains` on that merchant, since the IBAN is the bank's. An entry that is not an IBAN is reported and the list stays blank. |
| `billing_monthly_amount` | blank | The fee invoiced for each worked month. "Fill the rest of the year" adds a row of it for every month to December. |
| `billing_monthly_item` | blank | The `item` text of the monthly fee rows on `outgoing-plan`, written as the tab writes it. Needed with the amount. |
| `billing_subscription_amount` | blank | Subscriptions re-billed every month, filled in the same way. |
| `billing_subscription_item` | blank | The `item` text of the subscription rows. Needed with the amount. |
| `billing_bonus_amount` | blank | The bonus agreed for a whole year, shown for reference and never filled in. |
| `billing_bonus_item` | blank | The `item` text of the bonus rows. Needed with the amount. |
| `billing_client` | blank | The client the filled rows are for, by its name on the `clients` tab. |
| `invoice_company_name`, `invoice_address`, `invoice_vat_id`, `invoice_iban`, `invoice_place`, `invoice_signatory` | blank | What an invoice prints about your company: the name, street and town, VAT ID, the IBAN the client pays into, the town it is issued in and who prepares and signs it. Making an invoice needs all six. An IBAN that is not valid is reported. |
| `invoice_country`, `invoice_phone`, `invoice_mail`, `invoice_swift`, `invoice_bank`, `invoice_court_register`, `invoice_share_capital`, `invoice_issue_time`, `invoice_signatory_title` | blank | The rest of the invoice's details, each left off while blank. The bank, court register number and share capital go in the footer, the share capital as printed, such as `EUR 2,500.00 (fully paid-up)`. |
| `invoice_number_pattern` | `{n}-1-{yy}` | How a new invoice is numbered. `{n}` is the sequence, which restarts each year, and `{yy}` or `{yyyy}` the year. A pattern without `{n}` once is reported. |
| `invoice_folder_id` | blank | The Drive folder invoices are filed under. "Make invoice" asks for it in the Picker the first time and writes it here. |
| `invoice_file_path` | `{yyyy}/{yyyy}-{mm}/{yyyy}-{mm}-{client}-invoice.pdf` | Where under that folder each invoice is filed, with `{yyyy}`, `{yy}`, `{mm}` from the issue date, `{client}` and `{number}`. It must end in `.pdf`. |
| `invoice_mail_subject`, `invoice_mail_body` | `Invoice {number}, {month}` and a short note signed `{signatory}` | The invoice mail, with `{month}` (the issue month in the client's `mail_language`), `{number}`, `{client}`, `{company}` and `{signatory}`. |
| `invoice_reverse_charge_note` | the Croatian VAT law's Article 17 note | Printed under the totals, after an asterisk. |
| `statements_folder` | `work/dss/business-bank-account/erste/statements` | The Google Drive folder the bank's camt statements are filed in, as a path from My Drive, with a folder for each year inside. The app reads it and never makes or changes a folder there. A path where a folder is missing, or where two folders share a name, is reported. The statement fetch in the Sheet reads the row too and stops without it, so while the tab names no folder for the key, with no row, a blank one or one such as `/`, Settings, General says so and its Save writes the path shown, the default included. |
| `statements_sync` | `TRUE` | Whether each sync files the new statements of `statements_folder`. `FALSE` leaves statements to Import. Settings, General has it as a switch beside the folder. |
| `hr_company_registered` | blank | The day the company was registered, as a date cell or text such as `2025-05-12`. It starts the first tax period. |
| `hr_cit_return` | `pd` | `pd` for the corporate tax return on the accrual profit, `pd-nn` for the one on cash. |
| `hr_vat_principle` | `invoice` | `invoice` when VAT falls due on the invoice date, `cash` when it falls due on payment. |
| `hr_depreciation_doubled` | `FALSE` | Whether the accountant doubles depreciation rates by default. An asset's `doubled` still applies to it. |
| `hr_owner_loan_interest` | `0%` | The yearly interest rate the owner's loans from the company carry, as a percentage cell such as `2%`, or text such as `2%` or `0.02`. A number above 1, such as `2`, is refused, since it reads as 200%. Below the income tax law's rate the difference is a benefit in kind, as *Taxes and Owner* describes. |
| `hr_vat_returns_folder` | `work/dss/dss-finance/vat-returns` | The Google Drive folder the accountant's VAT returns are filed in, as a path from My Drive, which Year, Taxes reads as *Year screen* describes. A path where a folder is missing, or where two folders share a name, is reported there. |
| `hr_payroll_folder` | `work/dss/dss-finance/payroll` | The same for the accountant's salary workbooks, with a folder for each year and month inside. While the tab holds no value for either folder, Settings, General says so and its Save writes the path shown, so a later default cannot change them. |
| `hr_accountant_sync` | `TRUE` | Whether each sync reads the two folders for Year, Taxes. `FALSE` keeps the last read on this device. The facts card has it as a switch above the folders. |
| `import_profile_<name>` | none | How one bank's spreadsheet export imports, as `word=column` pairs split by `; `, as *Import* describes. One key per profile, which Import saves and deletes. A profile that cannot be read is reported and not offered, and "Remove the key" beside it on Settings, General takes its row off the tab. |

The `hr_` keys are the company's own facts for the Croatian d.o.o. pack, with where its accountant
files the returns, which the pack reads and checks itself, as *Core and the pack* describes.
Nothing outside the app reads the two folder keys, so a save writes them only once they change. Settings, General shows them while
`owner_pay_module` is on. They belong in the workbook and never in the app. The owner's facts for the payroll, where he lives,
pillar II, dependants and the year of birth, are the director's row on the `employees` tab.

Bucket labels must differ from each other and from the names of the derived lines (Net, All costs,
Owner earns, Kept). The theme is a choice of this device on Settings, This device, not a workbook setting:
System, the default, follows the device's own setting, also when it changes while the app is open.
Light or Dark is remembered on this device, and System forgets it.

## Taxes and Owner

Owner and the Year screen's Taxes tab serve a Croatian d.o.o., shown while `owner_pay_module` is on. They pick categories by
the `roles` column, never by name:

| Role | What it selects |
|---|---|
| `revenue` | Client revenue, the base of the effective tax rate |
| `owner-benefit` | The owner-pay category an owner share is for, as *Owner share* describes. Core reads it |
| `owner-loan-out`, `owner-loan-repaid` | Loans to the owner and their repayments |
| `owner-pay-tax` | Taxes owed because the owner was paid, added to the owner's gross cost |
| `watched` | In the taxes bucket, a tax with a monthly payment calendar |
| `reimbursement` | Reimbursements between owner and company, listed beside owner pay. A payment to the owner on one repays the owner's advances. A payment from the owner on one repays a private cost the company paid for the owner |
| `client-refund` | Money paid back to a client, such as an overpayment, on Invoicing |
| `arrears` | Paid in the month after the work, such as salary, its taxes and rent |
| `salary` | An employee's net salary, with the tax-free payments of the payslip paid in the same row, as *Salaries screen* reads it |
| `tax-free:<payment>` | A tax-free payment to an employee paid in a row of its own, such as `tax-free:results-bonus` or `tax-free:occasional-gift`, one role for each payment the ruleset's `hr.pit.nontaxable-caps` lists |
| `representation` | Representation, such as a client lunch |
| `personal-transport` | Personal transport costs |
| `capital-purchase` | Purchases kept as assets on the `assets` tab |
| `grant` | Grant receipts, whose terms are on the `grants` tab |
| `profit-distribution` | Dividends and the dividend tax |
| `corporate-income-tax` | Corporate income tax, the annual balance and the monthly advances alike |
| `vat-settlement` | VAT paid to the state or refunded by it |
| `prepaid-annual` | Paid once for a year ahead, such as an annual insurance policy |
| `non-deductible` | Costs the corporate tax never allows, such as fines or private costs |

The Assets tab of Year reads `capital-purchase` and `grant`. The accrual engine reads every role from
`arrears` down, as *Accrual year* describes, and the Year screen shows its figures.

The effective tax rate is the taxes bucket, paid less refunded, over client revenue. A tax refund
belongs in the taxes bucket. Whether loans count as owner pay is the bucket of the two loan
categories on the `categories` tab, which "Loans to the owner count as owner pay" on Settings,
General switches between `owner-pay` and `financing`. The loan book holds everything the owner owes
the company: loans and private costs on an `owner-loan-out` category, the owner's part of a split
company payment among them. Credits on an `owner-loan-repaid` category repay them, and so does a
payment from the owner on a `reimbursement` category, less what the company sent back the same day.
Each repayment first closes the fewest loans lent by its day that it equals exactly. The repayments
left then go to the oldest open loan first, and one that outruns a loan carries on to the next, so
none of them takes a loan that a later repayment equals. The loan balance is lent less repaid over
the whole ledger, signed. A screen says which role no category carries, and what it leaves out
because of that.

Costs the owner paid privately go on the `owner-advances` tab, from an opened file or from "Add advance"
on Owner. The pencil beside each one on Owner opens it to change or delete it, by its id. Each counts as a cost on its date and in its category on every profit and loss figure:
bucket totals, the monthly series, the window averages and runway, category totals, period review,
tax by type, the effective tax rate and the payroll cadence. Transactions lists each one as an
"Owner advance" row with no bank account, the owner as counterparty, and its category and amount as
a cost, so every drill from a figure that counts an advance shows it. They are not bank rows, so
balances, payees and Review leave them out. An account, counterparty or review filter leaves
them out too, since an advance has no bank account, no ledger counterparty and nothing to review.
Transactions then says how many advances in the period it does not list. "Every owner advance", a
choice among the categories in Add filter, selects all of them and no bank row. Payments to the
owner on a `reimbursement` category repay them and stay financing. Each one first repays the fewest
costs paid by its day that it equals exactly, and the ones left then repay the oldest first. A
payment to the owner on a day
the owner also paid the company on a `reimbursement` category returns that payment first, as when
the owner paid a private share back twice and the company sent the extra back. Only the rest of it
repays costs, and Reimbursed counts only that rest.

What a payment to the owner repays beyond every cost on the tab is a reimbursement with no cost on
file. Net owed counts it as money paid to the owner, which it is until its cost is added. Review
lists each one with its drill, the Net owed tile's build-up names their total, and Owner and
Overview's "Waiting for you" say how many wait on Review. "Add the cost" there opens Add advance on
the amount left unaccounted, the day before the payment and the payment's description.

The owner's private share of a payment the company made is a part of that payment on the `splits`
tab, in a category with the `owner-loan-out` role, as *Split rows* describes. The loan book counts it
as lent to the owner until a payment from the owner on a `reimbursement` category repays it, and
Owner lists it among the loans with the payment it is a part of.

Net owed, on Owner, is one signed balance on a day, as Who owes whom below describes. The owner owes the company the loan balance,
private costs and the owner's parts of split payments included. The company owes the owner the costs
the owner paid, less what it reimbursed. Positive means the owner owes the company. A private cost
the company paid in full counts as lent only when its row is in a category with the `owner-loan-out`
role. Filed as an ordinary cost with no part split off, it counts in costs and not in net owed.

**Owner** has Add advance and Compare pay mixes, which opens Year, Pay for the year after the newest booking, in its header, and two
tabs under one filter bar, as Analysis has, so both tabs read the same period. On a phone its Filters
button ends the tab row as an icon with its count. Taken, the default, follows every filter: the owner take, the gross cost of the owner, the
owner's net share of that cost and the monthly net pay, "Owner take by type" as a ring with the loan
balance beside it, and owner pay by month with the loans and their repayments as one "Loans, net"
band. The net share is the owner take without loans over itself plus the taxes owed because the
owner was paid, so 60,000 on 100,000 reads 60%. A loan is neither pay nor a cost, so it stays out of
both, and the gross cost it divides by can be lower than the gross cost tile when loans count as
owner pay. The monthly net pay is the owner take without loans over the months of the period: every
owner pay category, benefits from company costs included, and no loan. A month the ledger covers
only in part, such as the month so far or the ledger's first, counts as a whole month, as it does in
owner pay by month. Rolling periods hold complete months only. `ownerCost` in
`src/packs/hr-doo/domain/ownerCost.ts` and `netPayPerMonth` in `ownerTake.ts` work them out.
The ring holds each owner pay category paid out on balance, in the colour its band has in the
chart. Loans can be negative, so "Loans, net" sits under the ring with any category that took back
more than it paid, and the ring and those lines add up to the Owner take tile. `ownerTakeRing` in
`packCharts.ts` builds it. Beside the ring, while a category carries the `owner-loan-out` role, a
bar for each month of the period gives what the owner owed the company at its end, over every loan
row since the ledger began, from the same loan book as Who owes whom. A bar opens those rows up to
that month's end. Reimbursements stay outside the take and are named under it. The
owner's parts of shared costs count in the take, untaxed, as *Owner share* describes, while Who
owes whom reads the advances as booked. Who owes whom, at `?tab=owed`, follows the period only,
since a balance of one account or category is no debt anyone owes, and a line says so while other
filters are set. It reads the books as they stood on the period's last day, or on the newest booking
when the period runs past it, a cost the owner paid after the last bank row included, so last 12 months stand on the last day of the last complete month and
all time on the newest booking. `owedInPeriod` in `src/packs/hr-doo/domain/owedInPeriod.ts` cuts the
rows and advances at that day and runs the same matching, so a repayment after it is not known and a
loan can read open there though the whole ledger shows it repaid. The tab holds the Net owed tile,
which names the day, a line saying how many reimbursements with no cost on file wait on Review
whatever the period, every loan that had a balance in the period with the repayments that closed it
by that day, and every cost the owner paid privately that was owed in it, ten at a time. Each card
heads its list with what was owed at the start, what was lent or paid by the owner in the period,
what came back in it, and what was owed at the end, which add up. Last are the loans by month,
collapsed: lent and repaid bars over the period's months, whose month-end balance is beside the ring
on Taken. A new or changed advance dated outside the period says so in its toast, since the page does
not list it, and the toast's Open it opens it on Transactions. Add advance starts on the newest booking whatever the period.

While a category carries the `owner-benefit` role, Taken has one more tile and a card for those
parts, both named after that category, such as "Benefits from company costs". The tile gives their
total with the number of payments and opens the category on Transactions, and the Owner take tile
says how much of the take they are. The card is a ring of the parts by the category each comes
from, in that category's chart colour, with the share its rows were counted at, or "mixed" when
they differ. Each opens the benefit category, which holds the owner's parts and none of the
business parts, and there each part names the category it comes from. Beside the ring, "Tax avoided against a dividend" opens
its build-up: the corporate tax the same money would have paid at the rate Year works out for the
year it was paid in, on the rows as booked, then the dividend tax on what is left at the
`hr.pit.dividend` rate of the year after. "As a dividend you would net" is what is left of it. A
period across years sums each year at its own rates. Without `hr_company_registered` the card says
the comparison needs it, since the forecast that sets the rate counts from that day. A line says the
share is your estimate, which the accountant books in full, and "Set the defaults" opens Settings,
Categories. `ownerBenefits` and `dividendComparison` in `src/packs/hr-doo/domain/ownerBenefits.ts`
work the figures out. `dividendRoute` in `src/packs/hr-doo/domain/dividend/` gives the dividend
steps, which the next 100.00 of *Pay scenarios* uses too.

A loan from the company to the owner, who is its employee, gives a benefit in kind when it carries
less than the yearly rate the income tax law sets: 2% under Art. 21(3) of the Zakon o porezu na
dohodak, the ruleset's `hr.pit.loan-benefit`. The benefit is the difference between that rate and
the rate the loans carry, `hr_owner_loan_interest` (0% by default), on each day's balance of each
loan, from the day after it was lent to the day it was repaid, a day being a 365th of the year, or a
366th in a leap year. Each loan is rounded to the cent and the year adds them up. The law reaches a
loan from the employer to the employee, so the benefit reads the loan book, what the owner owes the
company, and never the costs the owner paid for the company. Year, Accountant shows a year's figure
as an open item, a year still open up to the newest booking, with its build-up: one line per loan
with its days owed and its rows, and the rule. It reads as settled when the loans carry at least the
law's rate.
Whether the benefit is grossed up through payroll is unconfirmed, as the rule's note says. The same
rate the loans carry comes off the related-party rate of `hr.cit.related-party-rate`, the corporate
tax adjustment that reaches a resident owner only while the company has a tax loss, and off the
yearly benefit Dividend capacity shows on what stays owed.

## Split rows

A bank row that paid for more than one thing, such as an order with a private item in it or a
salary paid with a bonus, is split on the `splits` tab. The ledger keeps the row as the bank booked
it, so the Apps Script, the balance chain and the append-only rule do not change. Each tab row is
one part: the ledger row's `date`, `account`, `row_amount` and `row_balance`, then the part's
`amount`, `category`, `note` and `owner_share`. The four key cells find exactly one ledger row, since the balance
chain makes them unique. Copy the balance from the ledger row when typing a split in a file.

The reader checks each split and refuses it whole, every one of its tab rows reported, when one of
these holds, each part named by its category, amount and day. The bank row then counts whole.

| Guard | Refused when |
|---|---|
| One row | the key finds no ledger row, or more than one |
| Readable | a row of the split cannot be read, such as an amount typed as text |
| Two parts | the split has fewer than two parts |
| Same sign | a part is zero, or has the other sign to its row |
| Adds up | the parts do not add up to the row |
| Known category | a part's category is blank or not on the `categories` tab |
| No asset | an asset on the `assets` tab claims the row as its payment, as the register of *Assets* matches it |

The No asset guard comes from the pack, which keeps those ledger rows whole whatever `owner_pay_module` says.
The figure screens count a split row through its parts. `presentedWorkbook` in
`src/features/transactions/application/` puts each part in the row's place, next to the
owner-pay presentation of the settings: a part keeps the row's day, account, balance, booking order
and text, and takes its own amount, category, family and bucket. So every profit and loss figure,
the owner figures, the taxes, the accrual view, the year end and the forecast count the parts, and
balances and cash on hand stay as they were. A part takes its own category's timing and bucket,
never the row's, so a category with the `arrears` role moves its part to the month before it was
paid. The review queue, rule coverage and the rules, the billing plan, the writes and the import
summary keep the rows as read, since a person reviews and a rule files the row the bank booked.
Settings, General lists the reader's problems with the splits the figures leave out.

Transactions lists a split row as the bank row, badged with its number of parts, with the parts
under it, larger first, each one a row of its own that filters and drills like any other. A filter that keeps one
part still shows the bank row above it. The CSV export writes the parts, each with its note and
`splits` as its tab, and an `owner_share` column with the share of the row, part or advance, which
both parts of a shared row carry. "Split" on a bank row opens the editor: parts with an amount, a category and a
note, at least two, typed without a sign since each takes the row's, with what is left to place shown
as the amounts change. The arrow beside an amount puts the rest of the payment into that part. The
editor says so up front when an asset claims the row, and saves nothing. The pencil on a split row
opens the same editor to change, add or remove parts or delete the split. "Split" on a part of a
shared row splits the payment it comes from. Each save is one write
through the record path with Undo in the toast, in both homes.

## Assets

The Assets tab of the Year screen, over the `assets` and `grants` tabs, which "Asset rows" and
"Grant rows" at its foot edit as *Settings screen* describes for a tab. `#asset-rows` and `#grant-rows`
open them. The register lists each asset with its yearly rate from `hr.cit.depreciation-rates`, the
charge of the year picked, the depreciation so far and the book value today. An asset's name opens the ledger debit
that paid for it: its `ledger_reference` found in a row's reference or description, or else a debit
on a `capital-purchase` category of its net cost, with or without VAT at the standard rate. Assets
with no payment, and capital purchases on no asset row, are listed under the register. So is a
payment found by a `ledger_reference` that is not what the assets claiming it cost together, with or
without VAT at the standard rate. The ruleset has no VAT rate before its first day, so a debit
dated earlier is never claimed. The asset that would claim it gets a problem naming the day, and
the read goes on. An item at or below `hr.cit.asset-threshold` is small inventory,
written off when put in use. A split of a payment an asset claims is refused, so the register
always matches whole bank rows.

Depreciation is straight-line from the month after an asset is put in use, each year rounded to the
cent. "Book value over time", collapsed, draws each asset's book value by month until it reaches
zero, and "Depreciation per year", collapsed, gives every year with each asset's charge behind it.
"The grant beside it", under the register, shows for each grant what it
releases per year, what stays deferred, the day its employment condition ends, and what the
clawback terms would take back if employment ended today. Book values, what stays deferred and the
clawback are as of today in every year. The depreciation tile and the register's charge follow the year. When the `year-end` tab has the
accountant's `grant` lines for a year, the residual against them is shown.

"Show doubled rates" puts `rates=doubled` in the address and recomputes the tab at twice the
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

The bridge starts from net as the screens count it, the bank rows, a split row through its parts,
and the owner's advances of the year. Each step is one adjustment:

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
owes on loans and advances (net owed at the year end), the VAT position, cash, costs
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
  revenue, the `outgoing-plan` rows still to invoice in the month. For the owner pay, the plan's
  scenarios.
- `paid-ahead`: a month that a `prepaid-annual` cost already paid covers.
- `averaged`: the line's average over its last twelve actual months, or fewer for a younger
  ledger, never counting its first part month. A cost on an `arrears` category, such as pay and
  rent, carries its last actual month forward instead, since pay changes by steps.
- `scheduled`: depreciation, small inventory, disposals and the grant release, which the asset
  and grant engines give for the whole year, assets bought in it included.

Revenue is the invoices by delivery period. A complete month after the last month any invoice
delivers in is forecast like a later month, so work not yet invoiced does not read as nothing. A
forecast month takes the `expectedInvoices` dated in it, matched against the invoices that deliver
by the last actual month only. So a month invoiced before the ledger closes it still reads its rows
in full, and a row left open in an actual month is not carried forward. A month with no row still
to invoice takes the average. A `plan` row on a revenue category is listed as not counted. A
cost paid in arrears forecasts the last complete month until its payment is in the ledger. A row
on a category taken out of profit is listed as not counted, and so is a row the plan guards stop.

The plan's other rows count in months the ledger has not reached:

- Owner pay: the year's `owner_pay_scenario` rows make one scenario, the first one's components
  until the day before the second's `date` and the second's from it (`switchedScenario`), without
  the dividend. Its months run through `scenarioPay`, the same payroll, tax-free items and rent
  that Pay scenarios works out, so the year is computed one way. The salary with health on top and
  the tax-free items count as personnel costs, and the rent as material costs. They take the place
  of the categories in the `owner-pay` bucket and the taxes with the `owner-pay-tax` role from the
  month after the earliest of those categories' last actual months, and are paid in arrears when
  those categories are. The payroll runs on the director's row of the `employees` tab. Without one
  that names a city it has no tax rates, so the rows are listed as not counted and the categories
  carry on. A grant whose employment condition ends in the
  year says whether the planned pay keeps a salary until then.
- Purchases become asset rows bought and put in use on their day, so the asset engine depreciates
  one above the threshold from the month after and writes one at or below it off in its month.
  Their net cost leaves the cash in that month.
- The dividend leaves the cash in its month: its tax, and the net less what the owner owes the
  company on the day of the forecast, which it settles first. It counts as paid out in the year for
  dividend capacity, and what it settles lowers what the owner owes there.

`planGuards` checks the rows across each year after the reader has checked each one on its own:

| Guard | Refused when |
|---|---|
| One switch | more than one dated `owner_pay_scenario` row in a year |
| A start | a dated row with no undated row for the days before it |
| Not on 1 January | a switch on 1 January, which leaves the first scenario no day |
| Same year | a row naming a scenario of another year |
| Works out | the switched owner pay fails the scenario guards of *Pay scenarios*, such as two salaries in the switch month |
| One dividend | more than one `dividend` row in a year |

`planDefaults` gives the editor's starting figure for each category: what a month with no plan row
takes, from the same lines the forecast builds. It needs no tax facts, so the editor works before
`hr_company_registered` is set. A category whose average runs against its bucket, such as refunds on a taxes
category, is left out, since a plan row reads income and costs both positive and would turn it
around.

Each month the ledger settles keeps what the plan had for it. `planAgainstActual` sets revenue
against the `outgoing-plan` rows dated in the month, each category against its `plan` row, and the
owner pay categories together against the plan's scenario, with the difference per month and per
line, income and costs both read positive.

The PD build-up runs through `taxBase` and `citLiability`. Line 56 is the advances `matchCitPayments`
finds paid plus those still to come in the year. The forecast gives the balance due on the filing
deadline and the year after's schedule, with the new monthly advance from April. A year before the
forecast year needs its return from the `year-end` tab, or else from its own forecast on the same
day, so the forecast needs `hr_company_registered`. December's revenue is a receivable at the year
end and December's arrears are paid in January.

Cash is projected month by month. A month the ledger has passed reads its bank balances. The rest
start from cash on the newest booking, or for a year the ledger has not reached from the year
before's projection with what that year received and paid after its end. Revenue of a forecast
month comes in when the client pays: the median days from issue to payment on Invoicing, counted
from the end of the month delivered, or the day after it when no invoice is paid yet. Open invoices
come in that many days after their issue, never before the day after the forecast. Costs are paid
in their month, costs on `arrears` categories in the month after, the VAT position on the forecast
day the month after, planned purchases and the dividend in their month, and the corporate tax by
its due day, an overdue one in the running month. Cash at the year end is December's. Runway is
that cash over the average monthly cost of October to December, as Overview counts it over its
last three months: owner pay and the corporate tax falling due are in it, and depreciation and
disposals, which pay nothing, are not.

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

## Pay scenarios

`payScenarios(workbook, year, asOf, rules)` in `src/packs/hr-doo/domain/scenarios/` works out every
scenario of a year from the `scenarios` tab on the same company figures, with
`scenarioOutcome(scenario, company, facts, rules)` for each one.

The company figures come from the forecast seen on `asOf`. The forecast reaches the year after the
newest booking, as the Year page does, so a scenario for that year takes the forecast of its
own year, plan included, and one for a later year takes the year after the newest booking's
figures and applies the rules of its own year. The owner pay the forecast counts, the `owner-pay` bucket and the taxes with
the `owner-pay-tax` role, is taken back out of profit, cash and the PD build-up, so each scenario
sets its own. Cash starts from cash at the year end with December settled, before the owner pay
and the year's corporate tax. The owner's own facts are the director's row on the `employees` tab:
city, birth year, pillar II and dependants. Without that row, or with a blank city, `payScenarios`
throws a RangeError.

A scenario is laid out over its year. A day a `salary_gross` row covers is a day as an employee of
the company. A day without one is a day insured elsewhere when a `director_basis` row says
`insured-elsewhere`, and otherwise a day as a board member on own contributions, since the law
insures a director that way when nothing else does. Then:

- Each month with salary runs through `payrollMonth`, paid on the last day of the month worked. A
  part month is prorated by working days. A salary below the director floor is paid at the floor.
- Tax-free items are checked against their yearly caps with `nontaxableUsage`. The part over a cap is
  taxed as salary in the month it is paid.
- As a board member only, the owner pays pension and health on the board member base himself. It is
  not a company cost. A part month is prorated by calendar days, which is an assumption. Insured
  elsewhere, the yearly difference to the director floor is taken as nothing.
- `annualSettlement` recomputes the year's income tax with the youth relief. Months whose
  allowance another employer uses are left out of it.
- Rent is taxed at 12% of 70% of it, which the owner pays.
- The corporate tax runs through `taxBase` and `citLiability` twice, with the salary, tax-free
  items and rent deducted and without them.
- A `dividend` of `max` pays out the year's profit after tax as far as the distributable amount and
  the share capital allow, and leaves earlier years' retained earnings alone. Its tax is withheld,
  and the net settles what the owner owes the company first.

The outcome sets out net to the owner, total cost to the company, taxes and contributions by type,
pillar II as the owner's savings and pillar I as pension rights, what the company keeps, net to the
owner of each 100.00 of profit before owner pay, and cash after the year. Net to the owner, pillar
II, the state and what is kept always add up to the profit before owner pay. Every figure is a
traced figure with its steps and rules. `marginalEuro` recomputes the owner-pay lane's table of the
next 100.00 of company money for the year: a tax-free item, rent, a dividend, and salary at the
lower rate, with the youth relief when the birth year has one, and at the higher rate.

Warnings: a salary below the director floor, a tax-free item over its cap, no salary on a day before
a grant's `employment_required_until` with what its clawback terms put at risk then, a dividend
above what the year can pay out, net assets below the share capital after the payout, and cash that
does not cover the year. Notes say what the figures rest on: a real basis for each tax-free item,
real business space for rent, and the board member and insured elsewhere assumptions.

`scenarioGuards` stops a scenario that cannot be worked out, and the screen lists why instead of
its figures. Each guard names the rows:

| Guard | Refused when |
|---|---|
| One a day | two `salary_gross`, `director_basis` or `rent_monthly` rows hold on the same day |
| Salary by month | two salary rows pay a salary in the same month, since a salary changes only from the first of a month |
| One dividend | more than one `dividend` row |
| Basis and salary | `board-only` or `insured-elsewhere` on a day with a salary, or `employee` on a day without one |
| Yearly cap | a tax-free item the ruleset does not list for the year, or one without a yearly cap, such as one capped by the day, the month or the kilometre, or tax free at actual cost |
| Employee only | a tax-free item paid in a month with no salary |

`startingScenarios(year, grants, rent, rules)` gives the four to start from: the floor salary all
year, the same with a results bonus, an occasional gift and a flat meal allowance at their caps
from the ruleset and the owner's rent, and the floor salary until the day after the grants'
employment date, then board-only insurance or a job elsewhere. Each pays out the rest as a
dividend, and the first is the base the others are compared with. When no day of the year is free
of the employment condition, the last two are left out.

## Year screen

A pack screen at `#/year`, shown while `owner_pay_module` is on. The year picker in its header holds
every year the `year-end` tab has lines for, the year before the newest booking's while the ledger
reaches into it, the newest booking's year and the one after, as `year=` in the address. Without
`year=` it opens the newest booking's year. A year is seen one of three ways:

| Year | Tabs |
|---|---|
| Closed, with the accountant's lines on the `year-end` tab | Accountant, Statements, Taxes and Assets |
| Ended, without the accountant's lines yet, such as last year from January to April | Forecast, Statements, Taxes and Assets |
| Open, the newest booking's year and the one after | Forecast, Plan, Pay, Taxes and Assets |

An ended year's forecast has every month from the ledger, and its Statements tab holds only the
accountant's lines, open, where the first ones go. A link to a tab its year lacks, such as
`#/year?tab=accountant`, opens the latest year that has the tab, and picking a year that lacks the
open tab opens its first one. Another year leaves out `compare=` and `base=`, since its scenarios
are its own. The planning notice, the rules the forecast and the scenarios rest on that the ruleset
only estimates for the year, the roles no category carries, a missing `vat` treatment and, for a
closed year, a blank `hr_company_registered` are said once, under the header.

**Accountant** opens on "Lines at a glance", a ring of the year's accountant lines by status, each
status opening the Statements tab. A line is `matched` when ours agrees with no adjustment between
the accrual and the cash view, `explained` when it agrees once the adjustments are made, `judgement`
when it agrees because it takes the accountant's figure for a choice the ledger cannot show, and
`open` otherwise. A waterfall leads from the cash net to profit before and after tax, one bar per
adjustment, with what nothing explains last. Open items list the accountant's choices, any gap to
the accountant's profit, months no invoice delivers in, purchases with no asset row, and what loans
to the owner and early asset purchases call for, each with what would settle it. The loans' benefit
in kind opens its build-up, as *Taxes and Owner* describes. "The bridge, step by step", collapsed,
is the waterfall as a list with the rules behind each step.

**Statements** sets the accountant's profit and loss, balance sheet and PD lines beside ours on the
accrual view and on the cash view, the last two collapsed. The cash view puts each booking of the
year on the line its category counts on, so its profit and loss lines add up to the cash net, and
its balance sheet holds only cash. Each line opens on how ours is built, every step drilling to its
rows, with the rules behind it. The tax payment date is checked against a ledger payment of our
balance due, and the distribution decision against our profit after tax. "Konto lines", collapsed,
compares the konto lines that share a category as one group beside our figure for those
categories, with the small inventory their payments bought and the year wrote off beside each one.
"The accountant's lines", collapsed, edits the `year-end` tab, every year of it, a new line
starting in the year picked. `#accountant-lines` opens it.

**Forecast** is the year as `forecastYear` sees it on the newest booking, and needs
`hr_company_registered`. Lines above the tiles say whether the planned owner pay keeps a salary
until a grant's employment condition ends, which months no invoice delivers in, and how many of the
year's billing plan rows are not invoiced yet, with a link to Invoicing, Plan. Four tiles give profit
before and after tax, the corporate tax and cash at the year end. A bar chart gives income, costs
and profit before tax by month, with planned or averaged bars hatched and the running month shaded.
The profit and loss and the PD return, both collapsed, are lists whose lines open on their parts,
the months a plan row, the billing plan or an average stands in for, their rows and their rules.
"Cash by month", collapsed, lists each month end with its build-up behind it, and the runway above
them. "Plan against actual", collapsed, sets plan, actual and the difference per line, each opening
on its months. The corporate tax payments are on the Taxes tab, and what the grants release in the
year on the Assets tab.

**Plan** is the plan editor for the year, with or without the figures. It writes the `plan` tab in
both modes through the record path, each change one write with Undo in the toast:

- Owner pay: a scenario of the year from 1 January, and optionally another from a day, which
  starts on the day after the grants stop requiring the employment. "Stop planning it" deletes the
  rows. Without a scenario for the year it links to the Pay tab.
- Costs and other income: each category with an average or a plan row, with what it takes now. A
  dialog sets an amount for every month, which starts at the default, and any month of its own.
  The save adds, changes and deletes rows so the tab holds what the dialog shows, and "Clear the
  plan" deletes them. The owner pay categories are set by the scenario while one is planned.
- Purchases: what it is, the day, the net cost and the depreciation group, added, edited and
  deleted.
- Dividend: the amount before tax and the month.

A row the forecast does not count shows why under it. Revenue is planned on the Plan tab of Invoicing, which the editor links to for the same year, and
whose "Fill 2027" writes a later year's fees.

**Pay** compares the year's owner pay scenarios, as *Pay scenarios* works them out, and needs
`hr_company_registered` and the director's row on the `employees` tab with a city for the figures,
and links to Settings or to Salaries for whichever is missing. The scenarios can be edited
without them. Two to four scenarios are compared, picked with `compare=` in the address, with
`base=` the one the others are compared against, by default the starting floor salary scenario.
"What the scenarios start from" opens the company figures, each on its build-up. Dividend capacity
follows, switching between the three payout options with `payout=interim` or `payout=keep` in the
address, and warning when the cash on the newest booking does not cover the interim payout. One
100% bar per scenario splits the profit before owner pay into net to the owner, pillar II, each tax
and contribution, and what the company keeps, and under the bars each scenario has a badge with its
warnings, or its notes when it has no warning, which opens them. "Side by side", collapsed, sets the
lines of each scenario beside the base's with the difference to it, and ticks the best value of a
line with a better direction. Below the lg breakpoint it shows the base and one other scenario,
picked above the table. "The next 100.00 of company money", collapsed, gives the routes, and every
figure opens its build-up and rules. "Scenarios for 2027", collapsed unless the year has none, lists
the year's scenarios as their rows. A component is added, edited or deleted in a dialog, a scenario
is renamed or copied with all its rows, and "Add the starting scenarios" writes the four for the
year, asking for the owner's rent. Every change is one write with Undo in the toast, in both modes.

**Taxes** holds the year's taxes paid and effective tax rate, then "Corporate income tax, expected
against paid", the payroll cadence, collapsed, for a Google Sheet "VAT returns" and "Payroll from the
accountant", then "Tax by type" as a ring and "Tax by type, by month", collapsed. The corporate tax lists every payment the schedule expects from the first tax period on,
seen on the newest booking, as *Forecast* describes, with overdue payments and payments no
obligation takes called out above them. The payroll cadence gives every watched tax month by month
since its first payment. Both span every year, open themselves when a payment is overdue or a month
was missed, and are `#corporate-tax` and `#payroll-cadence`. The ring holds each tax category that
paid out more than it took back in the year, in the colour its band has in the chart, and a refund
sits under it, so with the ring it makes the taxes paid. The year's figures count every bank row and
advance, whatever the filters of other screens say.

The two accountant cards read the workbooks the accountant mails, which the mail scripts file in
Drive: the `YYYY-MM-pdv` VAT returns of `hr_vat_returns_folder` and the `YYYY-MM-salary` workbooks
anywhere under `hr_payroll_folder`, an xlsx downloaded as filed and a Google Sheet exported as xlsx.
The pack's readers in `src/packs/hr-doo/domain/accountant/` read them, as *Accountant parity*
describes, and nothing is written to the books or to Drive. A period with an xlsx and a Google Sheet
reads the xlsx, and the two must read the same. The VAT card follows the year by the return's month,
newest first, from the first return filed to the last: each return with what it states and its
badges, "No return filed" for a month between them without one. "Carry" sets the return's carry
forward against our VAT position to the month's end, less the refund the return claims, and "Sales"
each sales line against the invoice of its number, delivered in the month. A return that claims a
refund says how much and the day the bank received it, or that it has not been received yet. Our
VAT position stays as booked, here and everywhere else. The payroll card follows the year by the worked month: each
employee's tab of each workbook, named after the month when the year's workbooks name more than one employee, with its payout day, gross, the state's share and the employee's, each beside the bank
figure it is set against. "Bank" needs both to hold, the state's share against the owner-pay taxes
within 5 days of the payout day, dividend tax left out, and the employee's share less rent and
refunds against one owner pay row of that week. "Rules" runs every line through the payroll engine,
and when it differs, the lines the ruleset works out otherwise are listed under the row. A part month
at the director floor takes its days worked from the employment dates of the director's row on the
`employees` tab, the weekdays from `from` to `to` within the month, public holidays included. Without
that row, or for a part month above the floor, it shows "Part month" with why. The payslips are the
director's, so the dependants come from that row too. A differing Carry or Bank badge, and
each bank figure, opens Transactions on the rows it compared, and a differing Sales badge opens the
month on Invoicing, Plan. A workbook the reader refuses shows "Could not read" with its name, tab, row
and reason, and so does one Drive did not give.

The files are read by the accountant step of each sync, as *Sync* describes, never by the screen. A
read lists both folders, one level of folders at a time, and downloads only the files whose Drive
`version` changed since the last read, whose tabs it keeps. That last read stays on this device in
IndexedDB (`ledgerboard-drive-reads`, `src/shared/google/driveReads.ts`) until the next read or
sign-out, so before a sync of this page the cards show it at once with its date. A sync without the
Drive read token shows "Allow access" in the sync control, and the cards keep the read this device
kept until that tap reads Drive again. The fake build's accountant folders, at the
default paths, hold made-up returns and salaries for 2026 that show a passing, a differing and an
unread row on each card.

**Assets** is *Assets* above.

The figures are for planning with the accountant, never filing advice.

## Salaries screen

A pack screen at `#/salaries`, after Year in the menu, shown while `owner_pay_module` is on. It shows
each payday's pay split into where the money went, and sets the accountant's payslip, the app's
payroll and the bank against each other, as `salaryReconciliation` below works them out. The
`employees` tab is the card at its foot with its editor, as *Settings screen* describes for the
editors, collapsed once a payday shows, and `#employee-rows` opens it. A new row starts with pillar II
ticked. While no single row is marked director, a line at the top says what the director's row is
for, since Year, Pay and the forecast's owner pay wait for it. A workbook kept in this browser reads
no payslips, which a line says, so each of its months shows "Payslip not read".

Above the tabs sit the years with a payday, the paydays of the year picked and, from two employees,
a choice of everyone or one employee, kept in the address as `year=`, `month=` and `employee=`.
Without a month the page opens on the newest payday that is not the month still running. Every
figure is the payslip's where one was read, else the app's, else the bank's, and a tile with a bank
figure says when the bank paid otherwise, such as "Bank 0.50 less". A line no source states counts
as nothing, and what was paid then stands for the net.

- **Month**, the default: five tiles, Company cost, what was paid to the employees, Pension savings
  (pillar II), To the state (pillar I, the income tax and health) and Problems, each with a bank
  figure opening its rows. For one person, a line gives the gross, the net with how it is worked out
  and the day the bank paid. "Where the company's money goes" is a ring of the company cost in five
  parts: to the employee, pillar II, pillar I, the income tax and health. Pillar II is the employee's
  own savings, so it sits beside what they were paid and stays out of the state's share. Under the ring
  the paid part splits into the net and what was paid beside it, with the rent and refunds the
  payslips list, which are not pay. "Gross to net" is the waterfall of `bridgeChart` from Gross II down
  to the net and up to what was paid, each payee's bar opening its rows. Then the problems, each with
  how it is worked out, its rows or the employees tab, and "Payslip, app and bank", every line of each
  employee with the three sources and whether they agree, collapsed while all agree. With more than
  one employee paid, the contributions of everyone sit in their own section, since the payees' rows
  pay for all of them together.
- **Over time**: the year's paydays as bars stacked in the ring's five parts, the month still running
  hatched, a band opening its bank rows. A table under it gives each month's cost, what was paid,
  pillar II, the state's share and its problems, and a month opens on the Month tab.
- **People**, from two employees: everyone paid on the payday with their gross, net, pillar II, the
  state's share, the cost and their problems, and the total, a card each on a phone. A name opens
  that person's month.

The ring and the bars wear the `--pay-*` tokens in `tokens.css`, series slots 1 to 5 once each,
checked with the dataviz palette validator in that order and around the ring's join against both
chart surfaces. Owner, Taken and the payroll cadence on Year, Taxes link here. `SalariesScreen.vue` and
`salariesView.ts` in `src/packs/hr-doo/presentation/salaries/` are the screen and its figures, and
`readEmployees` in `src/packs/hr-doo/domain/employees/` reads the tab.

`salaryReconciliation` in `src/packs/hr-doo/domain/salaries/` sets the accountant's payslips, the
payroll engine and the bank against each other per payday month, employee and line. No source wins:
every line the sources state differently is a problem, with the figures and the bank rows behind it.
The screen shows it, and `npm run parity:accountant` prints it, as *Accountant parity* describes.

- **Payday.** A month is the month the bank paid in. A payslip belongs to the month its payout date
  falls in and to the employee its tab names by the row's `name`. A bank row belongs to the month of
  its date.
- **The employee's lines.** Gross II, health, gross I, both pension pillars, income, the personal
  allowance, taxable income, income tax, net, the tax-free payments and what the employee was paid,
  each from the payslip and from the engine. The engine runs each payslip as the payroll card's rules
  do. A month without a payslip runs each employee on the row's `agreed_gross`, a director at least
  at the floor, for the month before it, the month salaries are paid in arrears for. An employee who
  is not the director and has no `agreed_gross` is not run, which is a problem.
- **What the bank paid the employee.** Every row to one of the row's `iban` accounts with a part in a
  `salary` or `tax-free:` category, as booked before any split, against the payslip's share less rent
  and refunds. A bonus paid apart from the payslip is pay the payslip does not list, so it shows as a
  difference until the accountant lists it.
- **Contributions.** The rows of the taxes bucket with `owner-pay-tax` and without
  `profit-distribution`, split by payee: the state budget's account is pension pillar I, the pillar II
  account pillar II and the health insurance fund's account health, as the Naputak on paying budget
  revenues names them (`contributionAccounts.ts`). Any other payee, the account of the employee's
  city, is income tax. They are set against the sum of everyone paid that month. A payslip that differs
  from the engine is reported on the employee's line, so a contribution line is a problem when the bank
  says the same as neither. In a month no one was paid, any contribution row is a problem.
- **Tax-free payments paid on their own.** The rows in `tax-free:` categories, by employee and year,
  against the caps of `hr.pit.nontaxable-caps`, and a payment over its cap is a problem in the month of
  its last payment.
- **Other problems.** A payslip not read for an employee paid that month, a payslip whose tab names no
  employee, a payslip whose city or pillar II is not the row's, the engine not run with why, an
  employee with no `iban`, a complete month with no pay rows to an employee expected to be paid, and
  pay to an account no employee has.

## Billing plan

The `outgoing-plan` tab is what is to be invoiced, for any freelancer or small business. The
services in `src/features/billingPlan/domain/` read it with the `invoices` tab:

- `billingTotals`: everything planned, everything invoiced and the difference over all clients,
  with plan rows by the year of their date and invoices by the year they were issued.
- `plannedAgainstInvoiced`: each month's plan rows against what invoices billed of them. An
  invoice lists a month's items together with items left over from before, and may bill next
  month's fee ahead, so no invoice belongs to one row. Each client's invoices, in issue order, take
  the client's rows. An invoice first fills the rows dated up to the end of the month it was issued
  in: the fewest open rows it equals exactly, or else the rows oldest first, by date and then tab
  order, the way the invoice matching lets payments fill invoices, as *Invoicing screen* describes. A remainder of €1 or more is a fee billed
  ahead and reaches on to the rows of the next month in the same way.
  A smaller one is a rounding difference, such as a row whose formula reads a cent below what was
  billed, and is invoiced above the plan on that invoice, so it never part fills a later month.
  What an invoice cannot place is invoiced with no plan row and is not carried to later rows. Rows
  still open are not invoiced yet.
- `itemStatistics`: each kind of item's total, in all and by year, such as how much of the
  billing is the monthly fee, bonuses, re-billed travel, subscriptions or contractors.
- `expectedInvoices`: the rows the given invoices have not billed, by month and client, each
  expected in the month it is dated. The screen passes every invoice, and the forecast the ones it
  counts.
- `fillRestOfYear`: the rows "Fill the rest of the year" adds for `billing_client`, the monthly fee
  and the subscription on the last day of every month from this one to December, skipping a month
  that already has the item for the client. For a later year it fills January to December, which
  is how a 2027 forecast gets its revenue from the billing plan rather than the average. Each row takes the description of the client's latest
  row of the same item, with the new month put where that row names its own month, long or short
  and with the year after it, so "Fee for September" becomes "Fee for October" and a description
  that names no month is kept as it is. An item with no row yet is described by its month, such as
  "Oct 2026". The yearly bonus is never filled in. The rows stay the one source the forecast reads,
  so a filled row is adjusted on the tab.

## Invoicing screen

`#/invoicing` answers what to bill this month and who still owes the company. "Make invoice" in its
header is the one way to make an invoice, as *Invoices* describes, for the client of the next
expected invoice. Four tiles above the tabs are figures as of the newest booking, whatever a tab's
period, client or year says, and each opens the tab that holds it: the next invoice (the oldest
month with plan rows no invoice billed yet, which opens that month on Plan), what is outstanding,
what is overdue, and the median days to get paid over the invoices settled in the last 12 months.
The tabs are Invoices, Plan and Clients, as `?tab=` says.

**Invoices** holds a period bar and, with more than one client, a client picker (`client=`). "Every
invoice, with the payments that settled it" lists the invoices issued in the period and every one
still open, newest first, ten at a time, with "Record invoice". Below it are what is owed by how late
it is, "Days to get paid", collapsed, with its median and mean, and "Revenue no client accounts
for", collapsed, when there is any. With no invoices yet the tab offers to record one, or the clients
tab when no client is on it.

**Plan** shows the billing plan for one year (`year=2026`), seen on the newest booking, picked from
every year a row or an invoice falls in, the year of the newest booking and the year after. One line
gives the year's planned and invoiced amounts and what of the year's rows is not invoiced yet. "Plan
rows" lists the year's rows, newest date first and by item, amount and description within a date. "Month by month",
collapsed, calls out rows not invoiced yet and what invoices billed above the plan, and
`month=2026-10` with `#billing-month-2026-10` opens a month and scrolls to it. "By item", collapsed,
lists the year's items with their shares and then charts every year by item, each item with one
colour on every chart and list. "Totals over every client", collapsed, gives everything planned,
everything invoiced and the difference, and what was invoiced each year by issue date.

The rows of the year can be added, edited and deleted in both homes. "Fill the rest of 2026", or
"Fill 2027" on the year after, previews the rows `fillRestOfYear` would add, with each description in a field to edit, and appends
them. An edit writes only the fields that changed, and a delete takes the row out. Both find the
row by its id and refuse when no row or several rows hold it or it changed since. Undo takes an
addition back, adds a deleted row again with its id, and puts an edited row back as it was.

**Clients** holds the clients tab as an editor, as *Settings screen* describes for a tab, and "Billing and
invoice terms", collapsed, the `billing_` and `invoice_` settings with their own Save, written as the
settings are. `#invoicing-terms` opens the terms. A client's IBANs are tags: a comma, Enter or leaving
the field adds the IBAN typed, a pasted list splits at its commas, and each tag has its own remove
button. The card settlement IBANs on Settings, General are the same field, `IbanTagsField` in
`src/features/settings/presentation/`. A client on two rows shows both rows left out, with the
reason, and Save stays off while both rows are there. Typing the second row's IBANs into the first
row and deleting the second row, then one Save, merges them. That save has no Undo, since Undo
never puts back a second row of one client.

"Record invoice", and the pencil on each invoice, add, edit and delete rows of the
`invoices` tab in both modes, in the eight columns the invoice generator writes, for an invoice made
elsewhere. The number is written as text, the amount as a number and each date as a date cell. A
recorded invoice starts on the newest booking, due a month later, for the work of its month, as the
generator set them.

The invoice matching pairs the `invoices` tab with the revenue credits, client by client, the way the
Sheet's `outgoing` tab does for its one client. A credit belongs to the client whose `clients` row
lists its IBAN, and one from an IBAN no client names is listed apart and never pays anyone's
invoice. Invoices fill oldest first, by issue date and then by number. A
payment can fill only invoices already issued on its day, so a credit that arrives before its
invoice is a payment with no invoice on file, and a payment past what is owed is an overpayment on
the newest invoice it reached. Nothing owed is ever negative. Revenue and client refunds are the
categories with the `revenue` and `client-refund` roles.

Ageing counts days past the due date, or past the issue date when an invoice has none, on the day
of the newest booking. Days to get paid is the median over the invoices settled in the period,
with the mean beside it. The matching always runs over the whole ledger. The period picks which
invoices are listed (issued in it, or still open) and which payments count for days to get paid.

## Invoices

"Make invoice" in the header of Invoicing makes an invoice the way the invoice generator
did, and drafts its mail without sending it. The services are in `src/features/invoicing/`.

- **The form.** The issue date is today. The number is the next one by `invoice_number_pattern`
  among the invoices issued in that year, over every client, so `{n}-1-{yy}` after `9-1-26` gives
  `10-1-26` and the first invoice of 2027 is `1-1-27`. A number the pattern does not describe is
  passed over. The due date is a month after the issue date, on the last day of the next month
  when that month is shorter, as the generator's `addOneMonth` did. The delivery period is the
  issue month. All of them can be changed. The lines start from the client's billing plan rows still
  open up to the end of the issue month, one per row, named by the row's description. Lines can be
  edited, removed and added, and "One line for the total" makes one line named as the client's last
  invoice was. The total is the sum of the lines. "Open the PDF" shows the invoice as it stands.
- **What it needs.** The six `invoice_` settings above, the client's `address`, and
  `reverse_charge` TRUE. The app makes only invoices without VAT for a client who accounts for it,
  with the note. A domestic invoice with VAT is made elsewhere and recorded with "Record invoice".
- **The PDF** is drawn in the browser with pdf-lib, loaded only when the dialog first opens, in the
  layout of the invoice generator's template. Its font is Inter from the app's own font files: the
  Latin file, and the Latin Extended one for letters such as č, ć, ž, š and đ.
- **Check** reads the file again, so the number is checked on the register as it is now, and stops
  when a sync or a change is already running. From then on the number stays as checked. Then it
  finds each folder of `invoice_file_path` by name under the invoice folder, among what the app can
  see. With `drive.file` the app sees only folders it made or the user picked, so a folder the old
  generator made is not in view. Rather than make a second one of the same name, the app opens the
  Picker inside its parent, titled with the folder to pick, and asks for the folders beside it too,
  so the next months need no pick. A picked folder stays in view. When the user cancels, the app
  offers to create the folder instead. Last, it refuses a file name already in view in the folder.
  A PDF the old generator filed is not in view, so the number on the register is the guard that
  matters.
- **Make the invoice** then runs the steps in order: file the PDF (making any folder the user chose
  to make), save the Gmail draft, and add the register row through the same write as "Record
  invoice". A step that fails stops the run and shows why, and "Retry the remaining steps" runs the
  ones left, so the PDF is never filed twice.
- **The mail.** "Create the mail draft" is remembered on this device and off at first. The first
  time it runs, Google asks the user to allow `gmail.compose`. The draft goes to the client's
  `invoice_mail` with the PDF attached and is never sent. With it off, the PDF downloads and "Write
  the mail in Gmail" opens Gmail's compose window with the recipient, subject and text filled in.
- **Re-export**, in the editor of an invoice on Invoicing, draws the PDF again with the
  register's number and dates, replaces the file of the same name in view, and saves a fresh draft.
  The old draft stays in Gmail until it is deleted there. The register row changes only when its
  item or amount do.
- **A workbook kept in this browser** has no Drive, so the PDF downloads and the register row is
  written to the workbook there.

The register keeps one row per invoice: the lines' descriptions joined by `; ` as `item` and the
total as `amount`, with the number, client, dates and delivery period, the eight columns the
generator wrote.

## Where the books are kept

The first run, and "Switch data source" on Settings, This device, offer three ways in
(`DataSourceChoices` in `src/features/data-source/presentation/`):

- **Open your books on Google Drive**, for a device whose books another device keeps there. After
  the sign-in the app searches Drive for the file it marked with `appProperties`, and opens the
  Picker, filtered to JSON files, when the search finds none. Two marked files are refused with a
  message, since the app cannot tell which one holds the books. So is a backup or another app's file
  picked there, since the books would then be saved into it. "Pick another file" skips the search and
  always opens the Picker, with the same refusals, so a file other than the marked one can be opened.
  A toast names the file and its folder once it is open, or says the file found or picked is the one
  already on screen.
- **Open a file**, an xlsx or a ledgerboard file, which shows its summary first, as *A workbook kept
  in this browser* describes.
- **Start empty**, with the default categories and settings.

An opened file and an empty start then choose their home. "Keep on Google Drive" opens the folder
Picker, creates `ledgerboard-company.json` there with its mark, reads the file back, and opens it
only when it holds the same records, with "Moved N records" in a toast. When Drive already holds a
marked file, nothing is made and the message says so. "Keep in this browser" keeps the document in
IndexedDB. On a phone the sign-in goes to Google and back, and an opened file is opened again after
it.

To move the books from the Google Sheet, download the Sheet as xlsx, open it here, compare the
counts per tab with the Sheet's, and keep it on Google Drive. Do not edit the Sheet between the
download and the move.

Settings, This device names the workbook. For the file on Drive it gives the folder the file sits
in with a link to it, "Open in Drive", the last save the file records, the newest daily backup and
the last sync. The folder and the backup cost three Drive requests and are asked only while the page
holds a token, since asking for one needs a click. A file a newer app saved says "A newer
ledgerboard saved this file" there, and every save is refused with the same reason until the app is updated.
A workbook kept in this browser shows when it changed and when it was last exported, with "Keep on
Google Drive", which moves it the same way and then deletes it here. A save that fails after its
upload may have reached the file, such as one an edit from outside the app overtook, so its toast
says "The save may not have finished" with the reason, and a refused one says "Nothing was written".

## A workbook kept in this browser

The document lives in IndexedDB, under its own id, as the store of record. The app asks the browser
to keep it (`navigator.storage.persist()`, which Firefox shows as a prompt). Clearing the site's data
deletes it, so the exported files are its only other copies until it moves to Drive.

- **Start empty.** The first run and "Switch data source" start an empty workbook on Drive or in
  this browser: a default category set for a freelancer or a small company, and the default
  settings. VAT refunds have their own `vat-refund` category in the operating bucket, and
  `tax-refund` in the taxes bucket is for income tax refunds. `benefits-from-company-costs` in the
  owner-pay bucket carries the `owner-benefit` role.
- **Open a file.** Open or drop an xlsx file, such as a download of the Google Sheet, or a
  ledgerboard file, such as a backup from the Drive folder. It opens as the app's document, every
  ledger row with an id, and a summary shows before anything is replaced: transactions, dates,
  accounts, categories, the records of each tab with their total, and every problem. Then "Keep on
  Google Drive" or "Keep in this browser" chooses where it lives. An xlsx file without a `ledger`
  tab is refused, and so is a ledgerboard file a newer app saved or another app keeps.
- **Export.** From either home, "Export to Excel" writes the workbook in the template format as
  `ledgerboard-<company or file name>-<yyyy-mm-dd>.xlsx`. Opening an export gives the same
  workbook. When changes have gone a week or more without an export, the sidebar says so.
- **Editing.** Every kind a person keeps by hand is edited the same way in both homes, as the
  *Settings screen* and *Write-back* describe. A change counts towards the export reminder.
  Settings, This device keeps what belongs to this device: the data source, Google sign-out, the
  theme and the privacy notes.

Choosing a file on Drive deletes the workbook kept in this browser, once the file has been read.
SheetJS loads only on the first import or export, as its own chunk.

## Import

The Import tab of Transactions, at `#/transactions?tab=import`, adds a bank statement to the ledger
in both homes. Drop or pick a file. Nothing is written until the dry run is confirmed, and Undo in
the toast takes the rows out again. Once confirmed, the dry run says how many of the new rows wait
on Review, with a link there. The services are in `src/features/imports/`.

With the file on Drive, "From the statements folder" sits above the file drop, `StatementFolderCard`
beside `ImportPanel`. It shows what the last sync did with the folder, as *Sync* describes: the
statements it filed, and each one it held with its dry run, the reason, and for an account with no
rows yet the start at its opening. "Confirm and file" writes what the held statements' dry run then
accepts, through the same path. The card is gone when there is nothing to say.

**camt.053.** `readCamtDocument` reads the file with the browser's `DOMParser`. It finds elements by
local name, so any camt.053 version reads, takes booked entries only, and reads every amount in
cents from its decimal text, refusing a negative one, one finer than a cent and a localised
`1.234,56`. Entries are put in booking-date order, ties in document order, and the running balance
must close at CLBD. The counts and sums of TxsSummry are checked per direction. TxsSummry is
required from Erste (`ESBCHR22`), whose statements always carry it, and a statement from another
bank without it reads with a note. A file may hold several Stmt, and each one is read or refused on
its own. The counterparty is the creditor
of a debit or the debtor of a credit, unless that side states this account's IBAN or, without an
IBAN, its holder's name. An entry whose domain is `ACMT` or whose sub-family is `COMM` or `CHRG`
takes the servicer's name when it names no party, since those are ISO 20022 sub-family codes. The
description is the unstructured remittance lines joined, then the structured remittance's text,
then the bank's own wording. The statement column holds `<creation day>-statement-<LglSeqNb>`, and
a statement is known by its IBAN and LglSeqNb. A reversal, a batched entry, a value date standing
in for a missing booking date and an entry without a bank reference are stored in `review_reasons`,
joined by ` | `, so the row waits on Review.

**Spreadsheet exports.** Any other file goes to SheetJS: xlsx, xls, ods or csv, a csv read as UTF-8
or else Windows-1250 with its cells kept as text. A profile on the settings tab says how one bank's
export reads, such as
`import_profile_otp-business` = `account=otp; date=Datum knjiženja; date_format=dd.mm.yyyy;
decimal=comma; debit=Isplata; credit=Uplata; balance=Stanje; counterparty=Naziv;
counterparty_iban=IBAN; description=Opis plaćanja`. Columns are named by their header text, and
the header row is the first of the file's first 40 rows that carries all of them, so a bank's title
lines above it do not matter. `date_format` is `dd.mm.yyyy` (a trailing dot and a time are fine),
`dd/mm/yyyy`, `mm/dd/yyyy` or `yyyy-mm-dd`, and a date cell reads as a date whatever it says.
`decimal` is `comma` or `point` for amounts written as text. The amount is one signed `amount`
column, or a `debit` and a `credit` column of which each row fills one. `balance`, `counterparty`,
`counterparty_iban`, `description` and `reference` are optional. A row without a date, or with a
label such as a total where the date goes, is skipped and noted. A row with a date the profile
cannot read refuses the file. A file listing newest first is turned round, and with a balance
column each row's balance must follow from the one before. A row without a bank reference gets
`row-<key>-<n>`: sixteen hex digits from its account, date, amount, balance and text, and its count
among equal rows of the file, so the same row in a later, overlapping export gets the same key. The
statement column holds the file's name and the first eight hex digits of its SHA-256. Import offers
the first saved profile whose columns head a row of the file. Otherwise it starts a new one from
the file: the header row, columns guessed from Croatian and English header words, the date format
and decimal mark from the cells, and the account whose IBAN the title lines name. The dry run reads
the file with the profile as it is edited, and "Save new profile" writes it to the settings tab
through the settings write. "Delete" beside a saved profile takes its row off the settings tab, so no
file is offered it again. Settings keep no Undo, so a deleted profile is saved again to bring it back.

**The dry run** lists each statement's entries with the category the rules give them, and checks
them against the ledger as it is on screen:

| Check | What happens |
|---|---|
| On the ledger already | An entry whose account holds its reference is listed as such and never written, so importing a statement twice, or one a sync filed, writes nothing. |
| Follows the ledger | New entries must come after every entry the ledger holds, carry a reference, and not predate the account's newest row. |
| Opening balance | The balance before the first new entry must be where the ledger leaves the account, or a statement in between is missing, and the statement is refused. |
| A new account | An account with no rows waits until "Start <account> at <opening>" is ticked, or for a file without balances until its opening balance is typed. |
| Statement numbers | A camt statement whose LglSeqNb is not one past the newest on the ledger for the account is noted, as the balances still decide. |
| Partly new | A statement whose first entries are on the ledger adds the rest and says so. |
| Imported before | A bank export whose statement label, its file name and hash, is on the ledger already, and that still has entries the ledger lacks, is refused. Its rows' keys changed since, such as after an edit to its profile, so they cannot be told from the rows it wrote. Imported again as it was, it writes nothing. |

Statements of one account are taken oldest first, each against where the one before left the
account. A refused one leaves the account where it was, so the next one is refused for the gap, and
the others are still written. A file without balances gets them worked out from where the ledger
leaves the account.

**The write** adds ledger records, checked by `LEDGER_WRITES` in
`src/features/imports/application/ledgerWrites.ts`, each new row with its own `id`, in one write
with the rest of the document. Right before writing, the ledger as it is then is checked again: a
new row already on it by its account and reference is refused, as any record the workbook holds
already is, which happens when another device's sync filed the statement since the dry run. A row
the reader refuses still holds its account and reference, so a new row with that reference is
refused too, until the row is fixed in a file opened again. Each account's new rows must open at
its newest balance and run on from it, and none may predate the account's newest row. Undo takes
the rows out whole.

## Settings screen

The screen at `#/settings`, set apart at the foot of the menu, holds how the workbook and this device
are set up, and the law behind the figures, one tab each:

| Tab | What it holds |
|---|---|
| General | The settings tab as three cards: the workbook (name, currency, number locale, review label, card settlement IBANs, statements folder with its sync switch and the owner-pay module) open, then the company and owner facts with the accountant's two folders and their sync switch and the bucket labels, collapsed, with one Save under them. While the tab holds no value for a key Save writes when unset (`owner_pay_module`, `statements_folder` and the two accountant folders), a line above Save names them and Save is open with nothing changed. Then the loan switch and the rows the app could not use, which opens itself while there are any |
| Categories | The categories tab |
| Accounts | The accounts tab |
| Ruleset | The law the d.o.o. pack computes with, while `owner_pay_module` is on, as *Ruleset* describes |
| This device | Where the books are kept, with export, import, the move to Drive, switch and sign-out, for a file on Drive the Sync card with the steps of the last sync and "Sync as the app opens", and the theme and privacy notes |

Without a workbook on screen only This device is there. A card with a field in error opens. A link
that names a fact by its field, such as `#/settings#owner-loan-interest` or
`#company-registered` from Year, opens the facts card and lands on the field. The clients tab and
the billing and invoice terms are on Invoicing, Clients, the rules on Review, Rules, and the assets,
grants and year-end tabs on the Year screen. Each of those is `FactTabCard` in
`src/features/settings/presentation/`, a card that edits one tab as this screen does.

The tabs are `PageTabs` in `src/shared/ui/`, which any screen with inner tabs uses: the tab is
`?tab=` in the address and the first tab stays out of it, picking a tab adds a step to the history
so Back returns to the tab before, and the arrow keys move between tabs without opening them. The
browser tab reads "Settings, Categories – Ledgerboard". A strip wider than the screen scrolls inside
itself, with its open tab brought into view and its cut edges faded, and a phone shares its width
between four tabs or fewer. What every tab follows, such as the filter bar of Analysis, goes in its
`above` slot, so a phone still finds the Filters button at the end of the tab row. A bar of one tab
that sticks, such as the Ruleset search, sticks under a phone's tab row through `--page-tab-row`. A
drill from a figure always opens Transactions on its Rows tab, so the tab of the screen it starts
from never carries over.

The editors work the same in both homes. Each tab is a table of fields: add a row, change any
field, delete a row with its bin, then "Save" writes the whole change as one write with Undo in the
toast and under "Changes in this session" on Review. Only the fields that changed are written, and
a deleted row is taken out. "Discard changes" goes back to what the workbook holds. A save that fixes a row the app
could not read, or deletes one, keeps no Undo, since nothing could store that row as it was.

On Categories the colour is a swatch button that opens a pop-up, `ColourSwatchPicker` in
`src/shared/ui/`: Bucket colour first, then the nine swatches, each a 44 px target named for a
screen reader, which the arrow keys move through. A line under them names the other categories of
the bucket that wear the chosen swatch, since a repeat is allowed. A colour outside the palette
shows as Bucket colour. Roles are a
menu of the roles core and the pack pick categories by, shown as chips. A role the app does not
know, such as `revenu` typed in a file, shows as a red chip with the error under it and blocks the
save until it is taken off.

A search and quick filters sit above the categories. The search matches every word typed against
the category, the name it shows as, its family, its bucket and its roles. Bucket and Role narrow the
list to one of each, and "Has an owner share", while the column shows, and "Unsaved changes" to the
rows that hold one. A line says how many show, such as "5 of 33 categories", with Clear filters. On
a phone the search sits beside a Filters button that counts the filters on and opens the rest in a
sheet. Every column but the colour sorts from its header, by a press or by Enter or Space:
ascending, descending, then the tab's own order again, which is where it starts. The header tells a
screen reader the sort too. The table scrolls inside its card under a header that stays in view. Its
height leaves the page header, the tabs, the card's header and filters and Save on the window, and
never drops under 24rem, about seven rows. Filters and sort belong to the screen. They are not in
the address or the books, so they start empty when the tab opens again, as unsaved rows do.

The rows are listed again only when a filter or the sort changes, or the tab reloads after a save
or Undo, so a row never moves or disappears while it is typed in. A row with an unsaved change or an
error shows whatever the filters say, and the count line says how many show only for that, so
nothing Save would write or refuse is out of view. A row that another row's change puts in error
while it is hidden, such as a name taken twice, joins the foot of the list. Add category puts the
new row at the foot, whatever the sort, scrolls the table to it and focuses its name, and it stays
at the foot until it is saved. `categoryListing` in `src/features/settings/domain/categoryListing.ts`
decides what shows and in which order. `SortableHeader` in `src/shared/ui/` is the header cell of a
plain table's column that sorts.

While `owner_pay_module` is on, the last column is "Owner share", the default a row filed in the
category takes, as *Owner share* describes. A category outside the operating bucket shows a dash
there unless it holds a share, which can then be cleared. The field blocks the save when it holds
anything but a whole number from 0 to 100, a share on a category outside the operating bucket, or
any share while no category carries the `owner-benefit` role. A save that sets or changes a
default first asks "Fill the rows without a share?" when ledger rows, split parts or owner advances
of that category hold no share, one line per category with its share and its rows. "Save and fill"
writes the categories and those cells in one write, so one Undo puts back the default and the
cells. A share of 0 is not blank and is left alone, and so is the ledger cell of a split row, whose
parts hold the shares. A row the pack keeps whole counts whole, so its own cell is filled and its
parts are not. A record that takes a share while the question is open keeps it. "Save the default only" writes the categories alone, and Cancel writes
nothing.

Each table checks its rows as the reader would before it lets a save go: a row the reader would
leave out is marked and blocks the save. A row the tab holds that the app cannot read at all, such
as a category with a misspelt bucket, is listed after the rows it reads, as stored, so it can be
fixed here. A category or account in use keeps its name, so its name
field and its bin are locked, and the tooltip says what uses it. A client or grant in use is refused
when the save renames or deletes it, with what uses it.

## Development

```sh
npm install
npm run dev            # http://localhost:5173/ledgerboard/, talks to Google
npm run dev:fake       # same app on a small synthetic workbook, no Google needed
npm run check          # typecheck and unit tests, the import boundaries among them
npm run build          # production build into dist/, then checks no dev-only code shipped
npm run build:fake     # fake-mode build into dist-fake/, for the visual check
npm run preview:fake -- --port 4173
npm run check:visual   # every screen at nine widths from 360 to 2560 in local Chrome, dark and light at 360, 430 and 1440, cards wider than their content, a card collapsed and expanded per screen, deep links into collapsed cards, the owner's part of a shared row under its category's filter, Owner's two tabs under a year and the default period, the gallery's donuts, the tabs of Settings with Back through them and a link to the last one, a link to Year's Statements tab alone kept in its year through two tabs and Back, a rule opened in the side panel from a link, and the row editors' add, edit, delete and undo at 360 and 1440 in both modes, the employees on Salaries among them, the categories searched, filtered to a bucket, sorted and a row edited while filtered and sorted, an owner advance changed and deleted, a settled row's category changed and undone, the laptop's owner share changed and cleared with undo, a category's default saved with the fill offer and undone, the pay scenario editor's, the plan editor's, the split editor's on Transactions and on Review, a dismissal on Review with restore and undo, a rule changed and deleted from its editor on Review, Rules, each undone, both statement imports with their dry run, confirm and undo at 430 too, the statements folder the settings lack saved from Settings, General and then changed, the first run kept on the fake Drive and in this browser, an xlsx moved to the fake Drive through its summary, a workbook kept in this browser moved there, a row confirmed while another device saves with undo, and with the file on Drive a sync that files a statement from the fake statements folder with undo in its step on This device and no toast, one that holds a statement with 1 problem in the sync control and its steps in a popover or a bottom sheet linking to Import, one that finds nothing new and says nothing, Allow access in the sync control, the control while a slow step runs and once ready, and on Year, Taxes the accountant's cards a sync read with the rows a differing badge opens, the read this device kept until Allow access, and the payroll folder saved from Settings, General with 1 problem in the sync control, Salaries for one and for five made-up employees on each tab, and with five a sync's payslips, the one problem's build-up and rows, a name on People and a month of Over time, and This device for a file a newer app saved, screenshots in visual-check/
npm run check:touch    # touch at 360 and 430 px: top bar with its one-line Sync button and drawer, the tabs of Settings with Back, a link to Year's Statements tab alone kept in its year, the Ruleset search and a rule in its sheet, Overview's waiting card with its review and corporate tax lines, drills, the Year screen's tabs and three editors, a forecast line, a payout option, the Plan tab, a pay scenario's warnings, figures and starting figures with the base beside one scenario, filter sheet, import, the categories searched, filtered from their sheet, sorted and edited while filtered, Owner opening on Taken with its net share and monthly net pay tiles, Owner's Filters button on the tab row setting one period for both tabs, the owner take under its ring against its tile, a month of the loan balance beside the ring opening its rows, the tax the benefits from company costs avoided against a dividend full screen, a card collapsed and expanded per screen, the row editors, an owner advance changed and deleted, one added outside the period and opened from its toast, the split editor on Transactions and Review, a category changed on Transactions, an owner share changed and cleared, a default saved with the fill offer, a dismissal, a rule changed and deleted from its editor with undo, and both statement imports in both modes, statements filed and held on sync with each state of the sync control and its steps in a bottom sheet, the statements folder saved from Settings, General, the way back from Google's sign-in page and from the Drive read grant, silent or asked, and from the silent ask after a sign-in with the sync it carries, ending ready or in Allow access, the accountant's cards on Year, Taxes as a sync read them with a differing badge's rows and the kept read, Salaries for five made-up employees with the gross to net chart's tap-then-drill and the sync's payslips, the one problem's build-up and rows, People and Over time, the payroll folder saved from Settings, General, the first run on the fake Drive and in this browser, an xlsx moved to the fake Drive, a workbook moved there from This device, a race kept on both sides, the newer-file notice, 44 px targets, in visual-check/touch/
npm run check:pwa      # after npm run build: manifest, offline reload, update prompt. Add -- --firefox for Firefox
npm run check:round-trip -- --workbook <file.xlsx>   # open as the document, write and read it, export and open again, counts only
```

The fake workbook is an 18-month synthetic company: two accounts, one closed by a sweep into the
other, a part-month at each end, one loss month, reimbursements to the owner, the last of them with
no cost on file, two rows waiting for review, a
rules tab that reproduces every row flagged `rule`, and rows a person confirmed that no rule covers
yet. Its `assets`, `grants`, `year-end`, `plan` and `scenarios` tabs hold the two computers it
bought, its start-up grant, made-up 2025 accountant figures that add up, a 2026 plan row the
ledger's months compare with, a 2027 plan whose owner pay switches from the floor salary to
board-only insurance the day after the grant's employment date, with a planned laptop and a
dividend, and four owner pay scenarios for 2027, two of them with warnings to show. Its `outgoing-plan` tab splits each of the first client's invoices into a month's fee
and its extras, with October planned and not invoiced yet, and has no rows for the second client,
whose invoices are invoiced with no plan row. Its `splits` tab splits four rows: a salary paid
with a results bonus, a design invoice that also paid a workshop, and a business lunch and an
office order, each with the owner's own part in it. Its ledger carries every column from A to R, as the Google Sheet did, then
`owner_share` and an `id` on every row. Its categories give AI services a 50% owner share, with "Benefits from company
costs" carrying the `owner-benefit` role, so its AI services rows hold 50, the laptop's row holds
30 of its own, and the office order's office part and the design tool advance hold one each. It holds no dismissed suggestions yet. On the Import tab the fake build offers two sample files that carry the main account on from its newest row: a
camt.053 statement with a client payment, a card purchase in dollars, a bank fee and a reversal,
and a Croatian bank's xlsx export with a title above the header, text dates, a decimal comma, split
debit and credit columns and a total below, which no saved profile fits yet. Both start from the
same balance, so once one is imported the other is refused. The variant kept in this browser sets the billing settings and has its director, Alex, on the `employees` tab, so the Drive variant shows Salaries without one.
`?fake=one-employee` and `?fake=five-employees` are the file on Drive with a made-up staff in place of
the owner's flat salary, from `src/packs/hr-doo/infrastructure/fake/fakeStaff.ts`: the owner alone at
the director floor, or with four ordinary employees on agreed salaries in three cities, one outside
pillar II, one with two children and one who joins in February 2026. Each payday pays every net
salary with a meal allowance to its employee and each contribution in one sum to its payee, as the
payroll engine works them out, and one share capital row in October leaves the main account where the
flat salary leaves it, so the sample statement still carries it on. Their payroll folder holds a
salary workbook for every worked month with a tab per employee. One month's tab is left out and one
misprinted for the owner alone, and for the five one tab is left out and the newest net row to one
employee is 10.00 short, so Salaries has a problem of each kind to show. The fake workbook is built as records in `fakeWorkbook.ts`. In the fake build it is a file on a Drive held in memory (`fake/fakeDriveSession.ts`), which answers syncs and saves, keeps revisions and makes the day's backup, until the page reloads. A
Drive and a Gmail held in memory answer "Make invoice" the same way: the invoice folder holds this
year's and last year's folders with every month inside, made by another app and out of view until
picked, and the browser's confirm dialog stands in for the Picker, OK picking every folder it names
and Cancel none. Its settings carry made-up invoice details, and Northwind has an address, an
invoice mail and reverse charge, while Lumen has none, so its invoice is refused.
The fake Drive's statements folder, at the default `statements_folder` path, names an XML file for
every statement on the fake ledger and holds the sample camt statement with a PDF beside it, so the
sample is the only file the app downloads from it. Sync files it, and a second sync finds nothing
new. `?fake=held-statement` adds a statement of an account the accounts tab lacks, named by its
label alone, which the sync holds, and `?fake=slow-statements` takes three seconds to list the folder,
so a check sees the sync control while the step runs. The fake build never goes to Google, so it
reads this folder as if it held the Drive read token, unless the tab noted a refused ask, which
leaves "Allow access" in the sync control. It holds the accountant's folders at the default folder
paths too, as *Year screen* describes for Taxes.
Every name, IBAN and amount in it is made up. `?fake=browser` keeps it as a workbook kept in this
browser with changes nine days past their last export and owner loans that carry 2.5%, so they give
no benefit in kind, and `?fake=empty` starts with nothing, which is the first run, whose folder
Picker picks a `Books` folder on the fake Drive. A variant that ends in `no-scenarios`, `no-plan` or
`no-billing-plan`, such as `?fake=no-plan` or `?fake=browser-no-plan`, starts without those records,
so the starting scenarios and the first plan line have nothing before them. `?fake=newer-file` is a
file a newer app saved, which the app shows and never writes. With `?fake=race` a phone files the
snack kiosk's row on the fake Drive a moment before the first save uploads, so the save runs again
on the phone's file and both stand. Every record that carries an id has a fixed one. The visual
check covers each variant, and the import summary of an xlsx it writes from the fake workbook. It and the touch check run against a preview of the fake build, so start one first:

```sh
npm run build:fake && npm run preview:fake -- --port 4173
npm run check:visual
npm run check:touch
```

While working on a screen, both take `--only` and `--widths` to run a part of the check quickly:

```sh
npm run check:visual -- --only invoicing,owner --widths 360,1440
npm run check:touch -- --only billing,split --widths 430
```

`--only` takes screen and flow names for the visual check, such as `invoicing`, `settings-categories`
or `split`, and step names for the touch check, such as `billing-edit-delete` or `split-drive`. A
name also picks every name that starts with it and a hyphen, so `invoicing` takes `invoicing-plan-2025`
and `invoicing-clients-browser` too. A touch step that carries on from the page of an earlier one runs that one as
well. `--widths` takes widths the check already has. A name nothing is called fails with the names
there are, and a run that would check nothing fails too. A limited run keeps the screenshots it does not
take and says on its last line that it was limited. Only the full run, without options, is the check
before a commit. The address of the preview can go before or after the options.

`check:pwa` serves the production build itself and sends every other origin to a dead proxy, so it
needs no preview and makes no call to Google.

In development and fake builds, `#/gallery` shows every shared component and chart style with
made-up figures, in whichever theme `?theme=light` or `?theme=dark` pins. The route does not exist
in a production build.

### Core and the pack

`src/features` and `src/shared` are the core, and `src/packs/hr-doo` is the Croatian d.o.o. pack.
The pack reaches core screens through one contribution, `hrDooPack` in
`src/packs/hr-doo/hrDooPack.ts`, of the type `PackContribution` in
`src/features/packs/packContribution.ts`. Its slots are the pack's part of the workbook, the Owner,
Year and Salaries screens, Overview's jobs after the core ones, the Review card of reimbursements with no
cost on file, the Ruleset tab and the loan card of Settings, the company and owner facts card with
its checks, the links of the spending breakdown, and the accountant step of a sync. `main.ts` loads the contribution and the pack's
tabs with a dynamic import and installs both before it makes the router or reads a workbook, so the
pack stays out of the entry chunk. While `owner_pay_module` is off, core shows none of it but the
routes, and the pack's part is still read, so the rows the pack keeps whole still count whole. Every
spec runs with the pack installed, through `tests/setup/installPack.ts`, and so do the scripts that
read or write a workbook, through `scripts/support/installPack.mjs`.

The pack owns its records. Owner advances, assets, grants, year-end lines, plan lines, pay
scenario rows and employees have their types, factories and codecs in `src/packs/hr-doo/domain/`, their kinds in
`hrDooKinds.ts`, each named with the pack's `hr-doo.` prefix, such as `hr-doo.asset`, their `WriteRules` in `hrDooWrites.ts` and `HR_DOO_PART`, which lists the kinds with
their rules, in `hrDooPart.ts` there. Their tab mappings are in
`src/packs/hr-doo/infrastructure/hrDooTabs.ts`, the records the plan, scenario and advance dialogs
make in `src/packs/hr-doo/application/`, and their editor columns in
`src/packs/hr-doo/presentation/editorColumns.ts`. The core `Workbook` carries them in `packParts`,
which `packPart(workbook, key)` reads, and the pack's screens read the workbook through
`hrDooWorkbook`, core's records with the pack's part. When the workbook is read, the part hands
core the two things core counts of it: the owner advances, as `ownerAdvances`, which profit and
loss, Transactions and the filters count beside the bank rows, and `rowsKeptWhole`, the ledger rows
the pack keeps whole, each with why in the pack's words, which the split guard and the split editor
quote. The part also lists in `categoryNaming` which of its kinds name a category, so the categories
editor keeps a category they name, and points out the owner advances' kind, whose categories stay in
the operating or taxes bucket. The `hr_` settings keys and `CompanyFacts` are the pack's too. The settings parser leaves the
pack's keys to it, neither reading nor reporting them, and the pack reads them with
`readPackSettings`. The facts card writes them with the rest of the settings in one Save.

`tests/importBoundaries.spec.ts` runs with the unit tests and fails on an import that breaks a rule,
naming the file, the line and the import:

- A `domain` folder, and the pack's ruleset outside its presentation, imports only domain code and
  `src/shared/calendar`, `src/shared/money` and `src/shared/text`.
- Core, which is `src/features`, `src/shared` and `src/App.vue`, imports nothing from `src/packs`.
  Only `main.ts` does.
- Nothing outside `src/features/workbook` imports its `infrastructure`, the document storage and
  the xlsx mapping. The exceptions are `main.ts`, which installs the pack's tabs and loads the fake
  seed, the fake build's data in an `infrastructure/fake/` folder, and a pack's `infrastructure`,
  which maps its tabs with `spreadsheetTab.ts`, `packTabs.ts`, `workbookTemplate.ts` and
  `cellFormats.ts`. A screen reaches them through the workbook's own presentation, such as
  `workbookFiles.ts`.
- An `application` folder imports no `infrastructure` folder. The exceptions are the files that wire
  adapters in, `src/features/workbook/application/workbookStore.ts` and
  `src/features/invoicing/application/invoiceGoogle.ts`.

It also fails on a line of `src` outside `src/features/workbook/infrastructure` that names
`sheetRow`, so row numbers stay with the xlsx mapping, and on `as RecordId` outside
`src/features/workbook/domain/recordId.ts`. Elsewhere a record is known by its `RecordId`: its kind and its
key or id, which `recordIdOf` makes and only a storage reads apart, with `keyOfRecordId`, to write
the id of a kind without a business key. A storage gives each record it reads its id, and a
record's own domain makes one where it states identity, such as `categoryIdOf`. Every kind's codec,
core's and the installed pack's, is found by its kind through `recordCodecs.ts` in
`src/features/workbook/application/`, the pack's through `PackPart.codecs`.

Each kind's domain gives its codec beside its factory, such as `INVOICE_CODEC` beside `invoiceOf`
in `src/features/workbook/domain/invoicesReading.ts`, or `ASSET_CODEC` beside `assetOf` in the pack's
`domain/assets/assetsReading.ts`. A `RecordCodec` (`recordCodec.ts`) says, whatever the storage, the
key or id a record's stored fields hold, the words that name it, the record its factory makes of
them or why it refuses them, and `fieldsOf`, the fields a record is stored as: a day as
`yyyy-mm-dd`, an amount as decimal text from its cents, a number as decimal text, a flag as true or
false, other text as typed, and a blank field left out. A setting is typed by its key: each key's
definition, core's or the pack's, says whether its value is a date, a number, a flag or text, and
its `apply` takes the value as text, so a date cell and the text `2025-05-12` read the same. A rule
is stored as its fields, which the rules reader checks.

The xlsx mapping reads a file the same way. The `SpreadsheetTab` of each tab turns a row's cells
into fields, a serial number into a day and an amount and a checkbox into a flag
(`cellReading.ts`), and hands them to the kind's codec. Writing an export turns a record's fields
into cells in one function, `cellsOfFields`, by the tab's cell formats (`cellFormats.ts`): a field
in a date column as its serial number, in another number column as a number, and anything else as
it is. So a tab's mapping holds only its tab, its kind and its cell formats, and for a `year-end`
amount and a settings value the format follows the line or the key. A pack tab's columns, notes and
mapping come from the pack's `PackSpreadsheetTab` (`packTabs.ts`).
What a storage holds of a kind is a `RecordsRead`: the records, each with its label and its fields as
stored, and the refused ones with theirs. The store keeps them beside the workbook. `readWorkbook`,
in the domain too, then applies the rules across records, such as a key on two rows or a category the
categories tab lacks, and gives the workbook and its problems, core's first and then the pack's. The Settings, Invoicing and Year
editors draft from the records and the refused ones alike, so a row the app leaves out, such as a
category whose bucket reads `operatng`, still shows as stored and can be fixed there. A draft is
the text of the record's fields, which becomes fields as `fieldsOf` gives them, never cells.

Google sign-in, the redirect, the session, Drive, the reads kept from it, the Picker and the script
loader are in `src/shared/google/`, and reading a spreadsheet file's tabs with SheetJS in
`src/shared/xlsx/`. The document's homes, on Drive and in this browser, are in
`src/features/workbook/infrastructure/`.

## Write-back

Review, Transactions, Owner, Invoicing, Year and Settings write records, the same way in both modes.
A screen hands `store.write(title, work)` its work, and the work takes the repository of each kind
from the unit of work, `unit.of(rules)`, and adds, changes or removes records there. A record the
domain refused, such as a category with a misspelt bucket, is repaired as the record its fields now
make, or discarded. The write is one write: checked whole, applied whole, or refused with every
reason and nothing written. `useRecordWrites` gives it a toast that names the records by their
labels, with Undo beside it where the write keeps one.

Each kind's `WriteRules` (`src/features/workbook/domain/writeRules.ts`) sit with the feature or pack
that owns the kind: categories, accounts and clients in
`src/features/settings/application/namedRecordWrites.ts`, settings in `settingWrites.ts` beside it,
rules in `src/features/rules/application/ruleWrites.ts`, ledger rows in
`src/features/imports/application/ledgerWrites.ts`, and invoices, the billing plan, split parts and
dismissals in the `*Writes.ts` file of their feature's `application` folder. The pack's are in
`src/packs/hr-doo/domain/hrDooWrites.ts`. The rules name the kinds their checks read, the fields a
change may touch, the kind's own checks and its reader, and whether a write keeps Undo. One write:

1. Reads fresh the kinds it touches and the kinds their checks read.
2. Finds each record it changes, repairs, discards or removes by its identity and by what the app
   read, so two rows that share a key but hold different fields are told apart, and refuses one that
   is gone, that two stored records hold alike, or that differs from what the app read. An added
   record whose identity the workbook holds already is refused too, so a copy is never made.
3. Refuses a change to a field the kind keeps from the app. Then each kind's checks run, and its
   reader reads the kind as the write would leave it: a record the write touches may not be left
   out or gain a problem, and a record it leaves alone may not drop out.
4. Applies every change at once, reads the kinds back into the copy on screen, checks each record by
   its identity, and adds the write to "Changes in this session" on Review, newest first.

Every message names a record by its label, such as an invoice's number or an asset's name, and
never by where it is kept.

Undo turns a write's receipt around: an added record is removed, a changed one changed back, and a
removed one added again with the same identity, at the end of its kind. Nothing reads where a record
sits, so the figures after Undo are those before the delete. Undo goes through the same checks, so it is refused when a record changed
since, or when the workbook holds the identity of a record it would put back. So a save that merged
two rows of one key, such as a client's two rows made into one, keeps its result: its Undo would put
back a second row the workbook already holds. Settings keep no Undo,
and neither does a write that repaired or discarded a refused record, since nothing could store that
record as it was. Settings are changed back on Settings. The
session list is held in memory, so a reload clears it.

- **Ledger rows.** A row is known by its account and reference, even one the reader refuses, or for
  a blank reference by its account, date, amount, balance and description, so rows a hand edit or
  another device added since the last sync do not matter. Each row also carries an `id`, which the
  move into the file and every import give it. The app changes only a row's `category`,
  `flagged_by` and `owner_share`. A refused ledger row is fixed outside the app, never by the app. Confirm writes the `review_label` setting to `flagged_by`.
  Recategorise, and Change category on Transactions, write the category and the label. Applying a
  new rule writes its category and `rule`, only to rows flagged `ai` or unclassified. A category the
  categories tab does not define is refused, unless Undo puts it back. Imported rows are added as
  *Import* describes, and Undo takes them out.
- **Rules.** The rules reader checks each rule a save adds or changes, against the categories as
  they are now, and a rule that counts today may not drop out. A broken rule elsewhere on the tab
  stays left out and blocks no save. Two enabled rules may share an order, and are tried by id. A new
  rule is appended, and an edited, switched, moved or deleted rule is found by its id. Delete in the
  rule's editor shows the back-test of taking it off first, and its row goes as a whole row. Moving a
  rule swaps its order with its neighbour's, so orders stay in steps of 100, and renumbers every
  rule in steps of 100 only when the two share an order. Every rules write has Undo.
- **Settings.** Each changed key's value is set, or a `key`, `value` row is added when the tab lacks
  the key. A removed key, an import profile deleted on Import, or an unknown key or a profile it cannot
  read removed on Settings, General, has its row taken out. A key on two rows, or a value the settings reader would not use, is
  refused.
- **Records of the other kinds.** Categories, accounts, clients, invoices, owner advances, assets,
  grants, year-end lines, billing plan rows, plan lines, pay scenario rows, split parts and
  dismissals are added at the end of their kind, changed in place and removed whole. A record of a
  kind with an id gets a new one when it is added and keeps it after. Each
  kind's own checks are these, each refused with its reason:

  | Kind | Refused, with the reason given |
  |---|---|
  | Categories | A name outside the slug format (lower-case letters and digits with single hyphens). Renaming or deleting a category that ledger rows, rules, owner advances, split parts, year-end `categories` or `plan` rows name. A bucket outside operating and taxes for a category owner advances carry. A changed colour outside the palette, or a role the change gives that the app does not know, unless Undo puts it back. Unless Undo puts it back too, a new owner share on a category outside the operating bucket or while no category carries the `owner-benefit` role, and that role on a second category or one outside the owner-pay bucket. |
  | Accounts | A name outside the slug format. Renaming or deleting an account ledger rows name, or clearing its IBAN, since the app files no statement whose IBAN the tab lacks. A new or changed IBAN that is not valid (shape and ISO 13616 check digits), is on another account, or is a client's. One IBAN names one account, since the fetch names each statement file by its IBAN and the app files each statement by it. |
  | Clients | A name outside the slug format, or one another row holds. Renaming or deleting a client that invoices, plan rows or `billing_client` name. An IBAN the change adds that is not valid, is on another client, or is one of your accounts. A save that merges a client's two rows into one keeps no Undo, as above. |
  | Invoices | A number already on the tab for any client, as the invoice generator checks. A client the clients tab lacks. An amount of zero or less. |
  | Grants | A name outside the slug format. Renaming or deleting a grant an asset is funded by. |
  | Owner advances | What their reader refuses: an amount of zero or below, which for a negative one points to the `splits` tab, or a category the categories tab lacks or keeps outside the operating and taxes buckets. "Add advance" on Owner, and "Add the cost" on Review, add one, and the pencil beside an advance on Owner changes or deletes it. |
  | Split parts | What their reader refuses against the ledger and the categories as they are now, which are the guards of *Split rows*. A split of a row an asset claims, with the asset named. |
  | Assets, year-end lines, billing plan rows, dismissals | What their readers refuse, such as an asset listed twice, a grant the grants tab lacks, or a konto row naming an unknown category. |
  | Plan lines | What their reader refuses, such as a dividend without its month or a category twice in one month. Then every year the change touches must pass the plan guards of *Forecast*. |
  | Pay scenario rows | A name outside the slug format. Renaming a scenario onto the name another scenario holds. Renaming or deleting the last row of a scenario a `plan` row names. Then every scenario the change touches must pass the guards of *Pay scenarios*, each refusal naming the scenario and its rows, and every plan year that names one of them must pass the plan guards. |

  The loan switch on Settings, General is a change to the `bucket` of the loan categories.

The storage is a port, `RecordStorage` (`src/features/workbook/application/recordStorage.ts`). The
store, `createWorkbookStore.ts` in the same folder, holds the unit of work, the copy on screen and
the session list. `workbookStore.ts` beside it wires the document storage in and gives the screens
`useWorkbook`. The copy on screen is the document whole with its revision, which the cache in
IndexedDB keeps as one row (`workbookCache.ts`). `documentRecordStorage.ts` in
`src/features/workbook/infrastructure/` keeps every kind's records in that one document, in a file
on Drive or in this browser. A read decodes the document and makes each record with its kind's
factory. A write works out the next document in memory: an added record goes at the end of its
kind, a changed one takes the fields the change alters and keeps every other field, a field the app
does not know among them, and a removed one leaves. A repaired record takes the fields of the fixed
record and keeps a stored field it does not name only while the record reads the same with it. The
document's home then stores it whole, so a write is all or nothing. A kind finds its codec through
`recordCodecs.ts` in the application folder, core's kinds and the installed pack's `PackPart.codecs`
alike, so the document storage needs no tab mapping.

When the home finds the document moved since the write's read, it stores nothing and the write
starts again from a fresh read, at most three times, after 1, 2 and 4 seconds with up to a second
more at random. A write the checks refuse on the fresh read is refused as always. After three moves
the write is refused with "Another device kept saving the workbook during this change".

`tests/recordStorageContract.spec.ts` says what any storage must do, once for each home and each
kind, core's and the pack's, in record terms: a record reads back as written, a change and a removal
find the record after another device added one ahead of it, a stale change writes nothing, a refused
record reads with its fields and reason and a repair stores it or a discard takes it out, Undo of a
removal brings it back with its identity, and a write across two kinds applies whole or not at all.
A storage joins by playing the outside edits, `addOutside`, `changeOutside` and `removeOutside`, and
a kind by giving its fixture as typed fields. `tests/documentStorage.spec.ts` holds what only the
document must do: one record per line, a file a newer app saved read and never written, unknown
fields and kinds kept through a save, the `hr_company_registered` date kept as the day it names, and
two devices saving at the same moment.

### The file on Drive

The document is one file, `ledgerboard-company.json`, in a Drive folder the person picks, made with
`drive.file` and marked with the `appProperties` `ledgerboard=company`, so a second device finds it
by search. Drive refuses no stale upload, so the home in `driveDocument.ts` checks the revision
itself. One home serves a file for as long as the page holds it, with a token getter rather than a
token, so it remembers the day's backup. A save:

1. Reads `files.get ?fields=headRevisionId`, and downloads the file with `alt=media` only when the
   revision differs from the copy's. That revision is the base.
2. Before its upload, reads the head again. A head other than the base is a moved file, and nothing
   is uploaded.
3. Uploads the whole document with `uploadType=media&keepRevisionForever=true`.
4. Lists the revisions and reads the head. A revision since the base that is neither the base nor
   this save's is another device's save. When this save's upload is the head, it replaced that save,
   so the write runs again on that save's text through the same checks and uploads the result, or
   uploads that save back and is refused with the reason. A save whose upload is not the head
   answers saved, since the device that landed last sees it.
5. Reads back from memory, since the save knows what the file holds.

A write makes five requests, the read and four for the save. The first save of a day first copies the base into a `backups`
folder beside the file, as `ledgerboard-company-<yyyy-mm-dd>.json`, and keeps the last 30 days and
the first of each month. Once more than 100 revisions are kept, the oldest are let go, since Drive
refuses a 201st. A revision Drive did not keep, such as an edit through Drive for Desktop, cannot be
read back, and the save says "The file changed outside the app during this save. Check the backups
folder."

The workbook kept in this browser is the same document in IndexedDB (`browserDocument.ts`), whose
revision is a new random id on every save, so a tab holding an older one finds it moved even after
the database was deleted and made again.

### The file

```json
{
  "format": "ledgerboard",
  "app": "company",
  "schema": {"core":1,"hr-doo":1},
  "savedAt": "2026-10-23T08:00:00.000Z",
  "records": {
    "ledger-row": [
      {"date":"2026-10-14","account":"main","amount":"-95.49","balance":"1204.10","category":"software","flagged_by":"ivan","id":"…"}
    ],
    "setting": [
      {"key":"hr_company_registered","value":"2025-05-12"}
    ]
  }
}
```

`documentFormat.ts` reads and writes it. Records go by kind, each kind's name as its `RecordKind`
names it, the pack's with its `hr-doo.` prefix, one record per line. Field names are the column
names of *The workbook format*. Every value is text except a flag, which is true or false. A day is
`yyyy-mm-dd`, an amount the app writes is decimal text from its cents, and text that looks like a
number stays as typed. A blank field is absent, and a field or a kind the app does not know is kept.
`schema` holds a version per contributor, core and each pack. A file that names a higher version, or
a contributor this app lacks, is read and never written: "This file was saved by a newer ledgerboard.
Reload to update before you change anything."

An xlsx file opens as this document (`spreadsheetDocument.ts`): every row moves as stored, each cell
by its column's format, so a date cell becomes its day and nothing is repaired on the way, and a
ledger row the reader takes gets an `id` when it has none. A refused row moves as it was. "Export to
Excel" writes the document back as the tabs of *The workbook format*.

## Accountant parity

`npm run parity:accountant -- --workbook <export.xlsx>` reads the
accountant's VAT returns and salary workbooks with the pack's readers in
`src/packs/hr-doo/domain/accountant/` and checks each against an xlsx export of the books, through `accountantDocumentsOf` in
`src/packs/hr-doo/application/accountantDocuments.ts` as Year, Taxes does. VAT returns are the `YYYY-MM-pdv.xlsx` files of
`~/gdrive/work/dss/dss-finance/vat-returns` (`--vat-returns <folder>`), salary workbooks the
`YYYY-MM-salary.xlsx` files anywhere under `~/gdrive/work/dss/dss-finance/payroll` (`--payroll
<folder>`). `--downloads <folder>`, by default `~/Projects/personal/ledgerboard-exports/accountant`,
adds xlsx downloads of the Google Sheets, named as in Drive. A period held only as a Google Sheet is
a stub on disk, and the script lists it as not read. When a period has two xlsx files, both must read
the same.

A VAT return reads by the labels of `Rekapitulacija` inside its two sections and by the form code on
each detail tab's total row. Every summary line must equal the detail tab it stands for, and a tab
the reader does not know is refused, so a new kind of supply fails loudly. A salary workbook has one
`Obračun plaće_<name>` tab per employee, each read by the labels in column A. Its title gives the
worked month, which must be the file's, and the payout date. Two tabs for the same name are refused.
A refused workbook prints its tab, row and reason.

Each return then gets two checks. The carry passes when the VAT position through the month, with the
`vat-settlement` rows to the month as booked so a refund lowers it, less the refund the return
claims, equals the return's `Pretplata za prijenos u buduća razdoblja` turned round. The form has no
line for a refund, so the refund claimed is what the previous month's return carried forward less
what this one brings forward in `Pretplata iz prethodnih razdoblja`, when that is more than zero. It
counts as received on the first `vat-settlement` row of that amount after the return's month and
within the three months after it. The script says so beside the carry, without the figure. Sales pass when every line of `Treće zemlje
usluge I` is the invoice of that number with the same amount, delivered in the month. A month between
two returns without one is listed as not filed. Each salary workbook gets two bank checks and the
rules. `- Država` must equal the rows of the taxes bucket with `owner-pay-tax` and without
`profit-distribution` within 5 days of the payout date, so a dividend tax paid that week stays out.
The employee's share less rent and refunds must be one owner-pay bank row of that week, as booked
before any split.

The rules run every line through the payroll engine and compare it to the cent. The city comes from
the note on the tax line and pillar II from its own line, and the dependants from the director's row
on the export's `employees` tab. A salary noted as the director's minimum base runs as an agreed
gross below the floor, so the engine finds the floor itself. A part month at the floor takes its days
worked from that row's `from` and `to`, counted against Monday to Friday of that month with public
holidays included, as the monthly fund of hours counts them. Without the row, or above the floor, its
rules are not run. Rent and refunds of costs listed beside the salary are not payroll, so they count only in
the total cost and in what the employee is paid. A total that adds gross I instead of gross II while
its two shares add up to the engine's total is a stated correction.

Then every payday month runs through `salaryReconciliation`, as *Salaries screen* describes, against
the salary workbooks read. Each month prints whether its lines agree and how many were compared,
each problem to resolve with the employee and line, and each year's tax-free payments paid apart
from the salary as in or over their cap. The problems are the books' to resolve, so they do not
change the exit code.

Each check prints as pass, FAIL, or corrected with the reason, then the counts. Any FAIL makes the
exit code non-zero. The workbooks and the export hold real figures, so the script prints no figure.
Never copy a figure from them into the repository.

Where the law leaves room, the engine follows the accountant: contribution bases come from the
month worked, so a December salary paid in January keeps December's director floor. Income tax
follows the payment date. The low-pay relief reduces only the pillar I base, which is practice and
not statute. A part month keeps the whole personal allowance. Youth relief is never applied in a
month, only in the annual settlement.

`payrollMonth` pays an employee who is not the director what the contract says, with no floor. The
`director` fact on the employees row turns the floor on. A non-director whose agreed full-time
gross is under the minimum wage (`hr.minwage`) gets a `below-minimum-wage` warning, which Salaries
lists as a problem. The monthly maximum base caps both pension pillars. The annual maximum base
(Art. 7(1)(19) of the Zakon o doprinosima) caps pillar I only, across every base of the year, so
the caller passes the earlier months' pension bases as `pensionBaseEarlierInYear` and pillar I
stops in the month the sum reaches the maximum. `taxableExtras` adds overtime, supplements or a
taxable bonus to the month's gross. Neither input is read from the books yet.

## Year-end parity

`npm run parity:year-end -- --workbook <export.xlsx> --year 2025` runs the accrual engine over an
xlsx export of the books, a split row through its parts and every row as booked, whatever its owner share, and compares every
line of that year's `year-end` rows with ours. It prints the bridge's steps with their kinds, then a
verdict per line. `pass` means ours equals the accountant's to the cent with no judgement behind it.
`judgement` means it equals because the engine took the accountant's figure, and names each
judgement with the difference it carries. `recorded` is a decision or a date the ledger cannot give,
checked where it can be: `paid-on` needs a corporate tax payment of our balance due on that day, and
the distribution lines must share out our profit after tax. The verdicts come from the same
comparison the Statements tab of the Year screen shows. `FAIL` gives the residual. Konto rows are listed by the
categories they share, with their differences and no verdict, since one category can sit on several
of them.

The exit code is non-zero unless the bridge's steps add up from the cash net to our profit before
tax, our profit before and after tax equal the accountant's to the cent, and no line fails. The export holds real company figures, so the script prints only verdicts and
differences. Keep the export outside the repository and never copy a figure from the output into
it.

## Google configuration

The app calls the Drive API, the Picker and, for mail drafts, the Gmail API. Three variables, read
at build time:

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
Picker and sign-in hosts, and requests go only to these hosts:

| Host | What the app asks it |
|---|---|
| `www.googleapis.com` | Drive: the books' file, its revisions and its backups, listing the invoice folders, making one, and uploading an invoice PDF (`/upload/drive/v3`), listing and downloading the files of the statements folder, and listing, downloading and exporting the accountant's workbooks |
| `gmail.googleapis.com` | The invoice mail draft, only once the user turned it on |
| `openidconnect.googleapis.com` | The userinfo endpoint |
| `oauth2.googleapis.com` | Token revocation, where `google.accounts.oauth2.revoke` posts |

The manifest and the service worker come from this origin only. Styles allow `'unsafe-inline'`
because Nuxt UI writes its colour variables into an inline `<style>`, and the Google Picker and
Identity Services libraries inject their own. Without it the Picker dialog loses its layout. The
dev server adds `ws://localhost:*` for hot reload.

## Ruleset

The Ruleset tab of Settings shows the Croatian law the d.o.o. pack computes with, as
`src/packs/hr-doo/ruleset/` holds it. Under the search sits the Watch list, collapsed, which
gathers the estimate, pending and unconfirmed versions with the matters the ruleset has no value for
yet, ten at a time. Then every rule is one line under its area (profit tax, owner pay, accounting,
VAT and company law), whose heading stays in view as the list scrolls: its name, its id, the value
of the version in force today and that version's confidence mark. The value is the version's first
rate, amount or count, or its first rate for a rule named for a rate, with the term's name when the
rule has more. An info button beside the list explains the marks. Estimate, pending and unconfirmed
versions are coloured.

A click on a line, or a link to `#/settings?tab=ruleset&rule=<id>`, opens the whole rule in a side
panel, a full-height sheet on a phone. The panel holds its value for every version, side by side on
a wide screen and one under another on a phone. Rates read as percentages with up to two decimals,
coefficients as factors such as 0.65, money in the app's money format, flags as yes or no, and table
terms as tables (cards on a phone). A value that differs from the version before is set in bold
with a brass mark. Each source links to the page that was loaded, in a new tab, with the act, the
article, the NN issues and the day it was checked. The rule's line is marked and scrolled to just
below the search bar, clearing a search that hides it, and closing the panel takes `rule` out of
the address. A rule opened from the list closes back to the list's own step in the history, so
the next Back leaves the list. A link to an id the ruleset does not have says so above the list. `ruleLink(id)` in
`ruleset/presentation/ruleWording.ts` builds the link, so a screen can send a figure to the rule it
rests on.

The search box matches every word typed against the rule id, title, values, notes, act names,
articles and NN issues. The area buttons narrow the list further.

A table term with more than 60 rows in a version opens on a search of its own and a Show all
button instead of every row. Today that is only the local income tax rates, which open on the unit
the director's row on the `employees` tab names.

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

## Licence

MIT
