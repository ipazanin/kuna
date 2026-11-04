# Wave 12b plan: storage boundary

Plan for the owner's review, revised to the owner's answers: a repository per record type with a unit of work, typed records, record identity by key or id, order from fields, ids on seven tabs, the pack owning its records, in eight stages.

Checked against the code at 7128551 and your export. The long tables are in the lane files: [storage touch points](research/storage-boundary/lane1-storage-inventory.md), [pack seams](research/storage-boundary/lane2-pack-seams.md), [sources](research/storage-boundary/lane3-sources.md) and [order and ids](research/storage-boundary/lane4-order-and-ids.md). Every count on the export comes from a scratch script that prints counts only, listed in lane 4.

## The owner's decisions, 2026-10-22

1. Writes go through a repository per record type, with a unit of work that turns their changes into one atomic batchUpdate.
2. One TypeScript type per record kind. A row the domain refuses still reaches the editors, as raw text with a reason.
3. Records are named by their label. No row numbers in toasts, refusals or problem lists, and no Sheet row link.
4. Storage order is not a business fact. Order comes from existing fields, and later from ids.
5. Split parts, plan lines, year-end lines, owner advances, billing plan items, dismissals and assets get an `id` column now. A row without one is refused. Your live Sheet gets ids when you accept an app prompt, never from an agent.
6. The pack's records move into the pack, which registers its kinds, repositories and Workbook part with core through the pack seam.
7. The pack owns its write rules and editor column sets.
8. The pack owns its `hr_` settings keys and `CompanyFacts`, through a seam in the settings parser.
9. The asset claim on splits holds whatever the owner-pay switch says.
10. Pack jobs follow core jobs on Overview.
11. Owner advances move into the pack too.
12. The eight stages ship as three deploys: stages 1 to 3, then 4 and 5 once your Sheet has ids, then 6 to 8.

Unchanged: the boundary check is a Vitest spec with no new dependency, the Google modules move to `src/shared/google/`, and the contract suite runs against the Google fake and the browser workbook.

## Toward a database

Your direction: move storage step by step toward a database-like structure. Tabs become tables: every record has an explicit identity, order comes from fields, references between tabs go by key or id, and a database adapter could slot in later without touching features.

**This wave does:**

- Every record kind gets an identity: a business key for nine kinds, an `id` column for seven.
- Order comes from fields. No figure depends on where a row sits.
- Features write through repositories and a unit of work. Only the spreadsheet adapter knows tabs, columns, cells and rows.
- The pack registers its own kinds, so a new storage maps them without core changes.
- One contract suite says what any storage must do.

**Later, in order:**

1. **A ledger id, once the app files the ledger itself (Wave 13).** Most ledger rows have no bank reference, so today their identity is account, date, amount, balance and description (lane 4). Cost: one id column and the same prompt as this wave, small once `CamtIngest.gs` no longer inserts rows.
2. **References by key or id.** A split part finds its ledger row by date, account, row amount and row balance (`splitsTabReader.ts:86-90`), and an asset claims its payment by a reference or a search in the description (`assetRegister.ts:55-60`). They would hold the ledger row's id instead. Cost: a column change on two tabs and a prompt that fills them, after step 1.
3. **The clients tab, one row per client.** Already a queue entry. IBANs become their own records that name the client.
4. **Rules in record terms, once Wave 13 retires `Rules.gs`.** Until then the rules mirror its cells for `parity:rules`.
5. **A third adapter**, an IndexedDB record store or a server database. Cost: the storage port, one mapper per kind (16), a pass of the contract suite, and the source choice in 16 files that branch on `google` and `excel`.

I recommend steps 1 and 2 in Wave 13 or right after it, since they finish "references by identity" and the ledger id is cheapest once the app owns the ingest. Step 3 is already queued. I would leave step 4 to Wave 13 and step 5 until a real need appears, such as using the app without Google. The contract suite keeps step 5 open at no extra cost.

## 1. Where things stand

Everything below is at 7128551 (lane 1).

- Every write goes through one funnel, `writeThrough` (`workbookStore.ts:338-377`), fed by four store methods in tab, header and cell terms (`workbookStore.ts:195-208`). Each Google write is one `spreadsheets.batchUpdate`.
- 41 write call sites outside the workbook feature build cells and row numbers. 17 record-to-cell builders sit in 12 feature files.
- `sheetRow` appears in 70 `src` files and 50 test files outside the workbook feature. It does five jobs: identity for a write, row words in messages, a Sheet link, tie-breaks, and map and list keys.
- 35 `src` files outside the workbook feature import its infrastructure. 8 core files import pack code 15 times.
- 14 of 16 tabs are parsed in infrastructure, mixing cell conversion and business rules.

## 2. Design

### Layers

```
features and pack        domain records (Invoice, Asset, ...), write through Repository<R> inside store.write
        |
WorkbookStore            unit of work: fresh read, find by identity, domain checks, one apply, read back, Undo
        |  RecordStorage (the port)
spreadsheet adapter      SpreadsheetTab<R> per kind: tab, columns, cells to record and back, placement, rows
        |
   +----+-----------------+
Google Sheet grid      browser workbook grid
```

A database adapter would implement `RecordStorage` with one table mapper per kind and pass the same contract suite.

### Record identity

```ts
// workbook/domain/recordId.ts
/** A record's kind and its business key or id. The same across reads, writes and storages. */
export type RecordId = string & { readonly __record: 'id' }

export function recordIdOf(kind: RecordKind<unknown>, key: string): RecordId

// workbook/domain/recordKind.ts
export interface RecordKind<R> {
  /** Such as `invoice`. A pack kind's name starts with the pack's. */
  readonly name: string
  readonly noun: RecordNoun
  /** The business key, or the `id` column of a kind without one. */
  keyOf(record: R): string
  /** How a toast, refusal or problem names the record, such as "invoice 1-1-26". */
  label(record: R): string
}
```

The identity replaces the opaque row reference. Keys: a ledger row's `LedgerRowKey` (`ledgerRowKey.ts:30-44`), a category's and an account's slug, a setting's key, a rule's id, an invoice's client and number, a client row's IBAN, a grant's slug, a scenario component's scenario, component and span. The seven kinds in decision 5 use their `id`. Records of those seven carry `readonly id: string`, a UUID from `crypto.randomUUID()` (Firefox 95 and later, see lane 4).

It is a branded string, like `CivilDate` (`civilDate.ts:5`) and `Money` (`money.ts:5`). It works with `===`, as a `Map` key and a `v-for` key, and inside Vue's proxies (lane 3). Domain code may build one, since it states identity, not storage. Row numbers exist only inside the spreadsheet adapter, which indexes a fresh read by identity at write time.

### Records and refused rows

Each kind keeps its domain type, such as `Invoice` with `deliveryPeriod` (`workbook/domain/workbook.ts:105-119`), minus `sheetRow`. A read gives both what parses and what does not:

```ts
// workbook/application/recordsRead.ts
export interface RecordsRead<R> {
  readonly records: readonly R[]
  readonly refused: readonly RefusedRecord[]
}

/** A stored row the domain refuses, kept so an editor can show it and fix it. */
export interface RefusedRecord {
  /** Null when the row lacks its key or id. */
  readonly id: RecordId | null
  readonly label: string
  /** Each stored field as text, by its name in the workbook format. */
  readonly text: Readonly<Record<string, string>>
  readonly reason: string
}
```

This is the cheap way to keep "operatng" on screen. The editors already work on text drafts (`settings/domain/tabRowDrafts.ts:14-40`). They build drafts from `records` and from `refused.text` alike, and on save parse the draft with the same domain function the adapter uses. So a kind needs no second draft type.

The split of today's readers: the adapter's `SpreadsheetTab<R>` converts cells by type (serial dates, euros to `Money`, TRUE to a flag) and calls the kind's domain factory, which refuses with a reason, such as grant parts that do not add up (`grantsTabReader.ts:43-79`). Rules across records, such as duplicate keys and unknown categories, run in the domain when the `Workbook` is assembled.

### Repositories and the unit of work

```ts
// workbook/application/repository.ts
/** One kind's records inside a write. Each call is checked and applied with the rest of the write, or not at all. */
export interface Repository<R> {
  add(record: R): void
  change(before: R, after: R): void
  remove(record: R): void
  /** Stores a refused record as this one. A refused record without an id is found by its text. */
  repair(refused: RefusedRecord, after: R): void
}

/** The repositories of one write. */
export interface UnitOfWork {
  of<R>(kind: RecordKind<R>): Repository<R>
}

// workbook/application/workbookStore.ts
write(title: string, work: (unit: UnitOfWork) => void, options?: { readonly addMissingKinds?: boolean }): Promise<WriteReceipt | null>
undo(write: SessionWrite): Promise<void>
```

A call site, for an edited invoice in `InvoiceDialog.vue`:

```ts
await store.write('Invoice saved', (unit) => unit.of(INVOICES).change(invoice, edited))
```

One interface serves every kind, with one typed instance per kind. A kind gets its own interface only for a verb that states a rule. None needs one today: a verdict is `change(row, withVerdict(row, verdict))`, and the ledger's write rules refuse a change to any field but `category` and `flagged_by`. Reads come whole at sync, as now, from `store.state`. So the repository has no query methods, and the cost lane 3 counted for a read side per repository does not arise.

Each kind's write rules sit with the feature that owns the kind:

```ts
// workbook/application/writeRules.ts: replaces TabRowRules (tabRowWrites.ts:31-53), with no columns or cells
export interface WriteRules<R> {
  readonly kind: RecordKind<R>
  /** Kinds whose fresh records the checks need, such as categories for a verdict. */
  readonly reads: readonly RecordKind<unknown>[]
  /** Fields a change may touch. Unset means all. */
  readonly changeable?: readonly (keyof R & string)[]
  refusals(change: KindChange<R>, fresh: FreshRecords): readonly string[]
  /** False for rules and settings, which keep no Undo (`workbookStore.ts:89-94`). */
  readonly undoable: boolean
}
```

`store.write` does what `writeThrough` and the four planners do now:

1. Read fresh the kinds the write touches and their `reads`.
2. Find each changed and removed record by identity. Refuse when it is gone or differs from `before`.
3. Run the domain checks: a written record may not be refused or gain a problem, an untouched one may not drop out, then each kind's `refusals`.
4. Hand the changes to `RecordStorage.apply` as one list, read back, check every record by identity, add the write to the session list.

```ts
// workbook/application/recordStorage.ts: the port the adapters implement
export interface RecordStorage {
  read(kinds: readonly RecordKind<unknown>[]): Promise<FreshRecords>
  /** Applies every change or none, finding each record by its identity. */
  apply(changes: readonly RecordChange[], addMissingKinds: boolean): Promise<void>
}
```

`store.write` replaces `setVerdicts`, `undoVerdicts`, `changeRules`, `changeSettings` and `changeRows`. One composable, `useRecordWrites`, replaces `useRowWrites` and `useLedgerWrites`, and gives the toast and Undo.

**Undo.** A receipt holds the records added, changed (before and after) and removed. Undo of a delete adds the record back with the same identity. It no longer goes back to its old row: the adapter puts it at the foot of its tab, and a ledger row where its date puts it, newest first. Since nothing reads order from rows, figures after Undo equal figures before the delete. Undo is refused when a record with that identity exists again. The check that a put-back row would land on the wrong row (`workbookStore.ts:96-125`) and `restored` in the change go away.

### Labels instead of rows

Toasts, refusals and problem lists name records by `label`, such as "Invoice 1-1-26 saved" in place of "Written to row 57 of the invoices tab". `sheetRowLink` and its use on Review go (`ReviewScreen.vue:80`). The whole-Sheet links in Settings and on the billing plan stay (`DevicePanel.vue:16`, `BillingPlanPanel.vue:22`).

### The pack seam

The pack builds one typed contribution (`src/packs/hr-doo/hrDooPack.ts`), and `main.ts` installs it with `await import` inside `start()`, as it loads the fake seed (`main.ts:16-19`), so the ruleset stays out of the entry chunk.

```ts
// features/packs/packContribution.ts
/** Names a pack's part of the Workbook and its type, as Vue's InjectionKey does. */
export interface PackKey<Part> {
  readonly name: string
  readonly __part?: Part
}

export interface PackPart<Part> {
  readonly key: PackKey<Part>
  readonly kinds: readonly WriteRules<unknown>[]
  /** Settings keys the pack parses, so core neither reads nor reports them. */
  readonly settingKeys: readonly SettingKeySpec[]
  assemble(records: FreshRecords, settings: PackSettingValues, core: Workbook): { readonly part: Part; readonly problems: readonly WorkbookProblem[] }
}

export interface PackContribution<Part> {
  readonly workbook: PackPart<Part>
  /** Ledger rows the pack keeps whole, with the names that claim them. Read whatever the owner-pay switch says. */
  rowsKeptWhole(core: Workbook, part: Part): ReadonlyMap<RecordId, readonly string[]>
  // Shown only while the owner-pay switch is on:
  readonly screens: readonly PackScreen[]
  waitingJobs(core: Workbook, part: Part, asOf: CivilDate): readonly WaitingJob[]
  readonly reviewCards: readonly AsyncComponentLoader[]
  readonly settingsTabs: readonly PackSettingsTab[]
  readonly settingsCards: readonly AsyncComponentLoader[]
  readonly companyFactsCard: AsyncComponentLoader
  costGroupLinks(group: string): RouteLocationRaw | null
}

export function installPack<Part>(pack: PackContribution<Part>): void
export function packPart<Part>(workbook: Workbook, key: PackKey<Part>): Part | null
```

- The `Workbook` loses `assets`, `grants`, `yearEndLines`, `planLines`, `payScenarios` (`workbook.ts:213-228`) and gains `packParts`. `packPart` holds the one cast. The pack's screens read `packPart(workbook, HR_DOO)`.
- The spreadsheet mappers for pack kinds live in `src/packs/hr-doo/infrastructure/` and implement `SpreadsheetTab<R>` from `workbook/infrastructure/spreadsheetTab.ts`. `main.ts` hands them to the adapter wiring, so the core contribution type names no infrastructure. A database adapter would take the pack's table mappers the same way.
- The settings parser takes the pack's key specs, leaves those keys to the pack and passes their values to `assemble`. `CompanyFacts` and the nine `hr_` keys (`settings.ts:115-136`, `:372-455`) move into the pack part.
- The pack owns `ASSET_ROWS`, `GRANT_ROWS`, `YEAR_END_ROWS` (`workbookTabRows.ts:165,177,198`), `OWNER_ADVANCE_ROWS` (`ownerAdvanceRows.ts:28`) and the three editor column sets (`factTabColumns.ts:30,58,80`), as `WriteRules` and editor columns.
- `countedSplits` moves into the core transactions domain and takes the claim map (`countedSplits.ts:14-27`). Data slots apply whatever the switch says. Only the screen slots read it, in one place instead of 21 reads in 11 files.
- Pack jobs come after core jobs, so "unaccounted" moves below the overdue invoices line (`tests/waitingForYou.spec.ts:22-28`).
- `router.ts:21` builds routes when the module loads, so the list moves inside `createAppRouter`. Specs that expect pack behaviour install it in a Vitest setup file.

Owner advances are the one pack kind core counts. See open question 1.

## 3. Order from fields

Every case, with today's rule, the new one and the export check, is in [lane 4](research/storage-boundary/lane4-order-and-ids.md). In short:

- **Ledger, same account and day:** the balance chain (each balance is the previous plus the amount), opened from the previous day's closing balance, then the reference. On the export: 47 account-days with two or more entries (179 entries, at most 9 in a day). The chain allows exactly one order on all 47, and all 47 equal today's `sequence`. 0 days are ambiguous. `Transaction.sequence` stays, derived by the ledger parser from these fields, so its eleven consumers do not change.
- **Ledger, across accounts on one day:** no field decides, so by account name. On the export 4 days have both accounts and 2 of them reorder. No figure moves. Only the order of the accrual bookings list changes.
- **Duplicate keys:** every row with a duplicated key is refused, where today the first row wins. This covers categories, settings, rule ids, invoices, assets, grants, year-end lines, plan lines, dismissals, scenario components, accounts and client IBANs. The export has 0 duplicates and 0 problems.
- **Ties:** invoices by number, billing items by item, amount and description, owner advances by amount and description, split parts larger first, konto lines by line id, rules by rule id with a tie among enabled rules reported. On the export no amount changes. The visible effects are the order of one same-day group of owner advances in lists and traced figures, the order of items inside a month on the billing view, and the part numbers of one split.
- **Imported statements** still land newest first, as the Apps Script places them. That placement is now the spreadsheet adapters' concern, for a person reading the tab.

## 4. Ids and the migration

**Rows needing ids on the export:** splits, year-end, owner-advances, outgoing-plan and assets. `plan` and `dismissed` are absent and start with the column when the app adds them. The Apps Script reads none of the seven tabs (lane 4).

**The id:** a version 4 UUID from `crypto.randomUUID()`, in a text column `id` after each tab's last column. The reader refuses a row without one. There is no reader that accepts both shapes once stage 4 lands.

**How your Sheet gets them.** Stage 3 adds a standing notice: "N rows on M tabs have no id yet. Add them?" Accepting writes the `id` headers and every missing id in one write. It shows on Overview's Waiting for you, opens a dialog that lists the tabs and counts, and works the same on a workbook kept in this browser. It stays after the migration, so a row you add by hand, or one written by an app tab left open from before the deploy, gets its id with one click. A copied row shares its id with the original. Both are refused, and the problem says to clear the copy's id cell.

**Deploy order.** Every push to `main` deploys (`deploy.yml:3-5`), so the order of pushes is the safeguard:

1. Push stages 1 and 2 as usual.
2. Push stage 3. From here every new row of the seven kinds gets an id, and rows without one still read.
3. You open the app, accept the notice, then export a fresh xlsx.
4. Push stage 4, which refuses rows without an id, only after you say the notice is gone. Pushed earlier, those rows would read as refused and their figures would drop out until you clicked.
5. Stages 5 to 8 follow. Their proofs use the fresh export, since the old one has no ids.

## 5. The import boundary

`tests/importBoundaries.spec.ts`, a Vitest spec using `ts.preProcessFile` and `vue/compiler-sfc`, both installed. It resolves relative imports and catches type-only, `export ... from` and dynamic imports. Each failure names the file, the import and the rule. Each stage adds its rules once they hold, so there is no list of tolerated violations.

| Rule                                                                                                                | Exceptions                                                                                                                  | Violations at 7128551                                                 | Holds from |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| A `domain` folder imports only `domain` folders and `shared/calendar`, `shared/money`, `shared/text`                | none                                                                                                                        | 2 files (`imports/domain/profileGuess.ts:3`, `tabularStatement.ts:6`) | stage 1    |
| Core (`src/features`, `src/shared`, `App.vue`) imports nothing from `src/packs`                                     | `main.ts`                                                                                                                   | 8 files, 15 imports                                                   | stage 1    |
| The word `sheetRow` appears only in `src/features/workbook/infrastructure`, and `as RecordId` only in `recordId.ts` | none                                                                                                                        | 70 files outside workbook                                             | stage 5    |
| Nothing outside `src/features/workbook` imports its `infrastructure`                                                | `main.ts` for wiring and the fake seed. Pack `infrastructure` may import `spreadsheetTab.ts`                                | 35 files, 78 lines                                                    | stage 7    |
| An `application` folder imports no `infrastructure` folder                                                          | the adapter wiring, moved out of `workbookStore.ts:510-548` into its own file, and `invoicing/application/invoiceGoogle.ts` | 17 files                                                              | stage 7    |

## 6. The contract suite

`tests/recordStorageContract.spec.ts`: one file, a `describe.each` over the two storages and, inside it, a `describe.each` over the kinds. Each kind gives a small fixture: two valid records, a change to one, and a row the domain refuses.

I chose one generic suite over a suite per repository. Every kind has the same `Repository<R>` interface, so the behaviour to test is the same, and 16 suites would repeat it. What differs per kind is the mapping, which the fixture's round trip covers. A pack kind joins by adding its fixture. This is Rainsberger's sense of contract test, one suite against every implementation through a factory (lane 3).

Each storage factory starts empty with every kind's header and gives a way to play an outside edit: a fresh `createFakeSheets` per test (`fakeSheets.ts:22`) under the Google adapter, and the in-memory grid of the browser workbook (`localWorkbookWriter.ts:15`). Per kind it checks:

- A record reads back as written, field by field: dates, money, flags, text that looks like a number staying text, a blank field clearing.
- Change and remove find the record by identity after records were added above it from outside.
- A change to a record that differs from `before`, or is gone, is refused and writes nothing.
- A refused row reads with its text and reason, and `repair` stores it as a valid record.
- Undo of a remove brings the record back with the same identity.

And once for the unit of work: a write across two kinds applies whole or not at all.

Spreadsheet-only behaviour stays in the adapters' own specs: placement of ledger rows, adding a missing tab or column, number formats, copying dropdowns and the order of requests. The 55 request-shape tests keep asserting the same requests.

## 7. Build stages

Eight stages, dependency-ordered, shipped as three deploys of one commit each: stages 1 to 3, stages 4 and 5, stages 6 to 8. Each deploy runs every check once, at its end. File counts are estimates from the lane inventories.

**Proof in every stage:** `npm run check` (typecheck and Vitest with the boundary spec), `npm run build` with the fake-bytes check, `check:pwa`, `check:import`, and the full `check:visual` and `check:touch` on the fake build. On an export: `check:round-trip`, `parity:rules`, `parity:year-end` and `parity:payroll`. A scratch script prints every figure the screens compute, on 7128551 (from `git archive` into a scratch folder) and on the stage, for the fake workbook in both modes and for the export. The outputs must match, except for an order change lane 4 lists.

**Stage 1: the pack's screen and claim slots, the Google move, the first boundary rules.** About 50 files: 7 new, 8 moved, 35 edited.

- The contribution type, `installPack`, the screen, job, card, tab and link slots, and `rowsKeptWhole`. `countedSplits` into core. All 15 imports and 3 path links gone. Pack jobs after core jobs.
- Google sign-in, Drive, Picker and session modules into `src/shared/google/`. The two import-domain files get their own cell type.
- Boundary rules for domain folders and core-to-pack imports.
- Main files: `main.ts`, `router.ts`, `screens.ts`, `App.vue`, `waitingForYou.ts`, `ReviewScreen.vue`, `SettingsScreen.vue`, `GeneralSettingsForm.vue`, `presentedWorkbook.ts`, `splitRows.ts`, `SplitDialog.vue`, `BreakdownPanel.vue`.
- Extra proof: `tests/waitingForYou.spec.ts` expects the new job order.

**Stage 2: order from fields.** About 35 files.

- A domain `bookingOrder` that derives `sequence` from the balance chain, in place of tab position (`workbookReader.ts:395-399`). A day whose balances do not chain is a problem.
- Duplicate keys refused in every reader in place of "first row wins". Client and scenario fields that rows give differently read blank with a problem.
- The 15 tie-breaks of lane 1 on fields. The rule editor refuses a tie among enabled rules.
- Main files: `workbookReader.ts`, the 7 tab readers, `settings.ts`, `readRules.ts`, `rule.ts`, `invoiceMatching.ts`, `plannedAgainstInvoiced.ts`, `fillRestOfYear.ts`, `billingView.ts`, `ownerAdvances.ts`, `accrualBookings.ts`, `closedYear.ts`, `scenarioPay.ts`, `listedRows.ts`, `ledgerRows.ts`, `InvoicesPanel.vue`.
- Extra proof: the lane 4 scripts on the export give the same counts, and the figure script matches.

**Stage 3: ids written, and the notice.** About 40 files. Deploy, then you accept the notice.

- The `id` column in the template for the seven tabs. Every add of those kinds sets an id. The readers read `id` when present.
- A new-column edit in the grid port, both grid adapters, the fake Sheet, and the Google adapter adding a grid column when a tab has none free.
- The notice on Overview with its dialog, and one write of headers and ids. The fake workbook gets fixed ids.
- Extra proof: on the fake Sheet with the old tabs, the notice's write gives every row a distinct id in one batchUpdate, and a second sync shows no notice.

**Stage 4: ids required.** About 15 files. Push only after you confirm the notice is gone.

- The seven readers refuse a row without an id, or with a shared one. The write planner finds those kinds by id instead of by content (`tabRowWrites.ts:296-318`).
- Extra proof: on your fresh export, every row of the seven tabs reads, and the figure script matches.

**Stage 5: record identity in place of row numbers.** About 160 files, most of them one-line changes: 70 `src` files outside the workbook feature, about 34 inside, 50 test files, `parity-rules.mjs` and `parity-year-end.mjs`.

- `RecordId` and `RecordKind` replace `sheetRow` on every record, problem, draft, guard, receipt and list key. The grid adapters index rows by identity at write time.
- Labels replace row words. `sheetRowLink` and `ledgerSheetId` go.
- The `sheetRow` boundary rule.

**Stage 6: the read side in records.** About 75 files.

- `SpreadsheetTab<R>` per core kind in the adapter. The 9 readers split into the adapter's conversions and the domain's factories and cross-record rules. `readWorkbook` moves to the domain. `cellReading.ts` splits the same way.
- `RecordsRead` with `refused` in the store state. The 20 screens that read the raw snapshot read records. The editors draft from records and refused rows.
- Extra proof: a category with a misspelt bucket still shows in the Categories editor, and saving it fixed writes one cell.

**Stage 7: repositories and the unit of work.** About 85 files.

- `Repository`, `UnitOfWork`, `WriteRules`, `RecordStorage` and its spreadsheet implementation. `store.write` and `useRecordWrites` replace five store methods and two composables. Undo by identity.
- The 17 write rule sets as `WriteRules`. The 41 call sites in about 25 files write records. The 17 builders go.
- The contract suite. The last two boundary rules. README "Write-back" and "Development" rewritten.
- Main files: `workbookStore.ts`, `tabRowWrites.ts`, `writePlans.ts`, `workbookWriter.ts`, both grid adapters, `tests/fixtures/writeBack.ts` and the 9 both-storage specs.
- Extra proof: the contract suite passes on both storages, and the Google request-shape tests pass without changes to what they assert.

**Stage 8: the pack owns its records.** About 70 files: 26 pack files, 9 core files and 25 test files read the pack's records today.

- The pack's kinds, mappers, write rules, editor columns, settings keys and `CompanyFacts` move into the pack and register through `PackPart`. The `Workbook` loses the pack's fields. The settings parser gets its key seam.
- Extra proof: the contract suite runs the pack's kinds, and the figure script matches.

## 8. Risks and what stays out

**Risks**

- Stages 6 and 7 are large, and Google writes must not change. The request-shape tests and the write replay in the visual and touch checks are the guard.
- A change writes only the fields that differ, so a formula the change leaves alone stays a formula.
- A conversion failure must be reported where a reader reports it now, or a problem count moves. The figure script compares problems by reason.
- The gap between the re-read and the batchUpdate stays until Wave 13 (lane 3, Optimistic Offline Lock).
- Pushing stage 4 before you accept the notice would drop those seven kinds out of the figures until you do.
- Your live Sheet is written once in this wave, by you, through the notice. The last check is yours after stage 7: one sync, then one confirm and Undo on Review.

**What stays out**

- The source choice and its UI stay two-way, Google or this browser.
- No tab changes shape beyond the `id` column. The clients tab keeps one row per IBAN.
- Rules keep the Apps Script's columns until Wave 13 retires `Rules.gs`.
- Rules and settings still have no Undo.
- No ESLint or dependency-cruiser.

## 9. Answered 2026-10-22

1. Owner advances move into the pack with the other pack records. The seam grows a slot that hands core the extra bookings for profit and loss, the Transactions list and the filters.
2. Ids on all seven tabs.
3. The eight stages ship as three deploys, one commit each: stages 1 to 3, then stages 4 and 5 after you accept the ids notice, then stages 6 to 8.
