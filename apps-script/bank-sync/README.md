# Bank sync script

An Apps Script that holds the Enable Banking key for Kuna, which runs in a browser and may hold no private key. Kuna calls it through the Apps Script API (`scripts.run`) with your Google token, and it calls `api.enablebanking.com`. It stores one session id per bank in Script Properties, and nothing a bank answers.

Kuna does nothing with it until you save a deployment ID on Spending, Settings, Bank sync. Before that it asks Google for no new permission, sends no request and shows no sync step.

The real path has not been tried yet. Your first run is its first trial, and the checks are at the end.

## 1. The Enable Banking application

1. Sign in at [enablebanking.com](https://enablebanking.com/) with your email and open API applications in the Control Panel.
2. Add a new application, in the **production** environment, keeping the default of a key made in your browser.
3. Give it a name, which your banks show you when you approve. A production application also asks for a data protection email and a privacy address, for which `https://ipazanin.github.io/kuna/privacy.html` is the one to give.
4. Add `https://ipazanin.github.io/kuna/` as the redirect URL, exactly so, with no `#`. Enable Banking adds `?code=...&state=...` to it, and Kuna reads them from there.
5. Register. Your browser downloads `<application id>.pem`, and the file's name is the application's id. Keep the file out of this repository.
6. Press Activate by linking accounts and approve your OTP and Revolut accounts. This puts the application in restricted mode, which reads only the accounts linked here. It does not replace the approval Kuna asks for later, so you approve each bank twice.

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

1. On Spending, Settings, Bank sync, paste the deployment ID and tap Save. Google asks for the one new permission.
2. Tap Link OTP. Approve at the bank, and Kuna comes back and fetches at once, since many banks give more than 90 days only in the first hour after an approval. Then the same for Revolut.
3. Each account goes to the Spending account with its IBAN and currency, so give those accounts their IBANs first. An account Kuna does not keep is listed with Add an account.

The sync step then runs with the page's sync, and leaves the banks alone for six hours on one device after they last answered, since many banks allow four background fetches a day. A bank that fails or a link that ended early shows as a line on the step and on Settings, and the other bank's rows still come. Sync now on Settings asks whenever you tap it. The home card says so from 14 days before a link's 180 days run out, and Link again starts it over.

## Ending a link

Removing Kuna at Google does not end a bank link. Withdraw the consent at your bank or in Enable Banking's Control Panel, then delete that bank's `SESSION <bank>` row from Script Properties. Deleting `ENABLE_BANKING_PRIVATE_KEY` or the script stops everything. Linking a bank again closes the session it replaces.

## After changing the code

Deploy, Manage deployments, edit the deployment and pick New version. The deployment ID stays the same.

## What to check on the first run

| Question                                                                                                         | Where it shows                                                                  | If it goes wrong                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do Script Properties need a scope of their own? Google's reference names none, unlike `UrlFetchApp`'s            | The first Link fails with "Specified permissions are not sufficient" or similar | Add `https://www.googleapis.com/auth/script.storage` to the manifest, add it to the Data Access scopes, and tell Kuna's `GoogleScope` to ask for it |
| Does `Project OAuth Scopes` on the script's Overview list only `script.external_request`?                        | The script's Overview                                                           | The token must cover every scope listed there, so Kuna must ask for each                                                                            |
| Does Apps Script take the key as Enable Banking's browser saves it?                                              | The first Link fails naming the key                                             | Turn it into PKCS#8 with `openssl pkcs8 -topk8 -nocrypt -in <id>.pem` and store that                                                                |
| Does the script answer `PERMISSION_DENIED`?                                                                      | Bank sync says the script did not answer: 403                                   | The script's Cloud project differs from Kuna's, so repeat step 3.2                                                                                  |
| Does a Revolut card row carry `transaction_date`, the day a Revolut file calls Started Date?                     | A file dropped after a sync doubles a card row that booked days later           | Tell Claude which fields it carries, since the same-day test depends on it                                                                          |
| How does Revolut split currencies and pockets? Enable Banking's docs say a multi-currency account comes as `XXX` | Rows land on the wrong account, or an account shows as one Kuna does not keep   | Tell Claude what the accounts look like                                                                                                             |
| Do both ways back from a phone work? A bank app may open another browser                                         | Bank sync says a bank came back to a browser that did not start the link        | Link from the browser your phone opens links in, or from a computer                                                                                 |
