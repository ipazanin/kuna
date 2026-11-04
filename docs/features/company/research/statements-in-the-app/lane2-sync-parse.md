# Wave 13, lane 2: the sync flow

How the app finds, parses and files new camt statements on sync, checked against the import feature and the real Erste archive.

Research on `~/Projects/personal/ledgerboard` at 8666d7e, plus the stage 7 write path as the [Wave 12b plan](../../../platform/storage-boundary-plan.md) describes it and the working tree has it so far. Read-only. Data checks ran on the Erste archive and on the owner's export `2026-10-23-live9.xlsx` through one scratch script, `archive-counts.mjs`, run against a `git archive` copy of 8666d7e in a scratch folder. It prints counts, dates and verdicts only.

## Findings

1. **The current reader parses the whole archive cleanly.** Every camt file reads as one statement, none is refused, and every entry has a bank reference. A dry run of the archive against the export gives no new rows, with every entry already on the ledger. Parsing all of it takes about 35 ms in Node, the dry run about 1 ms. Parsing is never the cost. Downloading is.
2. **"Not yet on the ledger" can be decided from the file name alone, as the Apps Script already does.** The fetch names every XML `<label>-<account>.xml` (`Code.gs:437-442`, `Code.gs:465-475`), and the ingest skips a file whose label and account are on the ledger without opening it (`CamtIngest.gs:418-425`). On the export that prefilter skips every file. So a sync with nothing new is one folder listing and zero downloads.
3. **The prefilter is only a shortcut.** Correctness stays where it is today: the dry run dedups by account and bank reference (`importDryRun.ts:110`), and the write rules check it again against a fresh read (`ledgerRows.ts:73-79`). A file the name test lets through by mistake writes nothing.
4. **No new stored state is needed.** No seen list, no settings key holding file ids, no tab. The ledger's `account` and `statement` columns are the state. I recommend this plainest option.
5. **The real friction is the token, not the parse.** The Drive read token is planned to live in page memory only. Auto sync runs only when no popup is needed (`autoSync.ts:20-27`). So after a reload, auto sync can read the Sheet but cannot list the statements folder until a click. See "Open questions".

## The archive

`work/company/business-bank-account/erste/statements/` on the Drive (the path in the implementation handoff, and `ERSTE_STATEMENTS_PATH` at `Code.gs:28`).

Every file holds one `Stmt` for the one business account. The PDF-only statements from before camt have no XML. Every XML is named `<label>-<account>.xml`, the date in the name equals the `CreDtTm` day, and every statement carries a distinct `Stmt/Id` and an `FrToDt`, but no `ElctrncSeqNb`. Statement numbers run with no gaps and no duplicates, no statement is empty, and every label and account is already on the export's ledger.

What the dry run does with a gap, checked on the export with rows taken out in memory:

| Case                                                      | New rows | Refused            |
| --------------------------------------------------------- | -------- | ------------------ |
| Ledger lacks the newest statement, its file is offered    | 1        | 0                  |
| Ledger lacks the newest two, both files offered           | 2        | 0                  |
| Ledger lacks the newest two, only the newest file offered | 0        | 1, the balance gap |

So a statement missing from the folder shows up as a balance gap on the next one, as the plan wants.

## The import feature today

| Step                    | Where                                                      | What it does                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load                    | `imports/infrastructure/importFiles.ts:15-31`              | Bytes to a camt `Document` (by a leading `<`) or a spreadsheet grid                                                                                                                                                                                                                                            |
| Read                    | `imports/domain/camtStatement.ts:49-66`                    | One `StatementReading` per `Stmt`: a statement or a refusal with a reason                                                                                                                                                                                                                                      |
| Refusals in the reader  | `camtStatement.ts:69-78, 107-122`                          | No label, unknown IBAN, no currency, chain does not close, summary counts or sums differ                                                                                                                                                                                                                       |
| Label                   | `camtStatement.ts:132-136`                                 | `CreDtTm` day plus `LglSeqNb`, such as `2026-08-26-statement-007`                                                                                                                                                                                                                                              |
| Statement identity      | `importedStatement.ts:24-26`                               | `{ kind: 'camt', iban, sequence }`                                                                                                                                                                                                                                                                             |
| Dry run                 | `imports/domain/importDryRun.ts:82-105`                    | Per account, oldest first. Dedup by account and reference, then refusals: rows between held rows (`:135`), no reference (`:141`), predates the newest row (`:153`), balance gap (`:160-169`), account with no rows waits for a start (`:174-181`). Notes for a sequence gap with joining balances (`:182-189`) |
| Where the ledger stands | `importDryRun.ts:259-273`                                  | Newest row, references, labels and newest sequence per account, from `Transaction`                                                                                                                                                                                                                             |
| Verdict                 | `importDryRun.ts:199`                                      | The rules engine, as the morning ingest does                                                                                                                                                                                                                                                                   |
| Write today             | `ImportPanel.vue:186-191`                                  | `useRowWrites(LEDGER_ROWS)` with the dry run's cells                                                                                                                                                                                                                                                           |
| Write checks            | `imports/application/ledgerRows.ts:70-101`                 | Against the fresh read: reference already held, opening balance, no row before the newest                                                                                                                                                                                                                      |
| Review                  | `workbook/domain/needsReview.ts:13-18`                     | A row waits when the AI guessed, the category is undefined, or the reader gave a review reason                                                                                                                                                                                                                 |
| Screen                  | `transactions/presentation/TransactionsScreen.vue:492-494` | Import is a tab of Transactions, one dropped file at a time                                                                                                                                                                                                                                                    |

Under stage 7 the write becomes `store.write(title, (unit) => ...)` with `unit.of(LEDGER_WRITES).add(entry)` per new row (`repository.ts:5-17`, `workbookStore.ts:215`, `ledgerRows.ts:135-147` in the working tree). `LEDGER_WRITES` keeps the same three refusals and adds the verdict check. The dry run's `added` is still `RowCells` (`importDryRun.ts:49, 212-233`), so the import's switch to records is part of stage 7 or of Wave 13. The sync should use whatever the Import tab uses, so there is one write path.

## Design

### Deciding "not yet on the ledger" per file

One `files.list` per folder gives `id`, `name`, `modifiedTime` and `size` for every file, up to 1000 per page (files.list reference, loaded 2026-10-23, https://developers.google.com/drive/api/reference/rest/v3/files/list: "The maximum value is 1000"). Then, per file:

1. Skip names not ending in `.xml`. PDFs stay in the folder for the owner. I would not filter on `mimeType`, since I could not check what type `createFile` gives a Gmail XML attachment. Unconfirmed.
2. If the name matches `^(\d{4}-\d{2}-\d{2}-statement-\d+)-(.+)\.xml$` and the ledger holds a row with that account and that `statement` label, skip it. This is `isFiledByName` (`CamtIngest.gs:421-425`) moved into the app's domain.
3. Download everything else with `files.get?alt=media` (manage-downloads guide, loaded 2026-10-23, https://developers.google.com/drive/api/guides/manage-downloads). Drive has no batch download: "Google Drive doesn't support batch operations for media" (https://developers.google.com/drive/api/guides/performance, loaded 2026-10-23). So it is one request per file.
4. Parse all downloaded files and run one dry run over all of them, as the Import tab does for one.

What still gets downloaded on every sync, and why that is fine:

- A file named by label alone, which the fetch writes for an IBAN the accounts tab lacks (`Code.gs:418-443`). It is refused until the account exists, then filed, then still downloaded each time and found on the ledger by reference. One small file.
- A statement with no entries, which never puts its label on the ledger. The archive has none. Each costs one small download per sync.
- A file whose rows are on the ledger under another label, such as a redelivery with another `CreDtTm`. The fetch keeps one file per account and number (`Code.gs:451-461`), so this should not occur.

Options I weighed and do not recommend:

| Option                                            | What it costs                                                                                                                                     | Why not                                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A seen list of Drive file ids in a settings key   | A settings write on every sync that finds something, a list that grows by about one id per working day                                            | It copies what the ledger already says. A file seen but refused must stay unseen, so the list needs the same rules the ledger gives for free                                                |
| A `modifiedTime` cursor per device or in settings | A stored timestamp, a `modifiedTime > '...'` query (search guide, https://developers.google.com/drive/api/guides/search-files, loaded 2026-10-23) | The full listing is already one request. A cursor saves nothing and misses a file moved into the folder with an old `modifiedTime`                                                          |
| `Stmt/Id` or `MsgId` from the camt                | A download of every file, then a stored id set                                                                                                    | Needs the download the name test avoids. Whether Erste keeps `Stmt/Id` across a redelivery is unknown. Statement identity stays IBAN and `LglSeqNb`, as in the reader                       |
| `md5Checksum` to spot a changed file              | One more listed field                                                                                                                             | Only for binary content per the File reference (https://developers.google.com/drive/api/reference/rest/v3/files, loaded 2026-10-23). A changed statement file is not a case the archive has |

### Finding the folder

The settings key holds a path, the same one the Apps Script will read (plan.md, Wave 13: "its folder read from `settings`"). Its default is `work/company/business-bank-account/erste/statements`. The app resolves it one segment at a time from My Drive's root with `'<parent>' in parents and name = '<segment>' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`. That is five requests. Then one listing of the statements folder for its year folders, and one per year folder. Drive has no recursive search: the search guide says the API "doesn't provide a query operator or parameter to recursively search descendant subfolder trees". Today that is seven or eight small requests per sync, and one more per year.

Two details to settle in the build. Using `'root' in parents` for the first segment is common practice, but I did not find it on a loaded Google page, so it is unconfirmed. The app only reads, so a missing segment is a problem for the owner ("No folder work/company/... in your Drive"). It never creates folders, unlike the Apps Script's `childFolder` (`Code.gs:518-521`).

A per-device cache of the resolved folder id in `localStorage` would save five requests. That is a convenience only, so I would leave it out of the first build.

### What a sync does

```
Sync (click or auto)
  read the Sheet, as now                                  workbookStore.ts:480-485
  if Google mode and a Drive read token is held:
    resolve the folder, list year folders and files
    keep .xml files the name test does not skip
    download them, load, read                             importFiles.ts, camtStatement.ts
    dry run against the workbook just read                importDryRun.ts
    write every statement the dry run accepts, one write  store.write, LEDGER_WRITES
    keep the statements it refused or holds back for the screen
```

Each sync makes one write, which covers every accepted statement. One Undo takes it all out, as an import's Undo does now. The write's own refusal ("on the ledger tab already ... The morning ingest may have filed it", `ledgerRows.ts:76-78`) can happen while `CamtIngest.gs` still runs. On that refusal the sync should run the dry run once more on the fresh read rather than show an error, since the ingest then filed the same rows.

"Accepted" means a statement with no refusal, no pending account start, and at least one new row. The dry run already leaves an account where it was after a refused statement, so later statements of that account are refused for the gap (`importDryRun.ts:78-80`). Writing the accepted ones never writes past a problem.

Excel mode has no sync (`workbookStore.ts:481-483`) and no Google sign-in, so the drop-a-file Import tab stays its only way in.

### What the screen shows

While it runs, the sync status reads in steps: "Reading the Sheet", "Looking for new statements", "Reading 2 statements", "Filing 3 rows". `SyncStatus.vue:42-64` today has only Syncing, Sync and Try again.

On success with rows written, a toast with Undo: "Filed statements 028 and 029, 3 rows. 1 waits on Review." It links to Review when a row waits. With nothing new, no toast. The sync time is the only sign, as today.

On a problem:

- An Overview "Waiting for you" job (`overview/presentation/waitingForYou.ts:18-25`), such as "1 statement was not filed", linking to Transactions, Import.
- The Import tab gets a card "From the statements folder" above the file drop. It shows the dry run of the files that were not filed with the existing `DryRunStatementCard`, and the reason in the reader's words. For a new account it shows the existing "start this account at this opening balance" control and a Confirm button, the same as for a dropped file.
- Statements the sync wrote in that run are listed as filed, so the owner sees where the problem starts.

Problems that stop a statement: an unreadable file, a reader refusal (unknown IBAN, chain or summary mismatch), a balance gap or a date before the newest row, rows between held rows, an entry without a reference, a new account waiting for its start. A folder that cannot be found or read is a sync problem shown the same way.

Notes that do not stop it, such as "statement 30 follows 28, the balances still join", go into the toast. See the open questions.

Uncertain verdicts write as today and land in Review through `needsReview`. Nothing changes there.

### How this sits with Wave 12b's order and ids

- **Order.** Same-day order comes from the balance chain (wave12b plan, "Order from fields"). Every camt row carries its own balance, which the reader works out in booking order with document order within a day (`camtStatement.ts:94-103, 289-295`). So a synced statement chains like every statement before it. Where rows land in the tab stays the spreadsheet adapter's concern.
- **Ids.** Synced rows need no new identity for dedup. Every camt row has a bank reference, and `(account, reference)` is the dedup key in the dry run and in the write rules. The 12b plan's later step 1, a ledger `id` column once the app files the ledger, fits here without changing the sync: the add sets a UUID, as the seven id kinds do. I would not derive a ledger id from the file or from `Stmt/Id`.
- **Labels.** The `statement` column keeps the label. It is both the name test's key and what the owner reads. A statement's label should stay a display string plus that skip key, never an identity (`camtStatement.ts:127-131` already says so).
- **Refused rows.** A ledger row the domain refuses (stage 6) is not in `workbook.transactions`, so its reference is not held and the dry run could offer it again. The write's fresh check would then refuse the import or pass it, depending on whether the refused row counts in `before`. Worth one contract test: a refused ledger row with reference R, and a statement carrying R.
- **Follow-up 3 of the cleanups.** Rows moving between read and write go away once `CamtIngest.gs` retires (plan.md, "Queued fix: follow-ups from the cleanups"). Until then the sync's write meets the same race the Import tab does, and the write rules catch it.

## Open questions for the owner

1. **The Drive read token after a reload.** Planned: page memory only (plan.md, Wave 13). Auto sync never opens a popup (`autoSync.ts:20-27`), and the GIS guide says to call `requestAccessToken()` "from a user-driven event such as a button press" (https://developers.google.com/identity/oauth2/web/guides/use-token-model, loaded 2026-10-23). MDN says a popup's `window.open()` "may" use up the click's transient activation (https://developer.mozilla.org/en-US/docs/Web/Security/User_activation, loaded 2026-10-23). I did not verify Firefox's behaviour for a second popup in one click. So after each reload, the folder is checked only after one more click, and on a phone that click is a redirect to Google and back. Today: you open the app at 9:00, the Sheet syncs by itself, and new statements wait until you press something. The options:
   - **Check on the next click.** Keep the token in memory. Overview shows "Check for new statements" until you press it. Costs nothing new, but there is one extra click per app open.
   - **Keep it like the Sheet token.** Store it in `localStorage` for its hour, as the `drive.file` token is (`googleAuth.ts:91-97, 131-137`). Auto sync then checks the folder within that hour. The cost is that a stolen token can read your whole Drive for up to an hour.
     I lean to the first for now. The Drive-access lane may know more about asking for both scopes in one popup.
2. **A sequence gap whose balances join.** Write it with a note in the toast, or stop and show it? The plan's list of problems does not name it. I would write it, since no money is missing.
3. **A file that will never parse**, such as a stray XML in the folder. With no seen list it is reported on every sync. Plainest: you move or rename it in Drive. A dismissal on the existing `dismissed` tab would also work, but it adds a kind there. I would not add one until it happens.
4. **Path or folder id in the settings key.** A path reads well and matches the Apps Script today. An id survives a rename or move. I would keep the path.

Unconfirmed: the MIME type Drive gives the archived XML files, `'root' in parents` as the first segment's query, and whether Erste keeps `Stmt/Id` on a redelivery.
