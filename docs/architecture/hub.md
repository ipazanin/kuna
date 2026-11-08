# Finance hub: proposal

Ledgerboard as a hub of finance apps: the target shape, how Wave 12b's storage boundary carries over, the first modularity wave in detail, the roadmap by difficulty against the current queue, and the decisions for the owner.

Checked against the code at 7128551 (paths relative to the repo), [the Wave 12b plan](https://github.com/ipazanin/kuna/blob/cd621ab/docs/features/platform/storage-boundary-plan.md) and the sources below, each loaded and its quote found in the page text. The detail behind it is in three lane files: [architecture](research/hub-lane1-architecture.md), [sources](research/hub-lane2-sources.md) and [apps](research/hub-lane3-apps.md). This designs on the shape Wave 12b leaves, not on today's code.

## The owner's decisions, 2026-10-22

1. **One app, a section per app.** One install, one sign-in, one deploy. The shell builds the menu and routes from installed apps.
2. **One Sheet per personal app**, not one personal Sheet. Open for the second-storage wave: which app owns a personal account that budgeting and loans both use, and how the other reads it.
3. **Company and personal data never share a file.** The company Sheet stays the company's record.
4. **Personal apps read company facts live.** The company app publishes typed facts, such as owner payments and owner loans, and nothing is copied.
5. **Every app keeps its own Overview, and the hub gets one overview across all apps.** The hub overview comes with the hub dashboard wave.
6. **Rename and move the address.** A new name and a new address, which means reinstalling the app on the phone and a new OAuth redirect URI in the Google Cloud project (a Cloud change that needs the owner's yes). The name is still to choose.
7. **The first hub wave runs after the company queue:** after Wave 12b, Wave 13, Wave 13b, Wave 14 and the clients fix.

## In short

- **One app, many apps inside it.** Ledgerboard stays one Vite build, one PWA and one deploy. The company app becomes the first app inside a thin shell, with the hr-doo pack still inside the company app. Personal loans, personal spending and budgeting, and personal assets come later as sibling apps.
- **Wave 12b already builds most of the machinery.** Its record kinds, repositories, unit of work, contract suite and pack seam carry over. What is new is a seam one level up (an app contribution), a store per storage instead of one store, and boundary rules between apps.
- **The first hub wave (H1) changes no figure and nothing you see, apart from the addresses gaining `/company`.** It moves folders, puts the shell in charge of menu, routes and settings tabs through the app seam, and creates the storage per app with exactly one storage.
- **A second storage comes with the second app, not before.** H2 adds it with an empty personal app, then loans (H3), the hub dashboard (H4) and company facts (H5). Spending and budgeting, the company-to-personal matching, assets and stocks follow.
- **Recommended timing:** H1 right after Wave 12b's third deploy, then Wave 13 and 13b, then H2 onwards.

## 1. The target

The hub is a shell that knows nothing about money. Each app is a business module with its own folder, its own record kinds and its own storage, and it plugs into the shell through one typed contribution. Apps share a small kernel of value types and the storage machinery. When one app needs another's data, it reads facts the other app publishes, through one translation file of its own, and never touches the other app's records. The dashboard shows tiles that apps contribute.

```
+--------------------------------------------------------------------------------+
| SHELL  src/shell                                                               |
| menu grouped by app . router with a prefix per app . sync button per storage   |
| first run per storage . Settings with "This device" . PWA . theme              |
| home: Overview until H4, then the hub dashboard built from app tiles           |
+--------------------+-----------------------------------+-----------------------+
                     | installApp(AppContribution), lazy, from main.ts
     +---------------+---------------+       +-----------+-----------------------+
     | COMPANY APP  src/apps/company |       | PERSONAL APPS  src/apps/... (H2+) |
     | ledger, review, rules, import |       | loans . spending and budget       |
     | invoicing, analysis, cash ... |       | assets . later stocks             |
     |  +-------------------------+  |       |                                   |
     |  | hr-doo pack (12b seam)  |  |       | companyFacts.ts (one translation  |
     |  | Owner, Year, ruleset    |  |       | file per app that reads them)     |
     |  +-------------------------+  |       |                ^                  |
     | facts.ts (published, H5) -----+-------+----------------+                  |
     +---------------+---------------+       +-----------+-----------------------+
                     | store.write: one unit of work, one storage                |
     +---------------+---------------+       +-----------+-----------------------+
     | company storage               |       | personal storage                  |
     | company Sheet or browser file |       | personal Sheet or browser file    |
     +-------------------------------+       +-----------------------------------+

SHARED KERNEL  src/shared: Money, CivilDate, MonthKey, Period, RecordId, RecordKind,
Repository, UnitOfWork, RecordStorage, spreadsheet and browser adapters, cache,
Google sign-in, UI kit, charts. It imports no app and no shell.
```

### The pattern

A **modular monolith** with a **DDD context map** between its modules.

| Pattern                                            | Used            | Why                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modular monolith                                   | Yes             | Grzybek: "Monolith is nothing more than a system that has exactly one deployment unit." GitHub Pages and one developer give one deployment unit. Fowler, MonolithFirst: "design a monolith carefully, paying attention to modularity within the software, both at the API boundaries and how the data is stored." 12b does the data part, and the boundary spec does the API part.     |
| Shared kernel, kept small                          | Yes             | Evans, DDD Reference: "Keep this kernel small." Value types and the storage port only. Accounts, categories and buckets stay inside each app.                                                                                                                                                                                                                                          |
| Published facts plus a translation file per reader | Yes             | Evans's anticorruption layer: "create an isolating layer to provide your system with functionality of the upstream system in terms of your own domain model." A change in the company model then breaks one personal file.                                                                                                                                                             |
| Separate ways                                      | Yes, by default | Evans: "Integration is always expensive, and sometimes the benefit is small." Invoicing, VAT and the year-end have nothing a budget needs.                                                                                                                                                                                                                                             |
| Storage per app, no write across two               | Yes             | Grzybek on modules sharing one database: "no constrains between tables from separate modules and no transactions between them." Google's batchUpdate is all-or-nothing within one spreadsheet only: "if one request is unsuccessful, none of the other (potentially dependent) changes are written."                                                                                   |
| Micro-frontends                                    | No              | Cam Jackson's headline benefit is "more scalable organisations with decoupled, autonomous teams". His costs, "more repositories, more tools, more build/deploy pipelines, more servers, more domains", would all land on one person. His own test is "technical and organisational maturity required to adopt such an approach without creating chaos".                                |
| Events and messaging between apps                  | No              | Grzybek: messaging needs "some sort of Event Bus" plus "outbox, inbox, internal commands messages". After a sync every app's data sits in the same browser, so a direct call to a pure function is fresher and needs nothing.                                                                                                                                                          |
| Feature-Sliced Design, wholesale                   | No              | Its rule that a slice "can only import other slices when they are located on layers strictly below" cuts by UI role (pages, widgets, entities). The repo cuts by business feature with domain, application, infrastructure and presentation inside, which is the shape you want. Its one useful idea, "A public API is a contract between a group of modules", is the `facts.ts` file. |

Sources, loaded 2026-10-22: [Grzybek, Primer](https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer), [Grzybek, Integration Styles](https://www.kamilgrzybek.com/blog/posts/modular-monolith-integration-styles), [Fowler, MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html), [Jackson, Micro Frontends](https://martinfowler.com/articles/micro-frontends.html), [Evans, DDD Reference 2015](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf), [Google, batchUpdate](https://developers.google.com/workspace/sheets/api/guides/batchupdate), [FSD Layers](https://feature-sliced.design/docs/reference/layers), [FSD Public API](https://feature-sliced.design/docs/reference/public-api).

## 2. How Wave 12b carries over

| 12b piece                                                 | What 12b gives                                                                                                | What the hub adds                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pack seam (`PackContribution`, `installPack`, `packPart`) | Screens, jobs, review cards, settings tabs and keys, and the pack's own kinds, all installed lazily           | Stays inside the company app, installed by the company app instead of `main.ts`. A new `AppContribution` one level up reuses its mechanics (typed object, install at start with `await import`, lazy loaders) but not its type. The pack seam hands the pack the company `Workbook` (`assemble(..., core: Workbook)`), which is right inside one context and wrong between apps. |
| `RecordKind`, `RecordId`                                  | Identity by business key or a UUID `id` column                                                                | Pack kinds keep the pack prefix (`hr-doo.asset`), and an app's own kinds stay bare, since each app keeps its own file. `tests/kindNames.spec.ts` refuses two kinds of one name in an app. The stored `id` is a bare UUID.                                                                                                                                                        |
| `Repository<R>`, `UnitOfWork`, `store.write`              | One atomic write per Sheet, Undo by identity                                                                  | One store per storage, each with its own `write`, session list and Undo. Rule: a write touches one storage.                                                                                                                                                                                                                                                                      |
| `RecordStorage` port and the spreadsheet adapter          | Kinds mapped to tabs, Google and browser grids                                                                | One adapter instance per storage, mapping only the kinds of the apps stored there.                                                                                                                                                                                                                                                                                               |
| `WriteRules<R>` per kind                                  | Owned by the feature that owns the kind                                                                       | Owned by the app that owns the kind. Same shape.                                                                                                                                                                                                                                                                                                                                 |
| Settings key seam (decision 8)                            | The pack declares its `hr_` keys                                                                              | Every app declares its keys. A storage's settings tab parses the keys of the apps stored there.                                                                                                                                                                                                                                                                                  |
| Contract suite                                            | `describe.each` over storages and kinds                                                                       | A new app's kinds join by adding fixtures. No new suite.                                                                                                                                                                                                                                                                                                                         |
| Import boundary spec                                      | Domain purity, core not importing the pack, no `sheetRow` outside the adapter, no infrastructure from outside | The hub rules in section 3.                                                                                                                                                                                                                                                                                                                                                      |
| The `Workbook` aggregate                                  | The company's records assembled, pack parts inside                                                            | Stays the company app's. Each later app assembles its own aggregate from its records.                                                                                                                                                                                                                                                                                            |

What 12b leaves company-shaped, and the hub has to change: one store singleton (`src/features/workbook/application/workbookStore.ts:510`, `useWorkbook` at `:550`), one choice key `ledgerboard.workbook` (`src/features/workbook/infrastructure/workbookChoice.ts:10`), cache tables named after the company tabs (`workbookCache.ts:22-26`), a root component that reads the company store (`src/App.vue:28-64`), and a closed list of eight company routes (`src/shared/routing/router.ts:10-19`, `screens.ts:1-31`). 47 `src` files call the store (`grep -rl 'useWorkbookStore\|useWorkbook(' src | wc -l`) and 19 branch on the data source (`grep -rlE "source === '(google|excel)'|source !== '(google|excel)'" src | wc -l`).

## 3. Wave H1: hub structure

**Goal:** the code is shaped as a hub with one app installed. Every figure identical, every check green, nothing visible changes except the addresses.

### What moves

```
src/
  main.ts              installs the apps (await import), then mounts the shell
  shell/               App.vue, routing, pwa, theme, layout, AppShell, AppBrand, ScreenNavigation,
                       ScreenSkeleton, UpdatePrompt, SyncStatus, autoSync, syncState, useGoogleReturn,
                       the first run (today's data-source feature), DevicePanel, the app registry
  shared/              kernel: calendar, money, text, charts, files, UI kit, tab editor,
                       google (12b stage 1), storage (12b's record and store machinery, both grid
                       adapters, cache, the browser-workbook file code from features/excel)
  apps/company/        app.ts, the 17 company features, the ledger domain (Workbook, Transaction,
                       Category, buckets), the company kinds' tab mappers
    packs/hr-doo/      unchanged inside, installed by apps/company/app.ts
```

1. **Folders.** The move above, by a codemod in one step with no logic change. At 7128551 it touches 273 `src` files (lane 1's edge list) and 496 import lines in 107 specs (`grep -rhE "from '\.\./src/(features|packs)" tests | wc -l`), plus the 8 scripts that import `src` (`grep -rlE "\.\./(\.\./)?src/" scripts`). 12b moves files too, so re-measure at the start.
2. **No path alias.** Relative imports stay. The scripts' resolver handles only relative specifiers (`scripts/support/typescriptResolve.mjs:16-26`), the 12b boundary spec resolves relative imports, and `tsconfig.app.json:7-9` has only `#build/*`. An alias would need four configs changed for a churn a codemod already handles.
3. **The app seam.** A sketch, names to settle in the build:

   ```ts
   // src/shell/appContribution.ts
   export interface AppContribution {
     readonly id: AppId // 'company'
     readonly name: string
     readonly routePrefix: `/${string}` // '/company'
     readonly storage: StorageSlot // which storage its kinds live in
     readonly kinds: readonly WriteRules<unknown>[]
     readonly settingKeys: readonly SettingKeySpec[]
     readonly screens: readonly AppScreen[] // lazy loaders, in menu order
     readonly settingsTabs: readonly AppSettingsTab[]
     menuCount?(screen: AppScreen): number | null // Review's count today
     readonly firstRun: AsyncComponentLoader // today's welcome screen text
   }
   ```

   `App.vue` stops importing the company store, filters and settings (`src/App.vue:6-15`) and builds the menu, subtitle, first run and sync slot from installed apps. The company read path then leaves the entry chunk.

4. **Routes and menu per app.** Routes come from installed apps under their prefix, so Overview is `#/company`, Transactions `#/company/transactions`, and `#/` opens the home app's first screen. With one app the menu stays the flat list it is. The owner-pay filter on screens (`App.vue:35`) moves into the company app. Rewrites 165 `#/` literals in `scripts` (`grep -rhoE "#/[a-z-]*" scripts | wc -l`) and about 55 route literals in 23 `src` files (`grep -rnoE "'/(transactions|review|invoicing|analysis|owner|year|settings)['?#]" src`). No redirects for old addresses.
5. **Filters scoped to the company app.** Today one filter state writes its keys into every route's query (`src/features/filters/application/filterStore.ts:29-50`) and every drill goes to `/transactions` (`:81`). The binding moves into the company app's install and applies to `/company` routes only.
6. **Settings per app.** The shell owns the Settings screen and its "This device" tab. General, Categories, Accounts and the pack's Ruleset come in as the company app's settings tabs (`src/features/settings/presentation/SettingsScreen.vue:31-40`).
7. **Storage per app, with one storage.** The store factory moves to the kernel and the registry creates one store per storage slot from the kinds of the apps in it. The cache builds its tables from those kinds instead of `WORKBOOK_TABS` (`workbookCache.ts:22-26`). The company's store is the only one, under the same choice key and the same Dexie name, so nothing on the phone resets. Setting the money format from the company workbook (`workbookStore.ts:229`) stays the company's for now.
8. **The dashboard slot waits for H4.** Overview and its waiting card stay the company's, as 12b leaves them. A tile slot with no reader would be dead code until the hub home exists.

### Boundary rules H1 adds

| Rule                                                                                                            | Exceptions                                                                               |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/shared` imports nothing from `src/shell` or `src/apps`                                                     | none                                                                                     |
| `src/shell` imports no app folder                                                                               | `main.ts` imports each `apps/<id>/app.ts`                                                |
| An app imports `src/shared` and its own folder only                                                             | Another app's `facts.ts`, and only from that app's one translation file. Empty until H5. |
| A pack imports its own app, its own folder and `src/shared`                                                     | none                                                                                     |
| A domain folder imports only domain folders of its own app and `shared/calendar`, `shared/money`, `shared/text` | 12b's rule, now per app                                                                  |
| Every pack kind name starts with its pack's id, and no two kinds of one app are equal                           | `tests/kindNames.spec.ts`                                                                |

### What stays as it is

The hub move itself kept the storage, the device keys, the base path, the Google scopes, the pack seam's shape, `Money`, the six company buckets, the ledger engine inside the company app, Overview and the data-source choice as they were. Later work changed several of them: the books moved from the Sheet to one JSON file per app ([#14](https://github.com/ipazanin/kuna/issues/14)), the app became Kuna with the base path `/kuna/` ([#22](https://github.com/ipazanin/kuna/issues/22)), and each app's file keeps its own currency ([#24](https://github.com/ipazanin/kuna/issues/24)).

### Visible changes for you to agree

Only the addresses, which gain `/company`. Bookmarks to old addresses land on the home screen.

### Size and proof

Large but mostly mechanical: about 390 files by import path, and about 25 edited by hand (`main.ts`, `App.vue`, routing, screens, the registry, `filterStore.ts`, `SettingsScreen.vue`, `autoSync.ts`, the store factory, the cache, the settings parser, the visual and touch check route lists). The hand count is an estimate. One commit, with the long checks run once at the end.

Proof, the same as 12b's:

- `npm run check` with the new boundary rules, `npm run build` with the fake-bytes check, `check:pwa`, `check:import`, the full `check:visual` and `check:touch` on the fake build, and on a fresh export `check:round-trip`, `parity:rules`, `parity:year-end`, `parity:payroll`.
- 12b's figure script on 12b's last commit and on H1, for the fake workbook in both modes and the export. Every figure and problem identical.
- The visual check's screenshots compared pixel by pixel between the two builds, with no difference.
- The Google request-shape tests unchanged in what they assert.
- The built entry chunk holds no company module. Its size before and after goes in the commit message, since nobody has measured it yet.

## 4. Roadmap

Sizes: small is under 20 files, medium 20 to 80, large over 80. Each is a rough estimate.

| Wave | What                                                                                                                                                                                                                                                                                                                           | Size              | Needs                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------- |
| H1   | Hub structure, as above                                                                                                                                                                                                                                                                                                        | large, mechanical | 12b deploy 3                                            |
| H2   | Second storage and an empty personal app: a store per storage, a choice and first run per storage, sync over every storage, one export per storage, the menu grouped by app, a personal Sheet the app creates under `drive.file` or a browser workbook. Decides where currency and number locale live once two storages exist. | large             | H1                                                      |
| H3   | Personal loans v1: loan, rate periods, an annuity or linear schedule, balance, next payment, payoff. Reads no ledger.                                                                                                                                                                                                          | medium            | H2                                                      |
| H4   | Hub dashboard v1: tile and waiting-job slots, the home moves from Overview to the dashboard, drills name the app they open, company and loan tiles                                                                                                                                                                             | medium            | H3                                                      |
| H5   | Company facts: `apps/company/facts.ts` with owner payments, the owner loan book and net owed. Loans shows the company loan read-only, the dashboard shows net owed.                                                                                                                                                            | medium            | H4, 12b stage 8                                         |
| H6   | Personal spending and budgeting: accounts, a ledger with ids from the first write, a personal bucket set, import, rules, review, budget lines and the budget comparison                                                                                                                                                        | large             | H5. Reusing the company import is easier after Wave 13. |
| H7   | Money crossing between the company and you: salary, dividends and reimbursements paired across both ledgers, an advance started from a personal row                                                                                                                                                                            | medium            | H6, Wave 13's ledger id                                 |
| H8   | Personal assets v1 and net worth: assets, dated valuations, mortgage equity by asset id, a net worth tile                                                                                                                                                                                                                      | small to medium   | H3, better after H6                                     |
| H9   | Stocks: `Money` with a currency, holdings, trades, dated prices                                                                                                                                                                                                                                                                | large             | H8                                                      |

### Against the current queue

Recommended order:

1. Wave 12b deploys 2 and 3, as planned.
2. **H1.** It depends on nothing in Wave 13, and a folder move is cheapest with nothing else in flight. Wave 13's new ingest code then lands in the company folder from the start.
3. Wave 13 and Wave 13b. They are queued, company-only, and Wave 13 gives the company ledger the ids H7 needs.
4. H2 to H5.
5. Wave 14 and the clients fix. Both are company-only and can slot between any two hub waves after Wave 13.
6. H6 to H9.

### Decisions left to each app's own discussion

Whether spending reuses the company ledger engine with buckets set per app (H6, 36 files import `bucket.ts` by `grep -rlE "domain/bucket'" src | wc -l`). Which loans: bank loans with a schedule, loans to and from family, or both (H3). Whether your residence city, birth year, second pillar and dependants move from `CompanyFacts` (`src/features/settings/domain/settings.ts:119-136`) to a person profile (H2 or H6). Whether net worth counts your stake in the company (H4, H8). Envelope budgets or one amount per category and month (H6). Whether `Money` gets a currency, which no app before stocks needs (H9).

## 5. Questions for the owner

### 1. One app, or separate apps?

Affects the installed app, sign-in and the menu. Today you open one installed Ledgerboard and press Sync once. With separate apps, Loans would be its own installed app with its own Sync button.

- **Keep one app with a section per app.** One install, one sign-in, one deploy. The dashboard reads every app in memory. Cost: H1.
- **Build separate apps at separate addresses.** Each installs and deploys alone. Cost: a repo and pipeline each, Vue and the UI kit shipped in each, and a dashboard that reads the other apps' browser databases, which is the shared-database coupling Grzybek warns about.

Recommendation: one app.

### 2. How is personal storage split?

Affects the first run of each personal app, Sync and the export. When you first open Loans, it asks where loans live.

- **Use one personal Sheet for every personal app.** The app creates it, with no Picker step. Loans, spending and assets share one accounts list, sync in one read and export as one file. Cost: one export holds all personal apps.
- **Use one Sheet per personal app.** Each app has its own file and first run. Cost: a file, a sync read and a first run per app, and the personal accounts that loans and spending both use live in only one of them.

Recommendation: one personal Sheet. The personal apps share accounts, which is how Firefly III and hledger model loans and assets.

### 3. May company and personal data ever share a storage?

Affects the company Sheet. With one file, a personal loan row would sit in the same Sheet the Apps Script writes the company ledger into.

- **Keep them apart always.** The registry refuses an app whose storage holds the other side's kinds, and the company Sheet stays a company record. Cost: a second file and a second sync read.
- **Allow one file for both.** One pick, one sync, one export. Cost: personal tabs need prefixed names, anyone who opens the company Sheet sees personal data, and splitting them later is a migration.

Recommendation: apart always.

### 4. How do personal apps get company facts?

Affects Loans and the dashboard showing what you and the company owe each other. Say the company lends you money on Monday. The company ledger has it after the next company sync.

- **Read company facts live.** Loans calls the company's published facts once both storages are loaded, so there is one copy of each fact. Cost: personal figures that use company facts are only as fresh as the last company sync.
- **Copy company facts into personal storage.** Personal screens work with the company storage unloaded. Cost: a copy rule on every sync, two copies that can disagree, and money counted twice once your personal statements are imported.

Recommendation: read live.

### 5. What is the home screen on day one?

Affects what opening the app shows. Today it is Overview, "How the company is doing" (`src/features/overview/presentation/OverviewScreen.vue:191`).

- **Keep Overview as home until a second app has tiles.** Nothing visible changes in H1. Cost: none now. The dashboard comes in H4.
- **Start a hub dashboard in H1.** A new home with company tiles only. Cost: a second screen that repeats Overview until another app exists, and a tile contract designed before its second user.

Recommendation: keep Overview until H4.

### 6. Does the hub keep the Ledgerboard name and address?

Affects the installed app's name, the address and the Google sign-in setup. Today the manifest says "Company finance dashboards over a Google Sheet or an Excel workbook" (`public/manifest.webmanifest:5`).

- **Keep the name and `/ledgerboard/`, change only the description.** Nothing moves. Cost: a few lines of text.
- **Rename it and keep the address.** New manifest name, titles and welcome text. Cost: small. Whether Firefox on Android updates an installed app's name without a reinstall is unverified.
- **Rename it and move the address.** A new repo path. Cost: reinstall the app, add a new OAuth redirect URI, and the old address stops working. Your data in this browser should survive, since every path on `ipazanin.github.io` is one origin, but that is reasoning, not tried.

Recommendation: keep the name and the address.

### 7. When does H1 run?

Affects the order of the queue.

- **Right after Wave 12b's third deploy.** The move happens with nothing in flight. Cost: Wave 13 starts one wave later.
- **After Wave 13.** Cost: little, the codemod moves Wave 13's files too. Personal apps start one wave later.
- **After the whole company queue (13, 13b, 14, the clients fix).** Cost: personal apps start several waves later, and every company wave adds files to move.

Recommendation: right after Wave 12b's third deploy.

## Found while checking the lanes

- **A new address would not lose this browser's data.** Lane 1 says moving off `/ledgerboard/` means choosing the Sheet again. GitHub Pages serves every repo of the account from one origin, and `localStorage` and IndexedDB belong to the origin, so the choice key and the cache should survive. The installed app and its service worker would not. Unverified on the phone.
- **Lane 3's reason for one personal Sheet does not hold.** It says personal writes across apps stay atomic, but its own rule is that no app writes another app's records. The better reason is the shared accounts list (question 2).
- **Lane 2 leans to one Sheet per app**, lanes 1 and 3 to one company and one personal Sheet. This proposal takes the second, for the reasons in questions 2 and 3.
- **Lane 2 wants a currency on `Money` in the refactoring wave.** No app before stocks needs one, so it waits for H9.
- **Counts differ slightly by method.** Lane 1 gives 34 importers of the buckets, 130 of `Money` and 50 of the store from its edge list. Plain greps give 36 (`grep -rlE "domain/bucket'" src`), 128 (`grep -rlE "shared/money/money'" src`) and 48 (`grep -rlE "application/workbookStore'" src`). No decision depends on the difference.
- **Route literals in `src`:** lane 1 counts 59 in 25 files. The narrower grep in section 3 gives 55 in 23. The codemod finds them either way.
