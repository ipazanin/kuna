# AI assist plan

Build plan for one AI assistant shared by every Kuna app: a Kuna-wide secrets file, one AI module with two adapters, and the first tasks in Company, Loans and Investments, checked against Kuna at 0717599.

The assistant from [the shared-module research](research/shared-module.md), built to the owner's answers of 4 Nov 2026. Kuna was read at `0717599`, and every `path:line` is against that commit. Paths under `packs/hr-doo/` mean `src/apps/company/packs/hr-doo/`. Every figure and every key is made up. Browser access, CORS, image formats and receipt costs come from [the receipts research](../spending/research/lane3-receipts.md) and are not repeated here.

## Summary

- **One secrets file for all of Kuna.** The Investments keys file becomes `kuna-secrets.json` in the app's hidden Drive folder, owned by a new `src/shared/secrets`. It holds the price vendor keys and the AI keys, is no longer tied to one Investments file, and survives Remove the Investments file. The old file folds into the new one on the next sync and is deleted only after the new one is written.
- **One AI module, `src/shared/ai`.** It owns one adapter per provider (Anthropic Messages, OpenAI Responses, OpenRouter Chat Completions), the request and tool loop, masking, the cited answer check, the provider list with a model choice per provider, and the Assistant card in Kuna settings. It writes nothing and reads keys only through `src/shared/secrets`.
- **Each app owns its tasks.** A task is a prompt, an output schema, read-only tools over the app's own domain functions, and a check against the app's own rules. The draft lands in a screen the app already has and is written through its existing write path, with Undo.
- **Defaults.** The assistant is off for every app until switched on. The default model is Claude Sonnet 5.5 on Anthropic and `gpt-6.1-sol` on OpenAI. Payroll and employee data go out only behind a per-task switch with a warning. IBANs and OIBs are masked in every row Kuna builds.
- **Never.** No tax form is filed, no mail is drafted or sent, and no web search or fetch tool is ever offered to a model. The AI computes no figure, so `check:figures` stays identical in every stage.
- **Spending** calls the same module for receipts. This plan names the interface and leaves the receipt task to `docs/features/spending/plan.md`.

## Module map

```
src/shared/secrets/        the secrets file, its merge and sync, this browser's copy, the key rows
src/shared/ai/             tasks and tools as types, masking, the cited answer, the run loop,
                           the adapters, provider presets, assist settings, the Assistant card
src/apps/company/assist/                  core tasks: suggest categories, later a rule from rows, column mapping
src/apps/company/packs/hr-doo/assist/     pack tasks: explain a figure, ask the rules, later pay and year-end
src/apps/loans/assist/                    read an offer PDF
src/apps/investments/assist/              read a broker statement, ask about tax
```

### What `src/shared/secrets` owns

| Owns                                                                                                    | From today                                                                                   |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| The file format, `kuna-secrets` version 1, its decode, merge and compare, and the reader of the old one | `src/apps/investments/prices/domain/keysFile.ts:1-87`                                        |
| The sync of the file with this browser, the fold of old files and their deletion                        | `src/apps/investments/prices/application/keysSync.ts:27-62`                                  |
| The Drive port for the hidden folder                                                                    | `KeysDrive`, `src/apps/investments/prices/application/pricesPorts.ts:69-78`                  |
| This browser's secrets under `kuna.secret.<id>`, and the one-time move from the old browser keys        | `src/apps/investments/prices/infrastructure/vendorKeys.ts:5-60`                              |
| The Drive adapter with its `drive.appdata` token                                                        | `src/apps/investments/prices/infrastructure/googleKeysDrive.ts:6-34`                         |
| The sync step every app's group lists, and what it needs of Google                                      | `KEYS_STEP` and `keysNeeds`, `src/apps/investments/prices/presentation/useKeysSync.ts`       |
| The key rows a card shows: kept or not, the last four characters, Save, Remove, Test                    | `useVendorKeys` and `keyEnding`, `src/apps/investments/prices/presentation/useVendorKeys.ts` |

It knows no vendor and no provider. A secret is an id, a key or nothing, and when it last changed. Each owner of a secret names its ids: Investments its price vendors, `src/shared/ai` its providers. A spec checks the two lists never share an id.

### What `src/shared/ai` owns

- **Domain:** `AiTask`, `AiTool`, `ToolAnswer`, `AiPart`, `TaskResult`, the strict schema subset both adapters accept, `maskIdentifiers`, and from stage 4 the cited answer schema and its check.
- **Application:** `runModelLoop`, the one loop over a `ModelPort`: masking, tool rounds, a limit on one request's prompt, an `AbortSignal` passed through `ModelRequest` to `fetch`. `runTask` is that loop with at most 6 rounds, 100,000 tokens a request and the schema check. `guardedModel` refuses a request that holds a secret, stop reasons turned into typed results, the schema check in code, then the task's own check. A reply off the provider's shape fails as `ModelRequestFailed`, which carries any tokens it spent.
- **Infrastructure:** `anthropicMessages.ts`, `openAiResponses.ts` and `openRouterChat.ts` (the only files that name AI hosts or import AI SDKs), `providerFetch.ts` with `serverSentEvents.ts` beneath them, `modelAccess.ts` (the one file that reads a key), `providerPresets.ts`, `assistSettings.ts` (the switches and model choices in this browser), and a fake model for the fake build.
- **Presentation:** `useAiTask`, the Assistant card for Kuna settings, the first-use consent dialog, and from stage 4 `CitedAnswerView.vue`.

It never imports `src/shared/google`, `src/shared/storage/application`, `src/shared/storage/presentation` or `src/shared/sync`. It has no port that writes.

### What each app owns

| App               | Tasks                                                                           | Read-only tools over its own functions                                                                                                        | Its checks                                                                                                    | Where the draft is written                                 |
| ----------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Company core      | Suggest categories (stage 3). Later a rule from rows, column mapping            | None in stage 3. Later `ruleCoverage` (`src/apps/company/rules/domain/ruleCoverage.ts:65`)                                                    | Slugs and rows from enums, then `proposeRule` and `backtestRuleChange` on confirm as today                    | The review queue's `recategorise`, `ReviewQueue.vue:71-79` |
| Company, hr-doo   | Explain a figure (stage 4), ask the rules (stage 5). Later pay, year-end, files | `rule`, `rules_in_year`, `watch_list`, `local_rate` over `ruleset.ts:50-112` and `localUnits.ts:51`. Later `payScenarios`, `dividendCapacity` | Every cited rule id returned by a tool or sent in the input, every amount equal to one Kuna sent              | Nothing for answers. Later the year-end tab's write        |
| Loans             | Read an offer PDF (stage 6)                                                     | None                                                                                                                                          | The editor's own field errors, and Kuna's EKS from `offerEks` (`effectiveRate.ts:35`) against the printed one | `ScenarioEditor.vue:199-222`                               |
| Investments       | Read a broker statement (stage 6), ask about tax (stage 5)                      | `law_section` over docs/law, split by heading                                                                                                 | The import dry run (`importDryRun.ts:273`) with its questions and commission check (`:176`)                   | `WorkbookImportDialog.vue:71`                              |
| Spending, planned | Read a receipt, in its own plan                                                 | Its own                                                                                                                                       | Its own sum, QR and bank checks                                                                               | Its own                                                    |

Every write above goes through `useRecordWrites`, whose Undo holds when every kind the write touched keeps Undo (`src/shared/storage/application/recordWrites.ts:65`).

### What each app gives the shell

`AppContribution` (`src/shared/app/appContribution.ts:84-122`) gains one optional field. It is a summary for the Assistant card, separate from the task objects, which stay inside the app.

```ts
/** What one task sends, for the Assistant card and the first-use dialog. */
export interface AssistTaskSummary {
  readonly id: `${string}.${string}`
  readonly title: string
  /** What leaves the device, in one plain sentence. */
  readonly sends: string
  /** True for a task that can send employee names or pay, which needs its own switch. */
  readonly employees: boolean
}

export interface AppAssist {
  readonly tasks: readonly AssistTaskSummary[]
}

// AppContribution gains: readonly assist?: AppAssist
```

The pack's tasks reach the company's summary through a new `PackContribution.assist: readonly AssistTaskSummary[]` (`src/apps/company/packs/packContribution.ts:59-79`, `NO_PACK` answers `[]` at `:81`), read through `shownPack(settings)` as the hub part reads `ownerTakeOut`. The pack also publishes `employeeIbans(records): ReadonlySet<string>` and `employeeNames(records): readonly string[]`, read from the records so a shared IBAN and a row listed twice count, so core can keep employee rows out of the review queue's request (stage 3).

### What spending will call

- `useAiTask(task)` from `src/shared/ai/presentation/useAiTask.ts`, which returns the run state and `run(input)`.
- `AiTask<Input, Output>` with an `image` part (base64 JPEG) and a `pdf` part. The browser downscale, `imagePartOf(file)`, lands in `src/shared/ai/presentation/` with the first task that sends a photo, since the size rules follow each provider's image limits.
- `AppAssist` on its `AppContribution`, and `secretsStep(wanted)` in its sync group.

### Boundary spec cases

New cases in `tests/importBoundaries.spec.ts`, written like the existing ones, each landing with the stage that first needs it. The rules "shared imports no app" (`:133-135`), "no app imports another" (`:143-145`) and "core imports no pack code" (`:147-149`) hold as they are.

1. **Only `src/shared/secrets` names the secrets.** `linesHolding(/kuna\.secret|kuna-secrets|kuna-investments-keys-|kuna\.price-vendor-key/, (file) => file.startsWith('src/shared/secrets/'))` is empty. Stage 1.
2. **Only the secrets adapter reaches the hidden folder.** `linesHolding(/\bAPP_DATA_FOLDER\b|tokenFor\('drive\.appdata'/, ...)` is empty outside `src/shared/secrets/`, `src/shared/google/` and `src/shared/storage/infrastructure/fake/`. Stage 1.
3. **Only the AI adapters talk to AI hosts.** `linesHolding(/api\.anthropic\.com|api\.openai\.com|openrouter\.ai|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.groq\.com|localhost:11434|localhost:1234/, ...)` is empty outside `src/shared/ai/infrastructure/`, and `@anthropic-ai/sdk` and `openai` are imported only from there. Stage 2.
4. **The AI module writes nothing.** No file in `src/shared/ai/`, nor any file it loads as it starts, imports `src/shared/google/`, `src/shared/storage/application/`, `src/shared/storage/presentation/` or `src/shared/sync/`. Stage 2.
5. **No model gets the web.** `linesHolding(/web_search|web_fetch|:online\b/, () => false)` is empty in `src`. Stage 2.
6. **Assist code only reads.** No file under an `/assist/` folder imports a target matching `/Writes\.ts$|useRecordWrites|recordWrites|\/mail\/|\/invoicing\/infrastructure\/|src\/shared\/google\//`. Stage 3.
7. **Assist code reaches a model only through the module's door.** No `/assist/` file outside a fake folder imports `src/shared/ai/infrastructure/`. Stage 3.
8. **The cases read real imports.** At least one `/assist/` file imports `src/shared/ai/`, and at least one app file imports `src/shared/secrets/`, like `reads the imports it checks` (`:123-131`). Stage 3.
9. **One file reads docs/law.** `src/apps/investments/tax/infrastructure/lawText.ts` is the only file that imports outside `src`, and only `docs/law/*.md?raw`. The no-dangle check (`:130`) strips `?raw` before it looks for the file. Stage 5.
10. **What a chat can reach.** Its catalogue, tools and reads, the reader contract and every `src/apps/*/assistant/` file load no secrets, no Google, no sync, no store and no app's application or infrastructure code through anything they import, and they import no writes. An app hands its reader the store from its `app.ts`. Chat stage 3.
11. **One key door.** Only `src/shared/ai/infrastructure/modelAccess.ts` in the AI module reads a stored secret, and the same chat code touches no browser storage, cookie or network. Chat stage 3.

## What the owner sees

- **Kuna settings** gets an **Assistant** card beside Sync and Appearance (`src/shell/settings/SettingsScreen.vue:19-22`). One row per provider: its key with Save, Test and Remove, its model picker with the default marked, and **Use this provider**. Under them one switch per installed app that has `assist`, each with its tasks and what they send, and an indented switch for each task that can send employee data, with the warning.
- **An app with its switch off** shows its assist buttons only once a key is kept in this browser. The first tap opens the consent dialog: what this task sends, the provider's retention in one sentence, and **Switch on for Company**.
- **A draft** shows in the screen that would take the same data typed by hand, with a usage line under it, such as "Sonnet 5.5, 812 in, 3,400 from cache, 600 to cache, 1,190 out, about $0.02". A model typed by hand with no known price says "price unknown" there. Nothing is stored until the owner saves there.

The switches, the provider in use and the model per provider are kept per device, like the auto-sync switch (`src/shared/sync/infrastructure/autoSyncSwitch.ts:3-30`). The keys sync through the secrets file. Consent does not travel.

## The rules

### Drafts only

- `runTask` returns a draft or its problems. A screen shows it and the owner saves through the app's own write. Nothing in `src/shared/ai` or under `/assist/` can write (boundary cases 4 and 6).
- A draft never creates a category, a rule, an account or an asset group as a side effect. A suggestion of something new shows as a proposal.

### Masking

`maskIdentifiers` runs inside `runTask` on every text part a task builds, so no task can forget it. An IBAN in upper or lower case, glued to the word IBAN or not, with any run of spaces, no-break spaces or hyphens between its characters, becomes its country code and last four characters (`HR•• ••••1234`) when it has an IBAN's length and passes the mod-97 check, so an invoice number stays readable and a number with a wrong check digit goes as written. An 11-digit OIB standing on its own, or written `123 456 789 01`, becomes `[OIB]`. A PDF or a photo cannot be masked, so a document task says in its `sends` line that the whole document goes. Counterparty names, client names and employee names never appear in a schema's `enum`, since Anthropic caches schemas apart from prompts for up to 24 hours.

### Cited answers and the model's own knowledge

From stage 4 every explanation and question uses one answer shape:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["parts", "ownKnowledge"],
  "properties": {
    "parts": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["text", "sources", "figures"],
        "properties": {
          "text": { "type": "string" },
          "sources": { "type": "array", "items": { "type": "string" } },
          "figures": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "ownKnowledge": { "type": ["string", "null"] }
  }
}
```

- `sources` are rule ids such as `hr.vat.rates` or law anchors such as `capital-gains.md#losses`. Code drops a part whose source was neither sent in the input nor returned by a tool in this run, and marks the answer "Partly unchecked". A part that names no source stays, and marks the answer the same way when Kuna gave sources.
- `figures` are refs Kuna gave each amount, such as `f.0.2`. The screen shows the amount from Kuna's own value with `MoneyText`.
- Code scans each part's text for amounts and rates in the `1.234,56`, `1,234.56` and `1 234,56` forms. A number is an amount with a currency on either side (a symbol, `euro` and its forms, `kn`, or an ISO code in capitals), or with a thousands separator or two decimals unless it reads as a day and a month. It is a rate before `%`, `posto` or `percent`. A bare whole number such as "4300" reads as a count and is not checked. Amounts and rates written in the labels and subtitle Kuna sent count as sent. Any amount that does not equal one Kuna sent or a tool returned flags "Contains a figure Kuna did not compute", with one retry offered. It is never corrected silently.
- `ownKnowledge` is what the model adds from its own knowledge. It shows below the cited parts, in a warning box titled **Not from Kuna's rules**, with no source chips. Its amounts carry the same flag.
- A law answer ends with the oldest day a rule source was checked (`sourcesCheckedSince` in `packs/hr-doo/ruleset/ruleset.ts`), or the day the docs/law file was checked.

### Never

- File or submit anything to Porezna uprava, FINA or a bank.
- Draft, send or reply to mail. The invoice run's `gmail.compose` token (`src/apps/company/invoicing/infrastructure/googleInvoiceDrive.ts:40`) stays out of reach by boundary case 6.
- Search or fetch the web. The adapters send no server tool, the OpenRouter list offers no `:online` model, and no preset lists a search model (boundary case 5).
- Reach a host outside the CSP list, which names each provider (`index.html:7`).

## Stages

Each stage is a commit that leaves Kuna working without any key, checked with `npm run check`, both builds, `check:figures` and the targeted visual and touch checks.

`check:figures` must print the same tree before and after every stage, on `--fake drive`, `--fake browser`, `--fake one-employee`, `--fake five-employees`, `--fake-loans sample`, `--fake-loans house-and-car`, `--fake-loans equal-principal`, `--fake-investments sample` and the live files. No stage touches a function the digest runs (`scripts/figure-digest.mjs`). A suggestion changes a category only when the owner confirms it in the browser.

Visual checks run locally with `npm run check:visual -- --only <pages> --widths 360,640,1024`, and CI runs every width. Touch checks run at 360 and 430 px (`scripts/touch-check.mjs:197`). The fake build answers every AI call from the fake model, picked by `?ai=ok`, `?ai=refused`, `?ai=cut-off` or `?ai=invented-figure`, so no check reaches a real host.

### 1. The shared secrets file

Move, rename, migrate. No model is called yet.

**Files**

| New                                                                                                  | From                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/secrets/domain/secretsFile.ts`                                                           | `prices/domain/keysFile.ts`. `VendorKeyChange` becomes `SecretChange`, `newestKeys` becomes `newestSecrets`, `sameKeys` becomes `sameSecrets`. `keysFileName` (`:24-26`) goes |
| `src/shared/secrets/application/secretsDrive.ts`                                                     | `KeysDrive` (`prices/application/pricesPorts.ts:69-78`), with `files()` in place of `filesNamed`                                                                              |
| `src/shared/secrets/application/secretsSync.ts`                                                      | `prices/application/keysSync.ts`. `deleteKeysFiles` (`:57-62`) goes                                                                                                           |
| `src/shared/secrets/infrastructure/browserSecrets.ts`                                                | `prices/infrastructure/vendorKeys.ts`, plus `moveBrowserSecrets`                                                                                                              |
| `src/shared/secrets/infrastructure/googleSecretsDrive.ts`                                            | `prices/infrastructure/googleKeysDrive.ts`                                                                                                                                    |
| `src/shared/secrets/infrastructure/fake/fakeSecrets.ts`, `fakeSecretsDrive.ts`, `seedFakeSecrets.ts` | `prices/infrastructure/fake/fakeKeys.ts`, `fakeKeysDrive.ts`, and the seeding at `seedFakeInvestments.ts:52-54`                                                               |
| `src/shared/secrets/presentation/pageSecrets.ts`                                                     | `prices/presentation/useKeysSync.ts`: `PAGE_SECRET_STORE`, `useSecretsChanged`, which the AI module reads without reaching the Google adapter                                 |
| `src/shared/secrets/presentation/secretsStep.ts`                                                     | `prices/presentation/useKeysSync.ts`: `pageSecretsDrive`, `secretsStep(wanted)`, `secretsNeeds(wanted)`, and the new `deleteKeysFromGoogle`                                   |
| `src/shared/secrets/presentation/useSecretRows.ts`                                                   | `prices/presentation/useVendorKeys.ts`, over any `{ id, needsKey }` instead of `PriceVendor`                                                                                  |
| `src/shared/secrets/presentation/words.ts`                                                           | `keysStep` and `keysRefused` from `prices/presentation/words.ts:148-158` and `:318-328`                                                                                       |

`prices/` above means `src/apps/investments/prices/`. Each old file is deleted in the same commit, with its tests moved.

**The file.** `kuna-secrets.json`, one per Google account in the hidden folder, holding `{ "format": "kuna-secrets", "version": 1, "secrets": { "<id>": { "key", "changed_at" } } }`. The ids carry over as they are: `twelvedata`, `alphavantage`, `finnhub` today, and `anthropic`, `openai`, `openrouter` from stage 2. The decoder also reads the old `kuna-vendor-keys` version 1 (`keysFile.ts:14-15`), whose entries have the same shape under `keys`. That reader stays only as long as old files may exist.

**The sync.** `syncSecrets(ports)` replaces `syncVendorKeys(ports, investmentsFileId)` (`keysSync.ts:27`):

1. List the hidden folder once. Take the `kuna-secrets.json` whose id sorts first, and every other file: a second `kuna-secrets.json` and each `kuna-investments-keys-*.json`. The old name holds an Investments file id the sync no longer knows, so it lists instead of asking by name.
2. Decode every file. If any is refused (`not-keys` or `newer`), stop: write nothing, delete nothing, and say so, as today (`keysSync.ts:33-35`). The `not-keys` message points to Delete my keys from the Google account in Kuna settings.
3. Merge all files and this browser's secrets, the newest change of each id winning, a removal as much as a save (`keysFile.ts:72-81`). There is no list of known ids any more. Every id in the file or in this browser syncs.
4. Write `kuna-secrets.json` when the merge differs from it, or create it.
5. Only after that write resolved, delete every other file. A failed delete leaves the file to fold again on the next sync, which changes nothing.
6. Read this browser again and keep the newer changes, as today (`keysSync.ts:47-53`).

A stale Kuna tab in another browser may make an old file again from its own keys. The next sync folds it in by the same rule.

**This browser.** `kuna.price-vendor-key.<id>` becomes `kuna.secret.<id>` and `kuna.price-vendor-key-changed.<id>` becomes `kuna.secret-changed.<id>`. `moveBrowserSecrets()` runs once from `src/main.ts` before the apps install (`:20-22`): each old pair moves unless the new pair holds a newer time, then the old pair is removed. Denied storage leaves everything as it is. `kuna.price-vendor-usage.*` are request counts, not secrets, and stay.

**The step.** `secretsStep(wanted)` is a `SyncStep` with id `secrets` and the label Keys. It is on when `wanted()` holds or this browser holds any secret change. It remembers the run it served, by the run's `startedAt` (`src/shared/sync/application/syncRun.ts:52`), so when several groups list it, only the first touches Drive and the others say "Up to date". Its refusal links to Kuna settings, not the Prices tab.

**One file for every app.** Any app's file on Drive turns the step on, so a key saved beside a browser-kept Investments file also goes to the secrets file. The Prices card and the Assistant card word their subtitles by whether any app's file is on Drive, through `PageSync.someOnDrive`.

**Delete my keys from the Google account.** A card in Kuna settings, shown with or without a file on Drive. After a confirmation it deletes the secrets file and every old keys file, read or not, and leaves this browser's keys alone. It is the way out of a refused file, and the way to clear a key once the last file has left Drive, where no sync runs. While a file is on Drive, the next sync of any browser holding keys saves them again, which the confirmation says.

**Changed**

- `src/apps/investments/sync/presentation/investmentsSyncGroup.ts:14-16`: `secretsStep(...)` and `secretsNeeds(...)` in place of `KEYS_STEP` and `keysNeeds`, wanted when an instrument is priced by a vendor that needs a key, as `keysToSync` reads it today (`useKeysSync.ts:45-50`).
- Every reader of `storedVendorKey` reads `storedSecret`: `PricesStatus.vue:6`, `useSymbolSearch.ts:3`, `useCloseLookup.ts:3`, `usePrices.ts:11`, `useSplitLookup.ts:3`, `HoldingScreen.vue:25`, `CompareWith.vue:16`. `PriceVendorsCard.vue:16-27` takes `PAGE_SECRET_STORE`, `useSecretsChanged` and `useSecretRows`.
- **Remove the Investments file keeps the keys.** `src/apps/investments/settings/application/fileRemoval.ts` loses the `keys` step: `RemovalStep` (`:10`), `deleteKeysFiles` (`:22-23`), the order (`:53`), its run (`:77`) and the comments that name it (`:5-9`, `:46-50`). `useFileRemoval.ts:3-17` loses the port, and `:41` asks for `drive.file` alone. In `src/apps/investments/settings/presentation/words.ts`, the keys lines (`:27`, `:47`, `:133`, `:153`) go and the list of what stays (`:36`, `:39`) names the keys in the Google account.
- `src/shared/google/words.ts:16`, `:37`: the `drive.appdata` refusal says "your keys", not "the price keys".
- `src/apps/investments/workbook/infrastructure/fake/seedFakeInvestments.ts:17-18`, `:52-54`: `?keys=other-browser` and `?keys=removed` seed `kuna-secrets.json` through `seedFakeSecrets`, and a new `?keys=legacy` seeds `kuna-investments-keys-<file id>.json` with the made-up Twelve Data key.

**Specs**

- `tests/secretsSync.spec.ts`, from `tests/keysSync.spec.ts`: the existing cases on the new name, plus an old file folded in and deleted after the write, an old file and the new one disagreeing with the newest change winning per id, a refused old file stopping the sync with nothing written or deleted, a second `kuna-secrets.json` folded in and deleted, a removal in the old file outdating an older key here, and price and AI ids syncing together.
- `tests/googleSecretsDrive.spec.ts`, from `tests/googleKeysDrive.spec.ts`, with `files()` listing the hidden folder.
- `tests/secretsStep.spec.ts`, from `tests/keysStep.spec.ts`: two groups in one run reach Drive once.
- `tests/browserSecrets.spec.ts`, from `tests/priceBrowserPorts.spec.ts` and `tests/pricesCardKeys.spec.ts`: the new names, and `moveBrowserSecrets` moving an old pair, keeping a newer new pair, removing the old one, and doing nothing when storage is denied.
- `tests/fileRemoval.spec.ts`, `tests/fileRemovalDrive.spec.ts`: no keys step, and `kuna-secrets.json` still in the folder after Remove.
- Boundary cases 1 and 2.

**Checks.** `check:figures` identical, since no figure code moves.

**Visual.** The Prices tab pages (`scripts/visual-check.mjs:2993-3035`) keep their names with the new browser keys. New `investments-prices-legacy-keys` on `?investments=sample&keys=legacy` shows the key the old file held. At 360, 640 and 1024 px.

**Touch.** `investments-key-synced` and `investments-key-removed` (`scripts/touch-check.mjs:2702-2703`) keep their steps with the new names. `investments-remove-drive` and its Croatian twin (`:2722-2723`) also find `kuna-secrets.json` in the fake hidden folder after Remove. New `investments-key-legacy` on `drive&investments=sample&keys=legacy`: open, let the sync run, the Prices tab shows the key's last four characters, and the hidden folder holds only `kuna-secrets.json`. The browser keys in `scripts/support/editorFlows.mjs` (`:3655-3837`, `:3928-4137`, `:5778-5885`), `scripts/visual-check.mjs` and `scripts/touch-check.mjs:2200-2215` take the new names.

**New strings**

| English                                                                                              | Croatian                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Access to the app's hidden folder on Drive was not allowed, so your keys stay in this browser alone. | Pristup skrivenoj mapi aplikacije na Driveu nije dopušten, pa vaši ključevi ostaju samo u ovom pregledniku. |
| Your keys in your Google account, which every Kuna app uses.                                         | Vaši ključevi na Google računu, koje koriste sve aplikacije Kune.                                           |
| Delete my keys from the Google account                                                               | Obriši moje ključeve s Google računa                                                                        |

**Cost.** None. No model is called.

### 2. The AI module, the two adapters, the model picker and the settings

**Files**

- New `src/shared/ai/domain/aiTask.ts`. A sketch of the shape, not final code:

```ts
/** One job an app gives the model, built from its own data, with the schema of what comes back. */
export interface AiTask<Input, Output> {
  readonly id: `${string}.${string}`
  readonly app: string
  readonly employees: boolean
  readonly effort: 'low' | 'medium' | 'high'
  system(): readonly AiTextPart[]
  input(input: Input): readonly AiPart[]
  readonly output: StrictSchema
  readonly tools: readonly AiTool[]
  check(output: unknown, run: ToolLog): Checked<Output>
}

export type AiPart = AiTextPart | { readonly kind: 'pdf'; readonly base64: string; readonly name: string } | { readonly kind: 'image'; readonly base64: string; readonly mediaType: 'image/jpeg' }

export type TaskResult<Output> =
  | { readonly kind: 'draft'; readonly draft: Output; readonly problems: readonly string[]; readonly usage: AiUsage }
  | { readonly kind: 'refused' | 'cut-off' | 'too-long' | 'failed'; readonly reason: string; readonly usage: AiUsage | null }
  | { readonly kind: 'switched-off' | 'no-key' | 'no-pdf' }
```

- New `src/shared/ai/domain/maskIdentifiers.ts`.
- New `src/shared/ai/application/runTask.ts` and `modelPort.ts`.
- New `src/shared/ai/infrastructure/anthropicMessages.ts`: `POST /v1/messages` with `anthropic-dangerous-direct-browser-access: true`, `output_config.format` with the schema, strict tools, `tool_choice` `auto` (forced choice returns a 400 on Sonnet 5.5 and Opus 5.5), the task's `effort`, no `temperature`, a `document` block for a PDF, `cache_control` on the system prompt. `stop_reason` is checked before any parse.
- New `src/shared/ai/infrastructure/openRouterChat.ts`, for OpenRouter only since the chat plan's first stage: `POST {baseUrl}/chat/completions`, `response_format` json_schema strict for a task without tools, and for a task with tools a final `answer` function whose strict parameters are the output schema, since whether `response_format` combines with `tools` is not documented. Arguments arrive as a JSON string and are checked in code. `finish_reason` is checked before any parse.
- New `src/shared/ai/infrastructure/providerPresets.ts`:

| Provider   | Adapter          | Models, price in / out per million tokens                                                                             | Default                       | PDF              |
| ---------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------- |
| Anthropic  | Messages         | `claude-haiku-5-5` $0.10 / $0.50, `claude-sonnet-5-5` $2 / $10, `claude-opus-5-5` $4 / $20                            | `claude-sonnet-5-5`           | `document` block |
| OpenAI     | Responses        | `gpt-6-luna` $0.10 / $0.50, `gpt-6.1-terra` $1 / $5, `gpt-6.1-sol` $2 / $10, `gpt-6-astra` $10 / $50                  | `gpt-6.1-sol`                 | `file` parts     |
| OpenRouter | Chat Completions | `anthropic/claude-sonnet-5-5`, `anthropic/claude-haiku-5-5`, `openai/gpt-6.1-sol`, at the underlying provider's price | `anthropic/claude-sonnet-5-5` | not offered      |

Each preset also holds its base URL, its key test and its retention sentence. OpenRouter's also sends `provider: { require_parameters: true }`, so a strict request goes only to endpoints that honour it. Haiku 5.5's price rises to $0.50 / $2.50 above 100,000 prompt tokens, which the run cap keeps below.

- New `src/shared/ai/infrastructure/assistSettings.ts`: `kuna.assist.<app>` and `kuna.assist-task.<task id>` switches, `kuna.assist-provider`, `kuna.assist-model.<provider>`, all off or default when absent or denied.
- New `src/shared/ai/infrastructure/fake/fakeModel.ts`: answers by task id from what the apps' fake seeds register, by the `?ai=` variant.
- New `src/shared/ai/presentation/useAiTask.ts`: reads the provider in use, its model and its key (`storedSecret`), returns `switched-off` or `no-key` without a request, builds the `ModelPort` (the fake one in the fake build, inline as `pageKeysDrive` does at `useKeysSync.ts:58-65`), and runs the task. A reset, a new run and leaving the screen abort the run under way and drop its result, a run stops after five minutes, and anything thrown ends as a `failed` result.
- New `src/shared/ai/presentation/AiAssistCard.vue`, `AssistConsent.vue`, `words.ts`. The card takes the apps as a prop, since shared code cannot import the shell.
- Changed `src/shared/app/appContribution.ts:84-122`: `assist?: AppAssist`.
- Changed `src/shell/settings/SettingsScreen.vue:11-22`: the card with `installedApps()` that have `assist` (`src/shell/routing/appRegistry.ts:11`), and whether some file is on Drive as a prop, since the AI module may not import the sync. It shows with or without a file on Drive. `src/shell/settings/words.ts`: the description names the assistant.
- Changed `index.html:7`: `connect-src` adds `https://api.anthropic.com https://api.openai.com https://openrouter.ai`. The dev policy widens this one (`scripts/devContentSecurityPolicy.ts:8-10`), so it needs no change.
- Dependencies: `@anthropic-ai/sdk` and `openai`, both with `dangerouslyAllowBrowser`, loaded in the lazy chunk of the first task. Their typed errors and retries on 429 and 5xx are why. The chunk sizes are measured in this stage, and if they are out of line, the adapters use `fetch` instead.

**Key test.** Anthropic: `POST /v1/messages/count_tokens` on a one-word message, which is free. OpenAI and OpenRouter: `GET {baseUrl}/models`. A test sends no data from the books.

**Specs**

- `tests/anthropicMessages.spec.ts`: the request body (browser header, schema, strict tools, `tool_choice` `auto`, no `temperature`, no server tool), and each reply (`end_turn`, `tool_use`, `refusal` with its explanation, `max_tokens`) mapped to its result.
- `tests/openRouterChat.spec.ts`: `response_format` without tools, the `answer` function with tools, `tool_calls` parsed and checked, `length` and `content_filter`.
- `tests/runTask.spec.ts`: every built text part masked and a PDF part untouched, the tool round cap, the cap on one request stopping before 100,000 tokens, a reply off the schema giving problems, `switched-off` and `no-key` sending nothing.
- `tests/maskIdentifiers.spec.ts`: a Croatian IBAN with and without spaces, a German one, an OIB alone and inside a reference, an amount with separators left alone.
- `tests/providerPresets.spec.ts`: every preset's origin in `connect-src`, as `tests/priceFetch.spec.ts:648-654` does for the price vendors, each default in its own list, and provider ids apart from the price vendor ids.
- `tests/assistSettings.spec.ts`: off by default, on per app, a choice that holds for the visit when storage is denied.
- Boundary cases 3, 4 and 5.

**Checks.** `check:figures` identical. `npm run build` reports the new chunk sizes, which go in the commit message.

**Visual.** `kuna-settings` and `kuna-settings-croatian` (`scripts/visual-check.mjs:1086-1097`) show the card with no key. New `kuna-settings-assist` with a made-up Anthropic key kept, `kuna-settings-assist-croatian`, and `kuna-settings-assist-on` with Company switched on. At 360, 640 and 1024 px.

**Touch.** New `assist-key`: open Kuna settings, type a made-up key, Save, its last four characters show, Test says it works (fake model), pick Opus 5.5, Remove. New `assist-switch`: switch Company on, reload, still on. Every switch and button is at least 44 px tall.

**New strings**

| English                                                                                                     | Croatian                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Assistant                                                                                                   | Asistent                                                                                                                       |
| Your own AI key, the model it runs and the apps that may use it. Each app stays off until you switch it on. | Vaš AI ključ, model koji pokreće i aplikacije koje ga smiju koristiti. Svaka aplikacija ostaje isključena dok je ne uključite. |
| Key for {provider}                                                                                          | Ključ za {provider}                                                                                                            |
| Model                                                                                                       | Model                                                                                                                          |
| {model} (default)                                                                                           | {model} (zadano)                                                                                                               |
| Use this provider                                                                                           | Koristi ovog pružatelja                                                                                                        |
| Switch on for {app}                                                                                         | Uključi za {app}                                                                                                               |
| What leaves this device: {sends}                                                                            | Što napušta ovaj uređaj: {sends}                                                                                               |
| Anthropic deletes what Kuna sends within 30 days and does not train on it.                                  | Anthropic briše ono što Kuna pošalje u roku od 30 dana i ne uči na tome.                                                       |
| OpenAI keeps what Kuna sends up to 30 days for abuse checks and does not train on it.                       | OpenAI čuva ono što Kuna pošalje do 30 dana radi provjera zlouporabe i ne uči na tome.                                         |
| OpenRouter keeps nothing by default, and the model's own provider keeps what its terms say.                 | OpenRouter prema zadanim postavkama ništa ne čuva, a pružatelj modela čuva ono što kažu njegovi uvjeti.                        |
| Add a key in Kuna settings to use the assistant.                                                            | Dodajte ključ u postavkama Kune da biste koristili asistenta.                                                                  |
| The key works.                                                                                              | Ključ radi.                                                                                                                    |
| {provider} refused the key.                                                                                 | {provider} je odbio ključ.                                                                                                     |
| {model}, {in} in, {out} out, about {cost}                                                                   | {model}, {in} ulaznih i {out} izlaznih tokena, oko {cost}                                                                      |
| The model declined this request: {reason}                                                                   | Model je odbio ovaj zahtjev: {reason}                                                                                          |
| The answer was cut off. Try again, or pick a larger model.                                                  | Odgovor je prekinut. Pokušajte ponovno ili odaberite veći model.                                                               |
| This would send more than {count} tokens, so Kuna stopped.                                                  | Ovo bi poslalo više od {count} tokena, pa je Kuna stala.                                                                       |

**Cost.** The Anthropic key test is free, and so is a models list on OpenAI.

### 3. Company: suggest categories for the review queue

**Files**

- New `src/apps/company/assist/application/suggestCategories.ts`, task `company.suggest-categories`, effort `low`:
  - **Input**, one request for the whole queue, at most 50 rows: each row as a ref (`r1`, `r2` and so on), the counterparty folded with `foldRuleText` (`src/shared/text/fold.ts:15`), the description, the amount with its sign, the account's name and the month. The counterparty IBAN is never sent. Then the categories: slug, name, family, bucket and roles (`src/apps/company/workbook/domain/workbook.ts:23-35`).
  - **Output:** `{ suggestions: [{ row, category, confidence, why }] }`, with `row` an enum of the refs, `category` an enum of the defined slugs, and `confidence` one of `high`, `medium`, `low`.
  - **Check:** drop a suggestion for an unknown ref or slug, for an unclassified bucket, or for one side of a credit and debit pair that the row's sign contradicts (the pair roles at `src/apps/company/rules/domain/proposeRule.ts:10`).
  - **Employees:** a row stays out unless the task's employee switch is on when its counterparty IBAN is in the pack's `employeeIbans(records)`, or its folded counterparty and description hold every word of a name in `employeeNames(records)`. When that leaves nothing to send, Suggest categories sends no request and the queue says the switch holds the rows back.
- Changed `src/apps/company/packs/packContribution.ts`: `PackContribution` (`:59-79`) gains `assist`, `employeeIbans` and `employeeNames`, `NO_PACK` (`:81`) answers `[]`, an empty set and `[]`. `packs/hr-doo/hrDooPack.ts` answers from the pack's employees.
- Changed `src/apps/company/transactions/presentation/ReviewQueue.vue`: a **Suggest categories** button on the queue card (`:112-139`). Suggestions are kept by row id for this page only. Each `ReviewQueueItem` gets its suggestion.
- Changed `src/apps/company/transactions/presentation/ReviewQueueItem.vue`: under the rules' verdict (`:96-104`) the line "Suggested: Software, likely" with its reason, and a **Use Software** button that emits `recategorise` (`:36-37`). The queue's `recategorise` (`ReviewQueue.vue:71-79`) writes it through `fileRows` with Undo and offers Make rule, which runs `draftForRow` (`src/apps/company/rules/domain/ruleDraft.ts:96`) as today. The row takes the owner's review label (`src/apps/company/transactions/domain/verdictChanges.ts:36-38`), so nothing new is stored.
- Changed `src/apps/company/transactions/presentation/words.ts:102`, `:298`: the badge for rows no rule decided reads "No rule" and "Bez pravila", not "AI guess", since a real suggestion now exists beside it (`ReviewQueueItem.vue:53`).
- Changed `src/apps/company/app.ts`: `assist` lists the core task and the pack's. The company sync group lists `secretsStep(...)`, wanted while Company's switch is on.
- New `src/apps/company/assist/infrastructure/fake/fakeSuggestions.ts`, registered from the company fake seed.

**Specs**

- `tests/suggestCategories.spec.ts`: the input folds the counterparty, masks an IBAN and an OIB in a description, sends no counterparty IBAN, and leaves employee rows out until the switch is on. The enums hold the queue's refs and the defined slugs. The check drops an unknown slug, an unknown ref and a contradicted pair side.
- `tests/reviewQueueSuggestion.spec.ts`: Use writes the same verdict as picking the category by hand, `flaggedBy` the review label.
- Boundary cases 6, 7 and 8.

**Checks.** `check:figures` identical. Before the stage ships, the owner runs it once on the live queue, and the usage line gives the real token counts for the cost note.

**Visual.** `review-suggested` and `review-suggested-croatian` on the default fake with `?ai=ok`, after a tap on Suggest categories. `review-suggest-refused` on `?ai=refused`. `review-employee-switch` with the employee switch line. At 360, 640 and 1024 px.

**Touch.** New `review-suggest`: tap Suggest categories, the consent dialog opens, Switch on for Company, the suggestions show, tap Use on the first row, the row leaves the queue, Undo brings it back, then Make rule opens the rule editor with the row's IBAN condition.

**New strings**

| English                                                                                                                                        | Croatian                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Suggest categories                                                                                                                             | Predloži kategorije                                                                                                              |
| Suggested: {category}, {confidence}                                                                                                            | Prijedlog: {category}, {confidence}                                                                                              |
| sure / likely / unsure                                                                                                                         | sigurno / vjerojatno / nesigurno                                                                                                 |
| Use {category}                                                                                                                                 | Koristi {category}                                                                                                               |
| No suggestion for {count} row(s)                                                                                                               | Nema prijedloga za {count} redak (retka, redaka), through the plural helper                                                      |
| No rule                                                                                                                                        | Bez pravila                                                                                                                      |
| Counterparty names, descriptions, amounts, months and accounts of the rows waiting for review, and your categories. IBANs and OIBs are masked. | Nazive protustrana, opise, iznose, mjesece i račune redaka koji čekaju pregled te vaše kategorije. IBAN-ovi i OIB-i su skriveni. |
| Include rows that name employees                                                                                                               | Uključi retke koji navode zaposlenike                                                                                            |
| This sends their names and the amounts paid to {provider}.                                                                                     | Ovo šalje njihova imena i isplaćene iznose pružatelju {provider}.                                                                |

**Cost.** Thirty rows are about 4,800 tokens in and 1,200 out: about 2.2 US cents on Sonnet 5.5 or `gpt-6.1-sol`, 0.1 cent on Haiku 5.5 or `gpt-6-luna`, 4.3 cents on Opus 5.5.

### 4. Company: explain a figure from its TracedFigure

**Files**

- New `src/shared/ai/domain/citedAnswer.ts`: the answer schema and `checkCitedAnswer`, as under the rules.
- New `src/shared/ai/presentation/CitedAnswerView.vue`: the parts, a chip per source through a `sourceLink` the app passes, the figures through `MoneyText`, the own-knowledge box, the flags and the usage line.
- New `packs/hr-doo/assist/application/explainFigure.ts`, task `hr-doo.explain-figure`, effort `medium`, no tools:
  - **Input:** the `TracedFigure` tree (`packs/hr-doo/ruleset/tracedFigure.ts:12-23`) with a ref per node (`f`, `f.0`, `f.0.2`), each label, day, amount and basis. Steps for one ledger row or advance stay home, since their labels name the other side of the payment, and so do planned revenue steps built from a client or item name, marked where they are made with a symbol key that the figure digest does not read. The tree goes down only as many whole levels as fit in 300 steps. A forecast's cash runs to thousands of steps, about 200,000 tokens uncut. A step that lost steps carries `stepsLeftOut`. For each `RuleCitation` (`packs/hr-doo/ruleset/schema.ts:183-189`) the version's terms through `versionOn` (`ruleset.ts:61`), its sources and its confidence. Then `RULESET_CHECKED_ON`. The ledger rows behind `drill` are never sent.
  - **Check:** `checkCitedAnswer`, where the sources Kuna sent are the cited rule ids and the amounts are the tree's.
- Changed `packs/hr-doo/presentation/tracedFigureView.ts`: `FigureDetail` (`:52-61`) gains `figure: TracedFigure` and `employees: boolean`, set by `figureDetail` (`:96-106`). The calls in `packs/hr-doo/presentation/salaries/salariesView.ts` (`:375`, `:406`, `:437`, `:453`, `:460`) pass `employees: true`.
- Changed `packs/hr-doo/presentation/FigureDialog.vue`: an **Explain** button under the rules (`:31-44`) and `CitedAnswerView` below, its chips linking with `ruleLink` (`packs/hr-doo/ruleset/presentation/taxRuleLinks.ts:9`). A figure with `employees` asks for the task's employee switch first.
- Changed `packs/hr-doo/hrDooPack.ts`: `assist` lists the task.

**Specs**

- `tests/explainFigure.spec.ts`: on the `steadyStudio` fixture (`tests/dividendCapacity.spec.ts:28-30`), the input carries every step's amount with its ref and every cited rule's terms, and no ledger row. A salary figure is refused while its switch is off.
- `tests/citedAnswer.spec.ts`: a source not sent drops its part, €4,224.00 equal to a ref passes in both number forms, €4,300.00 flags, 12% passes when a sent term holds 1,200 basis points, and own knowledge stays apart with its amounts flagged.

**Checks.** `check:figures` identical, since the figure is computed as before and only read.

**Visual.** `pay-figure-explained` and its Croatian twin on Year's Pay tab with a figure's dialog open and `?ai=ok`. `pay-figure-explain-stray` on `?ai=invented-figure` with the flag. `salary-figure-explain-asks` with the employee warning. At 360, 640 and 1024 px, where the dialog becomes a bottom sheet at 360.

**Touch.** New `figure-explain`: open a pay figure's dialog, tap Explain, the answer shows, tap a rule chip, land on the tax rules tab with `rule=` in the address, then Back.

**New strings**

| English                                                                             | Croatian                                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Explain                                                                             | Objasni                                                                                       |
| Not from Kuna's rules                                                               | Nije iz Kuninih pravila                                                                       |
| The model added this from its own knowledge. Kuna did not check it.                 | Model je ovo dodao iz vlastitog znanja. Kuna to nije provjerila.                              |
| Contains a figure Kuna did not compute                                              | Sadrži iznos koji Kuna nije izračunala                                                        |
| Partly unchecked: the model named a source it was not given, or none at all         | Djelomično neprovjereno: model je naveo izvor koji nije dobio ili nije naveo nijedan          |
| Try again                                                                           | Pokušaj ponovno                                                                               |
| Rules checked on {day}                                                              | Pravila provjerena {day}                                                                      |
| The figure's build-up, its amounts and the rules it rests on                        | Razradu iznosa, njegove iznose i pravila na kojima počiva                                     |
| This figure names employees. Explaining it sends their names and pay to {provider}. | Ovaj iznos navodi zaposlenike. Objašnjenje šalje njihova imena i plaće pružatelju {provider}. |

**Cost.** About 6,000 tokens in and 1,500 out: 2.7 US cents on Sonnet 5.5, 0.14 cents on Haiku 5.5, 5.4 cents on Opus 5.5. The largest figures, cut at 300 steps, are about 15,000 tokens in, about 4.5 cents on Sonnet 5.5.

### 5. Questions with tools over the ruleset index and docs/law

Two tasks, one per app, since the ruleset is the pack's and docs/law is Investments'. Both use `runTask`'s tool loop and the cited answer from stage 4. The index sits in a cached system prompt, and each tool call returns one rule version or one section.

**Company: ask the rules**

- New `packs/hr-doo/assist/application/askRules.ts`, task `hr-doo.ask-rules`, effort `medium`. The system prompt, cached with `cache_control` on Anthropic: what the ruleset is, the index of every rule (id, area, title through `ruleTitle`, `packs/hr-doo/ruleset/presentation/ruleTitles.ts:102`), the areas (`schema.ts:122`) and `sourcesCheckedSince()`. Measured at about 7,800 characters in the research, so about 2,500 to 3,500 tokens.
- New `packs/hr-doo/assist/application/ruleTools.ts`:

| Tool                        | Calls                                                                         | Returns                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `rule(id, on)`              | `versionOn` and `citationOf` (`ruleset.ts:61`, `:82`)                         | The version in force on the day, its terms, sources and confidence            |
| `rules_in_year(year, area)` | `rulesFor` (`ruleset.ts:93`)                                                  | Ids and titles in force that year                                             |
| `watch_list()`              | `watchItems` (`ruleset.ts:112`)                                               | Estimated, pending and unconfirmed versions and open items                    |
| `local_rate(place, on)`     | `findLocalUnit` (`packs/hr-doo/ruleset/localUnits.ts:51`) and the local rates | One city's or municipality's two rates, never the table of 760,000 characters |

A year the ruleset does not reach is refused by `rulesFor` itself, and the refusal goes back to the model as a tool error.

- Changed `packs/hr-doo/ruleset/presentation/RulesetPanel.vue`: an **Ask about the rules** box above the rule table, with `CitedAnswerView` under it.

**Investments: ask about tax**

- New `src/apps/investments/tax/domain/lawSections.ts`: `anchorOf` and the fence skipping move here from `tests/lawDocs.spec.ts:22-50`, and `sectionsOf(file, markdown)` splits a file by heading. The test imports them, so one function computes anchors.
- New `src/apps/investments/tax/infrastructure/lawText.ts`: one dynamic `import('…/docs/law/<file>.md?raw')` per file, loaded only when the first question runs. docs/law is not in the bundle today.
- New `src/apps/investments/assist/application/askTaxLaw.ts`, task `investments.ask-tax-law`, effort `medium`. The cached system prompt holds the section index (file, heading, anchor) and the `TAX_RULES` keys with their marks (`src/apps/investments/tax/domain/taxRules.ts:16-52`). One tool, `law_section(anchor)`, returns one section by `file.md#anchor`.
- Changed: the Tax screen gets an **Ask about tax** box. A source chip names the file and heading, without a link, since no screen shows docs/law today.

**Both**

- Changed `tests/importBoundaries.spec.ts`: boundary case 9, and `resolvedFile` (`:50-54`) strips `?raw`.

**Specs**

- `tests/ruleTools.spec.ts`: each tool on a fixed day returns one version with its sources, `local_rate` returns two rates for a known place and a tool error for an unknown one, and every answer's source ids are real rule ids.
- `tests/askRules.spec.ts`: a cited rule the tools never returned drops its part, a rate from a returned rule passes, and own knowledge shows apart.
- `tests/lawSections.spec.ts`: every `TAX_RULES` anchor is a section `sectionsOf` finds, and `tests/lawDocs.spec.ts` passes on the moved functions.
- `tests/runTask.spec.ts` gains tool loop cases: results of one turn go back in one message, the sixth round stops, and the cap on one request stops a loop before 100,000 tokens.
- Boundary case 9.

**Checks.** `check:figures` identical. Before this stage ships, the real prompts are counted once with the free `count_tokens` endpoint, and the counts replace the estimates here.

**Visual.** `company-rules-answer` and its Croatian twin on the tax rules tab with `?ai=ok`. `company-rules-answer-own` with the own-knowledge box. `investments-tax-answer` and its Croatian twin. At 360, 640 and 1024 px.

**Touch.** New `rules-ask`: type a question, tap Ask, the answer shows with a chip, tap the chip, land on that rule. New `tax-ask`: the same on the Tax screen, the chip names the section.

**New strings**

| English                                                                          | Croatian                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Ask about the rules                                                              | Pitajte o pravilima                                                       |
| Ask about tax                                                                    | Pitajte o porezu                                                          |
| Ask                                                                              | Pitaj                                                                     |
| Your question, and the rules the model looks up. Nothing from your books.        | Vaše pitanje i pravila koja model potraži. Ništa iz vaših knjiga.         |
| Your question, and the law sections the model looks up. Nothing from your books. | Vaše pitanje i odjeljci zakona koje model potraži. Ništa iz vaših knjiga. |
| Kuna's rules do not cover this.                                                  | Kunina pravila ovo ne pokrivaju.                                          |
| Law checked on {day}                                                             | Zakon provjeren {day}                                                     |

**Cost.** Three tool turns are about 25,000 tokens in and 2,000 out: 5 to 7 US cents on Sonnet 5.5 depending on cache hits, about a third of a cent on Haiku 5.5, 10 to 14 cents on Opus 5.5. A follow-up within five minutes reads the index from the cache.

### 6. Documents: a loan offer in Loans, a broker statement in Investments

Both send a whole PDF, which cannot be masked. Both run only on a provider whose preset reads PDFs, and say so otherwise. Kuna refuses a file over 10 MB.

**Loans: read an offer PDF**

- New `src/apps/loans/assist/application/readOffer.ts`, task `loans.read-offer`, effort `medium`. Input: the PDF and the fields of `OfferTexts` (`src/apps/loans/scenarios/presentation/OfferTermsFields.vue:24-44`) with what each means. Output: each field as a plain number or an ISO date, or null when the offer does not print it, plus the printed EKS.
- Check: the draft maps to `OfferTexts` in the screen's own number format, and the editor's own errors show as they would for typed fields (`typedOffer`, imported at `ScenarioEditor.vue:25`). Kuna's EKS from `offerEks` (`src/apps/loans/scenarios/domain/effectiveRate.ts:35`) is compared with the printed one, and a difference over 0.10 percentage points shows a line.
- Changed `src/apps/loans/scenarios/presentation/ScenarioEditor.vue`: a **Read an offer PDF** button for a new offer. The draft fills `offer`, and the owner checks it and taps Save (`:199-222`), which writes through `useRecordWrites` with Undo.
- Changed `src/apps/loans/app.ts`: `assist`, and `secretsStep(...)` in the Loans sync group.

**Investments: read a broker statement**

- New `src/apps/investments/assist/application/readStatement.ts`, task `investments.read-statement`, effort `medium`. Output: rows with the columns of `WORKBOOK_COLUMNS` (`src/apps/investments/imports/domain/portfolioWorkbook.ts:50-74`), `type` an enum of `WORKBOOK_TYPES` (`:21`), and Source file set to the PDF's name.
- Check: the rows become a `WorkbookTab` named Transactions with its header row (`:15-18`) and go through `readPortfolioWorkbook` (`:175`), then the dry run with its questions, skipped rows, rounded cells and commission check (`src/apps/investments/imports/domain/importDryRun.ts:176`, `:273`). A statement too long for one answer comes back cut off, and the screen asks to split it by year.
- Changed `src/apps/investments/imports/presentation/useWorkbookImport.ts`: `load(name, bytes)` (`:181-`) takes a function that gives the reading, so the file and the PDF go the same way into the dry run.
- Changed `src/apps/investments/imports/presentation/ImportFileStep.vue`: **Read a broker statement (PDF)** beside the workbook picker.
- Changed `src/apps/investments/app.ts`: `assist`.

**Specs**

- `tests/readOffer.spec.ts`: a made-up draft maps to `OfferTexts`, a missing first instalment is left blank, an EKS 0.4 points off shows the line, and one 0.05 off does not.
- `tests/readStatement.spec.ts`: made-up rows reach the dry run as a workbook file's would, an unknown `type` is refused by the schema, and a commission that does not add up is the dry run's existing question.
- `tests/runTask.spec.ts`: a `pdf` part on a provider without PDFs returns `no-pdf` and sends nothing.

**Checks.** `check:figures` identical, since a draft is only saved by the owner in the browser.

**Visual.** `loans-offer-read` and its Croatian twin with the editor filled from `?ai=ok`. `loans-offer-read-eks` with the EKS line. `investments-import-statement` with the dry run from a read statement. `investments-import-statement-no-pdf` on an OpenRouter choice. At 360, 640 and 1024 px.

**Touch.** New `offer-read`: pick a made-up PDF in the editor, the fields fill, change one, Save, Undo. New `statement-read`: pick a made-up PDF in the import, the dry run shows its rows, answer one question, Save.

**New strings**

| English                                                                                     | Croatian                                                                                                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Read an offer PDF                                                                           | Pročitaj PDF ponude                                                                                         |
| Read a broker statement (PDF)                                                               | Pročitaj izvod brokera (PDF)                                                                                |
| This sends the whole offer, with any name, address and OIB on it.                           | Ovo šalje cijelu ponudu, sa svim imenima, adresom i OIB-om na njoj.                                         |
| This sends the whole statement, with account numbers and holdings.                          | Ovo šalje cijeli izvod, s brojevima računa i ulaganjima.                                                    |
| Kuna's EKS {kuna} differs from the {bank} the offer prints. A fee or a term may be misread. | Kunin EKS {kuna} razlikuje se od {bank} navedenog u ponudi. Neka naknada ili uvjet možda je krivo pročitan. |
| {provider} does not read PDFs in Kuna. Pick Anthropic or OpenAI in Kuna settings.           | {provider} u Kuni ne čita PDF-ove. Odaberite Anthropic ili OpenAI u postavkama Kune.                        |
| The file is over 10 MB.                                                                     | Datoteka je veća od 10 MB.                                                                                  |
| The statement is too long to read at once. Split it by year.                                | Izvod je predug za jedno čitanje. Podijelite ga po godinama.                                                |

**Cost.** A PDF page is 1,500 to 3,000 tokens on Anthropic. A six-page offer is 11,000 to 20,000 tokens in and 1,800 out: 4 to 6 US cents on Sonnet 5.5, 0.2 to 0.3 cents on Haiku 5.5, 8 to 12 cents on Opus 5.5. A ten-page statement of about 100 rows is 18,000 to 33,000 tokens in and 6,000 out: 10 to 13 cents on Sonnet 5.5, about half a cent on Haiku 5.5, 19 to 25 cents on Opus 5.5.

### 7. The rest, in the research's ranked order

Each lands as its own commit with the same kinds of specs, checks, pages, steps and strings as the stages above.

| Order | Task                                                | App and screen                     | Input and tools                                                                                                                                                          | Check                                                                                                         | Sonnet 5.5 cost    |
| ----- | --------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1     | Draft a rule from several confirmed rows            | Company, rule coverage             | One group from `ruleCoverage` (`src/apps/company/rules/domain/ruleCoverage.ts:65`), conditions from `RuleCondition`                                                      | A `RuleDraft` (`ruleDraft.ts:26`) in the rule editor with `backtestRuleChange` (`backtestRule.ts:38`)         | about 1 to 2 cents |
| 2     | "Can I pay myself X"                                | Company, Year's Pay tab            | Tools over `payScenarios` (`packs/hr-doo/domain/scenarios/payScenarios.ts:36`), `dividendCapacity` (`dividendCapacity.ts:131`), `ownerTake` (`ownerTake.ts:61`) taking X | Every amount by a tool's ref                                                                                  | 5 to 7 cents       |
| 3     | Explain a tax line                                  | Investments, Tax                   | A map from each `CapitalGainsYear` figure to its `TAX_RULES` keys, then stage 5's `law_section`                                                                          | Anchors from `TAX_RULES`, amounts from the line                                                               | about 3 cents      |
| 4     | Fill the year-end tab from the accountant's package | Company, year-end tab              | The GFI PDF into the year-end line ids                                                                                                                                   | The ties of `readYearEnd` (`packs/hr-doo/domain/yearEnd/yearEndReading.ts:113`)                               | 5 to 10 cents      |
| 5     | Map an unknown bank export's columns                | Company, imports                   | The header and five sample rows                                                                                                                                          | An `ImportProfile` (`src/apps/company/imports/domain/importProfile.ts:23`) through the dry run                | about 1 cent       |
| 6     | An incoming invoice or a receipt paid privately     | Company, assets and owner advances | A PDF or a photo, with `imagePartOf` if spending has not added it                                                                                                        | The kind write rules of `hr-doo.asset` and `hr-doo.owner-advance` (`packs/hr-doo/domain/hrDooKinds.ts:10-17`) | 3 to 6 cents       |
| 7     | The accountant's payroll or VAT xlsx                | Company, salaries                  | The cell grids as text (`src/shared/xlsx/sheetGrids.ts`), behind the employee switch                                                                                     | The salary reconciliation                                                                                     | 2 to 4 cents       |

Then the providers and API features:

- Gemini, Mistral and Groq presets on a Chat Completions adapter, each a preset row and a CSP entry.
- Ollama and LM Studio presets for the laptop only, with the `OLLAMA_ORIGINS` note and `http://localhost:11434`, `http://127.0.0.1:11434` and `http://localhost:1234` in `connect-src`.
- OpenRouter's PKCE sign-in, so a phone never pastes a key.
- Anthropic's native citations through `search_result` blocks, for answers that do not need `output_config.format`, which refuses citations.
- Anthropic's server-side refusal fallback on Sonnet 5.5 and Opus 5.5, with the usage line naming the model that answered.

## Where the code fights the answers

- **The keys file belongs to one Investments file.** Its name carries the file id (`keysFile.ts:24-26`), the sync takes it (`keysSync.ts:27`), and Remove the Investments file deletes it (`fileRemoval.ts:77`, with the wording at `words.ts:27`). A Kuna-wide file means Remove stops deleting keys, and the sync must list the hidden folder to find old files, since their names hold an id it no longer has.
- **The page has no Kuna-wide sync group.** Groups come only from apps with a file on Drive (`src/shared/sync/presentation/pageSync.ts:117-119`), and a failed books read skips the rest of its group (`src/shared/sync/application/sync.ts`, `runGroup`). The secrets step rides in every app's group and runs once per run. A device with every app kept in the browser syncs no secrets, as today (`useKeysSync.ts:76`).
- **"Questions over the ruleset and docs/law" spans two apps.** The ruleset is pack code in Company, and docs/law backs Investments' Tax (`taxRules.ts:9-16`). One question that reads both would need one app to import another (`tests/importBoundaries.spec.ts:143-145`), so stage 5 has two tasks.
- **docs/law is outside `src`.** The boundary spec fails an import whose file it cannot find (`:130`) and an app import outside its folder and `src/shared` (`:143-145`). Stage 5 adds one named exception.
- **The figure dialog never sees the figure.** `FigureDialog.vue:13-15` takes a `FigureDetail` of chips and two levels of steps (`tracedFigureView.ts:16`, `:24-38`), built in ten places. `FigureDetail` must carry the `TracedFigure` for stage 4.
- **"AI" already means "no rule".** `categorise` writes `flagged_by = 'ai'` for rows no rule decided (`src/shared/categorising/domain/categorise.ts:9-23`), `needsReview` reads it (`src/apps/company/workbook/domain/needsReview.ts:13-15`), and the queue labels it "AI guess" though no model ran (`ReviewQueueItem.vue:53`). Stage 3 keeps the stored value and rewords the badge.
- **Core cannot see who is an employee.** The review queue is core code, the employees are the pack's, and core imports no pack code (`:147-149`). A salary row's counterparty name would go out with the queue unless the pack publishes `employeeIbans`, a change to `PackContribution`.
- **Masking covers rows, not documents.** A loan offer and a broker statement go whole, with names, addresses, OIBs and account numbers. Their `sends` line says so.
- **One model per provider, every task.** The research's quick and careful choices are gone, so the default Sonnet 5.5 makes sorting the queue about twenty times dearer than Haiku 5.5 would. The owner can still pick Haiku 5.5.
- **PDFs depend on the provider.** Anthropic's OpenAI-compatible layer rejects `file` parts, and OpenRouter's PDF handling was not checked, so document tasks run only on Anthropic and OpenAI.
- **The research said the dev CSP repeats the hosts.** It does not. `devContentSecurityPolicy.ts` widens `index.html`'s policy with a WebSocket only.

## Unconfirmed

- **Which OpenAI model is "medium".** `gpt-6.1-sol` costs what Sonnet 5.5 does. `gpt-6.1-terra` is cheaper and may be the better reading of "medium". `gpt-6-luna` supports function calling in Chat Completions only with reasoning off (receipts research), which matters for tool tasks.
- **Which provider runs.** "One provider list with a model choice per provider" is read as one provider in use at a time, the first key saved being used until the owner picks another.
- **Per-device switches and models.** Not asked. Read as per device, like auto-sync. Moving them into the secrets file would make them follow the account.
- **The owner's own pay on Year's Pay tab** is read as company figures, not employee data. Only figures from the salaries tab need the employee switch.
- **Bulk confirm.** Not asked. Stage 3 confirms one row per tap. `fileRows` takes many verdicts in one write (`ReviewQueue.vue:60-62`), so "use every sure suggestion" with one Undo would be a small later change.
- **The badge rewording** from "AI guess" to "No rule" was recommended by the research and not answered.
- **Browser access** to `POST /v1/messages/count_tokens` on Anthropic and `GET /models` on OpenAI and OpenRouter. The receipts research preflighted only the chat endpoints. A tiny one-token message is the fallback key test.
- **OpenRouter model ids** and whether OpenRouter passes PDFs through.
- **`response_format` with `tools`** on Chat Completions is not documented, hence the `answer` function.
- **Prompt cache prices.** The research gives Sonnet 5.5 cache reads at $0.10 per million tokens. The bundled API reference gives $0.20. The minimum cacheable prompt of 512 tokens on the 5.5 models is from the research.
- **SDK bundle sizes** were not measured.
- **Token counts** are estimates from character counts. Stage 5 counts the real prompts before it ships, and stage 3's first live run gives the real figure.
- **The EKS margin** of 0.10 percentage points is a guess at rounding, to be set from a real offer.
- **PDF page tokens** on OpenAI and the cost of a scanned statement were not measured.
- **Employee data and processing records.** Whether a hosted model reading employee pay needs a line in the owner's records as employer was not researched. This is not legal advice.

## Sources

- [One AI module shared by every Kuna app](research/shared-module.md), the research this plan rests on, with its sizes, costs, retention table and provider docs.
- [Receipt photos to draft transactions](../spending/research/lane3-receipts.md), for browser access, CORS preflights, the two adapters, PDF and image support and provider retention.
- [Module map](../../architecture/modules.md), for the boundaries and the planned key store move.
- [Hub overview plan](../overview/plan.md), the shape this plan follows.
- [AI help across the apps](https://github.com/ipazanin/kuna/issues/41), the task.
- [docs/law](../../law/README.md), the law the Investments question reads.
- The bundled Claude API reference of this session, for the model ids and prices of Haiku 5.5, Sonnet 5.5 and Opus 5.5, forced `tool_choice` returning a 400 on Sonnet 5.5 and Opus 5.5, thinking that cannot be switched off on Opus 5.5, citations refused with `output_config.format`, and the PDF `document` block.

## The owner's answers, 2026-11-04

- Keys live in the existing Investments keys file, which becomes one Kuna-wide file for all the user's secrets, vendor keys and AI keys, renamed to fit and no longer tied to one Investments file. The existing file migrates without losing keys.
- The user picks the model, with a medium model such as Sonnet as the default. One provider list with a model choice per provider.
- Payroll and employee data may go to a hosted model only behind a per-task switch with a warning about what leaves the device. IBANs and OIBs are masked in every row Kuna builds.
- Law answers may add the model's own knowledge, marked "not from Kuna's rules", next to the cited answers from the ruleset and docs/law.
- Every write is a draft the user confirms, through the app's existing write path with Undo.
- It never files tax forms, sends mail or searches the web.
- Off by default, switched on per app.
- The build follows a modular monolith: clear separation and reuse, with the module map first.
