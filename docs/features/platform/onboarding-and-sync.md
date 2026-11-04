# Onboarding, a seamless sync and mail in the app: proposal

One routed onboarding that asks for Google access once, for what the user switches on, lets them choose statements by hand, from a Drive folder or from their mail, and confirms the full folder path before the file is made. One sync that runs every enabled step in order, mail included, with progress in the sync control, one in-memory token fetched without a tap on open, and a missing permission shown as one action in the control.

This answers the items you queued in plan.md: "Queued by the owner: good quality onboarding" and "Queued by the owner: a seamless sync" (both 2026-10-25), and "Queued by the owner: mail in the app". Four read-only lanes fed the onboarding and sync part: the code, Google's primary sources, onboarding and the sync engine. The lanes read 9487050. HEAD moved to facccb0 ("Pick another file", pushed) during the research, and the working tree is clean. A review on 2026-10-26 checked every file and line cited in that part at facccb0 and loaded the Google, MDN and comparable-app pages again. Three more read-only lanes researched mail at facccb0: the four Gmail filing scripts, Google's rules for Gmail from a browser, and the design. Their full findings, filing rules and retirement steps are in [mail.md](research/onboarding-and-sync/mail.md), which stays the detailed mail reference. Nothing ran against Google or Gmail. Screen counts at Google's own pages are unverified.

## The answer

**Today a sync is three separate mechanisms that each ask Google on their own.** The open of the app bounces through Google for the Drive read token only. The Sync tap needs a second token, the `drive.file` one, which the open never renews. The statements step runs only if the read token happens to be in page memory, and otherwise a toast after the sync asks for a second tap. The accountant read is not part of the sync at all. It runs only while Year, Taxes is on screen. Mail is filed into Drive by four Apps Scripts on daily triggers, outside the app.

| Situation                                       | Today                                                                                                                                                                                                                        | Proposed                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| You, Firefox for Android, first open of the day | 3 trips to Google, 1 tap on Sync, then 3 taps to reach Year, Taxes for the accountant read                                                                                                                                   | 1 silent trip, 0 taps. Books, mail, statements and accountant files all sync on open                                                                  |
| You, Firefox on the Mac, first open of the day  | 1 silent trip, 1 tap, 1 popup that probably closes itself (unverified), then 2 taps to reach Year, Taxes for the accountant read                                                                                             | 1 silent trip, 0 taps                                                                                                                                 |
| You, Mac tab open over an hour, tap Sync        | 1 popup for the books, then the "New statements not checked" toast, a second tap and a second popup                                                                                                                          | 1 tap, then either 1 silent trip or 1 popup (decision 2)                                                                                              |
| The bank's statement mail arrives               | The Erste fetch files it at 06:00, and a later sync imports it                                                                                                                                                               | The mail waits in Gmail. The next sync files it and imports it in the same run                                                                        |
| New user, phone, start empty on Drive           | The tap goes to Google and comes back to "Signed in to Google… Tap it again". A wrong "Moved 86 records" toast. The first statement cannot import (no account). The first check for statements fails on your own folder path | One consent screen for what they switched on, back into the same step, folder confirmed with its full path, the account made from the first statement |
| New user, desktop                               | 2 consent popups, 2 toasts, Croatian pack on by default                                                                                                                                                                      | 1 consent, 0 toasts, the pack only if they say they are a Croatian d.o.o.                                                                             |

**What changes.** One token, held in page memory, carries every scope the user's settings need. The open fetches it with `prompt=none` in one trip, so auto-sync can run on open on both devices. That one trip still has to be proved by the stage 0 spike. A sync is an ordered list of steps (books, mail, statements, accountant folders), each declaring its scope and whether it is on. Each step reports in the sync control and in Settings, never in a toast. A step whose permission is missing shows "Allow access" in the control, and that one tap asks Google and resumes the sync. Onboarding gets its own route, asks for Google access once for the features the user switched on, before any file is opened, so a phone redirect returns into the step it left. The folder step shows and confirms the full path.

**Mail moves into the app, opt-in per user.** The four scripts that file the bank's and the accountant's mail become the mail step. Gmail is read only on a sync, never in the background, so mail lands at the next sync instead of at 06:00. Nothing is lost while the app is closed, because the mail waits in Gmail. The Google cost is one more restricted scope, `gmail.readonly`, only for users who switch mail on. Up to 100 users that means Google's unverified-app screen before the consent, the same screen Drive read and mail drafts already bring. Beyond 100 the app needs Google's restricted-scope verification, about six weeks of review, and possibly a yearly security assessment (decision 9). In onboarding a new user picks how statements arrive (by hand, a Drive folder, or from my mail), and by hand stays the default. You keep the same files in the same folders. The Erste fetch retires after a week of overlap and the three accountant filers after one monthly cycle.

## 1. Findings that shape the design

### What Google allows without a tap

- **A popup always needs a tap.** The GIS token model needs a user gesture "for every token request, including replacing expired tokens" ([choose an authorization model](https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model)). Automatic token refresh "is not supported by the Google Identity Services library" ([migration guide](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis)). Browsers open a popup only "in direct response to user input", and "a separate user gesture event is required for each `Window.open()` call" ([MDN window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)). Transient activation "expires after a timeout" and "may also be consumed by some APIs (like `Window.open()`)" ([MDN user activation](https://developer.mozilla.org/en-US/docs/Web/Security/User_activation)). MDN gives no timeout length for Firefox. So a slow step before the popup can outlast the tap, and one tap opens one popup.
- **A full-page redirect with `prompt=none` needs no tap.** Google shows no screen and "will return an error if the user is not already authenticated and has not pre-configured consent for the requested scopes" ([OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)). It costs a page reload, so it fits the open of the app, not the middle of a request.
- **No refresh token without a server.** The token model issues none, and a token lives about an hour (`expires_in` 3600 on the [implicit-flow page](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow), 3599 s in your Wave 0 test). The code flow needs a backend ([code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model)).
- **No hidden-frame renewal.** The GIS token client offers only its popup: "only the dialog UX is supported" ([use the token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)). Firefox keys cookies by the top-level site, by default since Firefox 103 ([MDN state partitioning](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning)), so a Google frame inside the app would not see the person's Google cookies. Both the popup and the redirect load Google as the top-level page, so our reading is that neither is affected. MDN describes partitioning for embedded resources and does not state the top-level case.

So: **after an hour, a running tab can get a new token only by a tap (popup) or by leaving the page (redirect).** Nothing renews quietly in the background.

### Several scopes in one consent

- `scope` takes several scopes separated by spaces. With more than one non-sign-in scope, Google shows a checkbox per scope and the user can untick any ([how user authorization works](https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works), [granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions)). `enable_granular_consent` is "Deprecated, no effect if set" ([GIS reference](https://developers.google.com/identity/oauth2/web/reference/js-reference)).
- The app reads what was granted from the token's `scope` field ([implicit flow](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)) and "should handle the denial of scopes by disabling relevant functionality" ([best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)).
- `include_granted_scopes=true` "will automatically add scopes previously granted by the user" to the request (implicit-flow page), and the GIS token client defaults to true ([GIS reference](https://developers.google.com/identity/oauth2/web/reference/js-reference)). The combined token should set it false and list exactly the scopes the enabled steps need, so a Gmail grant from months ago does not ride along.
- **One redirect returns one token** (implicit-flow page). Today's split into a stored `drive.file` token and an in-memory read token is why the phone makes two or three trips.
- **Unconfirmed, and it decides the silent ask:** whether `prompt=none` for three scopes, one of them never granted, fails as a whole or returns a token for the two granted. The OpenID page reads as "fails as a whole". The design therefore asks silently only for scopes the last token showed as granted, and asks with a tap for a newly enabled one. A spike settles it (stage 0).

### Up front versus in context

Google's policy says "Where possible, you must ask for scopes in context with incremental authorization" and to give a justification first ([OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies)). Best practices say not to ask for data access at first sign-in unless it is essential ([best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)). Your "ask once up front" stays inside this if onboarding asks only for the features the user just switched on, each with a one-line reason, behind one button. The switch is the intent. Google enforces this at verification, and the app is not verified.

### What each scope costs

| Scope            | Google's wording                                                                                                                                                      | Class                                                                                                      | Needed for                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `drive.file`     | "See, edit, create, and delete only the specific Google Drive files you use with this app" ([scopes](https://developers.google.com/identity/protocols/oauth2/scopes)) | Non-sensitive ([Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)) | The books file, its backups, the Picker, filing mail into folders the app made                                 |
| `drive.readonly` | "See and download all your Google Drive files"                                                                                                                        | Restricted                                                                                                 | Statements from a Drive folder, accountant folders, the full folder path, finding the folders the scripts made |
| `gmail.compose`  | "Manage drafts and send emails" ([Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes))                                                       | Restricted                                                                                                 | Invoice mail drafts. It can send mail too                                                                      |
| `gmail.readonly` | "View your email messages and settings" ([Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes))                                               | Restricted                                                                                                 | Filing the bank's and the accountant's mail                                                                    |

- A restricted scope that is not declared and verified shows Google's unverified-app screen "before it displays the consent screen". The project is then limited to "100 new users in total, after the app presents the unverified app screen", a cap "removed only after an app has been successfully verified" ([unverified apps](https://support.google.com/cloud/answer/7454865), [personal use](https://support.google.com/cloud/answer/13464323)). The cap "applies over the entire lifetime of the project, and it cannot be reset or changed", your own accounts count, and running out can end in "Google sign-in being disabled" ([Audience](https://support.google.com/cloud/answer/15549945), [verification](https://support.google.com/cloud/answer/13463817)). Once verified, restricted scopes need "re-verification" every year ([app verification](https://support.google.com/cloud/answer/9110914)). Both Drive read and mail drafts are kept off the consent screen's Data Access page on purpose (plan.md, Wave 9 and Wave 13). plan.md says `gmail.compose` was left off "to stay out of verification" (line 538), but Google lists it as restricted regardless, like `drive.readonly` ([restricted scopes](https://support.google.com/cloud/answer/13464325)). So a new user's default path should work on `drive.file` alone.
- **Testing status would undo all of this.** In Testing, "Authorizations by a test user will expire seven days from the time of consent" ([Audience](https://support.google.com/cloud/answer/15549945)). plan.md contradicts itself: Wave 0 step 1 says "publishing status Production", and the Wave 9 risk says "while the project stays in testing mode". Wave 13 asked the planning session to read the Audience page, and nothing records that it did. You need to read the Audience page (stage 0).
- The plan's Risks table still says "`drive.file` only, no sensitive scope". That has not been true since `gmail.compose` (Wave 9) and `drive.readonly` (Wave 13), and it should be corrected.

### What the code does today

- **The desktop also leaves the page on every open.** `askForDriveReadSilently` has no device check (`googleAuth.ts:224-236`), and `main.ts:27-36` calls it for every online open of Drive books, unless this tab already noted a refusal. So the bounce on open is already a cost you pay on both devices.
- **The open renews the wrong token.** It fetches `drive.readonly` only. Auto-sync needs a `drive.file` token under an hour old (`autoSync.ts:21-28`, `createWorkbookStore.ts:372-374`), so a morning open shows the cached copy and waits for a tap.
- **On a phone, Sync after the hour is three trips**: the open's silent trip, the tap's `drive.file` redirect (which unloads the page and loses the read token), and a second silent trip on the return (`googleAuth.ts:224-236`, `useGoogleReturn.ts:47-50`).
- **Missing access is reported after the fact in five places**, none of them the sync control: the toast after Sync (`useStatementSync.ts:179-194`), the toast when the ask fails (`useStatementSync.ts:163-172`), the refused-return toast (`useGoogleReturn.ts:27-35`), Overview "Waiting for you" (`OverviewScreen.vue:71, 216-228`) and the statements card (`StatementFolderCard.vue:69-79`). The accountant card adds a sixth. Its button says "Check for new statements" on a card about the accountant's files (`AccountantReturns.vue:47-56`). It asks for the read token and runs the statements sync, and only then do the cards read (`useAccountantDocuments.ts:59-60`).
- **Two ways to sync.** LedgerGate's "Sync" and "Try again" call `store.sync()` and skip statements (`LedgerGate.vue:38, 77`). App.vue's control calls `syncByHand` (`App.vue:93`).
- **A Sync tap during a save is dropped without a word** (`createWorkbookStore.ts:243-246`).
- **On a phone, four actions are lost on the way to Google**: Start empty and Keep on Drive (`documentStorePorts.ts:88-90`), a write with an expired token (`:124-127`), invoice Drive access (`invoiceGoogle.ts:15`) and Gmail drafts (`googleAuth.ts:187-190`). Each returns to "Tap it again" or "Make the invoice again" (`useGoogleReturn.ts:37-64`). Open a file loses its preview (`ImportDialog.vue:191-193`).
- **Gmail may need two popups from one click** (`useInvoiceRun.ts:385-386`). Whether Firefox lets the second open is unverified.

### What a new user meets today

- **The welcome card asks a storage question first**, with 177 to 188 words of storage detail across three equal choices, counted on the fake build of 9487050 at 360 and 1440 px. The only change at facccb0 is the "Pick another file" button.
- **The folder step has no path and no confirm.** The Picker title is "Pick the folder for the books" (`workbookStore.ts:31`) and the file is created right after the pick (`documentStorePorts.ts:94-99`). This is how your move landed in `_to-delete/work/company/shadow-accounting/`. The Picker's `Document` has a `PARENT_ID` but no path ([Picker document](https://developers.google.com/workspace/drive/picker/reference/picker.document)). With `drive.readonly` the app can walk the parents to My Drive, as the statement sync already does. Whether `drive.file` can read the picked folder's parent is unconfirmed (a 404 is likely).
- **An empty start cannot import its first statement.** The empty workbook has no accounts (`emptyWorkbook.ts`), and a camt file for an unknown IBAN is refused with "Add the account on Settings, Accounts first" (`camtStatement.ts:76`). The camt file already names its IBAN, currency and opening balance.
- **The defaults are your own Drive paths and your pack.** `statements_folder` defaults to `work/company/business-bank-account/erste/statements` (`statementFiles.ts:10`), the accountant folders to `work/company/company-finance/…` (`companyFacts.ts:27,30`), and `owner_pay_module` to true (`settings.ts:131`), which alone shows the whole Croatian pack (`packContribution.ts:91-93`).
- **Your books store only one of these explicitly.** Checked on the Drive mirror's copy of `ledgerboard-company.json`, saved 2026-10-25 15:23 UTC (keys only, no values read out): its 33 settings rows hold `statements_folder`, but no `owner_pay_module`, `hr_vat_returns_folder` or `hr_payroll_folder` row. Your pack and accountant read run on the code defaults. Changing a default would turn them off for you unless the rows are written first. Saving Settings does not write them: it writes only the values that changed (`changedSettings` and `changedPackSettings`, `settings.ts:770, 795`). The one exception is `statements_folder`, written when its row is missing (`generalSettingsToSave`, `settings.ts:786-792`).
- **Start empty on Drive says "Moved 86 records … read it back and found the same records"** (`useKeepOnDrive.ts:33-38`). Nothing moved. The 86 are the default categories and settings.
- **Nothing tells a new user how statements reach the app.** Your Apps Script fetch is yours alone.

### Mail, in short

The full findings, with every file, line and page, are in [mail.md](research/onboarding-and-sync/mail.md) under "1. Findings".

- **The app can take over all four scripts.** All four script queries are plain sender, subject and attachment searches. The Gmail API covers them with `messages.list` and `q`, `messages.get` for the headers and `attachments.get` for the bytes ([users.messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)). Google's JavaScript quickstart calls Gmail with `gmail.readonly` from a page ([quickstart](https://developers.google.com/workspace/gmail/api/quickstart/js)), the app already calls `gmail.googleapis.com` for drafts, and the CSP allows it. Quota is no concern.
- **`gmail.readonly` is the narrowest scope that works.** `gmail.metadata` cannot use `q`, cannot download attachments ([attachments.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get)), and is restricted as well. A label would need `gmail.modify`, a write grant on the whole mailbox. The history feed lasts about a week and push needs a server, so the design searches with `q`.
- **Verification is uncertain on three counts.** Gmail's approved uses may or may not cover filing bank statements ([Workspace user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). Google's pages disagree on whether the yearly assessment applies to an app with no server ([restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification), [Help Center](https://support.google.com/cloud/answer/13464321)), so plan as if it could be required. The home page must sit on a verified domain you own, and no Google page says whether a github.io subdomain counts ([public suffix list](https://publicsuffix.org/list/public_suffix_list.dat)). The policy also wants tokens encrypted at rest, which the in-memory token of decision 1 answers.
- **The scripts have gaps the move fixes.** The Erste fetch reads its folder and accounts from the archived Sheet, so an account added only in the app is filed without its account (latent today). Payroll probably runs near noon, because its manifest is on New York time ([clock trigger builder](https://developers.google.com/apps-script/reference/script/clock-trigger-builder), not checked against the Executions log). The Erste search has no time window. The 90-day window left the VAT returns for 2025-10, 2026-01, 2026-02 and 2026-04 unfiled, if those mails exist. Failures show only in Apps Script.
- **One unknown blocks the filing.** `drive.file` can't see the year and month folders the scripts made (Wave 0). Whether it can still create a file in one, with the folder id found through `drive.readonly`, is unconfirmed (stage 0 spike 8). If it can't, you pick about seven existing folders once, through the Picker step invoicing already has. A new user never meets this, because the app makes every folder it files into.
- **Limits that stay.** Under `drive.file` the app can't trash or replace a file a script filed (decision 12). The API matches messages, not whole threads ([filtering](https://developers.google.com/workspace/gmail/api/guides/filtering)), so an attachment on a reply from another sender stops being filed. The accountant rules fit only your accountant's file names (decision 13). Mail deleted before the next sync is never filed. A file dropped by hand into a folder the app made still needs `drive.readonly`.
- **Other ways in lose.** A user's own copy of the script stays outside your cap but asks for full mail and full Drive. A forwarding filter needs a server to read the receiving mailbox. A Gmail add-on needs Marketplace publishing and review. mail.md compares them under "Other ways in, and why they lose".

## 2. The proposed onboarding

**Rules.** Onboarding is a route, `#/start?step=…`, not a screen that `App.vue` swaps in, so a phone redirect returns into the step it left (the pending redirect already restores the route). Google access is asked before any file is opened, so no step leaves for Google while holding a file. One `AppCard` per step with one primary button. Keep today's ruled-paper background, the brass mark and the tokens. Nuxt UI 4.12 ships `UStepper`, `URadioGroup` and `UCheckboxGroup`: the stepper runs horizontal from 640 px and vertical on a phone.

**Order.**

| Path                                                            | Steps                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Start new books on Drive                                        | 1 Welcome, 2 Home, 3 Access, 4 Folder, 5 Company, 6 First statement, Overview                                                         |
| Start new books in this browser                                 | 1, 2, 5, 6, Overview. No Google at all, so statements come by hand                                                                    |
| Bring my books (Sheet download, Excel file or ledgerboard JSON) | 1, 2, 3 if Drive, then today's file summary (counts per tab and problems), 4 if Drive, 5 as a confirm of what the file says, Overview |
| Open my books on Drive                                          | 1, 3, then Find the file or Pick another file (facccb0), Overview                                                                     |

```
[1 Welcome]
  Ledgerboard
  Company finances from your bank statements, worked out in this browser.
  (•) Start new books
  ( ) Bring my books        An Excel file, a Google Sheet download or a ledgerboard file
  ( ) Open my books on Google Drive    Another device already keeps them
  [Continue]                                                      Privacy

[2 Where the books live]
  (•) Google Drive   One file you open on your phone and computer. Backed up daily.
  ( ) Only this browser   No Google. One device. Export to keep a copy.
  [Back]  [Continue]

[3 What the app may do in your Google account]          (Drive only)
  Always    Your books file          Only files this app makes or you pick.
  How do statements reach the app?
    (•) I import them by hand           No extra access.
    ( ) From my mail                    The app finds the bank's mail when you sync and files it in Drive.
                                        Google will say "View your email messages and settings".
    ( ) From a folder in my Drive       The app reads your Drive to find new ones.
                                        Google will say "see all your Drive files".
    (From my mail)  Your bank [Erste ▾ / Another bank: sender address]   Mail since [2026-01-01]
  [ ] Invoice mail drafts in Gmail      Google will say "manage drafts and send emails".
  [Continue to Google]   One Google screen. On a phone it opens Google and comes back here.
  -> back: each line says Allowed or Not allowed, with [Ask again] beside a refused one.

[4 Folder]
  [Choose a folder in Google Drive]   -> Picker, starting at My Drive
  Your books will be saved in
    My Drive › work › company › shadow-accounting
    ledgerboard-company.json, with a backups folder beside it
  [Create the file here]   [Choose another]   Open this folder in Drive ↗
  (no read access)  shadow-accounting, inside folders the app cannot see.  Open in Drive ↗ to check.

[5 Your company]
  Company name [            ]   Currency [EUR ▾]   Number style [1.234,56 ▾]
  Is this a Croatian d.o.o. that pays its owner?
    ( ) Yes, add owner pay, taxes, year end and the accountant's files
    (•) No
  (Yes, and Drive read allowed)  Accountant's VAT returns [Choose folder]   Payslips [Choose folder]
  (Yes, mail allowed, your presets only)  [ ] File the accountant's mail too   Payroll, VAT returns and invoices.

[6 Your first statement]
  Drop a camt.053 file or a bank export
  -> "HR12 3456 … (EUR) is new. Add it as account [main] from 1.204,10 on 2026-10-01?"  [Add and import]
  (from a Drive folder)  Statements folder [Choose folder] -> My Drive › … › statements
  (from my mail)  Statements are filed in My Drive › … › shadow-accounting › statements, a folder the app makes.
  [Skip for now]

[Overview]  "Getting set up" in Waiting for you: categories to look over, rows to review,
            invoice details, accountant folders. Each line links to its screen and goes once done.
```

**What each choice asks Google for.**

| Choice                                       | Asks for                                                                                                    | What happens                                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statements by hand (default)                 | Nothing beyond `drive.file`                                                                                 | Import tab upload. Also works for books kept in the browser                                                                                                                                                                                     |
| Statements from my mail                      | `gmail.readonly` and `drive.file`                                                                           | The app makes the statements folder inside the folder picked for the books, so the statements step can read it with `drive.file`. That step takes only the read token today (`googleStatementFolder.ts` line 5), so it gets a `drive.file` path |
| Statements from a Drive folder               | `drive.readonly`                                                                                            | Today's flow                                                                                                                                                                                                                                    |
| Accountant mail on (pack only, your presets) | `gmail.readonly` (shared with statements) and `drive.file`, plus `drive.readonly` for your existing folders | Hidden from other users (decision 13)                                                                                                                                                                                                           |
| Accountant mail off                          | `drive.readonly` only if Taxes should read folders filled by hand                                           |                                                                                                                                                                                                                                                 |
| Invoice mail drafts                          | `gmail.compose`                                                                                             | Decision 3                                                                                                                                                                                                                                      |
| Mail since                                   | Nothing                                                                                                     | Defaults to the start of the year, so years of old statements don't pile up on Import before an account exists                                                                                                                                  |

**The accountant mail choice** sits in step 5 because it depends on the pack answer. It shows only when the pack is on, mail was allowed in step 3, and your presets fit, so it reuses the mail access from step 3 and onboarding asks Google nothing more. Everyone else finds it as a switch in the pack's Settings tab, which asks in that same tap like any step switched on later.

**The folder step.** The Picker opens at My Drive (`DocsView.setParent('root')`, unconfirmed that it takes `'root'`) with the title "Choose the folder for your books". After the pick nothing is created. A confirm card shows the full path from My Drive, walked with the read token when the user allowed Drive read. Without it, the card shows the folder's own name, says the folders above it are not visible to the app, and links to the folder in Drive. "Create the file here" is the only action that writes. When Drive already holds a marked ledgerboard file anywhere, the step refuses before the Picker opens, as today (`documentStorePorts.ts:91-93`).

**The empty start.** The document onboarding creates carries an explicit row for every choice the user made (statements source, the mail senders, the folders, the pack). The first statement creates its account from the camt file's IBAN, currency and opening balance, in the import dry run, with the user naming it. The toast says "Created ledgerboard-company.json in My Drive › …", not "Moved N records".

**The move.** A Sheet download, an Excel file or a ledgerboard JSON keeps today's `ImportDialog` summary and refusals (a newer app's file, another app's file, a backup). Only the order changes: access first, then the file, then the folder, so the phone never drops the opened file. "Moved N records" stays for this path only.

**Comparable apps, for the look.** [Actual Budget's welcome screen](https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/components/manager/WelcomeScreen.tsx): "Start budgeting" as the one primary start, "Try the demo", and "Import my budget" as a quiet second line. Its [server screen](https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/components/manager/ConfigServer.tsx) offers the sync server as "completely optional: Actual works great on just this device too." [Firefly III's first steps](https://raw.githubusercontent.com/firefly-iii/docs/main/docs/docs/tutorials/finances/first-steps.md) (docs.firefly-iii.org itself returned 403): one wizard screen asks currency, language, the bank's name and yesterday's balance. [Lunch Money](https://support.lunchmoney.app/getting-started): start fresh with basic categories, then add transactions, then categorise. Its advice to import one month first comes from a CSV guide seen in search results only. Monarch's post-setup checklist is unconfirmed (its page returned 403, seen in search results only), but it is the idea behind "Getting set up".

## 3. The proposed sync

**Steps, in order.** Each declares its scope and its on or off setting. They run one after another, so the progress reads clearly. Running statements and the accountant read side by side would save 3 to 4 s.

| Step               | Scope                                                                                | On when                                                                          | Estimated time (from the call counts and the latencies in [spikes](research/json-storage/spikes.md)) |
| ------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Books              | `drive.file`                                                                         | Always, for Drive books                                                          | 0.5 s unchanged, about 1 s when moved                                                                |
| Mail               | `gmail.readonly` to read, `drive.file` to file                                       | A mail source has a sender (books setting, the accountant sources from the pack) | Not estimated                                                                                        |
| Statements         | `drive.readonly`, or `drive.file` for the folder the app made (statements from mail) | Statements from a folder or from mail is on (books setting)                      | 3 to 3.5 s with nothing new, 7 to 11 s when filing, plus 2 to 3 s for the first save of a day        |
| Accountant folders | `drive.readonly`                                                                     | The pack is on and its folders are set (pack setting)                            | 3 to 4 s, 5 to 8 s on a new device                                                                   |

The accountant step comes from the pack through a new sync-step field on its contribution. The pack's three accountant mail sources join the mail step through the same seam.

**The mail step** only fills folders. The statements and accountant steps after it still parse every file, so each kind of file has one parse path. Each source (bank statements, payroll, VAT returns, accountant invoices) runs on its own, so one failure doesn't stop the others. Per source it searches from 7 days before the newest message it filed, or from `mail_since` on the first run, skips names already in the folder, compares bytes through Drive's `sha256Checksum` ([files resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)), and files the rest with appProperties for the source, the Gmail message id and the message date. Those properties are the step's only state, so a sync that files mail writes nothing to the books. Its line reads "Filed 2, already there 5, 1 unmatched", and unmatched mail is listed with its subject. Sources, rules and naming are in [mail.md](research/onboarding-and-sync/mail.md) under "2. The design".

**Its permission** works like the other steps. `gmail.readonly` joins the one in-memory token whenever a mail source is on, rides the silent trip on open, and is never stored. Onboarding asks for it with the rest when the user picks "From my mail". When it is missing, the control shows "Allow access", and that tap asks Google and resumes the sync.

**State per step**, kept in a pure domain file with a spec: off, queued, running (with a line such as "Filing 4 rows"), done (with "Nothing new" or "Filed 028, 4 rows, 1 on Review"), waits for you (held statements), needs access (with the scopes), failed (with the message), or skipped because the books step failed.

**The sync control** shows one of four labels:

- "Statements 2/3" while running.
- "Allow access" when a step needs a permission.
- "1 problem" when a step failed or waits for you.
- The age of the last sync otherwise.

A tap does what the label says. On the age it syncs. Allow access asks Google for the missing scopes inside the tap and resumes the sync. A problem opens the step list in a popover on desktop or a bottom sheet on a phone, with "Sync again". While running the button is disabled and a screen reader hears the progress.

**Settings.** This device gets a Sync card: the last run's step lines with their time, and the auto-sync-on-open switch. General gets the statements switch beside the folder, and a mail card with each source's sender, subject and "Mail since". The pack's tab gets the accountant switch beside its two folders, and the accountant mail switch.

**Permissions up front.** Onboarding asks for the scopes of what the user switched on. Switching a step on later in Settings asks in that same tap. The sync itself never asks for a scope that no setting turned on.

**A missing permission** shows in the control as "Allow access", in that step's line, and nowhere else. No toast, no Overview line, no card button. The "Check for new statements" buttons go from Overview, the statements card and the accountant card.

**The phone redirect.** The pending redirect already carries `resume: 'sync'`. The return starts a fresh run of every step without remembering which ones had finished. Every step can run twice: an unchanged book is one `files.get`, mail and statements skip names already filed, the accountant read reuses files whose version did not change.

**Auto-sync on open.** Books on Drive, online, and the device switch on: the open makes one silent trip for every granted scope the enabled steps need, comes back with one token, and runs every step. A scope Google did not return shows as "Allow access". A sign-in Google refuses shows "Sign in to Google" in the control.

**Auto-sync when the tab is shown again** runs only while the token is good and 10 minutes have passed (`autoSync.ts:5`). It never leaves the page, which could lose an open editor.

**Partial failure.** Books failed: later steps are skipped. A failed mail step does not stop the statements step, which still reads what the folder holds. A failed statements step does not stop the accountant step. A 401 inside a step turns that step and later steps with the same scope into needs access. A 401 during a save keeps today's `refreshAfterFailedWrite` and shows "Not filed. Sync again." A tap during a save waits for the save and then syncs, instead of being dropped. Two devices filing at once already end as "nothing new" through the race rule and the retry (`createWorkbookStore.ts:318-343`, `driveDocument.ts:179-192`), and that line should read done, not failed. Two devices filing the same mail can leave a duplicate file in Drive, which leaves the figures unchanged.

**One way to sync.** LedgerGate's Sync and Try again call the same run as the control.

## 4. Your decisions

Decisions 1 to 8 come from the onboarding and sync research. Decisions 9 to 16 are mail.md's decisions 1 to 8, in the same order. The earlier decision 9, to build first and research mail later, is gone because the research is done. Decision 4 now also covers statements from mail, which mail.md had only as an onboarding choice. The two documents agree on every recommendation they share.

### 1. One token or two

This is about the sync control on both devices. Today the books token (`drive.file`) is kept in this browser for an hour less a minute (`googleSession.ts:13`), and the Drive read token (`drive.readonly`) lives in page memory only, so the stored one can never read all of Drive. A one-tap sync needs both, and one redirect returns one token.

Example: on the phone at 8:00, the open fetches the read token. The Sync tap then leaves for the books token and loses the read token, and the return fetches it again. That is three trips to Google before anything syncs.

- **Hold one token in page memory, store none.** One silent trip on open gets every scope, auto-sync can run on open on both devices, and the phone's three trips become one. An offline open shows the kept copy, as today. Cost: an open whose silent trip Google refuses has no token until a tap, and the token in memory can read all of Drive, write the books, and read all your mail when mail is on. Smallest code: the stored token in `googleSession.ts` goes, and the account email kept there for the login hint stays.
- **Keep the split.** One consent screen for both scopes, then a second silent trip for the narrow `drive.file` token to store. Cost: two trips on a phone on every open, and possibly two popups on desktop (unconfirmed). The stored token also stays plain JSON in localStorage, which verification would object to.

Recommendation: one token in page memory. The read-everything power already sits in page memory today.

### 2. How a desktop tab gets a new token after an hour

This is about the Sync tap on the Mac. A popup needs the tap, and a page in a tab gets no new token in the background (see "What Google allows without a tap").

Example: the Mac tab has been open since 9:00, and at 11:00 you tap Sync. Both tokens are more than an hour old.

- **Leave the page with a silent trip, everywhere.** The tap goes to Google with `prompt=none` before any step runs, so there is no progress to save, and the tab comes back syncing. No popup ever, one sign-in path on every device, and the GIS popup token client and its popup-blocking cases go. Sign-out's revoke also loads GIS today (`googleAuth.ts:300-312`), so the library stays unless that moves too. Cost: the page reloads, for a time nobody measured (Wave 0's silent renew took about 3 s, in a popup). An editor with unsaved text would lose it, so the app would have to ask before leaving when a form holds unsaved changes.
- **Keep the popup on desktop.** The tap opens Google's popup, which may close by itself since you consented already (unconfirmed). No reload. Cost: two sign-in paths stay, and a popup can still be blocked.

Recommendation: the silent trip everywhere, if the stage 0 spike shows the reload is under two seconds.

### 3. Gmail in the up-front ask

This is about Invoicing's "Create the mail draft". Today the Gmail token (`gmail.compose`) is asked for on the first draft of each page load and kept in page memory only (`googleAuth.ts:173-193`).

Example: on the phone you make the November invoice with the mail draft on. Today the tap goes to Google and comes back to "Make the invoice again" (`useGoogleReturn.ts:37-45`).

- **Ask for Gmail with the rest when mail drafts are on.** The token on open carries it, so making an invoice never leaves the page. Cost: every session with drafts on holds a token that can send mail, and every open asks Google, silently, for one more restricted scope.
- **Ask for Gmail only when an invoice needs it.** Cost: the "make the invoice again" round trip stays on the phone, and on desktop one click may need two popups, the second of which may be blocked (unverified).

Recommendation: ask with the rest when drafts are on. It is what "permissions up front for what my settings turn on" means, and a session already holds the read-all-Drive power. The mail step's `gmail.readonly` follows the same rule. The sync lane recommended the other way, on the grounds that a sync does not need to send mail.

### 4. How a new user's statements arrive by default

This is about onboarding's "How do statements reach the app?". Reading a statements folder needs `drive.readonly`, which Google words as "See and download all your Google Drive files". Reading the bank's mail needs `gmail.readonly`, "View your email messages and settings". Both are restricted.

Example: a new user whose bank emails a camt.053 file each month, with no script that saves it to Drive.

- **By hand by default, mail and a Drive folder as opt-ins.** A new user meets no restricted scope and no unverified-app warning, and does not use one of the 100 places. Cost: a one-tap sync files statements only for users who opt in. From mail needs a bank preset or the bank's sender address. A folder needs a fetch that fills it.
- **From my mail by default.** Every new user's Sync files the bank's mail from the first day, with no script. Cost: every new user sees Google's warning screen and "View your email messages and settings" on day one, uses one of the 100 places for good, and a bank without a preset needs its sender typed in.
- **A Drive folder by default.** Every new user's Sync looks for statements from the first day. Cost: every new user sees Google's warning screen and "See and download all your Google Drive files" on day one, uses one of the 100 places, and still needs something that fills the folder.

Recommendation: by hand by default. mail.md reaches the same answer.

### 5. The Croatian pack for a new user

This is about onboarding's company step. Today one setting, `owner_pay_module`, defaults to on (`settings.ts:131`) and alone decides whether the whole hr-doo pack shows (`packContribution.ts:91-93`).

Example: a German freelancer starts new books and today gets Owner, Year, Taxes and the Croatian ruleset from the first screen.

- **Ask one question in onboarding and set the existing switch.** "Croatian d.o.o. that pays its owner?" turns the current setting on or off. Cost: owner pay and the Croatian law stay one switch.
- **Split owner pay from the Croatian pack.** A user could keep owner pay without Croatian law. Cost: a new setting key and a migration of your file, for a user who does not exist yet.

Recommendation: one question, the existing switch. Either way, your file needs explicit rows for the switch and both accountant folders before the code defaults change. Saving Settings writes only changed values, so stage 1 adds a save that writes the missing rows, and you save Settings once before stage 3.

### 6. The folder path when the app cannot read Drive

This is about onboarding's folder step. The Picker can return the folder's id, name and parent id, but no path ([Picker document](https://developers.google.com/workspace/drive/picker/reference/picker.document)).

Example: a new user who imports by hand picks the folder `books` and the app has only `drive.file`.

- **Show the folder name and an "Open in Drive" link.** The user checks the path in Drive. Cost: a weaker confirmation than the full path, and the missing path is what let your move land in `_to-delete/`.
- **Ask for Drive read for every Drive user.** The full path always shows. Cost: every Drive user meets the restricted scope and the warning.

Recommendation: name and link, after the stage 0 spike shows whether `drive.file` can read the parent. You always get the full path, since you allow Drive read.

### 7. The "Filed statement 028" toast with Undo

This is about what a sync shows after it files statements. Today a filing pops a toast with Undo and, when rows wait, "Open Review" (`useStatementSync.ts:106-126`).

Example: you tap Sync on the Mac and statement 028 files 4 rows, 1 of them for Review. Today the toast says so, with Undo and "Open Review".

- **Move it into the statements step line**, with Undo there and in "Changes in this session". Cost: Undo is one tap further away after a sync on open.
- **Keep the toast for a filing only.** Cost: one toast remains after a sync.

Recommendation: move it, as you asked for results in the control and Settings.

### 8. Where auto-sync on open is switched

This is about the new auto-sync switch. Today nothing turns auto-sync off, and its 10-minute interval is a constant (`autoSync.ts:5`).

Example: you want the phone to sync as it opens, but the Mac to wait for your tap, because its bounce through Google flashes the page.

- **On each device, default on.** The phone can auto-sync while a slow desktop does not. Cost: set twice if you want it off on both.
- **In the books, one setting for all devices.** Cost: a device cannot differ.

Recommendation: on each device.

### 9. Whether the app ever serves more than 100 users

This is about every restricted scope a user accepts, mail now among them. Each user who accepts one through the warning uses one of 100 places for the project's life, yours included. Mail adds a place only for users who would otherwise stay on `drive.file`.

Example: a friend's company tries the app and turns on statements from mail. That is one place gone, and it can't be returned.

- **Stay unverified, under 100 users.** Nothing to do now. Cost: if the cap runs out, Google can disable sign-in for the app.
- **Verify the app when it nears 100.** Users past 100 can sign in. Cost: a custom domain with a home page and privacy policy, a demo video, a written case for each scope, about six weeks of review, and possibly a yearly assessment from about $3,000 a year (one assessor's [price list](https://leviathansecurity.com/programs/google-casa-cloud-application-security-assessment), a third-party page). Google may still reject Gmail access for bookkeeping.
- **Let other users run their own copy of the script.** Their mail stays outside your cap and verification. Cost: a much wider consent for them, a fix has to reach every copy, and they still need `drive.readonly`.

Recommendation: stay unverified and build the app path. Revisit when the hub's new address is chosen, since a domain of your own is the first step of verification.

### 10. How far back your first mail run reaches

This is about the first mail dry run on your books (stage 5). The scripts look back 90 days, which is how four VAT returns were never filed.

Example: with `mail_since` at 2025-01-01, the first dry run would list 2025-10, 2026-01, 2026-02 and 2026-04 VAT, if those mails exist, beside older payroll and invoice mail.

- **Start from 2025-01-01 once, in the dry run.** You see every missing file before anything is written. Cost: an older payroll xlsx may land beside a hand-made Sheet for the same month, and if they read differently Taxes marks that month unread until you remove one.
- **Start at the cutover, like the scripts.** Nothing old moves. Cost: the four gaps stay until you file them by hand.

Recommendation: start from 2025-01-01 in the dry run and decide from its list.

### 11. Which mail the app files

This is about the rules the mail step ports from the scripts.

Example: the October payroll mail carries the salary xlsx, an IP1 form, two payment-order PDFs and two XMLs. The app reads only the xlsx.

- **File what the scripts file today.** Your Drive keeps the same shape and nothing is lost when the scripts go. Cost: rules for files the app never reads, and a new `hr_incoming_invoices_folder` setting used only to file into.
- **File only what the app reads.** About 160 fewer lines. Cost: the IP1 forms, payment orders, statement PDFs and the accountant's invoices go back to hand filing.
- **Also file the supplier invoices.** Cost: one rule per supplier, each with its own sender and naming, for files the app doesn't read. Better as a later item.

Recommendation: file what the scripts file today, and leave supplier invoices out.

### 12. A correction to a file the scripts filed

This is about the accountant sources after cutover. Under `drive.file` the app can trash only files it made, and the scripts replace a filed copy when a newer mail brings different bytes.

Example: in November the accountant resends the September VAT return with a fix. The script filed the first one, so the app can't trash it.

- **Show it in the sync step for you to swap by hand.** No new access. Cost: one manual swap, possible only within the scripts' last 90 days.
- **Ask for full `drive` access.** The app replaces it itself. Cost: the token could change any file in your Drive, in the same restricted tier.

Recommendation: show it.

### 13. Accountant mail for other users

This is about the accountant mail choice in onboarding and the pack's Settings tab. The rules match your accountant's file names, which carry the company suffix, and the IP1 rule carries the employee's name.

Example: another Croatian d.o.o. turns on accountant mail. Its accountant's files carry that company's names, so none of your rules match and every attachment lands on the unmatched list.

- **Hide accountant mail from other users.** They never see the choice. No cost now.
- **Add a generic rule: every attachment from a sender, named by mail date plus its own name.** Another user's accountant mail gets filed. Cost: about two files, and Taxes can't read those names.

Recommendation: hide it until a second hr-doo user exists.

### 14. Mail rules as settings keys

This is about where mail sources live in the books. Each document type gets one sender list and one subject in settings, with the folders on today's keys, and a blank sender turns a source off. It holds as long as one rule per document type is enough.

Example: a user with two banks lists both senders in `statements_mail_from`.

- **Settings keys.** No new record kind. Cost: about 80 lines across `settings.ts` and `companyFacts.ts`.
- **A mail-source record kind.** Several rules per type, for a user who doesn't exist yet. Cost: a new tab in the books and its migration.

Recommendation: settings keys.

### 15. The two script bugs before retirement

This is about the scripts while they still run. The Erste fetch reads the archived Sheet (latent today), and payroll runs on New York time (unverified).

Example: you add an account in the app before the Erste fetch retires. Its statement is filed as `…-statement-027.xml` with no account, and if you rename it by hand the script no longer finds its own name and files it again on every run.

- **Leave both until retirement.** No script work. Cost: an account you add in the app before then is filed without its account name, and you must not rename it by hand.
- **Fix both now.** A small Apps Script change and a clasp push, which needs your yes. Cost: work on code that retires within weeks.

Recommendation: leave both. Don't add an account in the app until the Erste fetch retires, and check one payroll Executions entry for the run time (stage 0 spike 11).

### 16. Where you pay salaries from

This is about retiring the payroll filer (stage 7). After it goes, the payroll payment-order XML lands in Drive only when the app syncs.

Example: on pay day you open the payment-order XML in Drive before any device has synced that day. With the filer retired, the file isn't there yet.

- **Retire the payroll filer with the other two after one cycle.** One less script to watch. Cost: if you pay from the Drive XML, a pay day without a sync holds you up.
- **Keep the payroll filer until the app has been open on each pay day of one cycle.** Pay day never waits on a sync. Cost: one script runs a few weeks longer.

Recommendation: if you pay from the mail, retire it with the others. If you pay from the Drive XML, keep it for that cycle. mail.md left this as a question, so your answer picks the option.

## 5. Build stages

Each stage after 0 is one commit and one deploy. Mail (stages 5 to 9) needs the step model of stage 1 and the one token of stage 2. Stage 8 also needs onboarding (stage 3).

**Stage 0: spikes you run (no app code).** A throwaway `*.local` page, like the JSON storage spikes, on desktop Firefox and the Android installed app. Spikes 8 to 11 need desktop Firefox only. Results go into plan.md.

1. The project's Audience page: Testing or In production.
2. `prompt=none` for `drive.file drive.readonly gmail.readonly`, all granted: one token with all three scopes? This covers mail.md's check of `drive.readonly gmail.readonly` in one silent request.
3. `prompt=none` with one scope never granted: an error, or a token for the rest?
4. With a `drive.file` token, `files.get` on a picked folder's parent: a name or a 404.
5. `DocsView.setParent('root')` in the Picker.
6. On Android, the installed app's trip to Google: does it return into the app, and does sessionStorage survive?
7. The time of one silent round trip on each device.
8. With a token carrying `drive.file` and `drive.readonly`, create a file in a script-made folder. A 404 means the one-time folder picks in stage 6.
9. `messages.list`, `messages.get` and `attachments.get` with `gmail.readonly` from the page.
10. Is `sha256Checksum` present on the script-filed XML, PDF and xlsx files?
11. One payroll Executions entry: does it run near noon?

**Stage 1: the sync engine with today's tokens** (decisions 7 and 8). About 20 files.

- New `src/features/sync/`: the run state and control state with spec (about 140 lines), the ordered run with failure isolation, single flight and wait-for-save (about 160), its composable (about 90), the step list (about 120), specs over fakes.
- Changed: `SyncStatus.vue` (about 60), `App.vue` and LedgerGate onto the one run, `autoSync.ts` and spec (device switch), `useStatementSync.ts` becomes the statements step (about −90), `useAccountantDocuments.ts` becomes the accountant step (−40 / +30), the pack contribution gets sync steps, the statements and accountant switches in `settings.ts`, `companyFacts.ts` and their forms, a save of Settings that writes the pack switch and both accountant folders when their rows are missing (for stage 3), `DevicePanel.vue` Sync card, fakes that grant or withhold each scope.
- Removes: `syncByHand`, `checkForNewStatements`, the "not checked" and "no Drive read access" toasts, the "Check for new statements" buttons on Overview, the statements card and the accountant card, `syncState.ts` and its spec.
- "Allow access" still calls today's read-token ask.

**Stage 2: one token, one trip** (decisions 1, 2, 3, needs stage 0). About 10 files.

- `googleAuth.ts` (−120 / +70): one ask for a list of scopes replaces `requestToken`, `requestDriveReadToken`, `requestGmailToken` and the silent ask. The granted scope names are kept in localStorage (they are not secrets) so the silent trip asks only for those.
- `googleRedirect.ts` (about 40): the grant becomes a list of scopes. `main.ts` (about 10): the trip on open asks for every granted scope the enabled steps need. `useGoogleReturn.ts`: a refused return sets the control's state, no toast. `workbookStore.ts`, `documentStorePorts.ts`, `invoiceGoogle.ts`, `useInvoiceRun.ts`: take the one token.
- Removes: the stored token in `googleSession.ts` (decision 1, the account email stays), the "Tap it again" and "Make the invoice again" toasts, the GIS popup token client if decision 2 goes to the silent trip.

**Stage 3: onboarding** (decisions 4, 5, 6, needs stage 2). About 15 files.

- New `src/features/onboarding/`: the route and about eight step components, the "Getting set up" card.
- Changed: `createDriveFile` splits into pick and create, with a parent walk on the Drive port for the confirm. The import dry run offers to add the account from a camt file. `useKeepOnDrive.ts` toast wording. Settings defaults: blank statements and accountant folders, pack off, written explicitly by onboarding into the new document.
- **Your file first.** Your books hold no `owner_pay_module`, `hr_vat_returns_folder` or `hr_payroll_folder` row, and saving Settings with unchanged values writes nothing (`settings.ts:770-800`). So stage 1, which already changes `settings.ts` and `companyFacts.ts`, extends the rule that writes `statements_folder` when its row is missing (`generalSettingsToSave`) to the pack switch and both accountant folders. You then save Settings once before stage 3, and your books hold the rows the new defaults no longer supply. Proof below checks it.
- Removes: `WelcomeScreen.vue`, the first-run use of `DataSourceChoices.vue` (it stays for Switch data source), your paths as code defaults, and the "Google may ask about cookies first" note (`DataSourceChoices.vue:99`) if stage 0 item 6 shows Google asks nothing about cookies on the way.

**Stage 4: the sync and onboarding docs.** README sections "Google sign-in" and "Sync", `public/privacy.html` for the scope wording, the product hub's scope line, and the Risks row in plan.md.

**Stage 5: mail as a dry run, your presets only** (decisions 10, 13, 14, needs stages 1 and 2). About 17 files, 1,900 lines, most of them specs and fixtures.

- New `src/features/mail/`: `domain/mailSource.ts` (about 80, kinds, query, window), `domain/statementMailFiling.ts` (about 90), `application/mailFiling.ts` (about 160, search, plan, dedup, counts, dry run), `infrastructure/gmailMailbox.ts` (about 80), `infrastructure/fake/fakeMailbox.ts` with anonymised fixtures (about 150), `presentation/MailSettingsCard.vue` (about 150), three specs (about 450).
- New `src/packs/hr-doo/domain/accountant/accountantMailFiling.ts`, the three accountant rules (about 160), and its spec (about 250).
- Changed: `settings.ts` (+40), `companyFacts.ts` (+40), `driveClient.ts` (+10 for `createdTime`, `sha256Checksum`, `appProperties`), the scope list from stage 2 (+15), the sync step list and the pack's sync steps (+30), `GeneralSettingsForm.vue` (+20).

**Stage 6: Erste filing on** (decision 15). About 4 files. The write path of `mailFiling.ts` with its spec (+150). If spike 8 fails, `locateFiling`, the folder methods and the path template move from invoicing into `src/shared/google/` so invoicing and mail share one filing walk (`invoiceRun.ts` lines 51-73, `invoiceFiling.ts` lines 4-37, about 100 lines moved). After a week of overlap, retire the Erste fetch ([mail.md](research/onboarding-and-sync/mail.md), "Retiring the scripts").

**Stage 7: accountant filing on** (decisions 11, 12, 16). About 3 files: the correction rule with its spec (+80), and `hr_incoming_invoices_folder` if decision 11 keeps it (+20). After one monthly cycle, retire the three filers by deleting their triggers by hand, since each run reinstalls its own.

**Stage 8: "From my mail" in onboarding** (decision 4, needs stages 3 and 6). About 4 files: the step 3 choice and the bank preset (+120), `googleStatementFolder.ts` taking a `drive.file` path (+10), the app-made statements folder under the books folder (+40), its spec.

**Stage 9: the mail docs.** README host and scope tables, `public/privacy.html` for "View your email messages and settings", the product and finance hubs, `work/log.md`, the two memory notes, the plan.md Risks row on the filers, and the script folders staged in `_to-delete/`.

## 6. The proof

| Stage | Unit tests                                                                                                                                                                                                                        | Browser checks (fake build, 360 and 1440, touch at 360 and 430)                                                                                                                           | You, by hand                                                                                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | none                                                                                                                                                                                                                              | none                                                                                                                                                                                      | The eleven spikes, results written into plan.md                                                                                                                                                                                                             |
| 1     | The run: a step fails while others finish, a missing scope, books failing skip the rest, a 401 mid-step, a tap during a save, the device switch, each step off                                                                    | `check:visual` and `check:touch` flows for every control state (running, Allow access, 1 problem, ready) and the step list as popover and bottom sheet. Figures unchanged on `fake-drive` | Mac: Sync files a statement, the line shows it with Undo, no toast. Android: the same from the installed app                                                                                                                                                |
| 2     | Redirect specs: one token for several scopes, a partial grant with Drive read unticked, a refused silent trip, the resume of a sync                                                                                               | A touch check of the return with a mocked fragment for a full and a partial grant                                                                                                         | Android, cold morning open: no tap, one trip, books, statements and accountant done. Mac tab open over an hour: one tap, then one trip or one popup. Make an invoice with drafts on, on the phone, without "make it again"                                  |
| 3     | The step order per path, the account from a camt file, onboarding's explicit rows, the folder confirm with and without read access                                                                                                | Flows for each onboarding step, start new in the browser, bring an xlsx, and the getting-set-up card                                                                                      | Your file still shows the pack and the accountant read after the deploy. `check:round-trip` and both parity scripts on the latest export. A test Google account on both devices: start new on Drive, check the path shown against Drive, import a statement |
| 4     | none                                                                                                                                                                                                                              | `check:pwa`                                                                                                                                                                               | Read the privacy page's scope wording                                                                                                                                                                                                                       |
| 5     | Each naming rule against anonymised copies of real subjects and file names, including `RE:`/`FW:`, two-digit years, a PDF and XML pair, an unknown order kind, a delivery sent twice. The window with and without app-filed files | The mail step line in every state with `fakeMailbox`                                                                                                                                      | Dry run on your mail shows 0 new for Erste, matching the script's last log. With `mail_since` at 2025-01-01, read the list (decision 10)                                                                                                                    |
| 6     | The write path, a failed upload, a re-run after a phone is backgrounded mid-filing                                                                                                                                                | Figures unchanged on `fake-drive`                                                                                                                                                         | One week: each morning the Erste Executions log says `saved 0`, and the new files carry the app's appProperties                                                                                                                                             |
| 7     | A correction to an app-filed file replaced, to a script-filed file reported                                                                                                                                                       |                                                                                                                                                                                           | One cycle: payroll, VAT and an invoice filed by the app, and Taxes reads the xlsx                                                                                                                                                                           |
| 8     | The onboarding choice, the folder made under the books folder                                                                                                                                                                     | The onboarding flow with "From my mail" at 360 and 1440                                                                                                                                   | A test Google account with a sender preset pointing at a second test account that mails it a sample camt file. Start new on Drive, choose mail, sync, import                                                                                                |
| 9     | none                                                                                                                                                                                                                              | `check:pwa`                                                                                                                                                                               | Read the privacy page's Gmail wording                                                                                                                                                                                                                       |

## 7. What stays out, and risks

**Out:** a demo company (it would ship fake bytes, which `assert-no-fake-bytes` forbids), the `_to-delete/` staging convention (for the planning session), three devices saving at once, a backend for refresh tokens or the code flow with PKCE (unconfirmed for a static page), filing supplier invoices from mail (decision 11), Gmail labels (they need `gmail.modify`), and the Gmail history feed or push (push needs a server).

| Risk                                                                                                                                                                                                       | Mitigation                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| The project is still in Testing and consent expires every 7 days                                                                                                                                           | Stage 0 reads the Audience page. Publishing is a Cloud change that needs your yes                                     |
| Google retires the implicit flow, which it calls "insecure for browser-based single-page applications" ([implicit flow](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)) | No route without a server today. The token logic sits in one file after stage 2                                       |
| A token in memory with read-all-Drive, read-all-mail and send-mail powers, readable by any script injection                                                                                                | The strict CSP, no runtime scripts but Google's, each Gmail scope only while drafts or a mail source is on            |
| The 100-user cap runs out for good, your accounts included, and Google disables sign-in                                                                                                                    | By hand is the default, the onboarding line says what Google will show, and decision 9 comes before any public launch |
| Google rejects Gmail access at verification                                                                                                                                                                | Mail stays for users under the cap. Statements by hand or from a folder still work                                    |
| A silent trip on open costs a page flash on every open                                                                                                                                                     | Measured in stage 0. The auto-sync switch per device turns it off                                                     |
| The Android installed app hands Google's page to a browser tab and does not return                                                                                                                         | Stage 0 item 6, before stage 2                                                                                        |
| The bank or accountant changes a subject or file name                                                                                                                                                      | The mail step line lists the unmatched mail with its subject, never silent like the Executions log                    |
| Mail deleted before the next sync is never filed                                                                                                                                                           | The window catches up after any gap. The step line shows when the last mail was filed                                 |
| A backfilled xlsx beside a hand-made Sheet marks a month unread                                                                                                                                            | Decision 10 runs the dry run first                                                                                    |
| A script and the app both file during the overlap                                                                                                                                                          | The same names and the same duplicate rules on both sides, so whichever runs second sees the file                     |

## Sources

Loaded by the onboarding and sync lanes:

- https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model
- https://developers.google.com/identity/oauth2/web/guides/migration-to-gis
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/oauth2/web/guides/use-code-model
- https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works
- https://developers.google.com/identity/oauth2/web/reference/js-reference
- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2/policies
- https://developers.google.com/identity/protocols/oauth2/resources/best-practices
- https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions
- https://developers.google.com/identity/protocols/oauth2/scopes
- https://developers.google.com/identity/protocols/oauth2/production-readiness/overview
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://developers.google.com/identity/gsi/web/guides/fedcm-migration
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/about-auth
- https://developers.google.com/workspace/drive/picker/guides/overview
- https://developers.google.com/workspace/drive/picker/guides/web-picker
- https://developers.google.com/workspace/drive/picker/reference/picker.document
- https://developers.google.com/workspace/drive/picker/reference/picker.docsview
- https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setselectfolderenabled
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://support.google.com/cloud/answer/7454865
- https://support.google.com/cloud/answer/9110914
- https://support.google.com/cloud/answer/13464323
- https://support.google.com/cloud/answer/15549945
- https://openid.net/specs/openid-connect-core-1_0.html (the `prompt=none` error codes. Whether Google sends exactly these is unconfirmed)
- https://developer.mozilla.org/en-US/docs/Web/API/Window/open
- https://developer.mozilla.org/en-US/docs/Web/Security/User_activation
- https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning
- https://blog.mozilla.org/en/mozilla/firefox-androids-new-privacy-feature-total-cookie-protection-stops-companies-from-keeping-tabs-on-your-moves/ (does not say whether it is on by default)
- https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/components/manager/WelcomeScreen.tsx
- https://raw.githubusercontent.com/actualbudget/actual/master/packages/desktop-client/src/components/manager/ConfigServer.tsx
- https://raw.githubusercontent.com/firefly-iii/docs/main/docs/docs/tutorials/finances/first-steps.md
- https://support.lunchmoney.app/getting-started

Loaded again by the review on 2026-10-26, with the quotes above checked against them: choose-authorization-model, migration-to-gis, use-token-model, use-code-model, how-user-authz-works, js-reference, openid-connect, javascript-implicit-flow, policies, best-practices, granular-permissions, scopes, api-specific-auth, picker.document, picker.docsview, Gmail scopes, the four support.google.com pages, the three MDN pages, both Actual files, Firefly III and Lunch Money.

Loaded by the mail lanes and cited here (the full list is in [mail.md](research/onboarding-and-sync/mail.md) under "Sources"):

- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get
- https://developers.google.com/workspace/gmail/api/guides/filtering
- https://developers.google.com/workspace/gmail/api/quickstart/js
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files
- https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- https://developers.google.com/apps-script/reference/script/clock-trigger-builder
- https://support.google.com/cloud/answer/13464325
- https://support.google.com/cloud/answer/13463817
- https://support.google.com/cloud/answer/13464321
- https://publicsuffix.org/list/public_suffix_list.dat
- https://leviathansecurity.com/programs/google-casa-cloud-application-security-assessment (third party)

Unconfirmed (not loaded, seen only in search results): https://support.lunchmoney.app/guides/import-via-csv, https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-Guide, Mozilla's support pages on Total Cookie Protection.

Also unconfirmed, for stage 0: what picking a folder grants under `drive.file` beyond your 2026-10-20 test, whether a GIS popup with `prompt: ''` closes by itself, whether a second popup opens from the same tap, whether the unverified-app warning shows on every new consent, the exact wording of Google's warning and consent screens, and whether `drive.file` can create a file in a folder it can't see. For verification: whether a github.io subdomain passes domain verification, whether the yearly assessment applies to a browser-only app, and whether Gmail's approved uses cover bookkeeping.
