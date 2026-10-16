# Ledgerboard

Company finance dashboards over a workbook of bank transactions, computed in the browser. The
workbook is either a Google Sheet, which stays the system of record, or an Excel file kept in the
browser (Excel mode). There is no backend. It deploys to GitHub Pages at
`https://ipazanin.github.io/ledgerboard/`, with a privacy page at `privacy.html`.

With a Google Sheet, the app asks Google for `drive.file`, which covers files the user picks in the
Google Picker or that the app creates, and for `openid email`, which tells it which account signed
in. The app reads the Sheet and keeps a copy in IndexedDB. It writes nothing back.

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
| `ledger` | `date` (a date cell), `account`, `statement`, `counterparty`, `counterparty_iban`, `description`, `amount`, `balance`, `category`, `family`, `bucket`, `month`, `flagged_by`, `reference`. `family`, `bucket` and `month` are filled in on export and ignored on import. |
| `categories` | `category`, `family`, `bucket` (one of `income`, `operating`, `taxes`, `owner-pay`, `financing`, `neutral`), `colour`, and an optional comma-separated `roles` |
| `accounts` | `account`, `iban`, and an optional `currency` |
| `settings` | `key`, `value`, one row per setting |

`flagged_by` values `rule` and `ai` belong to the categoriser: `ai` marks a guess that waits for
review. Any other value means a person set the category.

### Settings keys

A blank value means the default. An unknown key is kept and reported. A value that does not hold
falls back to the default and is reported with its row, in the import summary and on Settings. The
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
| `owner_pay_module` | `TRUE` | `FALSE` hides owner pay and owner earns. Rows in the `owner-pay` bucket then count as operating cost, so costs and net do not change. |
| `review_label` | `human` | The `flagged_by` value a person's confirmation will write. `rule` and `ai` are taken. |

Bucket labels must differ from each other and from the names of the derived lines (Net, All costs,
Owner earns, Kept). Theme is a per-device choice and not a workbook setting.

## Excel mode

The workbook lives in IndexedDB, under its own id, as the store of record. The app asks the browser
to keep it (`navigator.storage.persist()`, which Firefox shows as a prompt). Clearing the site's data
deletes it, so the exported files are its only other copies.

- **Template.** "Download the empty template" writes a blank xlsx in the browser: the four tabs
  with their headers, a note on every header and every settings key, a default category set for a
  freelancer or a small company, and the default settings.
- **Import.** Open or drop an xlsx file. It goes through the same workbook reader as a Google Sheet,
  and a summary (transactions, dates, accounts, categories, every problem) shows before anything is
  replaced. A file without a `ledger` tab is refused.
- **Export.** From either mode, "Export to Excel" writes the workbook in the template format as
  `ledgerboard-<company or sheet name>-<yyyy-mm-dd>.xlsx`. Importing an export gives the same
  workbook. When changes have gone a week or more without an export, the sidebar says so.
- **Editing.** In Excel mode Settings edits the settings, categories and accounts, with the Sheet's
  rules: each category once, category, family and bucket filled, and a category or account that
  ledger rows use keeps its name. Ledger rows are changed in Excel and imported again. With a Google
  Sheet these are read-only on Settings and edited in the Sheet.

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
other, a part-month at each end, one loss month, a reimbursement and two rows waiting for review.
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

## Figure parity

`npm run parity:figures -- --workbook <export.xlsx>` computes every figure from an xlsx export of the
Sheet and compares it with the figure the Sheet's own analysis tabs show in the same export. It
prints each figure as a match, a correction the app makes on purpose (with the reason), or a
MISMATCH, and exits non-zero on any mismatch. The export holds real bank data. Run it locally, keep
the file outside the repository, and never commit an export or any figure from its output.

In development and fake builds, `#/gallery` shows every shared component and chart style with
made-up figures, in whichever theme `?theme=light` or `?theme=dark` pins. The route does not exist
in a production build.

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
only from this origin and from Google's two script hosts, frames only from Google's Picker and
sign-in hosts, and requests go only to the Sheets and Drive APIs, the userinfo endpoint and the
token revocation endpoint (`oauth2.googleapis.com`, where `google.accounts.oauth2.revoke` posts).
The manifest and the service worker come from this origin only. Styles allow `'unsafe-inline'`
because Nuxt UI writes its colour variables into an inline `<style>`, and the Google Picker and
Identity Services libraries inject their own. Without it the Picker dialog loses its layout. The
dev server adds `ws://localhost:*` for hot reload.

## Licence

MIT
