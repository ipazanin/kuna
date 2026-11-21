# Bank sync script

An Apps Script that relays Kuna's calls to Enable Banking, since a page cannot reach `api.enablebanking.com` itself. Kuna calls it through the Apps Script API (`scripts.run`) with the person's Google token. The page signs each call with the person's own Enable Banking key and passes the token first, with the session ids the call needs. The script keeps nothing: no key, no session and nothing a bank answers. It cuts each answer down to the fields Kuna reads.

One deployment serves everyone. Each person makes their own Enable Banking application, and Spending, Settings, Bank sync walks them through it. Their key and their sessions stay in their browser and in their own Google account's secrets file, as their AI keys do.

This page is the owner's deployment note.

## 1. The Cloud project

The script and Kuna's OAuth client must share one standard Cloud project, so use Kuna's.

1. In Kuna's project, enable the **Apps Script API**.
2. On the OAuth consent screen, under Data Access, add the scope `https://www.googleapis.com/auth/script.external_request`.
3. Note the project **number** from the project's dashboard.

## 2. The script

1. Make a new project at [script.google.com](https://script.google.com/), signed in as Kuna's owner.
2. In Project Settings, tick Show "appsscript.json" manifest file, and under Google Cloud Platform Project change to the number from step 1.
3. Paste `Code.gs` and `appsscript.json` from this folder over the editor's files. Script Properties stay empty.
4. Deploy, New deployment, type **API executable**, and Deploy. The manifest sets who may run it.
5. Copy the **Deployment ID**, from Deploy, Manage deployments.
6. Set the repository's Actions variable `VITE_BANK_SYNC_DEPLOYMENT` to it, and the same in `.env.local` for development. A build without it says on Bank sync that it has no bank sync script.

## 3. In Kuna

Set aside a quiet quarter of an hour once the application is active. Revolut gives more than 90 days only for 5 minutes after you approve, and the fetch writes straight to the file.

1. Import your last Revolut file first, as recent as you can, and any other file you still mean to bring in. The sync takes over the day after a file's last row, for each account. Rows on or before that day are left out and the result says how many.
2. On Spending, Settings, Bank sync, follow the set-up to make your Enable Banking application, bring its key and tap Check. Google asks for the one new permission.
3. Tap Link Revolut and approve. Tap Finish linking at once if it shows, which Firefox may need. Kuna then fetches every account the bank gives, including those it does not keep yet.
4. Read the result. An account Kuna keeps matches by IBAN and currency. Each one it does not keep is listed with a drafted name, kind and opening worked out from the bank's balance and rows, and Add, Add all or Leave out. An account that has the IBAN but other details offers Update account, or Keep mine to stop asking. The rows wait in the page until you tap, so add them before you reload. Undo there if it looks wrong. A fetch after Undo reaches back only 90 days.
5. Tap Link OTP and do the same. Its page asks for your token's serial number first.
6. Open What your banks send under the bank list and tap Read what they send. It shows, for each linked account, the names of the fields Enable Banking returned and how many rows carry each, a count of each fixed bank code such as `status BOOK`, and no value. Copy it for the checks below.
7. Add a calendar reminder at day 165 of the 180. Kuna's home card warns from day 166, but only when you open it.

The sync step then runs with the page's sync, and leaves the banks alone for six hours on one device after they last answered, since many banks allow four unattended fetches a day. Sync now and the fetch after a link tell the bank you are there, which lifts that limit. A bank that fails or a link that ended early shows as a line on the step and on Settings, and the other bank's rows still come. The home card says so from 14 days before a link's 180 days run out, and Link again starts it over.

Each fetch reads the balance too, and a note says so when the bank's differs from Kuna's, with Set the opening to the amount that makes them agree. A row missing in the middle shows the same way, so check the rows before you tap it. When a fetch wanted rows older than 90 days and the bank gave none, a note says to link that bank again.

## Ending a link

Removing Kuna at Google does not end a bank link. Remove bank sync on Bank sync closes every session, forgets the key in the browser and in the Google account, and clears the book's bank sync. A bank link also ends when you withdraw the consent at your bank or in Enable Banking's Control Panel. Linking a bank again closes the session it replaces.

## After changing the code

Deploy, Manage deployments, edit the deployment and pick New version. The deployment ID stays the same, so `VITE_BANK_SYNC_DEPLOYMENT` does too. Deploy a version whose functions take new parameters only once the page that sends them is live.

## What to check on the first run

Setting up:

| Question                                                                                             | Where it shows                                                           | If it goes wrong                                                         |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Does `Project OAuth Scopes` on the script's Overview list only `script.external_request`?            | The script's Overview                                                    | The token must cover every scope listed there, so Kuna must ask for each |
| Does the browser sign with the 4096-bit key the panel saves?                                         | Check on Bank sync fails naming the key                                  | Tell Claude what it says                                                 |
| Does the script answer `PERMISSION_DENIED`?                                                          | Bank sync says the script did not answer: 403                            | The script's Cloud project differs from Kuna's, so repeat step 2.2       |
| Do both ways back from a phone work? A bank app may open another browser                             | Bank sync says a bank came back to a browser that did not start the link | Link from the browser your phone opens links in, or from a computer      |
| Does OTP link at all? It is listed as beta, and one Enable Banking page still says not yet supported | The approval or the first fetch fails with a line naming OTP             | Keep OTP's statements as they are, since only one approval is lost       |

For what the banks return, open What your banks send on Bank sync, tap Read what they send, copy it with the first result, and tell Claude the answers:

| Question                                                                                                                                                                                             | Where it shows                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| How does each bank split accounts? One per currency, one `XXX`, and do pockets or savings come as accounts?                                                                                          | The account lines of what the banks send, and "has more than one account that fits" on the result |
| Does every account carry an IBAN?                                                                                                                                                                    | `hasIban` in what the banks send. An account without one is listed as one Kuna does not keep      |
| Which balances does each bank give, and is a booked one (`ITBD` or `CLBD`) among them?                                                                                                               | `balance_type` in what the banks send. Without a booked one a note may just mean rows are pending |
| Does `/balances` count towards the four unattended reads?                                                                                                                                            | "was not checked" on a later automatic sync                                                       |
| Is the first balance note clear of differences, with no gap and the right opening?                                                                                                                   | The result line, and each account's balance in the bank's app                                     |
| Does a card row carry `transaction_date`, and how often is it another day than `booking_date`?                                                                                                       | `transaction_date` and `madeOnAnotherDay` in what the banks send                                  |
| Is `entry_reference` on every row, and does a second Sync now bring nothing new?                                                                                                                     | `entry_reference` in what the banks send, and "already in" on the second result                   |
| Do days carry a time? Two exchanges or pocket moves alike on one day wait on review, and a time could tell them apart                                                                                | The `...WithTime` counts in what the banks send                                                   |
| How does an exchange look: both legs, on which accounts, with `exchange_rate` filled? Kuna pairs two legs on one day whose amounts follow the rate within 1%, and without a rate they wait on review | `exchange_rate` in what the banks send, and the rows on To review                                 |
| How does a pocket move look: one leg or two, and on which account? Kuna pairs it only when the pocket comes as an account of its own, kept as a savings account                                      | The rows on To review                                                                             |
| Is a fee inside the row's amount? Compare one row with a fee with the bank's app                                                                                                                     | The row's amount. There is no fee field to read, so Bank fees reads low if it is inside           |
| Is a foreign card payment's amount in the account's currency?                                                                                                                                        | A row on the wrong currency's account, or a note of a row in another currency left out            |
| Does the first row after the last file day double a row, or does one go missing?                                                                                                                     | The balance note, in the days after the switch. Fix it by hand and tell Claude                    |
