# Wave 12b, lane 2: the pack-to-core seams

Research at HEAD 7128551, read-only. Every import below was resolved by a script that walks `src/**/*.{ts,vue}` and resolves each relative `import ... from`, `export ... from`, side-effect `import '...'` and dynamic `import('...')` to a file (scratch: `imports.mjs`, output `imports.tsv`). It found 3,179 relative imports in `src`. A plain `grep -rcE "from '\.|import\('\.|^import '\."` over `src` counts 3,178, so the two agree. The project has no path aliases (`tsconfig.app.json` maps only `#build/*`), so relative imports are the whole picture.

## Summary

- Core imports pack code 15 times from 8 files. It also links to pack routes by path in 3 places in 2 files. All 15 imports are listed in the first table.
- The pack imports core 770 times: 295 imports into `src/features` and 475 into `src/shared`. The pack domain imports only core domain (0 imports of any application, infrastructure or presentation file). 19 pack imports, from 7 pack files, reach into `features/workbook/infrastructure`.
- There is no pack seam today. `src/packs` has 138 files and no `index.ts`. Core reaches into the pack through deep imports, two lazy routes, a flag on the screen list, a core setting (`ownerPayModule`, read 21 times in 11 files) and pack record types that live in the core `Workbook`.
- Recommendation: one typed pack contribution object, built in the pack and installed once in `main.ts`, with named slots per core screen. It removes all 15 imports and the 3 path links. The cost is 4 new files and about 16 edited files, plus the boundary script.

## 1. Imports from the pack into core

Command: `awk -F'\t' '$1 ~ /^src\/(features|shared|App.vue|main.ts)/ && $2 ~ /^src\/packs/' imports.tsv`, cross-checked with `grep -rn "packs/" src/features src/shared src/App.vue src/main.ts` (same 15 lines). `App.vue` and `main.ts` import no pack code.

| Core file:line                                                  | Brings                         | Kind                                          | Shows up on                                                                                             |
| --------------------------------------------------------------- | ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/features/overview/presentation/waitingForYou.ts:9`         | `forecastYear`                 | figure (corporate tax schedule, used at :153) | Overview, Waiting for you                                                                               |
| `src/features/overview/presentation/waitingForYou.ts:10`        | `ownerAdvances`                | figure (unaccounted reimbursements, :82)      | Overview, Waiting for you                                                                               |
| `src/features/overview/presentation/waitingForYou.ts:11`        | `payrollCadence`               | figure (missed payroll months, :132)          | Overview, Waiting for you                                                                               |
| `src/features/review/presentation/ReviewScreen.vue:15`          | `ownerAdvances`                | figure (:95)                                  | Review, Queue tab                                                                                       |
| `src/features/review/presentation/ReviewScreen.vue:16`          | `AddAdvanceDialog`             | dialog that writes `owner-advances` (:299)    | Review, Queue tab                                                                                       |
| `src/features/review/presentation/ReviewScreen.vue:17`          | `AdvancePrefill` (type)        | dialog input (:100)                           | Review, Queue tab                                                                                       |
| `src/features/review/presentation/ReviewScreen.vue:18`          | `UnaccountedReimbursements`    | card body (:274-288)                          | Review, Queue tab                                                                                       |
| `src/features/settings/presentation/GeneralSettingsForm.vue:11` | `LOCAL_UNITS`, `findLocalUnit` | tax rule data and a setting check (:46, :74)  | Settings, General, Company and owner facts card                                                         |
| `src/features/settings/presentation/SettingsScreen.vue:9`       | `LoanBucketSwitch`             | card that writes `categories` (:102)          | Settings, General                                                                                       |
| `src/features/settings/presentation/SettingsScreen.vue:10`      | `RulesetPanel`                 | tab (:38, :163-164)                           | Settings, Ruleset tab                                                                                   |
| `src/features/transactions/application/presentedWorkbook.ts:1`  | `countedSplits`                | guard that changes figures (:12)              | every figure screen, through `useFilteredLedger.ts:39`, and Settings problems (`SettingsScreen.vue:52`) |
| `src/features/transactions/application/splitRows.ts:5`          | `assetsClaimingRows`           | write guard (`SPLIT_ROWS.refusals`, :47-57)   | Split dialog on Transactions and Review                                                                 |
| `src/features/transactions/presentation/SplitDialog.vue:14`     | `assetsClaimingRows`           | guard message (:80-83)                        | Split dialog                                                                                            |
| `src/shared/routing/router.ts:16`                               | `OwnerScreen.vue` (lazy)       | route                                         | Owner screen and menu                                                                                   |
| `src/shared/routing/router.ts:17`                               | `YearScreen.vue` (lazy)        | route                                         | Year screen and menu                                                                                    |

Links by path, with no import:

- `src/features/spending/presentation/BreakdownPanel.vue:34-37` links the taxes group to `/year?tab=taxes` and the owner-pay group to `/owner?tab=taken`, shown only while the switch is on (:49, :64). Screen: Analysis, spending breakdown.
- `src/features/overview/presentation/waitingForYou.ts:44-46` builds the `/year?tab=taxes#card` link for the payroll and corporate tax jobs.

The core type also names the pack's jobs: `WaitingJob.key` at `waitingForYou.ts:23` lists `'unaccounted' | 'payroll' | 'corporate-tax'`.

## 2. How the pack is wired today

There is no registry and no public surface. `find src/packs -name index.ts` finds nothing, and `find src/packs -type f | wc -l` counts 138 files. Each core screen imports what it needs from deep inside the pack. The wiring is spread over several ad hoc seams:

| Seam                      | Where                                                                                                                                                                                                                                                                                                               | What it does                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routes                    | `src/shared/routing/router.ts:10-19`                                                                                                                                                                                                                                                                                | A record keyed by `ScreenPath` holds two lazy pack screens next to the core ones. `routes` is built at module load (:21).                                                                                                      |
| Menu items                | `src/shared/routing/screens.ts:1-31`                                                                                                                                                                                                                                                                                | `ScreenPath` lists `/owner` and `/year`. The `ownerPayPack` flag (:16, :28-29) marks them. `src/App.vue:35` hides them while the switch is off.                                                                                |
| On/off switch             | `src/features/settings/domain/settings.ts:34`, default `:153`, key `owner_pay_module` at `:502-507`                                                                                                                                                                                                                 | One core setting that every core screen reads before showing pack content (21 reads in 11 files, `grep -rn ownerPayModule src`).                                                                                               |
| Settings keys             | `src/features/settings/domain/settings.ts:115-136` (`CompanyFacts`), `:372-455` (the nine `hr_` keys)                                                                                                                                                                                                               | The pack's settings live in the core `Settings` type and parser. Its own comment at `:372` calls them "the pack's keys".                                                                                                       |
| Tabs and records          | `src/features/workbook/domain/workbook.ts:213-228`                                                                                                                                                                                                                                                                  | `Workbook` carries `ownerAdvances`, `assets`, `grants`, `yearEndLines`, `planLines` and `payScenarios`. Their types sit in core `workbook/domain` (`assets.ts`, `grants.ts`, `plan.ts`, `ownerPayScenarios.ts`, `yearEnd.ts`). |
| Tab names and columns     | `src/features/workbook/application/workbookWriter.ts:18-32` (`RowTab`), `src/features/workbook/infrastructure/workbookTemplate.ts:128-222`                                                                                                                                                                          | The pack tabs are part of the core tab union and the core template.                                                                                                                                                            |
| Tab readers               | `src/features/workbook/infrastructure/workbookReader.ts:13-23`, `:39-66`                                                                                                                                                                                                                                            | Core reads every pack tab into the `Workbook`.                                                                                                                                                                                 |
| Write rules for pack tabs | core: `features/settings/application/workbookTabRows.ts:165` (`ASSET_ROWS`), `:177` (`GRANT_ROWS`), `:198` (`YEAR_END_ROWS`), `features/workbook/application/ownerAdvanceRows.ts:28` (`OWNER_ADVANCE_ROWS`). pack: `packs/hr-doo/application/planRows.ts:81` (`PLAN_ROWS`), `scenarioRows.ts:106` (`SCENARIO_ROWS`) | Split across three places. The four core ones are used only by pack screens (`grep -rlw`, see section 4).                                                                                                                      |
| Editor columns            | `features/settings/presentation/factTabColumns.ts:30`, `:58`, `:80`                                                                                                                                                                                                                                                 | Asset, grant and year-end editor columns sit in core and are used only by the pack.                                                                                                                                            |
| Category roles            | `packs/hr-doo/domain/packRoles.ts:5-27`                                                                                                                                                                                                                                                                             | The pack owns its role names, but core seeds them in the template (`workbookTemplate.ts:262-302`) and the rule proposer knows four of them (`features/rules/domain/proposeRule.ts:10`).                                        |
| Fake data                 | `features/workbook/infrastructure/fake/fakeWorkbook.ts:249-253` (`hr_` settings), `:293` (`owner-advances`), `:314` (`planningValues` for assets, grants, year-end, plan, scenarios)                                                                                                                                | All pack fake data lives in the core fake.                                                                                                                                                                                     |

So the answer is several seams, not one. The switch, the routes and the records are each wired differently, and the guards, figures and cards reach core screens through deep imports.

## 3. The two follow-ups the plan names

Both still hold at HEAD. The plan's "Workbook presentation" case moved: 7128551 deleted `features/settings/presentation/WorkbookScreen.vue` and its pack imports now sit in `SettingsScreen.vue:9-10` (`git show --stat 7128551`).

**`features/transactions/application` imports hr-doo domain code.** Two files:

- `presentedWorkbook.ts:1` calls `countedSplits` (`packs/hr-doo/domain/countedSplits.ts:14-27`). That function drops the splits of a ledger row an asset claims and adds a problem for each part. The splitting is core business. Only the claim comes from the pack, through `assetsClaimingRows` and the ruleset (`countedSplits.ts:3-4`, `:15`).
- `splitRows.ts:5` calls `assetsClaimingRows` in `SPLIT_ROWS.refusals` (`:47-57`) to refuse a split write. It also reads the `assets` tab through core infrastructure (`readAssets`, `:10`, `:50`). `SplitDialog.vue:14` and `:80-83` repeat the same claim to explain the refusal before a write.

All three uses ask one question of the pack: which ledger rows does it keep whole, and by which names. Today the answer is keyed by `sheetRow` (`assetRegister.ts:104-111`), so the slot must take lane 1's record reference.

**Core presentation imports pack code.** Overview (`waitingForYou.ts:9-11`), Review (`ReviewScreen.vue:15-18`), Settings (`SettingsScreen.vue:9-10`, `GeneralSettingsForm.vue:11`) and the router (`router.ts:16-17`). Analysis links to pack routes without an import (`BreakdownPanel.vue:34-37`).

## 4. Storage from the pack side

Every pack write goes through `useRowWrites` (`features/workbook/presentation/useRowWrites.ts:32`), which calls `store.changeRows` (`:60`), so the one write path holds. No pack file calls the store's write methods directly (`grep -rn "changeRows\|store.write" src/packs` finds nothing). The pack domain never imports workbook infrastructure. The pack's application and presentation code does, 19 times from 7 files (`awk -F'\t' '$1 ~ /^src\/packs/ && $2 ~ /workbook\/infrastructure/' imports.tsv`).

| Tab                         | Read by                             | Write rules (file:line)                                     | Written from (pack)                                                                                  | Workbook infrastructure imported                                                                                                                |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan`                      | core reader, `workbookReader.ts:66` | `packs/hr-doo/application/planRows.ts:81`                   | `presentation/forecast/usePlanWrites.ts:19`                                                          | `planRows.ts:5-10` (`wholeNumberOf`, `readPlan`, `readScenarios`, `definedCategorySlugs`, `SheetRow`, `TEMPLATE_COLUMNS`), `usePlanWrites.ts:7` |
| `scenarios`                 | core reader, `workbookReader.ts:40` | `packs/hr-doo/application/scenarioRows.ts:106`              | `payScenarios/ComponentDialog.vue:46`, `ScenarioNameDialog.vue:28`, `StartingScenariosDialog.vue:30` | `scenarioRows.ts:6-10` (`slugOf`, `readPlan`, `readScenarios`, `definedCategorySlugs`, `TEMPLATE_COLUMNS`), `StartingScenariosDialog.vue:10`    |
| `year-end` (the statements) | core reader, `workbookReader.ts:65` | core `features/settings/application/workbookTabRows.ts:198` | `yearEnd/StatementsPanel.vue` through core `FactTabCard.vue:40`                                      | `StatementsPanel.vue:12-13` (`SheetRow`, `readYearEnd`)                                                                                         |
| `assets`                    | core reader, `workbookReader.ts:63` | core `workbookTabRows.ts:165`                               | `assets/AssetsPanel.vue` through `FactTabCard`                                                       | `AssetsPanel.vue:30`, `:32` (`readAssets`, `SheetRow`)                                                                                          |
| `grants`                    | core reader, `workbookReader.ts:39` | core `workbookTabRows.ts:177`                               | `assets/AssetsPanel.vue` through `FactTabCard`                                                       | `AssetsPanel.vue:31` (`readGrants`)                                                                                                             |
| `owner-advances`            | core reader, `workbookReader.ts:61` | core `features/workbook/application/ownerAdvanceRows.ts:28` | `AddAdvanceDialog.vue:46`, opened from Review                                                        | none directly. The core rules file imports `workbookReader` and `workbookTemplate` (`ownerAdvanceRows.ts:7-8`)                                  |
| `splits`                    | core reader, `workbookReader.ts:45` | core `features/transactions/application/splitRows.ts:36`    | none, the pack only supplies the claim                                                               | not from the pack. Core `splitRows.ts:10-14` imports five infrastructure modules                                                                |
| `categories`                | core                                | core `workbookTabRows.ts:103`                               | `LoanBucketSwitch.vue:27`, on Settings                                                               | `LoanBucketSwitch.vue:12` (`readCategoryRows`)                                                                                                  |

The pack writes in tab, header and cell terms like the rest of the app (`rowCellsOf` in `LoanBucketSwitch.vue:7`, `usePlanWrites.ts:3`, `ComponentDialog.vue:10`, `ScenarioNameDialog.vue:8`). Lane 1's change to business-term writes covers these files as well. The four core rule sets used only by pack screens (`ASSET_ROWS`, `GRANT_ROWS`, `YEAR_END_ROWS`, `OWNER_ADVANCE_ROWS`, each found in exactly one pack file by `grep -rlw`) are natural to move into the pack in the same step.

## 5. Design options for one pack seam

The slots every option has to serve, taken from the 15 imports and the 3 links:

| Slot                                                                      | Core screen                        | Today                                                            |
| ------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Screens (route, menu item, title, icon, lazy component)                   | menu and router                    | `router.ts:16-17`, `screens.ts:28-29`                            |
| Waiting jobs                                                              | Overview                           | `waitingForYou.ts:9-11`, `:44-46`, `:81-90`, `:128-169`          |
| Ledger rows kept whole, with the names that claim them                    | figures, split guard, split dialog | `presentedWorkbook.ts:1`, `splitRows.ts:5`, `SplitDialog.vue:14` |
| Review cards                                                              | Review, Queue tab                  | `ReviewScreen.vue:15-18`, `:91-105`, `:274-305`                  |
| Settings tabs                                                             | Settings                           | `SettingsScreen.vue:10`, `:38`, `:163-164`                       |
| Settings General cards                                                    | Settings, General                  | `SettingsScreen.vue:9`, `:102`                                   |
| Company facts fields and their checks, inside the General form's one Save | Settings, General                  | `GeneralSettingsForm.vue:11`, `:44-47`, `:55-60`, `:229-305`     |
| Cost group links                                                          | Analysis, spending breakdown       | `BreakdownPanel.vue:34-37`                                       |

### Option A: a typed contribution object installed once in `main.ts`

Core declares `PackContribution` with the eight named slots above, a `NO_PACK` value with empty slots, and `installPack(pack)` / `installedPack()`, in one core file (for example `src/features/packs/packContribution.ts`). The pack builds one object in `src/packs/hr-doo/hrDooPack.ts`. `main.ts` installs it before it creates the router.

- How a screen asks: `installedPack().waitingJobs(workbook, asOf)`, `installedPack().reviewCards`, and so on. Domain functions take what they need as arguments. For example `countedSplits(splits, rowsKeptWhole)` moves into core because the splitting is core business, and only application and presentation code read `installedPack()`.
- Typing: the interface is in core and names core types only (`Workbook`, lane 1's record reference, `WaitingJob`, `PageTab`, Vue `Component`). The pack satisfies it with `satisfies PackContribution`, so a missing slot fails `vue-tsc`. Screen paths become `` `/${string}` `` for pack screens, and `ScreenPath` keeps the core ones.
- Boundary check: nothing in `src/features/**` or `src/shared/**` imports `src/packs/**`. Only `src/main.ts` may. Pack code imports no `*/infrastructure/*` file (lane 1's rule). Pack domain imports only `*/domain/*` and non-UI `shared` code, which already holds with 0 violations.
- The switch: core reads `ownerPayModule` in one place (`installedPack()` returns `NO_PACK` while it is off) instead of 21 reads in 11 files. Today the asset claim on splits applies whether the switch is on or off (`presentedWorkbook.ts:11-18` does not check it). See question 3.
- Tests: core tests that expect pack behaviour (for example `tests/waitingForYou.spec.ts:22-28`) install the pack in a vitest setup file, or per spec. `vitest.config.ts` has no setup file today.
- Cost here: 4 new files (`packContribution.ts`, `hrDooPack.ts`, a pack `waitingJobs.ts` taking the three jobs out of `waitingForYou.ts`, and a pack Review card component holding the `ReviewScreen.vue:274-288` and `:298-304` blocks with its dialog). About 16 edited files: `main.ts`, `App.vue`, `router.ts`, `screens.ts`, `waitingForYou.ts`, `ReviewScreen.vue`, `SettingsScreen.vue`, `GeneralSettingsForm.vue` (the facts card moves into a pack component, so count one more new file if it is not folded into an existing one), `presentedWorkbook.ts`, `splitRows.ts`, `SplitDialog.vue`, `BreakdownPanel.vue`, `countedSplits.ts` (moves to core), `vitest.config.ts` plus its setup file, and `tests/waitingForYou.spec.ts`. The boundary script and its CI step come on top and are shared with lane 1.

### Option B: provide/inject

Same type and object. `main.ts` calls `app.provide(PACK, hrDooPack)` and components call `inject(PACK, NO_PACK)`.

- How a screen asks: only inside `setup` or a composable called from it. `presentedWorkbook`, `waitingJobs` and `SPLIT_ROWS` are plain functions and a module constant, so the pack has to be passed to them as an argument. `SPLIT_ROWS` becomes a factory built in `SplitDialog` setup.
- Typing: an `InjectionKey<PackContribution>`, otherwise as A.
- Boundary check: as A.
- Gotcha: the router is built before the app has the pack provided (`main.ts:21`), so `createAppRouter` needs the pack as an argument too. The pack then arrives two ways.
- Cost here: the same files as A without `installPack`, plus the signature changes to `presentedWorkbook`, `waitingJobs` and `SPLIT_ROWS` and their four test files (`fakeWorkbook.spec.ts`, `splits.spec.ts`, `splitWrites.spec.ts`, `waitingForYou.spec.ts`).

### Option C: core imports one pack index

`src/packs/hr-doo/index.ts` re-exports what core uses, and core imports only that file.

- How a screen asks: as today, with one import path.
- Typing: whatever the pack exports. Core decides where and when each piece shows.
- Boundary check: core may import `src/packs/hr-doo/index.ts` and nothing else under `src/packs`.
- Cost here: 1 new file and the 15 import lines.
- Why not: the dependency still points from core to the pack, and core screens still decide when pack content shows. A barrel that only re-exports states no rule, which is the kind of wrapper the house rules reject. It gathers the cross imports in one place but does not remove them.

### Recommendation: A

A removes every cross import and every path link, keeps domain functions pure, and needs no signature changes beyond `countedSplits`. B's only gain is avoiding a module-level value, and it pays for that with a second way to pass the pack (router argument) and four reworked test helpers. With one pack, eight slots stay small: each one maps to an import or a link that exists today, and nothing is added for a pack that does not exist.

Two gotchas for A:

- `router.ts:21` builds `routes` when the module loads, which happens before `installPack` runs. The route list has to move inside `createAppRouter`.
- An eager `import` of the pack object in `main.ts` would pull the pack domain and the ruleset into the entry chunk. In the build in `dist/` (built 08:07, before HEAD's 08:27 commit, so slightly stale), the entry chunk `index-*.js` is 150,909 bytes and holds no pack code. The ruleset sits in the shared `presentedWorkbook-*.js` chunk, 418,497 bytes, which every figure screen already loads (found by grepping `dist/assets` for a local-unit name from the ruleset table and for the role `owner-loan-out`). Loading the pack with `await import(...)` inside `start()`, as `main.ts:17` already does for the fake, keeps the entry chunk as it is. Component slots should be lazy loaders wrapped in `defineAsyncComponent`.

Visible changes under A:

- Overview job order. Pack jobs come after the core ones, so "unaccounted" moves from second place to after "overdue" (`tests/waitingForYou.spec.ts:22-28` expects it second today). See question 4.
- None to figures, as long as `rowsKeptWhole` returns what `assetsClaimingRows` returns today.

## Cross imports to remove and where each moves

| Today                                                                             | Moves to                                                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overview/presentation/waitingForYou.ts:9` `forecastYear`                         | pack `waitingJobs` slot (the corporate tax job, `:149-169`, moves into the pack)                                                                  |
| `overview/presentation/waitingForYou.ts:10` `ownerAdvances`                       | pack `waitingJobs` slot (the unaccounted job, `:81-90`)                                                                                           |
| `overview/presentation/waitingForYou.ts:11` `payrollCadence`                      | pack `waitingJobs` slot (the payroll job, `:128-146`)                                                                                             |
| `overview/presentation/waitingForYou.ts:44-46` `/year` link                       | moves with the two jobs into the pack                                                                                                             |
| `review/presentation/ReviewScreen.vue:15` `ownerAdvances`                         | pack Review card, computed inside it from `useFilteredLedger`                                                                                     |
| `review/presentation/ReviewScreen.vue:16-17` `AddAdvanceDialog`, `AdvancePrefill` | inside the pack Review card                                                                                                                       |
| `review/presentation/ReviewScreen.vue:18` `UnaccountedReimbursements`             | inside the pack Review card, rendered through the `reviewCards` slot                                                                              |
| `settings/presentation/SettingsScreen.vue:9` `LoanBucketSwitch`                   | `settingsCards` slot (General tab)                                                                                                                |
| `settings/presentation/SettingsScreen.vue:10` `RulesetPanel`                      | `settingsTabs` slot                                                                                                                               |
| `settings/presentation/GeneralSettingsForm.vue:11` `LOCAL_UNITS`, `findLocalUnit` | the facts card becomes a pack component in the form's facts slot, with a `settingsProblems` check merged into the form's errors so one Save stays |
| `transactions/application/presentedWorkbook.ts:1` `countedSplits`                 | `countedSplits` moves to core transactions domain and takes the claim map. The map comes from the `rowsKeptWhole` slot                            |
| `transactions/application/splitRows.ts:5` `assetsClaimingRows`                    | `rowsKeptWhole` slot, on the freshly read records (also drops `readAssets` at `:10`)                                                              |
| `transactions/presentation/SplitDialog.vue:14` `assetsClaimingRows`               | `rowsKeptWhole` slot                                                                                                                              |
| `shared/routing/router.ts:16-17` lazy `OwnerScreen`, `YearScreen`                 | `screens` slot, with the lazy loaders in `hrDooPack.ts`                                                                                           |
| `shared/routing/screens.ts:28-29` `ownerPayPack` entries                          | `screens` slot. The flag goes away                                                                                                                |
| `spending/presentation/BreakdownPanel.vue:34-37` `/year`, `/owner` links          | `costGroupLinks` slot                                                                                                                             |

## Open questions for the owner

1. Pack tabs and their record types (`assets`, `grants`, `year-end`, `plan`, `scenarios`, `owner-advances`) live in the core `Workbook` and the core reader today. With record-to-column mapping in each storage adapter, the adapters have to know these records, so I suggest they stay in core this wave. Moving them into the pack would need a second seam that registers tabs with storage. This is a "what owns what" question, so it is yours.
2. The nine `hr_` settings keys and `CompanyFacts` live in core `Settings` (`settings.ts:115-136`, `:372-455`). Keep them there this wave, or let the pack own its keys?
3. Should the owner-pay switch turn the whole pack off, including the asset claim on splits? Today the claim applies with the switch off. With it on, nothing changes either way.
4. Is it fine that pack jobs on Overview come after the core jobs, which moves "unaccounted" from second place to after "overdue"?
5. Should the four core write rule sets only pack screens use (`ASSET_ROWS`, `GRANT_ROWS`, `YEAR_END_ROWS`, `OWNER_ADVANCE_ROWS`) and the three editor column sets move into the pack together with lane 1's business-term writes?
