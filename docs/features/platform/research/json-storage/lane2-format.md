# JSON storage, lane 2: format, size, migration, alternatives

One JSON document per app with records by kind in the workbook format's field names, every value as text and flags as booleans. Measured on the owner's export, the document is well under 1 MB and stays under 1 MB after five years, so no split by year. A scratch round trip through the format leaves the whole workbook and every figure line identical. What goes away with the Sheet, counted, and SQLite, a backend and appDataFolder weighed against the code.

Read-only research. The code is the working tree on top of 8666d7e, where deploy 3 is mid-build: typed reads with refused rows and the pack owning its records are in, and stage 7's write path (`Repository`, `UnitOfWork`, `WriteRules`, `RecordStorage`, `store.write`) is partly in. I designed against stage 7 as [the Wave 12b plan](../../storage-boundary-plan.md) describes it. Counts on the owner's data come from `2026-10-23-live9.xlsx` through the scratch scripts listed at the end, which print counts and shapes only.

## Findings first

1. **The format fits the 12b port with almost no new per-kind code.** The domain factories already take `StoredFields` (`src/features/workbook/domain/storedFields.ts:10-19`), a field's text plus what it holds as a date, an amount, a number or a flag. A JSON value of text gives all of that. Built from the JSON text alone, the factories made 479 of 479 records identical to the ones they make from the Sheet's cells, across every kind except settings and rules.
2. **The round trip is lossless on the owner's data, with one typed setting.** Sheet export to JSON and back: the whole `Workbook` is deep-equal, and the figure script (deploy3b's `figures.mjs`) prints 76,302 lines with 0 differences. The first run failed on exactly one record. `hr_company_registered` is a date cell in the `settings` tab, so a migration that writes a settings number as plain digits turns it into a non-date. The migration has to type settings values by their key spec.
3. **Size is not a problem.** The document is well under 1 MB today, with an id and an owner share on every ledger row, and five years at three times today's pace stay under 2 MB. Parsing takes about 1 ms on a desktop. Drive's 5 MB line for single-request uploads is decades away at today's pace. **A ledger split by year is not needed**, and it would break the "one write, one file" rule that makes a write all or nothing.
4. **Two kinds are still cell-shaped.** The settings record is `{ key, value: cell }` and the rule record is `{ cells }` (`src/features/workbook/infrastructure/spreadsheetTab.ts:203,212`). Rules mirror `Rules.gs` until Wave 13 retires it. Both need typed records before a storage without cells can hold them. So do the editors, whose drafts still build cells with serial dates (`src/features/settings/domain/tabRowDrafts.ts:59-110`, used by `FactTabEditor.vue:55,105`).
5. **The contract suite is written in spreadsheet terms.** Its harness plays outside edits as `insertAbove(tab, cells)`, `setCell(tab, …, column, value)` and `deleteRow(tab, …)`, and its fixtures are cells with serial dates (`tests/recordStorageContract.spec.ts:31-41,105-115`). It needs to move to record terms before a JSON storage can run it.
6. **The pack's kind names are not prefixed**, though the plan said they would be (`src/packs/hr-doo/domain/hrDooKinds.ts:9-14`: `asset`, `grant`, `plan-line` and so on). In the JSON file kind names become stored names, so this is the last cheap moment to settle them. Today a `RecordId` holds the kind name only in memory, and the `id` column stores the bare UUID (`recordId.ts:10-21`), so a rename now costs nothing on disk.
7. **With the Sheet gone, about 6 Google grid files (about 700 lines) go entirely.** If the browser alternative also keeps the JSON document instead of a grid, 8 more files of grid write planning (about 1,250 lines) go too. So do the add-tab prompts in 10 UI files, the Google halves of 17 test files and about 340 lines of Apps Script that format the ledger and seed tabs.
8. **None of the alternatives beats one JSON file per app.** SQLite on Drive still syncs as one whole binary file, so it has the same write boundary as JSON plus a WASM worker and an unreadable file. A backend would bring refresh tokens and real transactions, at the cost of hosting financial data on a server for one user. appDataFolder hides the file from the owner and Google deletes it when the owner removes the app.

## 1. The file format

### Shape

One document per app, named after the app, such as `ledgerboard-company.json`, in the folder the owner picks.

```json
{
  "format": "ledgerboard",
  "app": "company",
  "schema": { "core": 1, "hr-doo": 1 },
  "savedAt": "2026-10-23T08:00:00.000Z",
  "records": {
    "ledger-row": [{ "id": "…uuid…", "date": "2026-10-14", "account": "main", "amount": "-95.49", "balance": "1204.10", "category": "ai-services", "flagged_by": "owner", "reference": "00123" }],
    "category": [{ "category": "ai-services", "family": "operating", "bucket": "operating", "colour": "#dce9f9" }],
    "setting": [{ "key": "hr_company_registered", "value": "2025-05-12" }],
    "hr-doo.asset": [{ "id": "…uuid…", "asset": "laptop", "bought": "2025-07-01", "cost_net": "1200", "group": "computers" }]
  }
}
```

The values are made up. The rules of the shape:

- **Records by kind**, keyed by the kind's `name`. Each kind is an array of objects. Order in the array means nothing, as 12b already made true for tabs. New records go at the end.
- **Field names are the workbook format's column names**, such as `flagged_by` and `period_from`. The factories read fields by these names, the xlsx export keeps them, and the README's format table describes both storages at once. A blank field is absent, as a blank cell is absent from `StoredFields` today.
- **Every value is a JSON string, except a flag, which is a JSON boolean.** Dates are `yyyy-mm-dd`. Money is decimal text with a dot and no thousands separator, written by the app from cents with two decimals (`"-95.49"`). Rates stay fractions as the Sheet holds them (`"0.25"`). Text that looks like a number stays exactly as typed (`"00123"`). On the owner's export no value needed an exponent, and a few billing amounts carry more than two decimals, kept as stored by the migration. Reading rounds them to the cent, as it does today (`src/shared/money/money.ts:16-21`).
- **Identity is the 12b identity.** A kind with a business key is found by it (a category's slug, an invoice's client and number). The seven keyless kinds, and the ledger once Wave 13 gives it one (12b "Toward a database", step 1), carry `id`. No kind gets a second identity just for JSON.
- **References by key or id**, as the fields already hold them: a ledger row's `category` names a category's key, an asset's `funded_by` a grant's. When 12b's step 2 lands (a split part and an asset naming the ledger row's `id`), the JSON holds that too. I would keep the migration a pure copy and not change references in it, so the proof stays "same fields in, same workbook out".
- **Unknown fields are kept.** A change writes only the fields it alters (`recordStorage.ts:37-41`), so a field the app does not know survives, as an unknown column does today.

**Why text and not JSON numbers.** A JSON number parses to a binary float, and `JSON.stringify` writes `1e21` and loses the difference between `"00123"` and `123`. With text, "the storage holds what was typed" is a string comparison, which the stale-write check (`recordWrites.ts`, "refuses one that differs from what the app read") relies on. One factory today reads a setting as a serial number or as text (`src/packs/hr-doo/domain/companyFacts.ts:103`). On JSON only the text branch is left, which is simpler.

**Layout on disk.** Pretty-printed with two spaces the file is 39% bigger raw and the same gzipped (198.8 against 142.8 KB raw, 23.8 against 23.1 KB gzip). Uploads are not compressed (see the size section), so raw counts. I suggest one record per line: about the compact size, readable in Drive's preview, and a revision diff shows one line per changed record. A columnar layout (field list plus arrays) is 28% smaller raw and the same gzipped (102.9 KB raw, 22.3 KB gzip). That saving is not worth losing self-describing records.

### Schema version and the pack

`schema` holds one version per contributor: `core` and each pack. Each contributor registers an ordered list of upgrades (1 to 2, 2 to 3) that work on the parsed document. Core imports nothing from the pack (`tests/importBoundaries.spec.ts`), so one shared integer would force core's upgrade list to know the pack's changes. Per contributor, the pack's kinds evolve with the pack.

- An older document is upgraded in memory on read and written at the app's version on the next write.
- **A newer document is read and never written.** The installed app on the phone runs cached code until its service worker updates, so an old phone could otherwise write an old shape over a new one. The app says "This file was saved by a newer ledgerboard. Reload to update before you change anything."
- Kind names are stored names from here on. I recommend prefixing the pack's kinds now (`hr-doo.asset`, `hr-doo.year-end-line`), as the 12b plan intended, and naming the clients kind `client` once the clients fix lands (today `client-iban`, `recordKind.ts:36`).

### How it fits `RecordStorage` and the contract suite

The port (`src/features/workbook/application/recordStorage.ts:26-42`) has `read`, `identify`, `preview` and `apply`, and every method fits a document:

| Port method              | JSON adapter                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read(kinds)`            | Parse the document, upgrade it, and for each kind turn each object into `StoredFields` and call the kind's factory, which gives `RecordsRead` with records and refused ones, as `recordsOfRows` does for a tab (`spreadsheetTab.ts:328-345`) |
| `identify(kind, record)` | The kind's key or id, the same `RecordId` as today                                                                                                                                                                                           |
| `preview(changes)`       | Apply the changes to a copy of the parsed document: add appends, change merges the altered fields into the object found by identity, remove drops it. Read the copy back through the factories.                                              |
| `apply(changes)`         | Write the whole document in one upload, with the revision check the concurrency lane settles. One write is one file, so it is all or nothing, as one `batchUpdate` is today.                                                                 |

`addMissingKinds` stops meaning anything, because a document always has a place for every kind (an empty array).

What each kind must provide is the open design point. Today `SpreadsheetTab<R>` holds four things per kind: the factory call, `key(cells)`, `label(cells)` and `cells(record)` (`spreadsheetTab.ts:60-71`). Three of the four take cells. Two ways to give a JSON adapter the same:

- **Move the record's codec into the domain (recommended, the table-like option).** Each kind's domain gives `key(fields)`, `label(fields)` and `fieldsOf(record)` next to its factory, with `fieldsOf` returning typed values (a `CivilDate`, a `Money`, a flag, text). The JSON adapter is then one generic file with no per-kind code. The xlsx mapping keeps only the tab name, column order and number formats. The pack registers nothing new: its kinds already come through `PackPart`, and their codecs travel with them. Cost: the 16 mappings' `key`, `label` and `cells` move into their domain files and switch from cells to fields, about 20 files plus their specs.
- **Reuse `cells(record)` and add a field-type table.** The JSON adapter converts the spreadsheet mapping's cells, using a table of which field is a date, an amount or a flag. `cellFormats.ts` and the pack's `numberFormat` hold most of that table. It is cheaper by perhaps 10 files, but it keeps serial dates and cell types in the write path of a storage that has no cells. The year-end `amount`, which is a date, a rate or an amount depending on its line (`hrDooTabs.ts:253-274`), needs its own rule in the table too.

The contract suite needs the same move. `StorageUnderTest` becomes record-shaped: `addOutside(kind, fields)`, `changeOutside(kind, id, field, text)`, `removeOutside(kind, id)` and `held()`, with fixtures as typed fields instead of cells. "Added above it from outside" becomes "written by another device in between", which for a document is a new object at the start of the kind's array. The Google request-shape tests stay with the xlsx or go with the Sheet (section 4). JSON-only checks join the suite's JSON storage: a newer schema is read and never written, an older one is upgraded, and a stale revision writes nothing.

### Before the JSON adapter can hold every kind

- Settings and rules records become typed (finding 4). Rules can only follow once Wave 13 retires `Rules.gs`, which the queue puts before this wave.
- The editors draft in fields instead of cells.
- Every write goes through `store.write`. Today the old store methods are still called from 7 files (`useSettingsSave.ts`, `ImportPanel.vue`, `useLedgerWrites.ts`, `useRulesChange.ts`, `useInvoiceRun.ts`, `workbookStore.ts`, `useRowWrites.ts`), which stage 7 is moving.

## 2. Size

Measured by `jsondoc.mjs` and `project.mjs` on the export, each kind as compact JSON. A ledger row is about 300 bytes, a rule or an asset a little less, and a setting about 56 bytes. The whole document is well under 1 MB raw and a fraction of that gzipped, about the size of the xlsx export of the same data.

**Growth.** The ledger grows by a few hundred rows a year, and the other kinds grow per year by a handful of records each. An id and an owner share on every ledger row add about a tenth. Five years at three times today's pace stay under 2 MB, and parsing stays under a few milliseconds on a desktop. The projection repeats real records with fresh UUIDs, so its gzip figure is pessimistic (random ids do not compress). Parse times are from Node 24 on an M4 Max. A phone is slower, by an amount I did not measure.

**The limits that matter.**

- Drive's guide says simple and multipart uploads are for files of "5 MB or less", with resumable upload recommended above that ([Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads), loaded 2026-10-23). `files.update` takes up to 5,120 GB ([files.update](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update)). So 5 MB means switching to the resumable protocol, not a wall.
- Each write uploads the whole file. Drive's performance guide documents gzip for responses only, with an `Accept-Encoding` header and `gzip` in the user agent. It says nothing about compressed uploads or about `alt=media` downloads ([Improve performance](https://developers.google.com/workspace/drive/api/guides/performance)). So I count raw bytes for uploads. Whether downloads come back compressed is unconfirmed.
- At five years, a confirm on Review uploads under 1 MB. On a phone that is around a second on a decent connection. That is my estimate, not a measurement.

**A split by year: not needed.** At today's pace the file reaches 5 MB only after decades, and well over a decade even at three times the pace. Splitting would also give up what the one-file design buys. Undo, a split of an old ledger row, a year-end closing that reads the ledger and an asset claiming an old payment can each touch two years. Across two files that is two writes that cannot be all or nothing. I would revisit only if a single write's upload became slow on the phone. The first remedy then is fewer uploads (batching confirms on Review), not more files.

## 3. The migration from the owner's Sheet

### The flow in the app

Offered only while the source is a Google Sheet, on Settings, This device: "Move to a Drive file".

1. **Fresh read of the Sheet** through today's sync. The dialog lists what moves: counts per kind, and every refused record by its label. Refused records move too, as their stored fields, and stay refused in the file until fixed. Nothing is lost, and nothing is silently repaired.
2. **The owner picks the folder** in the Picker, then the app creates the file there (`files.create`, multipart). Permissions and the folder flow are the permissions lane's.
3. **The encoder** turns each record into the JSON shape. Records the factory made are written through the kind's codec. A refused record's fields are written by the column's type, a date column as `yyyy-mm-dd` and any other number as its text. Settings values are typed by their key spec, which is the one gap the scratch run found.
4. **The proof in the app.** The app reads the new file back through the JSON adapter and compares the whole `Workbook` with the one it read from the Sheet, deep-equal, the same check `jsondoc.mjs` makes. Only if they match does it switch the source to the file and say "Moved 577 records. The Sheet is kept as an archive." If they differ, the source stays the Sheet, the new file is left for inspection, and the dialog names the kinds that differ.
5. **The Sheet becomes a read-only archive.** The app never writes it again. The app can lock it with Drive's content restriction: `files.update` with `contentRestrictions.readOnly: true` and a `reason`. Drive says that blocks "Modifying the title", "Making content edits", "Uploading a revision" and "Adding or modifying comments", that Google Sheets can carry it, and that a user with writer access can remove it ([Protect file content](https://developers.google.com/drive/api/guides/file-locking), loaded 2026-10-23). Whether `drive.file` may set it on a picked Sheet, and whether a bound Apps Script keeps running on a locked Sheet, are both unconfirmed. Without the lock, renaming the Sheet to say it is an archive is enough.

### The proof before the build ships

All of these were run once in scratch on the export against the deploy 3 working tree, and run again on a fresh export when the wave is built:

| Check                                                                                     | Result on the export                                                                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Export to JSON and back, every section of the workbook (`transactions` to `companyFacts`) | 18 of 18 sections the same, 0 problems before and after                                                               |
| The whole `Workbook` deep-equal                                                           | true                                                                                                                  |
| `figures.mjs` (deploy3b) on the export and on an xlsx written from the decoded JSON       | every line, 0 differences                                                                                             |
| Records made by the factories from the JSON text, not from cells                          | all identical, 0 refused                                                                                              |
| Without typing `hr_company_registered` as a date                                          | 1 problem, `companyFacts` and the forecast and dividend figures differ. That is the failure the encoder must prevent. |

In the wave itself, the proof is: the contract suite passes on the JSON storage, and the figure script and the parity scripts (`parity:year-end`, `parity:payroll`, and `parity:rules` if it still exists after Wave 13) give the same output on the export and on the JSON made from it. Then, after the owner moves, a fresh xlsx export from the JSON source runs through the same scripts against the last Sheet export.

### What the Apps Script needs

After Wave 13 the script keeps the fetch and the ledger formatting (plan, Wave 13). With JSON the formatting goes (section 4), but the fetch still reads the Sheet. `fetchErsteStatements` names camt files by account through `accountNameByIban(SpreadsheetApp.getActiveSpreadsheet())` (`Code.gs:368-390`, `Data.gs:188`). On an archived Sheet that list goes stale when the owner adds an account in the app. The options are reading the accounts from the JSON file with `DriveApp`, or filing by IBAN alone and letting the app map IBAN to account, which Wave 13's parsing already does from the statement itself. This is the Wave 13 owner's call, and I have not checked it beyond those call sites.

## 4. What goes away with the Sheet

Counted in the deploy 3 working tree. "Goes" assumes the browser alternative keeps the same JSON document in IndexedDB instead of a grid, which I recommend: one adapter with two places to keep the bytes (a Drive file or this browser), and xlsx only for import and export. Excel mode's grid would otherwise keep the whole row-planning layer alive for one storage.

| What                                             | Files                                                                                                                                                                                                                                                                                                                                                                                                                           | Lines                                 | Notes                                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Sheets adapter                            | `sheetsClient.ts`, `googleWorkbookWriter.ts`, `googleWorkbookPorts.ts`, `spreadsheetLink.ts`, `application/readFromGoogle.ts`, `fake/fakeSheets.ts`                                                                                                                                                                                                                                                                             | 697                                   | 6 files go. The Sheet links in `BillingPlanPanel.vue` and `DevicePanel.vue` go too. The `sheets.googleapis.com` entry leaves the CSP (`README.md` "Content Security Policy"). |
| Grid write planning shared by both grid storages | `tabRowPlans.ts`, `writePlans.ts`, `ledgerPlacement.ts`, `rowIds.ts`, `workbookWriter.ts`, `localWorkbookWriter.ts`, `spreadsheetRecordStorage.ts`, `application/tabRowWrites.ts`                                                                                                                                                                                                                                               | 1,255                                 | 8 files go. Row finding, placement, cell diffs and the ledger's newest-first insert. Some, such as `tabRowWrites.ts` and the "Add ids" planner, deploy 3 removes already.     |
| Template notes and dropdowns                     | `workbookTemplate.ts` (298), notes in `settings.ts` and the pack's `TemplateColumn` notes in `hrDooTabs.ts`, the dropdown `copyPaste` in `googleWorkbookWriter.ts`                                                                                                                                                                                                                                                              | about 300                             | The empty template download goes, since a new user starts empty in the app. Column lists stay for the xlsx export header. Notes on export are optional and could go.          |
| Add-tab and add-column prompts                   | `AddTabNotice.vue`, `addMissingKinds` through `recordStorage.ts`, `recordWrites.ts`, `useRecordWrites.ts`, `workbookStore.ts`, and 10 UI files: `ReviewScreen.vue`, `SplitDialog.vue`, the four plan dialogs, `usePlanWrites.ts`, `PayPanel.vue`, `ScenarioEditor.vue`, `StartingScenariosDialog.vue`                                                                                                                           | 1 file goes, 14 lose a branch         | A document always has every kind. The "names the columns to add" refusal for an older `plan` tab goes too. `MissingIdsDialog.vue` is already leaving in deploy 3.             |
| Cell formats                                     | `repeatCell` formats and the text format `@` in the Google writer                                                                                                                                                                                                                                                                                                                                                               | in the writer above                   | `cellFormats.ts` (28 lines) stays for the xlsx export, so Excel shows dates as dates.                                                                                         |
| Round trip                                       | `scripts/round-trip-workbook.mjs`                                                                                                                                                                                                                                                                                                                                                                                               | rewritten                             | It becomes JSON to xlsx to JSON identical, plus xlsx import to JSON for a new user's own workbook.                                                                            |
| Tests                                            | Google halves of 17 specs that use `googleHarness` or `createFakeSheets`, `readFromGoogle.spec.ts`, `recordWriteRequests.spec.ts` (the request-shape tests), `rowIds.spec.ts`, `tabRowWrites.spec.ts`                                                                                                                                                                                                                           | 4 files go, 13 lose their Google half | The 13 specs on `excelHarness` move to a JSON harness.                                                                                                                        |
| Fake mode                                        | `fake/fakeWorkbook.ts` (795 lines) builds a grid, `seedFakeWorkbook.ts`                                                                                                                                                                                                                                                                                                                                                         | rewritten                             | The fake seed becomes a JSON document. The visual and touch flows "in both modes" become Drive file and this browser.                                                         |
| Apps Script ledger formatting and tab seeding    | `refreshWorkbook`, `requireLedgerTabShape`, `formatLedgerTab`, `formatLedgerDataRows`, `requireLedgerFilter`, `setLedgerSignalColumnsToText`, `categoryColourRules`, `ensureRows`, `ensureColumns`, `trimColumns` and helpers (about 180 lines in `Code.gs`), `seedHumanTabs`, `seedCategoriesTab`, `seedAccountsTab`, `inferAccountIbans`, `appendUnknownAccounts`, `writeHumanTab` and helpers (about 160 lines in `Data.gs`) | about 340                             | `dailyPass` keeps the fetch and the triggers.                                                                                                                                 |
| README                                           | "Write-back" (about 220 lines), "Manual test, against a copy of the Sheet first", "The workbook format" intro, "Google configuration", "Excel mode"                                                                                                                                                                                                                                                                             | rewritten                             | The format table stays and describes the JSON fields.                                                                                                                         |

What stays: `spreadsheetTab.ts`, `packTabs.ts` and `hrDooTabs.ts` as the xlsx mapping, `workbookFile.ts`, `cellReading.ts` and `workbookSnapshot.ts` for xlsx import, and the export reminder.

## 5. The alternatives once more

### SQLite on Drive (wa-sqlite or SQLite's own WASM build, kept in OPFS)

**Firefox support, from primary sources.** OPFS's synchronous handle, `createSyncAccessHandle`, is in Firefox 111 and Firefox for Android 111 (MDN browser-compat-data, `api/FileSystemFileHandle.json`, loaded 2026-10-23). MDN says it "is only available in Dedicated Web Workers" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)). SQLite's persistence guide lists Firefox 111 and later. It says the `opfs` VFS needs `SharedArrayBuffer` and so the COOP and COEP headers, which GitHub Pages cannot send (`README.md`, "Content Security Policy"). The `opfs-sahpool` VFS "Does not require COOP/COEP HTTP headers" but does not support several connections at once, so two tabs fight over one database ([sqlite.org persistence](https://sqlite.org/wasm/doc/trunk/persistence.md)). wa-sqlite's VFS table lists all its example VFSes as free of COOP and COEP needs. `AccessHandlePoolVFS` is single-connection, and `OPFSCoopSyncVFS` handles several connections with a "retry hack" ([wa-sqlite examples](https://github.com/rhashimoto/wa-sqlite/blob/master/src/examples/README.md)). The page does not mention Firefox.

**Against the code.** OPFS is local to one browser. Getting the data from the phone to the desktop still means uploading the whole database file to Drive after each write and downloading it on sync. So the write boundary, the revision check and the conflict story are the same as with JSON. On top of that come a WASM module and a worker, a binary file the owner cannot read in Drive, and revisions nobody can diff. What SQL would buy, queries and indexes, the app does not use: the domain computes every figure from the whole workbook in memory (`readWorkbook`, `presentedWorkbook`), and repositories have no query methods by design (12b plan, "Repositories and the unit of work"). Not recommended.

### A small backend

Google's comparison says the token model issues no refresh token, needs no backend, and needs a user gesture for a new token. The code model issues a refresh token, needs a backend "for endpoint hosting and storage", and works offline ([Choose an authorization model](https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model), loaded 2026-10-23). A backend would therefore give sync without a click, server-side transactions and real concurrency, and it would end the whole-file upload. It would also put bank data and refresh tokens on a server the owner runs for one user. It would add hosting, backups, patching and the privacy page's promises to a project whose README opens with "There is no backend", and it would take the app off GitHub Pages alone. The `RecordStorage` port and the contract suite keep this door open at no cost. Not now.

### Drive's appDataFolder

It needs only `drive.appdata`, a non-sensitive scope, and needs no Picker or folder. But its contents "are hidden from the user and from other Google Drive apps" and "can't be accessed using the Drive user interface". It "is deleted when a user uninstalls your app from their My Drive". Files there cannot be shared, moved to another space or trashed ([Store application-specific data](https://developers.google.com/workspace/drive/api/guides/appdata), loaded 2026-10-23). For company books, a file the owner cannot see, download or keep after removing the app is the wrong home. It also blocks the hub's "personal apps read company facts live" if those ever run as separate OAuth clients. That last point is my inference. Not recommended as the store. It could hold a second copy, but the folder already has Drive's revisions (the history lane).

### xlsx only as an export

Yes, as the plan says. Keep "Export to Excel" and the export reminder, and keep xlsx import, which a new user needs for an existing workbook and which serves as the owner's offline restore. Drop the empty template download and its notes. The round-trip check moves to JSON to xlsx to JSON.

## Open questions

1. **Codec in the domain, or a field-type table?** I recommend the domain codec (key, label and typed fields per kind) as the database-like option, at about 20 files. The table is cheaper but keeps cells in a storage without cells.
2. **Prefix the pack's kind names now?** `hr-doo.asset` and so on, before the file freezes them. It costs nothing on disk today.
3. **The browser alternative keeps JSON too?** That is what removes the 8 grid planning files. Otherwise Excel mode keeps them alive alone.
4. **Lock the archived Sheet?** It depends on whether `drive.file` allows `contentRestrictions` on a picked file and whether the bound fetch script keeps running on a locked file. Both are unconfirmed.
5. **Where the fetch script gets account names** once the Sheet is an archive (section 3). This is a Wave 13 call.
6. **References by ledger id in the migration, or after?** I recommend after, so the migration stays a pure copy with the simplest proof.

## Scratch scripts

In the research session's scratch folder, run from the repo with `node --import ./scripts/support/typescriptResolve.mjs <script> <export.xlsx>`:

- `stats.mjs`: field shapes per tab (date, number, flag, text, numeric text), counts only.
- `jsondoc.mjs`: builds the document, prints sizes per kind, compact, pretty and columnar, ledger rows per month, then decodes it back and compares every workbook section, the whole workbook, and the records made straight from JSON text. It writes `live9.json` and `live9-from-json.xlsx` beside itself, and both hold real data. Run it with `DATE_SETTINGS=hr_company_registered` for the passing run.
- `project.mjs`: the five-year projection with timings.
- The figure diff used deploy3b's `figures.mjs` on the export and on `live9-from-json.xlsx`. Outputs are `fig-xlsx.txt` and `fig-json.txt`, and they hold real figures.
