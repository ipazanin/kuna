# Bank sync script

An Apps Script that holds the Enable Banking key for Kuna, which runs in a browser and may hold no private key. Kuna calls it through the Apps Script API (`scripts.run`) with your Google token, and it calls `api.enablebanking.com`. It stores one session id per bank in Script Properties, and nothing a bank answers.

Kuna does nothing with it until you save a deployment ID on Spending, Settings, Bank sync. Before that it asks Google for no new permission, sends no request and shows no sync step.

The real path has not been tried yet. Your first run is its first trial, and the checks are at the end.

## 1. The Enable Banking application

1. Enter your email at [enablebanking.com](https://enablebanking.com/) and open the one-time link. There is no separate signup. Open API applications in the Control Panel.
2. Add a new application, in the **production** environment, keeping the default of a key made in your browser. No certificate is involved.
3. Fill in the form:

   | Field                 | Value                                                  |
   | --------------------- | ------------------------------------------------------ |
   | Name                  | `Kuna`. Your banks show it when you approve            |
   | Description           | A line such as `Personal budgeting, read only`         |
   | Data protection email | Your own email                                         |
   | Privacy URL           | `https://ipazanin.github.io/kuna/privacy.html`         |
   | Terms URL             | `https://ipazanin.github.io/kuna/terms.html`           |
   | Redirect URL          | `https://ipazanin.github.io/kuna/`, exactly so, no `#` |

   Enable Banking adds `?code=...&state=...` to the redirect, and Kuna reads them from there.

4. Register. Your browser downloads `<application id>.pem`, and the file's name is the application's id. Keep the file out of this repository.
5. Press Activate by linking accounts and approve **every account Revolut and OTP offer**, since the API leaves out anything not linked here. This puts the application in restricted mode. It does not replace the approval Kuna asks for later, so you approve each bank twice. OTP is listed as beta, which Enable Banking says means only low traffic, and its page asks for your token's serial number as the username.

## 2. The Cloud project

The script and Kuna's OAuth client must share one standard Cloud project, so use Kuna's.

1. In Kuna's project, enable the **Apps Script API**.
2. On the OAuth consent screen, under Data Access, add the scope `https://www.googleapis.com/auth/script.external_request`.
3. Note the project **number** from the project's dashboard.

## 3. The script

1. Make a new project at [script.google.com](https://script.google.com/), signed in as the account you use Kuna with.
2. In Project Settings, tick Show "appsscript.json" manifest file, and under Google Cloud Platform Project change to the number from step 2.
3. Paste `Code.gs` and `appsscript.json` from this folder over the editor's files.
4. In Project Settings, under Script Properties, add:

   | Property                     | Value                                                                                                                            |
   | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
   | `ENABLE_BANKING_APP_ID`      | The application's id, the name of the `.pem` file                                                                                |
   | `ENABLE_BANKING_PRIVATE_KEY` | The whole `.pem`, from `-----BEGIN` to `-----END`. If the field drops the line breaks, write each one as the two characters `\n` |

   Script Properties are the only place the key lives. Delete the downloaded file once the first link works, or keep it in your password manager.

5. Deploy, New deployment, type **API executable**, and Deploy. The manifest sets who may run it to you alone.
6. Copy the **Deployment ID**, from Deploy, Manage deployments.

## 4. In Kuna

Set aside a quiet quarter of an hour. Revolut gives more than 90 days only for 5 minutes after you approve, and the fetch writes straight to the file.

1. Import your last Revolut file first, as recent as you can, and any other file you still mean to bring in. The sync takes over the day after a file's last row, for each account. Rows on or before that day are left out and the result says how many.
2. On Spending, Settings, Bank sync, paste the deployment ID and tap Save. Google asks for the one new permission.
3. Tap Link Revolut and approve. Tap Finish linking at once if it shows, which Firefox may need. Kuna then fetches every account the bank gives, including those it does not keep yet.
4. Read the result. An account Kuna keeps matches by IBAN and currency. Each one it does not keep is listed with a drafted name, kind and opening worked out from the bank's balance and rows, and Add, Add all or Leave out. An account that has the IBAN but other details offers Update account, or Keep mine to stop asking. The rows wait in the page until you tap, so add them before you reload. Undo there if it looks wrong. A fetch after Undo reaches back only 90 days.
5. Tap Link OTP and do the same. Its page asks for your token's serial number first.
6. In the script's editor, pick `logBankFields` from the function list and press Run. The execution log shows, for each linked account, the names of the fields Enable Banking returned and how many rows carry each, a count of each fixed bank code such as `status BOOK`, and no value. Copy it for the checks below.
7. Add a calendar reminder at day 165 of the 180. Kuna's home card warns from day 166, but only when you open it.

The sync step then runs with the page's sync, and leaves the banks alone for six hours on one device after they last answered, since many banks allow four unattended fetches a day. Sync now and the fetch after a link tell the bank you are there, which lifts that limit. A bank that fails or a link that ended early shows as a line on the step and on Settings, and the other bank's rows still come. The home card says so from 14 days before a link's 180 days run out, and Link again starts it over.

Each fetch reads the balance too, and a note says so when the bank's differs from Kuna's, with Set the opening to the amount that makes them agree. A row missing in the middle shows the same way, so check the rows before you tap it. When a fetch wanted rows older than 90 days and the bank gave none, a note says to link that bank again.

## Ending a link

Removing Kuna at Google does not end a bank link. Withdraw the consent at your bank or in Enable Banking's Control Panel, then delete that bank's `SESSION <bank>` row from Script Properties. Deleting `ENABLE_BANKING_PRIVATE_KEY` or the script stops everything. Linking a bank again closes the session it replaces.

## After changing the code

Deploy, Manage deployments, edit the deployment and pick New version. The deployment ID stays the same. Until a new version is deployed, Kuna drafts every new account as a current account, since the old script does not say which are savings.

## What to check on the first run

Setting up:

| Question                                                                                              | Where it shows                                                                  | If it goes wrong                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do Script Properties need a scope of their own? Google's reference names none, unlike `UrlFetchApp`'s | The first Link fails with "Specified permissions are not sufficient" or similar | Add `https://www.googleapis.com/auth/script.storage` to the manifest, add it to the Data Access scopes, and tell Kuna's `GoogleScope` to ask for it |
| Does `Project OAuth Scopes` on the script's Overview list only `script.external_request`?             | The script's Overview                                                           | The token must cover every scope listed there, so Kuna must ask for each                                                                            |
| Does Apps Script sign with the 4096-bit key the panel saves?                                          | The first Link fails naming the key                                             | Tell Claude what it says                                                                                                                            |
| Does the script answer `PERMISSION_DENIED`?                                                           | Bank sync says the script did not answer: 403                                   | The script's Cloud project differs from Kuna's, so repeat step 3.2                                                                                  |
| Do both ways back from a phone work? A bank app may open another browser                              | Bank sync says a bank came back to a browser that did not start the link        | Link from the browser your phone opens links in, or from a computer                                                                                 |
| Does OTP link at all? It is listed as beta, and one Enable Banking page still says not yet supported  | The approval or the first fetch fails with a line naming OTP                    | Keep OTP's statements as they are, since only one approval is lost                                                                                  |

For what the banks return, read the `logBankFields` log and the first result, and tell Claude the answers:

| Question                                                                                                                                                                                             | Where it shows                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| How does each bank split accounts? One per currency, one `XXX`, and do pockets or savings come as accounts?                                                                                          | The log's account lines, and "has more than one account that fits" on the result        |
| Does every account carry an IBAN?                                                                                                                                                                    | `hasIban` in the log. An account without one is listed as one Kuna does not keep        |
| Which balances does each bank give, and is a booked one (`ITBD` or `CLBD`) among them?                                                                                                               | `balance_type` in the log. Without a booked one a note may just mean rows are pending   |
| Does `/balances` count towards the four unattended reads?                                                                                                                                            | "was not checked" on a later automatic sync                                             |
| Is the first balance note clear of differences, with no gap and the right opening?                                                                                                                   | The result line, and each account's balance in the bank's app                           |
| Does a card row carry `transaction_date`, and how often is it another day than `booking_date`?                                                                                                       | `transaction_date` and `madeOnAnotherDay` in the log                                    |
| Is `entry_reference` on every row, and does a second Sync now bring nothing new?                                                                                                                     | `entry_reference` in the log, and "already in" on the second result                     |
| Do days carry a time? Two exchanges or pocket moves alike on one day wait on review, and a time could tell them apart                                                                                | The `...WithTime` counts in the log                                                     |
| How does an exchange look: both legs, on which accounts, with `exchange_rate` filled? Kuna pairs two legs on one day whose amounts follow the rate within 1%, and without a rate they wait on review | `exchange_rate` in the log, and the rows on To review                                   |
| How does a pocket move look: one leg or two, and on which account? Kuna pairs it only when the pocket comes as an account of its own, kept as a savings account                                      | The rows on To review                                                                   |
| Is a fee inside the row's amount? Compare one row with a fee with the bank's app                                                                                                                     | The row's amount. There is no fee field to read, so Bank fees reads low if it is inside |
| Is a foreign card payment's amount in the account's currency?                                                                                                                                        | A row on the wrong currency's account, or a note of a row in another currency left out  |
| Does the first row after the last file day double a row, or does one go missing?                                                                                                                     | The balance note, in the days after the switch. Fix it by hand and tell Claude          |
