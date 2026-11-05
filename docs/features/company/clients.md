# One clients row per client: proposal

The queued clients fix: a client record keyed by its slug with a list of IBANs in one cell, read with the card_settlement_ibans list parser, the guards and the editor that go with it, two build stages in one deploy, and how the two Acme rows on the live Sheet get merged.

Checked against HEAD 8666d7e and the working tree of deploy 3, which holds stages 6 and 8 of [the Wave 12b plan](../platform/storage-boundary-plan.md) and is getting stage 7. Paths are relative to the repo and point at the working tree unless marked HEAD. The design writes through stage 7's `store.write` and `Repository` as that plan describes them. Checks on your export ran through scratch scripts that print counts only, and the counts are left out here.

## What you asked and what is decided

From plan.md, "Queued fix: one clients row per client" (after Wave 14, before the JSON storage wave):

- One `clients` row per client. The `iban` cell holds several IBANs separated by commas, read with the same list parser as `card_settlement_ibans`. Breaking change, no reading of the old shape.
- Each IBAN valid, on no other client, and not one of your own accounts. A duplicate slug is refused, not grouped. The "second row of a client" rules go.
- The client editor edits the IBANs as a list, add and remove. Payer matching keeps reading `Client.ibans`.
- The two Acme rows on your Sheet merge into one in the same wave. The handoff adds: ask you before writing, ideally done by you through the app right after the deploy.
- Checks: reader and guard tests, round trip, the editor flows, and receivables on the export still attributing every Acme payment.

One older line disagrees. The Wave 12b plan's "Toward a database" step 3 says "IBANs become their own records that name the client". The queue entry is later and more specific, so this proposal follows it. A list on the client record also keeps a client one record, which the JSON storage wave can store as an array with no format work.

## How it works today

Your export has two clients rows for one client (Acme), on adjacent rows. Both give the same name. The first fills all the invoicing columns, the second none. Its invoices, its billing plan rows and the `billing_client` setting name this client. The ledger holds credits from both IBANs and a client refund from the first. Some enabled rules test `counterparty_is_client`.

The reader keys each row by its IBAN (`src/features/workbook/infrastructure/spreadsheetTab.ts:233-251`, record kind `client-iban` at `src/features/workbook/domain/recordKind.ts:36`). It groups rows by slug into one `Client` and takes each name and invoicing field from whichever rows agree (`src/features/workbook/domain/clientsReading.ts:98-134`). So the app already sees one client with two IBANs. On the export at HEAD there are no problems, and every payment and the refund are attributed.

The cost of the row-per-IBAN shape shows in three places. The guards need a "second row carries the same name" rule (`src/features/settings/domain/clientGuards.ts:63-66`). A change to the address has to touch every row of the client in one save (the open point under deploy 1 in plan.md). And a client row's label is its IBAN, so a toast about a client prints the IBAN (`spreadsheetTab.ts:238`).

What a merged row does to today's code, checked on the export with the two rows merged into one cell: HEAD reads `IBAN1, IBAN2` as one IBAN with a comma in it, reports nothing, and attributes no payment at all. The Apps Script reads the cell the same way (`Data.gs:343-370`, `normaliseIban` at `Categorise.gs:81`), so its `counterparty_is_client` rules would stop matching Acme credits. That is why the merge must follow the deploy, and why Rules.gs must be gone first (see Risks).

## The design

**In plain terms.** A client is one record, named by its slug. Its IBANs are a list inside that record, stored as one comma-separated cell. Everything that reads clients today reads the same `Client` it gets now, so matching, rules, invoicing and the forecast do not change. What changes is the record's identity, its reader, its guards, its editor field and its tab note.

### Domain

- **The record.** `ClientRecord = Client & { readonly id: RecordId }` in `src/features/workbook/domain/clientsReading.ts`, the shape `CategoryRecord` and `AccountRecord` use (`categoriesReading.ts:12`, `accountsReading.ts:12`). `Client` keeps its fields (`workbook.ts:136-156`). `ClientRow`, `ClientRowInvoicing` with its null reverse charge, `rowsByClient`, `clientOf`, `clientsOf` and the "rows give it differently" problem all go (`clientsReading.ts:11-22`, `:83-134`). `reverse_charge` blank reads FALSE, as the template note says.
- **The kind.** `CLIENT_RECORDS = recordKind<ClientRecord>('client', 'client', 'clients')` in place of `'client-iban'`. The key is the slug, and the label is the name, or the slug when the name is blank. No IBAN in toasts any more. No record id is stored anywhere (the cache holds raw tabs, `workbookCache.ts`), so the rename needs no migration.
- **The list parser.** `ibanListOf` moves from `src/features/settings/domain/settings.ts:617-623` to `src/features/workbook/domain/iban.ts`, beside `isIban` (`iban.ts:11`). The settings parser (`settings.ts:386`), `GeneralSettingsForm.vue:13` and the client factory import it from there. The domain boundary rule allows domain to domain. The cell is written as `ibans.join(', ')`, as `settings.ts:384` writes the setting.
- **The factory** `clientRecordOf(fields, id)` refuses a record with no slug or no IBAN, as today (`clientsReading.ts:27-29`). An IBAN given twice in one cell is read once.
- **The reader** `readClients(read): Reading<ClientRecord>`:
  - A slug on two or more records leaves every one of them out, with the problem "acme is on 2 rows. Put all its IBANs in the first row, separated by commas, and delete the others." This is 12b's duplicate-key rule.
  - An entry that is not a valid IBAN is left out of that client, with a problem naming it. The client still reads. Refusing the whole record would cascade: invoices would report their client missing (`invoicesReading.ts:49-51`) and plan rows would drop out (`billingPlanReading.ts:25-26`).
  - An IBAN on two clients is left out of both, with a problem on each, as today's shared-IBAN rule does for rows (`clientsReading.ts:77-81`).
  - The language and reverse-charge doubts stay as they are (`clientsReading.ts:34-57`).
- **The guards** in `clientGuards.ts`. `ClientCells` becomes `{ slug, name, ibans }`. The checks:
  - The slug keeps to the format and is on one record only: `slugChangeRefusals(..., true)` in place of `false` (`clientGuards.ts:37-42`, `slug.ts:68`). A slug that invoices, plan rows or `billing_client` name is not renamed or deleted, as now.
  - Each IBAN the change adds is valid, on no other client, not twice in the list, and not one of your accounts (`clientGuards.ts:52-61`, run per entry).
  - The "same name on another row" rule goes (`clientGuards.ts:63-66`). So does the comment about a second row (`:25-31`).
- **The account guard** keeps its `clientIbans` map. It is built by `flatMap` over each client's IBANs in `ACCOUNT_WRITES` (`src/features/settings/application/workbookTabRows.ts:202`).

### Application

- `CLIENT_WRITES: WriteRules<ClientRecord>` (`workbookTabRows.ts:206-221`) with the new guard input. Its `reads` stay accounts, invoices, billing items and settings. After stage 7 the `CLIENT_ROWS` path at `workbookTabRows.ts:97-132` is gone already, so this fix touches one rule set.
- The readers that need the slugs keep `definedClientSlugs` (`billingPlanRows.ts:44`, `invoiceRows.ts:75`). `readWorkbook` reads `withoutIds(keep('clients', readClients(...)))` in place of `clientsOf(...)` (`readWorkbook.ts:70`), as categories do one line above.
- Payer matching does not change: `receivablesOf` builds its IBAN map from `Client.ibans` (`receivables/domain/invoiceMatching.ts:88`), and so do the rules' context (`rules/domain/categorisationContext.ts:13`) and the counterparty links on Invoices (`InvoicesPanel.vue:122`).
- Merging the two Acme rows needs no new application code. The editor drafts from stored fields, refused and left-out records included (`settings/domain/tabRowDrafts.ts:41-44`). The adapter finds a record by its identity and the record the row reads as (`spreadsheetRecordStorage.ts:172-180`). So two rows that share the slug `acme` but differ in IBAN are each found exactly once, and one save can change the first and remove the second.

### Infrastructure

- The mapper in `spreadsheetTab.ts:233-251`: key by slug, label by name, `clientRecordOf`, and `iban: client.ibans.join(', ')`.
- The template notes in `workbookTemplate.ts:119-129`. `client` becomes "One row per client. Required." `iban` becomes "The IBANs the client pays from, separated by commas. A payment from any of them counts against the client's invoices. Required." `address` drops "fill it on one of the client's rows, or the same on each".
- The fake workbook gives one client a second IBAN with no ledger rows from it (`fake/fakeWorkbook.ts:308-312`), so the editor shows a list and no fake figure moves.
- The Apps Script: by the time this fix is built, Wave 13 has retired `Rules.gs`, and `requireClientIbans` (`Data.gs:343-370`) has no caller. If Wave 13 left it in `Data.gs`, this fix deletes it and the planning session pushes the change. `parity:rules` goes with Wave 13 as well, so its client comparison (`scripts/parity-rules.mjs:155-171`) needs no change.

### Presentation

- A new draft cell kind `iban-list` in `tabRowDrafts.ts:17`, which normalises each entry with `ibanListOf` and writes them joined.
- `FactTabEditor.vue` renders that kind with Nuxt UI's `UInputTags`, which ships in the installed `@nuxt/ui` 4.12.0. Its page (https://ui.nuxt.com/docs/components/input-tags, loaded 2026-10-23) calls it "an input element that displays interactive tags": each tag has a delete icon, a `delimiter` prop adds a tag on a typed character such as a comma, `add-on-paste` splits pasted text on that delimiter, and `add-on-blur` adds what is typed when the field loses focus. I did not check its touch behaviour on Firefox for Android, so `check:touch` has to cover it. See question 2.
- `factTabColumns.ts:21-32`: the `iban` column becomes `iban-list` and gets a wider field. `ClientsPanel.vue:42-53`: the description becomes "Who pays your invoices, one row per client with every IBAN they pay from", and `row-noun` becomes `client`, so the button reads "Add client".

### What goes away

`ClientRow`, `ClientRowInvoicing`, the grouping by slug and the "give it differently" problems, the second-row name rule and its test, the `client-iban` kind name, the IBAN in client labels, and the deploy 1 open point about changing shared fields on both rows. README loses "one row per IBAN" in "The workbook format" (`README.md:204`), the identity line (`:228`) and the guards row (`:1360`).

## Build stages

Two stages in one commit and one deploy. The new reader refuses the old shape, so neither stage can ship alone.

**Proof for the deploy:** `npm run check`, `npm run build`, `check:pwa`, `check:import`, and the full `check:visual` and `check:touch` on the fake build. On the export: `check:round-trip`, `parity:year-end` and `parity:payroll`. The 12b figure script on the fake workbook, which must match the commit before. A scratch script on the export with the Acme rows merged must print one client with two IBANs and no unattributed payment, which is what HEAD gives on the unmerged export. The same script on the unmerged export must print the duplicate-slug problem on 2 rows and nothing else wrong in the clients tab.

**Stage 1: the record, the reader and the guards.** About 20 files.

- `iban.ts`, `settings.ts`, `GeneralSettingsForm.vue` (the parser move). `clientsReading.ts`, `recordKind.ts`, `workbook.ts` (doc comment), `readWorkbook.ts`, `spreadsheetTab.ts`, `workbookTemplate.ts`, `clientGuards.ts`, `workbookTabRows.ts`, `fake/fakeWorkbook.ts`.
- Tests: the clients cases in `tests/workbookReader.spec.ts` (HEAD `:273`, `:314`), `tests/workbookTabGuards.spec.ts` (the clients block at `:123`), the clients case in `tests/recordWriteRequests.spec.ts:85-88`, the `client-iban` fixture in `tests/recordStorageContract.spec.ts:173` (renamed `client`, one record with two IBANs, a change that adds one), `tests/settings.spec.ts` for the moved parser, and `tests/tabRowWrites.spec.ts:238` if stage 7 leaves it.
- Proof: reader tests for a list, a malformed entry, an IBAN on two clients and a slug on two rows. Guard tests for each refusal. The contract suite on both storages.

**Stage 2: the editor.** About 10 files.

- `tabRowDrafts.ts`, `FactTabEditor.vue`, `factTabColumns.ts`, `ClientsPanel.vue`. The card settlement field in `GeneralSettingsForm.vue` if you choose the tags field for both (question 2). `scripts/visual-check.mjs:129` ("Add client"), `scripts/touch-check.mjs` (the `invoicing-clients` step), `scripts/support/editorFlows.mjs` (a flow that adds an IBAN to a client, removes it and saves, with Undo). README "Settings screen" and "Write-back".
- Proof: the flow at 360 and 1440 px in both themes, a save that adds one IBAN writing one cell in one batchUpdate, and the Google request-shape tests unchanged apart from the clients case.

**What needs your hands, for the planning session:**

1. Before the push: confirm that Wave 13 is deployed and that `Rules.gs` is gone from the Apps Script project. If `requireClientIbans` is still in `Data.gs`, push the trimmed `Data.gs` with `npx @google/clasp push -f`, then check Extensions, Apps Script, Executions after the next morning run.
2. Right after the deploy goes green: open the app, Invoicing, Clients. The two Acme rows show as left out. In the first row's IBAN field add the second IBAN, delete the second row, and save. Until then Invoicing shows each of Acme's invoices with a problem, its plan rows are left out of the billing plan and the forecast, and its payments read as unattributed. Nothing is written in the meantime.
3. Then export a fresh xlsx. The implementation session checks it: 0 problems, the receivables counts above, figures identical to the previous commit's on the old export.

No Google Cloud change.

## Questions for you

### 1. How the two Acme rows become one

**Where:** your live Sheet's `clients` tab, and Invoicing, Clients in the app, right after this deploy.

**Today:** Acme has two rows, one per IBAN. After the deploy the app refuses a slug on two rows, so both rows drop out until they are merged, and with them Acme's invoices, plan rows and payment matching.

- **Fix it yourself in the clients editor (recommended).** The editor shows both rows with the reason. You add the second IBAN to the first row, delete the second row and save, and Undo works if you slip. Costs no extra code, since the editor already edits refused and left-out rows. It is also how any duplicate typed into the Sheet by hand gets fixed later. You need about a minute right after the deploy.
- **The planning session edits the Sheet by hand.** It types both IBANs into the first row's cell and deletes the second row, through Chrome, with your yes, right after the deploy. Costs no code, but it is a hand edit of the live Sheet, with the Plain-text and Name box quirks the handoff warns about.
- **A one-time "Merge client rows" notice.** Like the Add ids notice: Overview offers it, you accept, one write merges the rows. Costs about 10 files that only serve your two rows, and then removing them again, which is what deploy 3 is doing to Add ids now.

### 2. How you type a client's IBANs

**Where:** Invoicing, Clients, the IBAN field of each client, and Settings, General, "Card settlement accounts".

**Today:** a client's row takes one IBAN in a plain text field. The card settlement setting takes several IBANs in one text field, comma separated.

- **A tags field for both (recommended).** Each IBAN shows as its own tag with a remove button. You add one by typing it and a comma, or by pasting a list. The card settlement field switches to the same field, so the app has one way to edit a list of IBANs. Costs one draft kind and one editor branch, plus one field change in General settings.
- **A tags field for clients only.** The same for clients, and the card settlement setting stays a comma text field. Saves the one field change but leaves two ways to type IBAN lists.
- **A comma text field, as the card setting has now.** The cell shows as you would type it in the Sheet. Cheapest, a column kind only. It does not give the add and remove the queue entry asks for, and a long pair of IBANs is hard to read in a narrow grid cell at 360 px.

## Risks and what stays out

**Risks**

- **The order of deploys.** Built before Wave 13, the Apps Script would read a merged cell as one IBAN with a comma in it, and its `counterparty_is_client` rules would stop filing Acme's credits in the morning ingest. `parity:rules` would also fail on the two client lists. Keep the fix after Wave 13 as queued. If it moves earlier, `requireClientIbans` has to split on commas the way `requireCardSettlementIbans` does (`Data.gs:299`), pushed before the merge.
- **The window after the deploy.** Until the merge, Acme's figures on Invoicing and the forecast's billing drop out, loudly, with problems. Merging before the deploy would be worse: HEAD reads the merged cell without a problem and attributes nothing.
- **An app tab left open from before the deploy** reads the merged row the HEAD way until it reloads. The PWA update prompt covers this, as with every breaking deploy.
- **Two rows copied whole** share both slug and fields, so the adapter cannot tell them apart and refuses the save with "Change it in the Sheet" (`spreadsheetRecordStorage.ts:221-228`). Your Sheet has no such pair.

**What stays out**

- A client with no IBAN yet stays refused, as today. An invoice for it reports the client missing. Changing that is its own decision.
- No separate IBAN records or tab (see "What you asked").
- The rules' `counterparty_is_client` and its "no clients tab" refusal (`rules/domain/readRules.ts:109-110`) stay as they are. Their wording about the Apps Script is Wave 13's to change.

## The owner's decisions, 2026-10-23

1. The owner merges Acme's two rows himself in the clients editor right after the deploy. No merge notice, no hand edit by the planning session.
2. A tags field for IBAN lists, for clients and for the card settlement setting alike.
