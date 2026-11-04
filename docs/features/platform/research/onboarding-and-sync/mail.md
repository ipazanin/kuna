# Mail in the app

The app can take over the four Apps Scripts that file bank and accountant mail into Drive. It reads Gmail with gmail.readonly on each sync and files with drive.file. Under 100 users that adds no new kind of Google screen. A new user picks statements from mail, from a Drive folder or by hand in onboarding.

This answers "Queued by the owner: mail in the app" in plan.md and decision 9 of [the onboarding and sync proposal](../../onboarding-and-sync.md). It stands alone and slots into that proposal as one more sync step, one more onboarding choice and stages after its stage 3. Three read-only lanes fed it: the four scripts, Google's rules for Gmail from a browser, and the design against ledgerboard HEAD `facccb0` (clean working tree). Nothing ran against Google or Gmail. Every web page cited was loaded by a lane. Anything marked unconfirmed was not found in a loaded page.

## The answer

**Yes, the app can take over all four mail scripts.** On each sync it searches Gmail for the bank's and the accountant's mail, files the attachments under the same names the scripts use, and then runs the statements and accountant steps as the proposal describes. Mail lands in Drive at the next sync instead of at 06:00. Nothing is lost while the app is closed, because the mail waits in Gmail.

**The Google cost is one more restricted scope, `gmail.readonly`.** It is the narrowest scope that can search mail and download attachments. The app already asks for two restricted scopes (`drive.readonly`, `gmail.compose`), so a user sees the same unverified-app warning they would see today, and nothing new happens up to 100 users. Past 100 users the app needs Google's restricted-scope verification: a domain of your own, a demo video, about six weeks of review, and possibly a yearly security assessment that one assessor prices from $3,000. Whether a browser-only bookkeeping app passes that review, and whether it needs the assessment, is unconfirmed.

**What a new user sees.** Onboarding's "How do statements reach the app?" gets a third answer, "From my mail". Choosing it adds Google's warning screen and the line "View your email messages and settings" to the one consent of the proposal. The app makes the statements folder itself, so it needs no Drive read for it. By hand stays the default and asks for nothing. The accountant mail rules fit only your accountant's file names, so other users don't see them until a second Croatian d.o.o. user exists.

**What you see.** The same files in the same folders, filed by the app on sync. The Erste fetch retires after a week of overlap, and the three accountant filers after one monthly cycle.

**One unknown blocks the build.** `drive.file` can't see the year and month folders the scripts made (Wave 0 saw this). Whether it can still create a file in them, with the folder id found through `drive.readonly`, is unconfirmed. If it can't, you pick about seven existing folders once, through the Picker step invoicing already has. A new user never meets this, because the app makes every folder it files into.

## 1. Findings

### Failures and gaps first

1. **The Erste fetch reads its folder and accounts from the archived Sheet.** It takes `statements_folder` from the archived `settings` tab and the IBAN-to-account map from the archived `accounts` tab (`Code.gs` lines 222-252, `Data.gs` lines 27-48). A folder changed in the app doesn't reach it. An account added only in the app is filed as `…-statement-027.xml` with no account. If you then rename it by hand as the hub says (the shadow-accounting hub, lines 182-184), the script no longer finds its own name (`Code.gs` lines 300-313) and files the statement again on every run. This is latent today: the 2026 statements folder holds no label-only XML (checked by listing, 2026-10-26). The move into the app fixes it, because the app takes accounts from the books.
2. **Payroll probably runs near noon, not at 06:00.** Its manifest says `"timeZone": "America/New_York"` (`company-finance/payroll/scripts/appsscript.json`, checked) and the trigger uses `atHour(6)` (`payroll/scripts/Code.gs` line 184). Google: "Runs between 5am-6am in the timezone of the script" ([clock trigger builder](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)). That is about 12:00 in Zagreb. Not checked against the Executions log.
3. **The Erste search has no time window and no paging.** Its query has no `newer_than` (`Code.gs` line 5, checked) and calls `GmailApp.search(query)` (line 201). Google: "This call will fail when the size of all threads is too large for the system to handle" ([GmailApp](https://developers.google.com/apps-script/reference/gmail/gmail-app)). Fine at 27 threads, and it only grows.
4. **The 90-day window left four VAT returns unfiled.** The VAT folder has no file for 2025-10, 2026-01, 2026-02 or 2026-04 (listing checked 2026-10-26). An app run that reaches back further would see those mails, if they exist. Unverified that they do.
5. **Failures surface only in Apps Script.** Unmatched attachments go to the Executions log. A thrown error stops the run and Google mails a trigger failure. The Erste fetch runs before the ledger formatting unwrapped, so a failed fetch also skips that morning's formatting (hub line 172).
6. **The plan misreads `gmail.compose`.** It says the scope was left off the consent screen "to stay out of verification" (plan.md line 538). Google lists it as restricted regardless ([Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [restricted scopes](https://support.google.com/cloud/answer/13464325)). `drive.readonly` is restricted too ([Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)).
7. **`gmail.metadata` can't do the job, and saves nothing.** `messages.list`: the `q` parameter "cannot be used when accessing the api using the gmail.metadata scope" ([users.messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)). `attachments.get` takes only `mail.google.com`, `gmail.modify` and `gmail.readonly` ([attachments.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get)). `gmail.metadata` is restricted as well.
8. **The 100-user cap is for the project's life.** "100 new users in total", and it "applies over the entire lifetime of the project, and it cannot be reset or changed" ([Audience](https://support.google.com/cloud/answer/15549945), [verification](https://support.google.com/cloud/answer/13463817)). Your own accounts count. Running out can end in "Google sign-in being disabled".
9. **Verification is uncertain on three counts.**
   - Gmail's approved uses are email clients, backup, productivity, and reporting that improves "the email experience", such as travel itineraries or package tracking ([Workspace user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)). Filing bank statements arguably fits the last. Unconfirmed.
   - Google's pages disagree on the yearly assessment. One ties it to data reaching "a third-party server" ([restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)). Another has no server condition ([Help Center](https://support.google.com/cloud/answer/13464321)). Google sets the tier itself. Plan as if it could be required.
   - The home page must sit on "a verified domain you own" ([Help Center](https://support.google.com/cloud/answer/13464321)). `github.io` is a public suffix ([public suffix list](https://publicsuffix.org/list/public_suffix_list.dat), line 13833), and no Google page says whether your github.io subdomain is accepted. The hub plan's new address would settle it.
10. **Verification would also want tokens encrypted at rest** (Workspace user data policy). The sign-in token sits as plain JSON in localStorage (`src/shared/google/googleSession.ts` lines 9, 16). The proposal's decision 1 removes that file, and `gmail.readonly` must stay in page memory like `drive.readonly` (`googleAuth.ts` lines 105-111).
11. **`drive.file` can't see folders the scripts made.** Wave 0, 2026-10-20: "a `drive.file` token lists no children of the picked folder" (plan.md line 538). Invoicing already handles it by opening the Picker on the parent (`src/features/invoicing/application/invoiceRun.ts` lines 51-73). Whether a token can create a file in a folder found only through `drive.readonly` is unconfirmed. Stage 0 tests it.
12. **The app can't replace a file the scripts filed.** The three accountant filers trash the filed copy when a newer mail brings different bytes (payroll `Code.gs` lines 82-101, VAT 83-102, invoices 64-83). Under `drive.file` the app can trash only files it made. This matters only for mail in the scripts' last 90 days.
13. **The API searches messages, the scripts read whole threads.** The scripts read every message of a matching thread. Gmail search "doesn't" match thread-wide ([filtering](https://developers.google.com/workspace/gmail/api/guides/filtering)). An attachment on a reply inside the accountant's thread with a different sender stops being filed. That is probably right, and the dry run has to expect it.
14. **The accountant rules fit one accountant.** The attachment names carry the company suffix (invoices `Code.gs` lines 60-62, payroll 134 and 172) and the IP1 file name carries the employee's name (payroll line 138). For another user they match nothing.
15. **Nothing runs while the app is closed, and mail deleted before the next sync is never filed.** Gmail search skips trash and spam unless asked (`includeSpamTrash`, users.messages.list).
16. **Under `drive.file` the app can't see a file dropped by hand into a folder it made.** That case keeps needing `drive.readonly`.

### The four scripts today

None reads or sets a Gmail label or marks a mail read. Each knows what it filed only by the file names in Drive, and the accountant filers also compare bytes.

| Source                                                | Query (sender by role)                                        | Files                                                                                                                                                                  | Duplicate rule                                                                                              | Read by the app today                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Bank, "ERSTE Izvadak NNN", every statement sent twice | the bank, `subject:"ERSTE Izvadak" has:attachment`, no window | `erste/statements/<YYYY>-statements/<date>-statement-NNN.pdf` (date from the attachment name, number from the subject) and `<CreDtTm day>-statement-NNN-<account>.xml` | PDF by exact name, XML by the `-statement-NNN-<account>.xml` suffix, so a redelivery a day later is skipped | XML in the statements step. PDF not read                                                      |
| Accountant, "Plaća za M/YYYY"                         | the accountant, `newer_than:90d`                              | `payroll/<YYYY>-payroll/<YYYY-MM>/` salary xlsx, IP1 PDF, rent and salary payment-order PDFs and XMLs. Month from the subject                                          | By name, kept if filed at or after the message date or bytes match, otherwise replaced                      | Salary xlsx (or hand-made Sheet) on Year and Taxes. The rest not read                         |
| Accountant, "Račun za M/YYYY", month untrusted        | the accountant, `newer_than:90d`                              | `incoming-invoices/<YYYY>-incoming-invoices/<YYYY-MM>/<mail date>-accounting.pdf`, date in Europe/Zagreb                                                               | As payroll. A resend on a later day becomes a second file                                                   | Not read                                                                                      |
| Accountant, "PDV za M/YYYY"                           | the accountant, `newer_than:90d`                              | `vat-returns/<YYYY>-vat-returns/<YYYY-MM>-pdv.xlsx` (year folders since 2026-10-26). Period from the subject                                                           | As payroll. A hand-made Sheet doesn't block the xlsx                                                        | xlsx (or Sheet) on Year and Taxes. The mail body with the running VAT prepayment is not filed |

Sources: `shadow-accounting/scripts/Code.gs` (lines 5, 201-335, 381-397), `company-finance/payroll/scripts/Code.gs` (29-195), `incoming-invoices/scripts/Code.gs` (19-109), `vat-returns/scripts/Code.gs` (23-128). The supplier invoices beside the accountant's in `incoming-invoices/` (subscriptions, airlines, the insurer) are filed by hand and no script touches them.

Where the app reads: the statements step lists one level of year folders and reads `.xml` only (`src/features/imports/infrastructure/googleStatementFolder.ts` lines 14-17, `domain/statementFiles.ts` lines 28-35). The accountant read walks every level and takes only `YYYY-MM-pdv` and `YYYY-MM-salary` (`src/packs/hr-doo/domain/accountant/accountantFile.ts` lines 27-37). Both need `drive.readonly`. The app's only Gmail call is draft creation.

### Gmail from the browser

- **The calls.** `messages.list` with `q` in Gmail search syntax, up to 500 per page. `messages.get` for headers and attachment parts ([messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get)). `attachments.get` for the bytes. All four script queries are plain `from:` `subject:` `has:attachment` searches, so `q` covers them.
- **It works from a page.** Google's JavaScript quickstart calls Gmail with `gmail.readonly` through the GIS token client ([quickstart](https://developers.google.com/workspace/gmail/api/quickstart/js)). The app already calls `gmail.googleapis.com` for drafts, and the CSP allows it (`index.html` line 7).
- **Dates in a query are "midnight on that date in the PST timezone"** ([filtering](https://developers.google.com/workspace/gmail/api/guides/filtering)). Use `after:<epoch seconds>`.
- **Quota is no concern.** list 5 units, get 20, attachment 20, against 6,000 units per user per minute ([quota](https://developers.google.com/workspace/gmail/api/reference/quota)). A sync with ten new mails uses about 1,000.
- **The history feed doesn't fit.** Records are "typically available for at least one week", then a full sync is needed ([sync guide](https://developers.google.com/workspace/gmail/api/guides/sync)). Push needs Cloud Pub/Sub and a server ([push](https://developers.google.com/workspace/gmail/api/guides/push)). A month nobody opened the app would get nothing from it, so the design searches with `q`.
- **No labels.** Setting one needs `gmail.modify`, a write grant on the whole mailbox ([messages.modify](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/modify)).
- **Policy.** Writing a user's attachments to their own Drive is a transfer allowed "to provide or improve ... user-facing features" with their consent (Workspace user data policy).

### Other ways in, and why they lose

| Way                                           | What the user does                                                                                                                                                                                                                                                                                                                         | Why not                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The user's own copy of the script             | Copies a template script, runs install, accepts "Read, compose, send, and permanently delete all your email" (`GmailApp.search` needs `mail.google.com`) and full Drive ([GmailApp](https://developers.google.com/apps-script/reference/gmail/gmail-app), [DriveApp](https://developers.google.com/apps-script/reference/drive/drive-app)) | Outside your cap and verification, since each copy is the user's own project ([client verification](https://developers.google.com/apps-script/guides/client-verification)). But the consent is far wider, every fix has to reach every copy, and the app still needs `drive.readonly` to read what it files |
| A Gmail forwarding filter                     | Adds a forwarding address ([forwarding](https://support.google.com/mail/answer/10957))                                                                                                                                                                                                                                                     | Something has to read the receiving mailbox, which means a server. No Google feature that files mail into Drive was found, though that is not proven                                                                                                                                                        |
| A Gmail add-on with a "file this mail" button | One tap per mail. Its scope is non-sensitive ([add-on scopes](https://developers.google.com/workspace/add-ons/concepts/workspace-scopes))                                                                                                                                                                                                  | Public Marketplace publishing and review for gmail.com users ([publishing](https://developers.google.com/workspace/marketplace/how-to-publish)). Details unconfirmed                                                                                                                                        |
| By hand                                       | Downloads from the bank and uploads in the app, or drops into the folder                                                                                                                                                                                                                                                                   | Kept as the default. Upload needs only `drive.file`                                                                                                                                                                                                                                                         |

## 2. The design

**Mail is one more sync step, before the statements step.** The order becomes: books, mail, statements, accountant folders. Each mail source runs on its own, so one failure doesn't stop the others. Mail only fills folders. Every statement is still parsed by the statements step, and every accountant file by the accountant step, so there is one parse path each. Downloading a just-filed XML again costs a few kilobytes and isn't worth a second path. The XML's file name comes from the existing camt reader (`src/features/imports/domain/camtStatement.ts` line 48, label at lines 127-133) with accounts from the books, not a second parser.

**Mail sources are settings, not a new record kind.** A blank sender turns a source off. Folders reuse today's keys.

| Source                     | New settings                                                        | Folder                                         | Naming, ported from the script                                                                                                    |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Bank statements            | `statements_mail_from` (list of senders), `statements_mail_subject` | `statements_folder` (existing)                 | XML `<label>-<account>.xml`, PDF `<date>-statement-NNN.pdf`. For a bank without a preset, mail date plus the bank's own file name |
| Payroll (pack)             | `hr_accountant_mail_from`, `hr_payroll_mail_subject`                | `hr_payroll_folder` (existing)                 | Month from the subject. The XML takes its kind from the order PDF in the same message                                             |
| VAT returns (pack)         | shared sender, `hr_vat_mail_subject`                                | `hr_vat_returns_folder` (existing)             | Period from the subject, two-digit years accepted                                                                                 |
| Accountant invoices (pack) | shared sender, `hr_invoices_mail_subject`                           | new `hr_incoming_invoices_folder` (decision 3) | Mail date in Europe/Zagreb                                                                                                        |
| All sources                | `mail_since`                                                        |                                                | The earliest mail the first run looks at                                                                                          |

The query per source is `from:(a OR b) subject:"…" has:attachment after:<epoch seconds>`. Your presets are your four current queries.

**What one sync does, per source.**

1. Work out the window: from 7 days before the newest message the app filed for this source, or from `mail_since` if it has filed none.
2. Search, then read each message's headers and attachment names.
3. Name each attachment by the source's rule. An attachment no rule matches goes on the step's "unmatched" list with the mail's subject.
4. Skip names already in the folder (the folder listing the statements and accountant steps already do).
5. For the correction sources, a same-named file with different bytes is a correction. If the app filed the old one, it trashes and replaces it, as the scripts do. If a script filed it, the step line says "Correction for 2026-09 VAT, swap it by hand" (decision 4).
6. Download and create the rest, with three appProperties: `ledgerboard-mail=<source>`, the Gmail message id and the message date.
7. Report in the step line: "Filed 2, already there 5, 1 unmatched".

**Dedup without downloading.** Bytes are compared through Drive's `sha256Checksum` ("if available", [files resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)) against a WebCrypto SHA-256 of the attachment from Gmail. Whether the scripts' files carry it is a stage 0 check.

**State lives on the filed files, not in the books.** The window comes from `filesWithAppProperty` (`src/shared/google/driveClient.ts` lines 123-125), and `createFile` already writes appProperties (lines 137-154). Each property is capped at 124 bytes ([properties](https://developers.google.com/workspace/drive/api/guides/properties)). A marker in the books would make every sync a save with a revision and a backup, and could claim a file a failed upload never wrote. A window from the newest file in the folder would jump forward when someone drops a file by hand. Files only the app filed don't have that problem.

**A month nobody opened the app** is covered by the window, which starts at the last message filed however long ago. A message that matched no rule stays on the unmatched list until a later filing moves the window 7 days past it.

**Tokens.** `gmail.readonly` joins the one in-memory token of the proposal's decision 1 whenever a mail source is on, and its silent trip on open. It is never stored.

**Two devices at once** can file the same name twice, since Drive allows duplicate names. Figures are unaffected: the ledger dedups by reference and `filingsByPeriod` tolerates extra files (`accountantFile.ts` lines 38-55). The design leaves the duplicate in place rather than adding a cleanup.

**Retiring the scripts.**

1. Ship mail as a dry run: per source "would file N, already there M, unmatched K", with names and checksums. The proof is 0 new for Erste, matching the script's last log, which saved nothing and left nothing unmatched.
2. Turn filing on for Erste. Statements arrive every working day, so a week of overlap is quick evidence: each morning the Executions log says `saved 0`, and the new files carry the app's appProperties.
3. Retire the Erste fetch: delete its trigger in the Apps Script editor. With `formatLedger` gone the project holds nothing else, so stage `shadow-accounting/scripts/` in `_to-delete/`.
4. Keep the three accountant filers through one monthly cycle so payroll, VAT and an invoice each arrive with the app filing first. Then delete their triggers by hand and never run them again, because each run reinstalls its trigger (payroll `Code.gs` lines 178-186, the same in the other two). Stage their `scripts/` folders and Drive project stubs.
5. Update the hubs, `work/log.md`, and the payroll and invoice fetch memory notes.

## 3. Onboarding choices

The proposal's step 3 becomes:

```
How do statements reach the app?
  (•) I import them by hand           No extra access.
  ( ) From my mail                    The app finds the bank's mail when you sync and files it in Drive.
                                      Google will say "View your email messages and settings".
  ( ) From a folder in my Drive        The app reads your Drive to find new ones.
                                      Google will say "see all your Drive files".
  (From my mail)  Your bank  [Erste ▾ / Another bank: sender address]   Mail since [2026-01-01]
```

| Choice                                       | Asks for                                                                                                  | What happens                                                                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Statements by hand (default)                 | nothing beyond `drive.file`                                                                               | Import tab upload. Also works for books kept in the browser                                                                                                                                                                                      |
| Statements from mail                         | `gmail.readonly` + `drive.file`                                                                           | The app makes the statements folder inside the folder picked for the books, so the statements step can read it with `drive.file`. That step takes only the read token today (`googleStatementFolder.ts` line 5), so it needs a `drive.file` path |
| Statements from a Drive folder               | `drive.readonly`                                                                                          | Today's flow                                                                                                                                                                                                                                     |
| Accountant mail on (pack only, your presets) | `gmail.readonly` (shared with statements) + `drive.file`, plus `drive.readonly` for your existing folders | Hidden from other users (decision 5)                                                                                                                                                                                                             |
| Accountant mail off                          | `drive.readonly` only if Taxes should read folders filled by hand                                         |                                                                                                                                                                                                                                                  |
| Mail since                                   | nothing                                                                                                   | Defaults to the start of the year, so years of old statements don't pile up on Import before an account exists                                                                                                                                   |

## 4. Your decisions

### 1. Whether the app ever serves more than 100 users

Every user who accepts a restricted scope through the warning uses one of 100 places for the project's life, yours included. Mail adds a place only for users who would otherwise stay on `drive.file`. Example: a friend's company tries the app and turns on statements from mail. That is one place gone, and it can't be returned.

- **Stay unverified, under 100 users.** No cost now. If the cap runs out, Google can disable sign-in for the app.
- **Verify the app when it nears 100.** A custom domain with a home page and privacy policy, a demo video, a written case for each scope, about six weeks of review, possibly a yearly assessment from about $3,000 a year (one assessor's [price list](https://leviathansecurity.com/programs/google-casa-cloud-application-security-assessment), a third-party page). Google may still reject Gmail access for bookkeeping.
- **Other users run their own copy of the script.** Outside your cap and verification. Cost: a much wider consent for them, a fix has to reach every copy, and they still need `drive.readonly`.

Recommendation: stay unverified and build the app path. Revisit when the hub's new address is chosen, since a domain of your own is the first step of verification.

### 2. How far back your first run reaches

The scripts look back 90 days, which is how four VAT returns were never filed. Example: with `mail_since` at 2025-01-01, the first dry run would list 2025-10, 2026-01, 2026-02 and 2026-04 VAT, if those mails exist, beside older payroll and invoice mail.

- **Start from 2025-01-01 once, in the dry run.** You see every missing file before anything is written. Cost: an older payroll xlsx may land beside a hand-made Sheet for the same month, and if they read differently Taxes marks that month unread until you remove one.
- **Start at the cutover, like the scripts.** Nothing old moves. Cost: the four gaps stay until you file them by hand.

Recommendation: start from 2025-01-01 in the dry run and decide from its list.

### 3. Which mail the app files

Example: the October payroll mail carries the salary xlsx, an IP1 form, two payment-order PDFs and two XMLs. The app reads only the xlsx.

- **File what the scripts file today.** Your Drive keeps the same shape and nothing is lost when the scripts go. Cost: rules for files the app never reads, and a new `hr_incoming_invoices_folder` setting used only to file into.
- **File only what the app reads.** About 160 fewer lines. Cost: the IP1 forms, payment orders, statement PDFs and the accountant's invoices go back to hand filing.
- **Also file the supplier invoices.** Cost: one rule per supplier, each with its own sender and naming, for files the app doesn't read. Better as a later item.

Recommendation: file what the scripts file today, and leave supplier invoices out.

### 4. A correction to a file the scripts filed

Example: in November the accountant resends the September VAT return with a fix. The script filed the first one, so the app can't trash it.

- **Show it in the sync step for you to swap by hand.** No new access. Cost: one manual swap, possible only within the scripts' last 90 days.
- **Ask for full `drive` access.** The app replaces it itself. Cost: the token could change any file in your Drive, in the same restricted tier.

Recommendation: show it.

### 5. Accountant mail for other users

The rules match your accountant's file names, and the IP1 rule carries the employee's name.

- **Hide accountant mail from other users.** No cost now.
- **Add a generic rule: every attachment from a sender, named by mail date plus its own name.** Cost: about two files, and Taxes can't read those names.

Recommendation: hide it until a second hr-doo user exists.

### 6. Mail rules as settings keys

Each document type gets one sender list and one subject in settings, with the folders on today's keys. A user with two banks lists both senders. It holds as long as one rule per document type is enough.

- **Settings keys.** About 80 lines across `settings.ts` and `companyFacts.ts`.
- **A mail-source record kind.** Several rules per type, for a user who doesn't exist yet. Cost: a new tab in the books and its migration.

Recommendation: settings keys.

### 7. The two script bugs before retirement

The Erste fetch reads the archived Sheet (gap 1, latent today) and payroll runs on New York time (gap 2, unverified).

- **Leave both until retirement.** Cost: an account you add in the app before then is filed without its account name, and you must not rename it by hand.
- **Fix both now.** A small Apps Script change and a clasp push, which needs your yes. Cost: work on code that retires within weeks.

Recommendation: leave both. Don't add an account in the app until the Erste fetch retires, and check one payroll Executions entry for the run time.

### 8. Where you pay salaries from

Do you pay from the payroll payment-order XML in Drive, or from the mail? If from Drive, a file that lands only when the app syncs could hold you up on pay day. If that's a real case, the payroll filer can keep running until the app has been open on each pay day of one cycle.

## 5. Build stages

These follow the proposal's stages 1 to 3, because mail needs the sync step model and the one token. Each stage after the spikes is one commit and one deploy.

**Stage 0 additions: spikes you run in Firefox, in a scratch folder.**

1. With a token carrying `drive.file` and `drive.readonly`, create a file in a script-made folder. A 404 means the one-time folder picks.
2. `messages.list`, `messages.get` and `attachments.get` with `gmail.readonly` from the page.
3. One silent request carrying `drive.readonly gmail.readonly`: are both granted?
4. Is `sha256Checksum` present on the script-filed XML, PDF and xlsx files?
5. One payroll Executions entry: does it run near noon?

**Stage 5: mail as a dry run, your presets only.** About 17 files, 1,900 lines, most of them specs and fixtures.

- New `src/features/mail/`: `domain/mailSource.ts` (about 80, kinds, query, window), `domain/statementMailFiling.ts` (about 90), `application/mailFiling.ts` (about 160, search, plan, dedup, counts, dry run), `infrastructure/gmailMailbox.ts` (about 80), `infrastructure/fake/fakeMailbox.ts` with anonymised fixtures (about 150), `presentation/MailSettingsCard.vue` (about 150), three specs (about 450).
- New `src/packs/hr-doo/domain/accountant/accountantMailFiling.ts`, the three accountant rules (about 160), and its spec (about 250).
- Changed: `settings.ts` (+40), `companyFacts.ts` (+40), `driveClient.ts` (+10 for `createdTime`, `sha256Checksum`, `appProperties`), the scope list from the proposal's stage 2 (+15), the sync step list and the pack's sync steps (+30), `GeneralSettingsForm.vue` (+20).

**Stage 6: Erste filing on.** About 4 files. The write path of `mailFiling.ts` with its spec (+150). If spike 1 fails, `locateFiling`, the folder methods and the path template move from invoicing into `src/shared/google/` so invoicing and mail share one filing walk (`invoiceRun.ts` lines 51-73, `invoiceFiling.ts` lines 4-37, about 100 lines moved). After a week, retire the Erste fetch.

**Stage 7: accountant filing on.** About 3 files: the correction rule with its spec (+80), and `hr_incoming_invoices_folder` if decision 3 keeps it (+20). After one monthly cycle, retire the three filers.

**Stage 8: "From my mail" in onboarding.** About 4 files: the step 3 choice and the bank preset (+120), `googleStatementFolder.ts` taking a `drive.file` path (+10), the app-made statements folder under the books folder (+40), its spec.

**Stage 9: docs.** README host and scope tables, `public/privacy.html` for "View your email messages and settings", the product and finance hubs, `work/log.md`, the two memory notes, the plan.md Risks row on the filers, and the script folders staged in `_to-delete/`.

## 6. The proof

| Stage | Unit tests                                                                                                                                                                                                                        | Browser checks (fake build)                             | You, by hand                                                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | none                                                                                                                                                                                                                              | none                                                    | The five spikes, results written into plan.md                                                                                                                |
| 5     | Each naming rule against anonymised copies of real subjects and file names, including `RE:`/`FW:`, two-digit years, a PDF and XML pair, an unknown order kind, a delivery sent twice. The window with and without app-filed files | The mail step line in every state with `fakeMailbox`    | Dry run on your mail shows 0 new for Erste, matching the script's last log. With `mail_since` at 2025-01-01, read the list (decision 2)                      |
| 6     | The write path, a failed upload, a re-run after a phone is backgrounded mid-filing                                                                                                                                                | Figures unchanged on `fake-drive`                       | One week: each morning the Erste Executions log says `saved 0`, and the new files carry the app's appProperties                                              |
| 7     | A correction to an app-filed file replaced, to a script-filed file reported                                                                                                                                                       |                                                         | One cycle: payroll, VAT and an invoice filed by the app, and Taxes reads the xlsx                                                                            |
| 8     | The onboarding choice, the folder made under the books folder                                                                                                                                                                     | The onboarding flow with "From my mail" at 360 and 1440 | A test Google account with a sender preset pointing at a second test account that mails it a sample camt file. Start new on Drive, choose mail, sync, import |
| 9     | none                                                                                                                                                                                                                              | `check:pwa`                                             | Read the privacy page's Gmail wording                                                                                                                        |

## 7. Risks

| Risk                                                          | Mitigation                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| The 100-user cap runs out and Google disables sign-in         | By hand stays the default. Decision 1 before any public launch                                    |
| Google rejects Gmail access at verification                   | Mail stays for users under the cap. Statements by hand or from a folder still work                |
| The bank or accountant changes a subject or file name         | The step line lists the unmatched mail with its subject, never silent like the Executions log     |
| Mail deleted before the next sync is never filed              | The window catches up after any gap. The step line shows when the last mail was filed             |
| A token in memory can read all your mail                      | Asked for only while a mail source is on. The strict CSP, no runtime scripts but Google's         |
| Backfilled xlsx beside a hand-made Sheet marks a month unread | Decision 2 runs the dry run first                                                                 |
| A script and the app both file during the overlap             | The same names and the same duplicate rules on both sides, so whichever runs second sees the file |
| Google retires the implicit flow                              | Shared with the proposal. The token logic sits in one file after its stage 2                      |

## Sources

Loaded by the lanes:

- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/modify
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/Format
- https://developers.google.com/workspace/gmail/api/guides/filtering
- https://developers.google.com/workspace/gmail/api/guides/sync
- https://developers.google.com/workspace/gmail/api/guides/push
- https://developers.google.com/workspace/gmail/api/reference/quota
- https://developers.google.com/workspace/gmail/api/quickstart/js
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/properties
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files
- https://developers.google.com/workspace/drive/picker/guides/overview
- https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- https://developers.google.com/workspace/add-ons/concepts/workspace-scopes
- https://developers.google.com/workspace/marketplace/how-to-publish
- https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://developers.google.com/apps-script/reference/script/clock-trigger-builder
- https://developers.google.com/apps-script/reference/gmail/gmail-app
- https://developers.google.com/apps-script/reference/drive/drive-app
- https://developers.google.com/apps-script/guides/client-verification
- https://developers.google.com/apps-script/concepts/scopes
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/guides/triggers/installable
- https://support.google.com/cloud/answer/13464325
- https://support.google.com/cloud/answer/15549945
- https://support.google.com/cloud/answer/13463817
- https://support.google.com/cloud/answer/13464321
- https://support.google.com/cloud/answer/13463816
- https://support.google.com/cloud/answer/7454865
- https://support.google.com/mail/answer/10957
- https://support.google.com/mail/answer/6579
- https://publicsuffix.org/list/public_suffix_list.dat
- https://leviathansecurity.com/programs/google-casa-cloud-application-security-assessment (third party)

Unconfirmed: whether `drive.file` can create a file in a folder it can't see, whether a github.io subdomain passes domain verification, whether the yearly assessment applies to a browser-only app, whether Gmail's approved uses cover bookkeeping, and the copy-link mechanics of a template script.
