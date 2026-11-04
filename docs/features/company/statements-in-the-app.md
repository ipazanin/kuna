# Statements parsed by the app: proposal

Wave 13: the app reads new camt statements from the Drive folder on sync and files them in one write through the Wave 12b write path, the Apps Script keeps only the Gmail fetch and the ledger formatting, and the app drops what only mirrored the script. Design, four build stages, the clicking work for the planning session and five questions.

Built on three research lanes: [Drive read access](research/statements-in-the-app/lane1-drive-read.md), [the sync flow](research/statements-in-the-app/lane2-sync-parse.md) and [retiring the Apps Script's parsing](research/statements-in-the-app/lane3-apps-script.md). Code is cited at HEAD 8666d7e, or as "working tree" where deploy 3 (Wave 12b stages 6 to 8) has already changed it. The design writes through stage 7 as [the Wave 12b plan](../platform/storage-boundary-plan.md) describes it: `store.write`, `UnitOfWork`, `WriteRules`, `RecordStorage`. Real data appears as counts only.

## What you asked, and what is already decided

You asked on 2026-10-21 that the Apps Script stop parsing. It fetches statements from Gmail and files them in a folder. The app parses them when it is opened and synced. Decided in plan.md, Wave 13:

1. **Drive read access** is `drive.readonly` as a one-time incremental grant, the way Gmail drafts work. The token lives in page memory only, never in localStorage. `drive.file` stays for writes. The unverified-app warning and the 100-user cap are accepted. No `inbox` tab.
2. **On sync** the app lists the statements folder (a settings key, default the Erste archive path), parses every camt file not yet on the ledger with the Wave 6 reader, and writes clean statements at once through the import write path. It stops and shows the dry run only on a problem: a balance gap, a refused file, an unknown IBAN. Uncertain verdicts still land on Review.
3. **The Apps Script** keeps `fetchErsteStatements`, its folder read from `settings`, and `dailyPass` keeps the fetch and the ledger formatting. `CamtIngest.gs`, `ErsteCamt.gs`, `Categorise.gs` and `Rules.gs` are staged in `_to-delete/` after one more parity proof and your review.
4. **Checks:** the dry run on every real statement (0 new rows on a current ledger), a write replay, the Google import on a copy of the Sheet, and a sync with no new files that writes nothing.
5. From Wave 12c: rule deletion comes with this wave. From Wave 13b: it is built after this wave, so the app is the only writer of ledger rows.

## How it works today

Erste mails statement 028 overnight. At 06:00 `dailyPass` saves the PDF and the XML into `statements/2026/`, the XML named `<label>-<account>.xml`. `CamtIngest.gs` then skips every file whose label and account are already on the ledger (`CamtIngest.gs:421-425`), parses the new one, categorises it with `Rules.gs` and inserts its rows newest first. You open the app at 9:00. The auto sync reads the Sheet without a click (`autoSync.ts:20-27`), the new rows are there, and one waits on Review.

The app can already do the parsing. On every XML file in the archive the app's reader and the Apps Script's agree on every header, every cell and every verdict, and a dry run against your export adds no rows and refuses none (lane 2, lane 3). Parsing the whole archive takes about 35 ms. What the app cannot do today is see the folder: the Sheet token is `drive.file` (`googleAuth.ts:31`), and your Wave 9 spike showed a `drive.file` token lists no children of a picked folder.

## The design

**In plain terms.** At 06:00 the script only files the XML. At 9:00 the app reads the Sheet as today. If the page holds a Drive read token, it then lists the statements folder, sees one file whose label is not on the ledger, downloads it, runs the Import tab's dry run, and files the 2 new rows in one write. A toast says "Filed statement 028, 2 rows. 1 waits on Review." with Undo. A sync that finds nothing new downloads nothing, writes nothing and shows no toast. When a statement has a problem, nothing past it is written for that account, Overview shows a job, and the Import tab shows that statement's dry run with the controls it has today.

The one friction is the token. Kept in page memory, it is gone after every reload, and on desktop a new token needs a click (Google: "A user gesture triggers the token flow", use-token-model guide, lane 1). So with today's decision the folder is read only after one tap per app open. That is question 1.

### Domain

- **New `src/features/imports/domain/statementFiles.ts`.** Which files in the folder to download: names ending in `.xml` (the MIME type Apps Script gives an attachment is unconfirmed, so no MIME filter), minus those whose `<label>-<account>.xml` name has its label and account on the ledger already. This is `isFiledByName` moved into the app. On your export it skips every file. It is only a shortcut: the dry run's dedup by account and reference (`importDryRun.ts:110`) and the write rules' fresh check (`ledgerRows.ts:73-79`, working tree) still decide what is written.
- **`importDryRun.ts` unchanged in logic.** Its `added` is still `RowCells` (`importDryRun.ts:46-52`). If stage 7 has not turned it into ledger records, this wave does, so the Import tab and the sync add records the same way.
- **A `statements_folder` settings key** beside `invoice_folder_id` (`src/features/settings/domain/settings.ts:311`): a path from My Drive, default `work/company/business-bank-account/erste/statements`, read as segments. The fetch reads the same row.
- **No new stored state.** No seen list, no file-id cursor, no tab. The ledger's `account` and `statement` columns are the state (lane 2 compared four alternatives and none adds anything).

### Application

- **New `src/features/imports/application/statementSync.ts`.** One function that runs after the Sheet read:
  1. Resolve the folder, list its year folders and their files.
  2. Keep the files `statementFiles` says to read, download them, `loadImportFile` each (`importFiles.ts:15` already takes an `ArrayBuffer`), read them with `statementReadings` (`importStatements.ts:19`).
  3. One `dryRunFor` over all of them (`importStatements.ts:33`).
  4. One `store.write('Filed statements …', (unit) => …)` that adds the dry run's accepted rows through `LEDGER_WRITES` (`ledgerRows.ts`, working tree). Accepted means no refusal, no pending account start and at least one new row. The dry run already leaves an account where it was after a refused statement (`importDryRun.ts:78-80`), so nothing is written past a problem.
  5. While `CamtIngest.gs` still runs, the write may be refused because the morning ingest filed the same rows first (`ledgerRows.ts:77`, working tree). The sync then runs the dry run once more on the fresh read instead of showing an error.
- **Its outcome** (filed statements, held statements with their dry run, a folder problem) is page state in the imports feature, read by the Import card and the Overview job. It is not stored.
- **Wiring.** `App.vue` runs the Sheet read then the statements step, both for the Sync button and for `startAutoSync` (`App.vue:31`, `:47`). The workbook store stays unaware of statements. Excel mode has no sync (`workbookStore.ts:480-485`, working tree) and keeps the drop-a-file import.
- **Reuse.** The write goes through the same `LEDGER_WRITES` as the Import tab, so there is one ledger add path, one Undo and one set of refusals.

### Infrastructure

- **`src/shared/google/googleRedirect.ts` and `googleAuth.ts`.** A third grant kind `'drive-read'` beside `'gmail'` (`googleRedirect.ts:14`, `:161`), the scope check in `settleRedirect` (`googleRedirect.ts:117`), and `requestDriveReadToken` and `currentDriveReadToken` beside the Gmail pair (`googleAuth.ts:139-185`), the token in a module variable cleared by `forgetGoogleSignIn` (`googleAuth.ts:188-192`). It asks for `drive.readonly` alone with `include_granted_scopes: false`, so the read token can't write the Sheet or send mail. Google's reference says that with false the token covers only the requested scopes.
- **`src/shared/google/driveClient.ts`.** `listChildren` (`driveClient.ts:21-39`) takes a query and a field list, so it serves the folder walk, the year listing and invoicing. A new `downloadFile` does `files/<id>?alt=media`. Everything stays on `www.googleapis.com`, which the CSP allows (`index.html:7`).
- **New `src/features/imports/infrastructure/googleStatementFolder.ts`.** Walks the path one segment at a time with `'<parent>' in parents and name = '<segment>' and mimeType = folder and trashed = false` (Drive has no path query, search-files guide, lane 1). Two folders of one name in a parent are refused with the segment named, and a missing one is reported. The app never creates folders. Today that is 5 segment lookups, 1 year listing and 1 file listing per sync, and 0 downloads when nothing is new.
- **New fake statement folder** under `imports/infrastructure/fake/`, made from `sampleImportFiles.ts`, folded out of the production build like the fake Sheet, so the visual and touch checks can run a sync.

### Presentation

- **Sync status** (`src/shared/ui/SyncStatus.vue`) reads in steps: "Reading the Sheet", "Looking for new statements", "Filing 3 rows". Today it has only Syncing, Sync and Try again.
- **The toast** of `useRecordWrites` with Undo, linking to Review when a filed row waits there.
- **Overview, Waiting for you** gets a statements job (`waitingForYou.ts:18-25`) such as "1 statement was not filed", linking to Transactions, Import. Under the recommended answer to question 1 it also shows "Check for new statements" while the page has no read token.
- **Import tab** gets a "From the statements folder" card above the file drop, a new focused component beside `ImportPanel.vue`. It shows the held statements with `DryRunStatementCard`, the start-this-account control and Confirm, and lists what the same sync filed so you see where the problem starts.
- **`useGoogleReturn.ts`** resumes the sync after a `drive-read` redirect on a phone, with no second tap (today Gmail asks you to tap again, `useGoogleReturn.ts:27-35`).
- README "Google sign-in" and "Import", and `public/privacy.html:149-161`, name `drive.readonly`.

### What goes away, after the Apps Script push

Lane 3 lists about 25 places with paths. The main ones:

- `scripts/parity-rules.mjs`, the `parity:rules` npm script and its README section. It loads every `.gs` file in the folder (`parity-rules.mjs:55-56`), so it breaks the moment the four files move.
- The whole-tab rules check (`rulesTabRefusals.ts` and its callers), the order-tie rule (`rule.ts:65-81` and the tie report), `hasClientsTab` and its parameters, the "keep at least one IBAN" guard (`accountGuards.ts:67-69`), the Import tab's morning-run note (`ImportPanel.vue:305`), and the README test steps that run _Preview camt ingest_ and _Back-test categorisation_.
- `RULE_WRITES` loses its Apps Script check (`ruleWrites.ts:27-50`, working tree). Rules become ordinary records with one write path, and rule deletion from Wave 12c lands here as a `remove`.

**Stays, with the Apps Script reason replaced:** the account and IBAN guards (the fetch names files by IBAN), the accounts and settings header rules (the fetch reads them by header), and the fresh check before an import writes (another device's sync can file the same statement). About 20 comments and test names that cite `ErsteCamt.gs`, `Rules.gs` or "the ingest" as the authority are reworded.

**On the script side:** `Code.gs` and `Data.gs` lose the schema, the seeding of `categories` and `accounts` (`Data.gs:30`, a second writer of a tab the app owns), the back-test and the ingest step. A 40-line head reader and `normaliseIban` move into `Code.gs`, since the fetch names each XML from `camtDocumentHead` (`ErsteCamt.gs:28`). The ledger formatting becomes header-driven and loses `trimColumns` (`Code.gs:230`, `:350`). Today it deletes every ledger column past 18, so Wave 13b's `owner_share` column would be deleted with its values on the first 06:00 run. Lane 3's drafts are `kept/Code.gs` and `kept/Data.gs` in its scratch folder.

### Assumed unless you say otherwise

- The `statements_folder` value is a path, shared with the fetch, rather than a picked folder id.
- A statement number gap whose balances still join is written with a note in the toast, as the Import tab does today. Only a balance gap stops it.
- A file that never parses is reported on every sync. You move or rename it in Drive. No new dismissal kind.
- With the `statements_folder` row missing, the fetch stops with a message and files nothing, instead of carrying its own default.
- The hub's step of renaming a label-only file by hand goes. The app dedups such a file by reference.
- New ledger rows still go in newest first until the JSON storage move removes the Sheet. Only a person reading the Sheet gains from it, and the move deletes the code anyway.
- Signing out drops the read grant too. Google's GIS reference: "The `revoke` method revokes all of the scopes that the user granted to the app" (https://developers.google.com/identity/oauth2/web/reference/js-reference, loaded 2026-10-23).
- Wave 12c stores a category colour as its swatch's light hex ([its proposal](small-features.md)), so the kept formatting still colours the Sheet.

## Build stages

Four stages, two deploys: stages 1 to 3 as one commit, then stage 4's app commit on the day of the Apps Script push. Both stops in the handoff hold: before the Cloud change, and before the Apps Script change.

**Proof in every deploy:** `npm run check`, `npm run build` with the fake-bytes check, `check:pwa`, `check:import`, the full `check:visual` and `check:touch` on the fake build. On a fresh export: `check:round-trip`, `parity:year-end`, `parity:payroll`, and `parity:rules` while it exists. The figure script prints every figure identical to the commit before the wave.

**Stage 1: the Drive read grant.** About 8 files: `googleRedirect.ts`, `googleAuth.ts`, `useGoogleReturn.ts`, `public/privacy.html`, README, `tests/googleRedirect.spec.ts` and the touch flow for the return.

- Proof: unit tests for the pending redirect with `drive-read`, the scope check refusing a token without `drive.readonly`, and the token cleared on sign-out. `check:touch` on the redirect return with a mocked fragment.
- Stop: the planning session makes the Cloud reads and changes listed under _Your hands_ (items 1 to 3) before the deploy.

**Stage 2: reading the folder.** About 13 files: `statementFiles.ts`, `googleStatementFolder.ts`, the fake folder, `driveClient.ts`, `googleInvoiceDrive.ts` for the wider `listChildren`, `settings.ts` and the template's settings row, `fakeWorkbook.ts`, specs, README's settings list.

- Proof: unit tests for the walk (two matches refused, a missing segment named, quotes escaped), paging on `nextPageToken`, the name test on a label-only file and on a statement with no entries. A scratch script over the real archive and live9 prints that the name test downloads nothing.

**Stage 3: the sync.** About 20 files: `statementSync.ts`, `importStatements.ts`, `importDryRun.ts` if its rows are still cells, `App.vue`, `autoSync.ts`, `SyncStatus.vue`, `OverviewScreen.vue`, `waitingForYou.ts`, `ImportPanel.vue` and the new folder card, the visual and touch flows, specs, README "Import".

- Proof, unit and both storages: accepted statements go out in one write with one Undo, a refused statement stops the later ones of its account and not other accounts, a sync with no new files makes 0 writes, shows no toast and adds nothing to "Changes in this session", the ingest race reruns the dry run, and a new account waits for its start. One contract test lane 2 asked for: a refused ledger row holding reference R, and a statement carrying R.
- Proof on your data (scratch, lane 3's ten checks): 1 to 4 compare the app with the Apps Script in `node:vm` (headers, cells, verdicts, `parity:rules`), so they must run before the files move. 5 to 9 are the app's own: rows equal to the ledger by account and reference, a dry run of 0 new rows, a write replay of every camt row through `store.write` on both storages, 0 downloads by the name test, and a no-new sync that writes nothing. Check 10 is the Google import on a copy of the Sheet (_Your hands_, item 5).
- Deploy A. **Stop for your review** of the proof and the two kept script drafts.

**Stage 4: the Apps Script push and the removals.** About 45 files in the app, most of them deletions or one-line rewordings.

- The script change and push (_Your hands_, items 6 to 10).
- The same day: the app commit with everything under _What goes away_, plus rules Undo if you choose it in question 4. README, the handoff's check list and the shadow-accounting hub updated.
- Proof: the deploy checks without `parity:rules`, the rules editor flows for change, delete and Undo, figures identical. The next morning's `dailyPass` green with no ledger row added by the script, and the next statement filed by the app on its first sync, its balance continuing.

## Your hands, for the planning session

Each Cloud item is a shared-environment change: show it to the owner, wait for the owner's yes, make it in Chrome and re-read the page.

1. **Audience page:** read the publishing status and record it on the handoff's Cloud row. plan.md says "Production" in Wave 0 and "testing mode" in Wave 9. If Testing, question 2 applies.
2. **Data Access page:** declare `drive.readonly` or not, by question 3. Default: no change.
3. **APIs and services:** confirm the Google Drive API is enabled. A read only. No change to the OAuth client, the API key or Branding.
4. **After deploy A, the first grant.** On desktop Firefox: Sync, then "Check for new statements", accept the consent with its unverified-app warning. Watch the network panel: every download should stay on `www.googleapis.com`. Whether Drive ever sends a browser download to another host is unconfirmed, and the CSP would block it. Then once on the phone, through the redirect.
5. **Check 10 on a copy of the Sheet.** The implementation session copies the live Sheet with the Drive MCP `copy_file`. The owner connects the app to the copy (Settings, This device), deletes the newest statement's rows on the copy, syncs, sees them come back equal, then reconnects the live Sheet. The copy is staged in `_to-delete/` with a manifest line.
6. **The owner's review** of the proof and the kept drafts. Nothing below runs before the owner's yes.
7. **The settings row:** The owner adds `statements_folder` = `work/company/business-bank-account/erste/statements` in the app's Settings, General. A live Sheet write by the owner. Check on a fresh export that it reads back.
8. **The script change** (implementation session): replace `Code.gs` and `Data.gs` with the reviewed drafts, move the four files with plain `mv` to the Drive's `_to-delete/work/company/company-finance/shadow-accounting/scripts/` with a manifest line, then `npx @google/clasp push -f` from `scripts/`. clasp's README: push "always replaces the whole content of the online project with the files being pushed".
9. **First runs by hand, never by the trigger.** Reload the Sheet, then from the Shadow Accounting menu run _Format the ledger_ (all 18 columns kept, banding, filter and colours as before, no value changed) and _Fetch Erste statements from Gmail_ (saved 0 or the new ones). Then `dailyPass` from the editor. Each green in Extensions, Apps Script, Executions.
10. **The next morning:** the 06:00 `dailyPass` green, no ledger row added by the script, the next statement filed by the app.
11. **Records:** a `work/log.md` entry, the shadow-accounting hub sections lane 3 names, the memory note `shadow-accounting-pipeline.md`, and the Done line under Wave 13 in plan.md.

Rollback for items 9 and 10: move the four files back, restore `Code.gs` and `Data.gs` from the staged copies, push again. The change touches no Sheet cell.

## Questions for you

### 1. Reading new statements after you reload the app

Where: the sync on open, the Sync button, Overview.

Today: you open the app at 9:00, the Sheet syncs by itself, and the rows the 06:00 script filed are already there. Once the app files them itself, the folder can be read only while the page holds a Drive read token, and a reload starts without one.

- **Tap once per app open (recommended).** Opening reads the Sheet as today. Overview and the Sync button say "Check for new statements" until you tap. On desktop Google's popup opens and should close by itself once you have consented (unconfirmed, Google's pages don't say what a repeat request shows). On the phone the tab goes to Google and back, and the sync carries on by itself. For the next hour every automatic sync reads the folder too. Cost: one tap a day, included in stage 3.
- **Go through Google on every open.** The app moves the tab to Google and back with `prompt=none`, which Google documents as "Don't display any authentication or consent screens", then reads the folder. No tap, but every open loads Google's page first and takes a few seconds longer, on desktop too. Cost: about 4 more files, and a path for when Google asks for consent again.
- **Keep the read token like the Sheet token.** It goes into browser storage for its hour, and auto sync reads the folder with no tap, as today. This reverses your decision of 2026-10-21: a script injected into the page could read your whole Drive for up to an hour, where today it reaches only the Sheet and files the app made. Cost: small.

### 2. If the Cloud project is still in Testing

Where: every Google grant beyond the sign-in, Gmail drafts included. Ask only if the Audience page says Testing.

Today: the status is not recorded. In Testing, Google expires an authorization "seven days from the time of consent" for any scope beyond name, email and profile (lane 1).

- **Publish to production (recommended).** The consent shows Google's unverified-app warning once, and the grant lasts until you revoke it. The app is capped at 100 new users, which Wave 13 already accepts. `public/privacy.html` exists. Whether Branding is filled was not checked. Cost: one Cloud change.
- **Stay in Testing.** The Drive read and Gmail grants ask again every week. No Cloud change.

### 3. Listing `drive.readonly` on the consent screen

Where: Google's consent screen setup, the Data Access page.

Today: `gmail.compose` is not listed there, to stay out of verification, and its grant works (Wave 9 spike). The handoff says to add `drive.readonly`.

- **Leave it off, as Gmail is (recommended).** No Cloud change. The app asks for it at runtime. Google's page doesn't say what happens to an undeclared scope, so the first grant in item 4 is the test. Cost: none.
- **List it.** It shows under "Your restricted scopes", and Google advises against restricted scopes "to avoid unnecessary additional reviews". What the console then does to an unverified app is not on Google's pages. Cost: one Cloud change and an unknown.

### 4. Undo on rules

Where: Review, Rules, the rule editor.

Today: saving or changing a rule has no Undo (`ruleWrites.ts:27-33`, working tree), because a put-back rule had to pass the Apps Script's whole-tab check. Wave 12c left rule deletion for this wave. Once the script is gone, a rule is an ordinary record.

- **Give rules Undo (recommended).** A saved, changed or deleted rule gets Undo in its toast, like every other record. A deleted rule comes back with one tap. Cost: one flag on the rules' write rules and its tests, in stage 4.
- **Keep rules without Undo.** A deleted rule is gone unless you type it again. Cost: none.

### 5. A ledger id

Where: the identity of every ledger row, which splits, asset claims and Review find it by.

Today most ledger rows have no bank reference (the Wave 12b plan), so a row is known by its account, date, amount, balance and description. The Wave 12b plan suggested an `id` column "in Wave 13 or right after", since the app then files the ledger alone. You removed the "Add ids" notice, so existing rows would need another way to get their ids.

- **Add it with the JSON storage move (recommended).** The migration writes every record fresh once, so each ledger row gets its id then, with no notice and no Sheet column. Wave 13 doesn't touch ledger identity. Cost: none now.
- **Add it in Wave 13.** New rows get an id when they are filed. The existing rows need a one-time fill: a version of the notice you removed, or a write to your live Sheet by an agent. Cost: about 15 files and one live Sheet write.

## Risks

- **Two writers for a while.** Between deploy A and the push, the morning ingest and the app's sync both file ledger rows. The write rules' fresh check refuses the second, and the sync reruns its dry run quietly. Keep the gap to days.
- **A Drive read token can read the whole Drive.** It lives in page memory for its hour, carries no other scope, and the CSP and the absence of third-party scripts are the guard.
- **Google calls the implicit flow "strongly discouraged"** for modern web apps and points to the code flow with PKCE. The phone sign-in already uses it. The code flow needs a server, so nothing changes now.
- **The kept script ran only on fakes.** Lane 3's smoke run filed every name the archive holds and saved nothing on a second run, but Google's own Sheets and Drive calls are tested only by the first runs by hand in item 9.
- **The header-driven formatting must ship before Wave 13b**, or the 06:00 run deletes the `owner_share` column.
- **camt paths no real statement has carried yet:** a fee, a reversal, a foreign-currency card entry, and the family and sub-family difference of plan.md discrepancy 8. The proof reports whether any was in the run.
- **Unconfirmed:** the MIME type of the archived XML files (the design filters on the name), `'root' in parents` for the first path segment, and whether Erste keeps `Stmt/Id` on a redelivery (the design doesn't use it).

## Out of this wave

- Reading other banks' exports or PDFs from the folder. Statements 001 to 006 exist only as PDF and stay as they are.
- A sync in Excel mode. The drop-a-file import stays its way in.
- The ledger id and references by id (question 5, and step 2 of "Toward a database").
- Appending ledger rows at the foot of the tab.
- Where the fetch gets its folder and account names once the JSON move retires the Sheet (lane 3, question 6). The JSON storage research carries it.
- Wave 14's accountant workbooks, which reuse this wave's read token and `downloadFile`.

## The owner's decisions, 2026-10-23

1. Reading new statements after a reload: go through Google on every open with `prompt=none`, no tap. Handle the case where Google asks for consent again.
2. The planning session checks the Cloud project's Audience page and publishes it to production if it says Testing.
3. `drive.readonly` stays off the Data Access page, like `gmail.compose`.
4. Rules get Undo once the Apps Script no longer checks the rules tab.
5. The ledger id comes with the JSON storage move, not in Wave 13.
