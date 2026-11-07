# JSON storage on Drive: proposal

One JSON file per app in a Drive folder the owner picks replaces the Google Sheet. Records by kind with typed text fields, a revision check before and after every save, dated backups, the same document in the browser for a user without Google, the move from an xlsx download of the Sheet, and three build stages over two deploys.

Built on two research lanes: [the Drive side](research/json-storage/lane1-drive.md) and [the format, the migration and the alternatives](research/json-storage/lane2-format.md). Code is cited at the working tree, where deploy 3 of Wave 12b is mid-build on top of 8666d7e, and the design follows stage 7 of [the Wave 12b plan](storage-boundary-plan.md) (repositories, unit of work, `store.write`). This wave runs after Waves 12c, 13, 13b, 14 and the clients fix, so paths those waves rename are estimates. Every value shown is made up. Counts on the owner's data come from `2026-10-23-live9.xlsx`.

## What you asked and what is decided

You asked on 2026-10-22 to leave Sheets for a simple JSON file database on Drive, in a folder you pick. Agreed then, in plan.md under "JSON storage":

- Replace the Sheet, do not support both.
- One JSON file per app. Drive has no transaction across files, so one file keeps a save all or nothing, which is also the hub's rule that one write touches one storage.
- xlsx stays as an export for reading and backup, not as a live storage.
- After Wave 13 (the Apps Script stops writing the ledger) and Wave 12c (everything editable in the app).
- The personal apps of the hub are born on JSON, one file each.

## Findings that shape the design

1. **Drive refuses no stale write.** `files.update` has no `If-Match`, ETag or revision precondition, and Google's v2-to-v3 guide lists the Files `etag` as "n/a" in v3 (lane 1, [files.update](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update), [v2 to v3](https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference)). The app has to check the file's `headRevisionId` itself.
2. **A lost save can only be recovered from a kept revision.** Google: "You can only download blob file content revisions marked as Keep Forever", capped at 200 per file ([revisions](https://developers.google.com/workspace/drive/api/guides/manage-revisions)). Unkept revisions are "typically preserved for 30 days", so the app keeps its own dated backups.
3. **`drive.file` is enough.** The app creates the file in a picked folder, as it already files invoice PDFs (`src/features/invoicing/infrastructure/googleInvoiceDrive.ts:37-62`). Scopes stay `drive.file openid email` (`src/shared/google/googleAuth.ts:31`). No Google Cloud change.
4. **The format is proven on your data.** Your export to JSON and back gives a deep-equal workbook and 76,302 figure lines with 0 differences. The first run failed on one record, the `hr_company_registered` date in settings, so settings need typing by their key.
5. **Size is no concern.** The document is well under 1 MB today, with ledger ids and owner shares, and stays under 1 MB after five years at today's pace. Drive's single-request upload line is 5 MB, decades away. No split by year.
6. **Firefox has no File System Access API** on desktop or Android (MDN compat data, Mozilla's position negative), so there is no local folder. The browser storage stays IndexedDB.
7. **Correction to lane 1.** It counts on "the existing retry in `store.write`". There is none. The write reads once, checks once, applies once and reads back (`writeThrough` in `src/features/workbook/application/createWorkbookStore.ts:262-304`, which stage 7 is writing as I read it). The retry is new in this wave.
8. **Stage 7 already makes the store generic over the copy it holds.** The store now takes a `Copy` type with ports `read`, `localCopy` and `openStorage`, whose storage gives a `readBack` (`createWorkbookStore.ts:71-96`, wired for tabs in `workbookStore.ts:15-30`). Today that copy is tabs of cells, and the cache is one Dexie table per tab keyed by sheet row (`src/features/workbook/infrastructure/workbookCache.ts:21-26` at HEAD). So the JSON storage plugs in a document as the copy instead of reworking the store. These working-tree lines move while deploy 3 is built.
9. **The pack's kind names lack the prefix the 12b plan gave them** (`src/packs/hr-doo/domain/hrDooKinds.ts:9-14`: `asset`, `grant`, `plan-line`). In the file they become stored names. Today they live only in memory, so the rename is free now and costly later. This follows a decision already made, so it is no question.

## How it works today

You confirm a waiting row on Review. `store.write` reads the ledger and categories tabs fresh from the Sheet, finds the row by its key, runs the checks, and sends one `batchUpdate` that writes the row's `category` and `flagged_by` cells. It reads the two tabs back and replaces the tab-shaped copy in IndexedDB. If your phone confirmed another row a second earlier, both land, because each write touches only its own cells. With one JSON file that changes: every save uploads the whole file, so the second upload would replace the first one's file unless the app checks.

## The design

### In plain terms

Your books become one file, `ledgerboard-company.json`, in a Drive folder you pick once. A sync asks Drive whether the file changed and downloads it only if it did. A save works on the records as now, then uploads the whole file. Before the upload the app checks that nobody saved since its read. After it, the app checks that nobody saved in the fraction of a second between. When someone did, it puts their save back and adds its own. The first save of a day also copies the file as it stood into a `backups` folder beside it. Someone without Google keeps the same document in the browser. xlsx stays for opening a workbook and for "Export to Excel".

### The file

```json
{
  "format": "ledgerboard",
  "app": "company",
  "schema": { "core": 1, "hr-doo": 1 },
  "savedAt": "2026-10-23T08:00:00.000Z",
  "records": {
    "ledger-row": [{ "id": "…uuid…", "date": "2026-10-14", "account": "main", "amount": "-95.49", "balance": "1204.10", "category": "software", "flagged_by": "owner" }],
    "setting": [{ "key": "hr_company_registered", "value": "2025-05-12" }],
    "hr-doo.asset": [{ "id": "…uuid…", "asset": "laptop", "bought": "2025-07-01", "cost_net": "1200.00" }]
  }
}
```

- Records by kind, each kind an array. Order in an array means nothing, as 12b made true for tabs.
- Field names are the workbook format's column names, so the README format table describes the file and the xlsx export at once.
- Every value is text except flags, which are JSON booleans. Dates are `yyyy-mm-dd`, money is decimal text written from cents, and text that looks like a number stays as typed (`"00123"`). A blank field is absent. Unknown fields are kept.
- Identity and references are 12b's: a business key, or `id` for the keyless kinds.
- One record per line on disk: about the compact size, readable in Drive's preview, and a revision diff shows one line per changed record.
- `schema` holds a version per contributor, core and each pack. A file saved by a newer version is read and never written: "This file was saved by a newer ledgerboard. Reload to update before you change anything." That stops a phone on cached code from writing an older shape over a newer one.

### Domain

- **Each record type gives its own fields.** Next to each kind's factory, its domain gains `fieldsOf(record)`, returning dates, amounts, flags and text, plus `key(fields)` and `label(fields)` in place of today's `key(cells)` and `label(cells)` (`src/features/workbook/infrastructure/spreadsheetTab.ts:60-71`). 16 kinds, 10 in core and 6 in the pack. Question 4 is the alternative.
- **Settings typed by key.** A setting spec declares whether its value is a date, a number, a flag or text, and `apply` takes the value as text. Today specs take a cell and handle a serial date themselves (`src/packs/hr-doo/domain/companyFacts.ts:98-104`).
- **Rules as records.** Wave 13 retires `Rules.gs`, and 12b leaves the typed rule to it. If Wave 13 has not done it, this wave does, since the rule record is still `{ cells }` (`spreadsheetTab.ts:206-214`).
- **Kind names settled.** `hr-doo.asset`, `hr-doo.year-end-line` and so on, and `client` once the clients fix lands (`client-iban` today, `src/features/workbook/domain/recordKind.ts:36`).
- Reading needs nothing per kind. A JSON text that parses as a date or a number gives `StoredField` its date, money and number (`src/features/workbook/domain/storedFields.ts:10-19`), and the factory picks what it needs. Built that way, the factories made 479 of 479 records identical to the ones made from your Sheet's cells.

### Application

- **The port stays.** `RecordStorage` keeps `read`, `identify`, `preview` and `apply` (`src/features/workbook/application/recordStorage.ts:26-42`). `addMissingKinds` goes from the port and from `store.write`, since a document always has a place for every kind.
- **The held copy becomes the document.** The store's `Copy` becomes the document: the stored fields of every kind plus the file's revision. One set of store ports replaces the tab ports (`workbookStore.ts:15-30`), and `fetchFromGoogle(sheet)` becomes a fetch of the Drive file. Readers of the copy outside the store are few: the export (`src/features/excel/application/workbookFiles.ts:56-61`), the device panel and the export reminder (`DevicePanel.vue:30`, `LocalWorkbookStatus.vue:24`) and seven missing-tab checks that go.
- **Retry on a moved file.** When `apply` finds the file moved since the read, `writeThrough` starts again from a fresh read, at most three times, with the backoff Google's limits page gives. The checks already refuse a record whose `before` no longer matches, so a retry can only land what is still valid.
- **Sources.** `'google' | 'excel'` become `'drive' | 'browser'`. 27 files compare against those words today, 40 comparisons in all, and the missing-tab ones go rather than change.

### Infrastructure

| File                                                                                                                             | What it does                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workbook/infrastructure/documentFormat.ts` (new)                                                                                | Encode and decode the file: text rules, schema versions, the newer-file guard, one record per line                                                                                                                                                         |
| `workbook/infrastructure/documentRecordStorage.ts` (new)                                                                         | The one JSON adapter. `read` decodes and calls the factories. `preview` applies changes to a copy in memory: add appends, change merges the altered fields into the record found by identity, remove drops it. `apply` hands the new document to its home. |
| `workbook/infrastructure/driveDocument.ts` (new)                                                                                 | The document's home on Drive: revision check before, upload, check after, recovery, backups                                                                                                                                                                |
| `workbook/infrastructure/browserDocument.ts` (new)                                                                               | The document's home in IndexedDB                                                                                                                                                                                                                           |
| `shared/google/driveClient.ts`                                                                                                   | Gains download, media upload, multipart create (moved out of `googleInvoiceDrive.ts:37-62`, so there is one upload builder), `revisions.list` and `revisions.update`, and a search by `appProperties`                                                      |
| `workbook/infrastructure/workbookCache.ts`                                                                                       | Rewritten: the document whole, with its revision                                                                                                                                                                                                           |
| `workbook/infrastructure/fake/`                                                                                                  | `fakeSheets.ts` becomes an in-memory Drive file with revisions that a test can race. `fakeWorkbook.ts` (795 lines) builds records instead of a grid.                                                                                                       |
| `spreadsheetTab.ts`, `packTabs.ts`, `hrDooTabs.ts`, `workbookFile.ts`, `workbookSnapshot.ts`, `cellReading.ts`, `cellFormats.ts` | Stay as the xlsx mapping for import and export, with one generic field-to-cell conversion in place of 16 `cells` functions                                                                                                                                 |

**A save on Drive, step by step:**

1. Read: `files.get ?fields=headRevisionId`, then download with `?alt=media` only if the revision differs from the cached one. That revision is the base.
2. Pre-check: `files.get` again. Moved means "changed meanwhile", and `store.write` starts over.
3. Upload: `PATCH .../upload/drive/v3/files/{id}?uploadType=media&keepRevisionForever=true&fields=headRevisionId` with the whole document.
4. Post-check: `revisions.list`. A revision between the base and the new head means another device saved in between. The app downloads that revision, which Keep Forever allows, and runs the write again on it. If its own change still passes the checks, the new upload holds both saves. If it no longer does, the app uploads the other device's revision back and refuses its own change with a message.
5. Read back from memory: the post-check showed the head is this upload, so no download is needed.
6. Housekeeping: once more than 100 revisions are kept, the oldest is unkept, so Drive's cap of 200 is never met.
7. Backup: the first save of a day first copies the base to `backups/ledgerboard-company-YYYY-MM-DD.json`. The app keeps the last 30 dailies and the first of each month.

Three requests a save in the normal case, the same order as the Sheet's fresh read, `batchUpdate` and read back today.

**The folder and the second device.** On the first run "Keep it on Google Drive" opens the folder Picker (`src/shared/google/picker.ts:61-66`). The app creates the file there with `appProperties` naming the app. A second device searches by those `appProperties` and needs no Picker. Whether a phone token finds a file the desktop created that way is unconfirmed, so a Picker view filtered to JSON files is the fallback when the search finds nothing.

### Presentation

- First run and "Switch data source": open an Excel file, start empty, then keep it on Google Drive or in this browser. A browser workbook moves to Drive with the same choice later.
- Settings, This device: the file's name and folder, a link to it in Drive, the last save and the last backup.
- Two new messages: the newer-file notice, and "The file changed outside the app during this save. Check the backups folder." for a revision the app cannot download, such as an edit through Drive for Desktop.
- Nothing else changes on screen. No figure moves.

### What goes away

| What                                                                                                                                                                                                                                     | Files                                        | Lines       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------- |
| Google Sheets adapter: `sheetsClient.ts`, `googleWorkbookWriter.ts`, `googleWorkbookPorts.ts`, `spreadsheetLink.ts`, `readFromGoogle.ts`, `fake/fakeSheets.ts`                                                                           | 6 go                                         | about 700   |
| Grid write planning: `tabRowPlans.ts`, `writePlans.ts`, `ledgerPlacement.ts`, `rowIds.ts`, `workbookWriter.ts`, `localWorkbookWriter.ts`, `spreadsheetRecordStorage.ts`, `tabRowWrites.ts` (only if question 1 goes the recommended way) | 8 go                                         | about 1,250 |
| Add-tab and add-column prompts: `AddTabNotice.vue`, and the branch in 14 files (21 files mention `addMissingKinds` or `missingTabs` today)                                                                                               | 1 goes, 14 lose a branch                     |             |
| The empty template's notes and dropdowns, the cell formats of the Google writer                                                                                                                                                          | in the files above and `workbookTemplate.ts` | about 300   |
| The Sheet links in `BillingPlanPanel.vue` and `DevicePanel.vue`, `sheets.googleapis.com` in the CSP (`index.html:7`), the Sheet wording in `public/privacy.html:149-190`                                                                 | edits                                        |             |
| The Google halves of 17 specs, `readFromGoogle.spec.ts`, the request-shape spec, `rowIds.spec.ts`, `tabRowWrites.spec.ts`                                                                                                                | 4 go, 13 lose a half                         |             |
| Apps Script ledger formatting and tab seeding in `Code.gs` and `Data.gs`                                                                                                                                                                 |                                              | about 340   |
| README "Write-back", "Manual test, against a copy of the Sheet first", "Google configuration" and "Excel mode"                                                                                                                           | rewritten                                    |             |

Rewritten rather than removed: `scripts/round-trip-workbook.mjs` (xlsx to JSON to xlsx to JSON, identical), the fake seed and the `?fake=` variants that only served missing tabs.

## Build stages

Three stages in two deploys. **Proof in every stage:** `npm run check`, `npm run build`, `check:pwa`, the full `check:visual` and `check:touch` on the fake build, and on a fresh export `check:round-trip`, `parity:year-end`, `parity:payroll` (and `parity:rules` while it exists). The figure script prints every figure identical to the commit before the wave, on the export and on the fake workbook.

**Before stage 2: spikes.** A throwaway page on the dev server, kept out of the commit, against a scratch file in a scratch folder, never the books. Needs your hands (below).

1. A media upload with `keepRevisionForever=true`, then a second one, then a download of the first revision.
2. Two tabs uploading within the same second: `revisions.list` shows both at once and in order.
3. What Drive answers for the 201st kept revision.
4. Only if 2 fails: a pre-generated file id used twice from two devices returns `409`, which would give a true compare-and-swap through a claim file.

**Stage 1: each record type gives its own fields.** About 45 files. Deploy A, nothing you see changes.

- `fieldsOf`, `key` and `label` beside the 16 factories. The xlsx and Sheet mappings convert those fields to cells in one generic function.
- Settings specs declare their value type and take text. Rules typed if Wave 13 did not.
- Editors draft in fields instead of cells (`src/features/settings/domain/tabRowDrafts.ts:59-110`, `FactTabEditor.vue`).
- Pack kind names prefixed, `client` named.
- The contract suite's harness moves to record terms: `addOutside`, `changeOutside`, `removeOutside`, `held`, with typed fixtures instead of cells and serial dates (`tests/recordStorageContract.spec.ts:31-41`, `:105-115`).
- Extra proof: the Google request-shape tests pass without changes to what they assert, and the contract suite passes on both grid storages.

**Stage 2: the document on Drive and in the browser.** About 95 files: about 8 new, 45 edited, 20 deleted, the rest tests.

- `documentFormat.ts`, `documentRecordStorage.ts`, both homes, the pre-check and the retry in `writeThrough`, the document as the store's copy, the cache, the sources, the folder flow, the `appProperties` search and its Picker fallback, the newer-file guard.
- The Sheets adapter, the grid planning, the add-tab prompts and their specs go. CSP, privacy page and README follow.
- Extra proof: the contract suite on the JSON storage in both homes. JSON-only checks: a newer schema is read and never written, a moved file writes nothing and retries, the `hr_company_registered` date survives. Your export opened as xlsx, written as JSON and exported again gives the same figure script output and the same parities as the export itself.

**Stage 3: the check after the save, and backups.** About 15 files. Ships with stage 2 as deploy B, since stage 2 alone leaves the silent gap.

- The post-check and its recovery, the unkeep housekeeping, the daily and monthly backups, the outside-edit message.
- Extra proof: on the fake Drive, a race in each order keeps both saves, a conflicting race restores the first and refuses the second with its message, and the 101st kept revision unkeeps the oldest.

**After deploy B, once you have moved:** an "Export to Excel" from the JSON source runs through the figure script and the parities against the last Sheet export, with the same output.

## What needs your hands

For the planning session. No Google Cloud change is needed: the scopes, the OAuth client, the redirect URIs and the Picker key's referrers all stay.

1. **Answer the four questions below** before stage 1.
2. **Run the spike page** (before stage 2): Firefox on the Mac, `npm run dev` at `http://localhost:5173/ledgerboard/` (already an authorised redirect URI), sign in, pick a scratch folder such as `_to-delete/ledgerboard-spike/`, click through the four spikes and copy the printed results into plan.md. Stage the scratch folder in `_to-delete/` afterwards.
3. **Do not edit the Sheet** between the download in step 4 and the move. After Wave 13 nothing else writes its ledger.
4. **Move, on the Mac, after deploy B is green.** Download the Sheet as xlsx (File, Download, Microsoft Excel). Open the app, choose "Open an Excel file", and compare the summary's counts per kind with the ones the build session reports from its fresh export. Choose "Keep it on Google Drive", pick the folder, and wait for "Moved N records". The app reads the file back and compares before it switches.
5. **On the phone:** open the installed app, take the update, sign in, and let it find the file (or pick `ledgerboard-company.json` if it asks). Confirm one row on Review, Undo it, and sync on the Mac to see both.
6. **Archive the Sheet:** rename it to `shadow-accounting (archive)` in Drive. Do not lock it with a content restriction: whether the bound fetch script still runs on a locked file is unconfirmed.
7. **Apps Script push**, after step 5: remove `refreshWorkbook` and the ledger formatting and tab seeding (about 180 lines in `Code.gs`, 160 in `Data.gs`) from `dailyPass`, keep `fetchErsteStatements` and the triggers. `npx @google/clasp push -f` from `scripts/`, run `dailyPass` from the editor, check Executions is green. Then a `work/log.md` entry, the shadow-accounting hub, the product hub and the memory note `shadow-accounting-pipeline.md`.

## Assumed unless you say otherwise

- The file is `ledgerboard-company.json`, so the hub's later apps sit beside it as `ledgerboard-<app>.json`.
- Backups: the first save of a day copies the file as it stood, the last 30 dailies are kept, and the first of each month is kept for good. About 5 MB of dailies today.
- No restore screen. To restore, you open a backup with "Open a file", which takes a ledgerboard JSON as well as an xlsx, and keep it on Drive, which replaces the main file in one save.
- The move is a plain copy. Refused records move as stored and stay refused until fixed. References change only in 12b's "Toward a database" step 2, before or after this wave, never inside the move.
- The export reminder stays for a workbook kept in this browser only. A Drive file has its backups.
- No Web Lock for two tabs on one device. The revision check treats a second tab like a second device.
- Schema versions and the newer-file guard come now. An upgrade step comes with the first format change, not before.

## Questions for you

### 1. Should a workbook kept in this browser become the same JSON document?

Affects the first-run choice "this browser" (today's Excel mode), which someone without Google uses. Today a saved invoice in Excel mode goes through the grid planner: the app works out the invoice's row on the `invoices` tab and which cells differ, and writes them into tabs kept in IndexedDB (`localWorkbookWriter.ts`, `tabRowPlans.ts`).

- **Keep the same document in the browser (recommended).** The browser holds the same file a Drive folder would, and moving it to Drive later is one save. xlsx is only for opening and exporting. Cost: nothing extra. It removes the 8 grid planning files, about 1,250 lines, and the store holds one shape of copy.
- **Keep the grid in the browser.** Nothing changes for a browser user. Cost: the grid planning, the add-tab prompts and the tab-shaped cache stay alive for one storage, and the store holds two shapes of copy, tabs for the browser and a document for Drive.

### 2. How should a save guard against the other device saving at the same moment?

Affects every save, on every screen. Today two devices that confirm different rows a second apart both land, because each writes only its own cells. With one file, the later upload replaces the whole file.

- **Check before and after each save, and keep the app's revisions (recommended).** If the phone and the Mac save within the same second, the second one notices after its upload, puts the first save back and adds its own. You never lose a save without a message. Cost: one more request per save, about 40 lines plus the unkeep housekeeping, up to 100 kept revisions in your Drive storage (about 16 MB today, 75 MB in five years), and spikes 1 to 3 first.
- **Check before each save only.** A save on the other device in the same fraction of a second can vanish with no message. It is unlikely for one person, but silent. Cost: nothing beyond the check before.

### 3. How should your books move from the Sheet to the file?

Affects the move, once. Today the app reads the Sheet through the Sheets API and keeps its tabs.

- **Move from an xlsx download of the Sheet (recommended).** You download the Sheet, open it in the new app, check the summary and pick the folder. The app writes the file, reads it back and compares. It is the same path a new user takes and the exact path proven on live9, and the Sheets code leaves in the same deploy. Cost: no screen of its own. You must not edit the Sheet between the download and the move.
- **Move with a button that reads the live Sheet.** "Move to a Drive file" on Settings, This device reads the Sheet fresh, writes the file and compares. One click, no download. Cost: the Sheets adapter and the grid code stay one deploy longer, a dialog of about 4 files is built and then deleted, and the read goes through the Sheets API rather than the xlsx path the proof covered.

### 4. Should each record type give its own typed fields, or should the file be made from today's cells?

Affects nothing on screen, only how every record type is stored. Today an invoice is saved as cells: its tab mapping turns its dates into serial numbers (`spreadsheetTab.ts:60-71`, `dayCell` at `:102-104`). A JSON file has no serial numbers.

- **Each record type gives its own fields (recommended).** The domain of each kind says which field is a date, an amount, a flag or text. The JSON storage is one generic file, xlsx becomes a plain mapping of tab name, column order and formats, and a later database storage needs no code per kind. This is the database-like option you chose in 12b. Cost: about 20 files plus their specs, in stage 1.
- **Keep the cells and add a table of field types.** The file on disk is the same. Cost: about 10 files fewer, but serial dates and cell types stay in the save path of a storage without cells, and the year-end amount, which is a date, a rate or an amount depending on its line (`src/packs/hr-doo/infrastructure/hrDooTabs.ts:253-274`), needs a rule of its own in the table.

## Risks and what stays out

**Risks**

- The check after the save relies on `revisions.list` showing a racing revision at once and in order. Google does not promise it, and spike 2 decides. If it fails, spike 4's claim file is the fallback.
- If the folder sits inside your Drive for Desktop mirror, an edit on the Mac uploads a revision without Keep Forever. The app sees it but cannot download it, so it can only say so.
- Each save uploads the whole file: about 160 KB today, 760 KB in five years. My estimate is about a second on a phone on a decent connection, not measured.
- The phone signs in with the implicit flow, which Google calls insecure for single-page apps. That is the same as today.
- The fetch script names statement files by account through the Sheet's `accounts` tab (`Code.gs:371-373`, `Data.gs:188`). On the archive that list goes stale when you add an account in the app, and that account's statements are filed under their label alone. Wave 13 decides where the app reads the account from.
- Waves 13, 13b and the clients fix change record kinds before this wave, so the file counts are estimates.

**What stays out**

- SQLite on Drive: still one whole-file upload, plus a WASM worker and a file you cannot read, for queries the app does not run.
- A small backend: refresh tokens and real transactions, at the cost of hosting bank data on a server for one user. The port and the contract suite keep that door open.
- Drive's app-data folder: hidden from you, and deleted when you remove the app.
- A split of the ledger by year, a restore screen, Web Locks, the Sheet as a live storage, and the hub's second storage, which comes with its own wave.

## The owner's decisions, 2026-10-23

1. A workbook kept in this browser becomes the same JSON document as the Drive file. The browser grid goes.
2. Each save checks the file before and after, and the app keeps its own Drive revisions. The Drive spikes come first.
3. The move goes through an xlsx download of the Sheet.
4. Each record type declares its own typed fields.
5. Ledger rows get their id during the move (decided with Wave 13).

## Changes queue while a save runs

Each store runs one job of its file at a time, in tap order: a write, a sync's read, a move or a drop. A second change never gets refused because a save runs. It waits its turn, and a sync waits behind the saves ahead of it and reads what they left. A move and a drop are refused while anything is queued, and choosing another file does nothing then, since the Picker needs the tap.

`state.snapshot` is what the file holds, which the cache keeps and an export writes. `state.records` and `state.workbook` are what is on screen: the snapshot with the queued changes marked `shownAtOnce` made on top of it. So a later tap reads an earlier queued change and its `before` is what the file will hold by its turn. A one-tap control asks for `shownAtOnce`, and a dialog or a form's Save does not, so its record changes when it lands.

Every check still runs at the write's turn on a fresh read. A write shown at once also runs them at the tap, on what the screen shows, so the screen never shows what the rules refuse. A failed write leaves the queue and its control flips back. The writes behind it go on, and one that was made on top of it is refused alone and says so.

A control reads `writes.saving(key)` from `state.waiting`, so it spins from the tap until the write lands, even on a screen left and reopened. Closing the tab while a save waits brings up the browser's own warning where the browser has one. Nothing is kept across a close, and a phone may lose a waiting save with no warning. [The plan](saves-plan.md) has the reasoning.
