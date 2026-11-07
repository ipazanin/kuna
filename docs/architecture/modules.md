# Module map

Kuna is a modular monolith. It is one Vite build, one PWA and one deploy, and inside it each app is a module with its own folder, its own record kinds and its own file. A module owns its records and its rules, publishes a small contract that is not its internal model, and imports only what this map allows. One write touches one file, so a save is all or nothing.

The reasons for this shape, and the patterns it was weighed against, are in the [hub design](hub.md). Paths and lines below are against the code at `0717599`.

## The modules

| Module                          | Owns                                                                                                                                                                                           | Published contract                                                                                                             | May import                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `src/shell`                     | The frame, the router, the app registry, the home, Net worth, Kuna settings and the page's one sync                                                                                            | Nothing to the apps                                                                                                            | `src/shared`. It sees apps only as the `AppContribution` each one hands over, which `src/main.ts:19-22` loads and installs |
| `src/apps/company`              | The company ledger, buckets, roles, category rules, imports and the dry run, review, splits, invoicing, receivables, analysis, mail filing and onboarding, kept in `kuna-company.json`         | `companyApp`, an `AppContribution` whose hub part does not count into the personal sum (`src/apps/company/app.ts:71`)          | Its own folder and `src/shared`. Only its `app.ts` imports the pack                                                        |
| `src/apps/company/packs/hr-doo` | The Croatian d.o.o. rules: VAT, owner pay, payroll, dividends, owner loans and advances, year end, the ruleset, and its own record kinds prefixed `hr-doo.`                                    | `PackContribution` to the company app (`src/apps/company/packs/packContribution.ts:59-79`), installed by `installPack` (`:98`) | Its own folder, the company app and `src/shared`                                                                           |
| `src/apps/loans`                | Bank loans and their plans, rate periods, the subsidy, informal loans and their movements, scenarios, kept in `kuna-loans.json`                                                                | `loansApp`, whose hub parts count as has and owes (`src/apps/loans/app.ts:55`)                                                 | Its own folder and `src/shared`                                                                                            |
| `src/apps/investments`          | Instruments, trades, income, cash per account, FIFO lots, the prices file, which price vendors need a key, performance and tax, kept in `kuna-investments.json` with its prices file beside it | `investmentsApp`, whose hub part counts as has (`src/apps/investments/app.ts:85`)                                              | Its own folder and `src/shared`                                                                                            |
| `src/apps/assets`               | Assets and valuations, a flat's value carried by the DZS index, a car's estimate from the customs table, equity after a linked loan, kept in `kuna-assets.json`                                | `assetsApp`, whose hub part counts as has (`src/apps/assets/app.ts`)                                                           | Its own folder, `src/shared`, and Loans' published `facts.ts` from one file only                                           |
| `src/apps/spending`             | Accounts per currency, transactions, categories with a parent, budgets with carry-over, statements and their rules, the bank sync, receipts and their lines, kept in `kuna-spending.json`      | `spendingApp`, whose hub parts count as has and owes (`src/apps/spending/app.ts`)                                              | Its own folder and `src/shared`                                                                                            |
| `src/shared`                    | The kernel: value types, the document storage, Google, sync, the UI kit and charts                                                                                                             | Exported types and functions, never an app's records                                                                           | `src/shared` only                                                                                                          |

`src/apps/company/spending` is the company's cost breakdown, a feature of the company app. The Spending app has its own folder, `src/apps/spending`.

## Inside a module

An app is cut by business feature, such as `bankLoans`, `holdings` or `rules`, and each feature holds `domain`, `application`, `infrastructure` and `presentation` folders. Dependencies point inward.

- Domain code imports only its own app's domain code and the domain parts of the kernel: `src/shared/storage/domain/`, `src/shared/calendar/`, `src/shared/money/` and `src/shared/text/` (`tests/importBoundaries.spec.ts:86-91`, `:164-172`).
- Application code imports no infrastructure, except the files that wire adapters in (`:105-111`, `:194-196`).
- Storage adapters live in `src/shared/storage` and each app's `workbook/infrastructure`, and only storage code, an app's `app.ts`, the fake seeds and a pack's tab mappings import them (`:93-100`, `:180-192`).
- Each kind an app stores has a name of its own, and a pack's kinds start with the pack's name (`tests/kindNames.spec.ts:16`, `:22`).

## Published contracts

A contract is the types a module gives others, kept apart from the types it computes with. A change to the internal model then breaks one translation file, not the reader's screens.

### What an app gives the shell

`AppContribution` (`src/shared/app/appContribution.ts`) lists an app's id, name, colour, screens, menu, Settings, home card, hub part, set-up lines, first run, suggested set-up order, sync group, what it tells the chat (`assistant`, a lazy `AppAssistant`, in `src/apps/<app>/assistant/`) and what it starts while the page is open. The shell never sees an app's records. Net worth reads each app's hub part as labelled figures with a caption and a link (`HubPart`, `CountedHubPart` and `AppHub`, `:55-81`). An app that counts adds its parts into the personal sum, and one that does not, the company, shows its parts beside it. `personalNet` adds them up (`src/shared/app/personalNet.ts:34`, called from `src/shell/netWorth/NetWorthScreen.vue:56`), and `homeCardFigures` turns an app's store state into figures, a wait or a failure (`src/shared/app/homeCardFigures.ts:4-15`).

Each app builds its hub part from its own model in its own file: `companyHubFigures` (`src/apps/company/home/presentation/companyHubFigures.ts:9`), `loansHubFigures` (`src/apps/loans/home/presentation/loansHubFigures.ts:12`) and `investmentsHubFigures` (`src/apps/investments/home/presentation/investmentsHubFigures.ts:8`).

### What the pack gives the company app

`PackContribution` is the company app's only way into the pack. Core code never imports pack code. It calls the slots, such as `ownerTakeOut` (`src/apps/company/packs/packContribution.ts:67`), which the company's hub part reads through `shownPack` (`src/apps/company/home/presentation/companyHubFigures.ts:13`). Without the pack, `NO_PACK` answers every slot with nothing (`src/apps/company/packs/packContribution.ts:81`).

### What one app publishes to another

An app may publish facts in one file, `src/apps/<app>/facts.ts`, with types of its own. A reading app imports it from one translation file and nowhere else. The first use is Loans' published bank loans for Assets. Loans keeps `BankLoan` with its principal, dates, instalments, interim interest, subsidy and repayment type (`src/apps/loans/workbook/domain/bankLoan.ts:29-41`). It publishes `PublishedBankLoan`, which holds only a key, a name, what is owed on the day and a link. Assets reads it in `src/apps/assets/loans/application/assetLoans.ts`. The company's own facts for the personal apps, such as the owner loan, would follow the same rule.

## What may import what

`tests/importBoundaries.spec.ts` runs with the unit tests and names the file, the line and the import of each break.

| Rule                                                                                           | Lines                     |
| ---------------------------------------------------------------------------------------------- | ------------------------- |
| The spec reads the imports it checks: each app is loaded by `main.ts`, and no import dangles   | `:123-131`                |
| `src/shared` imports nothing outside `src/shared`                                              | `:133-135`                |
| `src/shell` imports no app. Only `main.ts` reaches an app, by a dynamic import of its `app.ts` | `:137-141`                |
| An app imports its own folder and `src/shared`, so no app imports another                      | `:143-145`                |
| An app's code outside its packs imports no pack code. Only the app's `app.ts` does             | `:147-149`                |
| A pack imports its own folder, its app and `src/shared`                                        | `:151-162`                |
| Domain code imports its own app's domain and the kernel's domain folders                       | `:164-172`                |
| Row numbers stay in the spreadsheet adapter and record ids with their maker                    | `:174-178`                |
| Storage adapters are imported only by storage code, `app.ts`, fake seeds and pack mappings     | `:180-192`                |
| Application code imports no infrastructure, except the adapter wiring files                    | `:194-196`                |
| A brand is declared only in the files that own one                                             | `BRAND_OWNERS`            |
| `figure-digest.mjs` reads figures from domain code, but for a list that only shrinks           | `FIGURES_IN_PRESENTATION` |

The rules "no app imports another" and "shared imports no app" are what force every reuse through `src/shared`.

## Shared modules

| Folder                    | Holds                                                                                                                                                                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/app`          | `AppContribution`, the hub contract, `personalNet`, `homeCardFigures` and this device's set-up answers                                                                                                                                                                                                               |
| `src/shared/ai`           | The AI tasks and tools as types, masking, the cited answer, the model loop, the egress guard, one adapter per provider, the one file that reads a key, the provider list, this device's assistant switches, the Assistant card, and the chat: its catalogue, its two tools, the panel and the tag. It writes nothing |
| `src/shared/calendar`     | `CivilDate`, month keys, date ranges and their labels                                                                                                                                                                                                                                                                |
| `src/shared/categorising` | `Rule`, `categorise`, `TransactionFacts`, the IBAN and card tests, and `CategorisableRow`, the structural row the rules read                                                                                                                                                                                         |
| `src/shared/charts`       | ECharts setup, axes, tooltips, chart dots, the chart range select and the category swatches                                                                                                                                                                                                                          |
| `src/shared/files`        | Downloading a file and hashing it                                                                                                                                                                                                                                                                                    |
| `src/shared/google`       | Sign-in, scopes, the Drive client and the Picker                                                                                                                                                                                                                                                                     |
| `src/shared/layout`       | The viewport and sticky bands                                                                                                                                                                                                                                                                                        |
| `src/shared/mail-filing`  | `fileMail`, `MailSource<Books>`, Gmail search and its window, the filed-file properties, the PDF statement naming, the Gmail and folders adapters, the fake mailbox over an app's seed and the plan list                                                                                                             |
| `src/shared/money`        | `Money`, `Percent`, `Share`, decimals, money formats, typed amounts and the ECB conversion rule (`RateBook`)                                                                                                                                                                                                         |
| `src/shared/rates`        | The ECB fetch and its fake twin                                                                                                                                                                                                                                                                                      |
| `src/shared/routing`      | The browser tab's title                                                                                                                                                                                                                                                                                              |
| `src/shared/secrets`      | `kuna-secrets.json` in the app's hidden Drive folder, its merge and sync, the fold of the old keys files, this browser's secrets and the key rows of a card                                                                                                                                                          |
| `src/shared/storage`      | Record kinds and ids, the store, the Drive and browser homes, the one Kuna folder and the move into it, the first run                                                                                                                                                                                                |
| `src/shared/styles`       | The app's CSS and design tokens                                                                                                                                                                                                                                                                                      |
| `src/shared/sync`         | The page's one sync over every app's group                                                                                                                                                                                                                                                                           |
| `src/shared/text`         | Folding, the rules' folding, fact and occurrence keys, plurals, the language and the translation types                                                                                                                                                                                                               |
| `src/shared/theme`        | Light and dark                                                                                                                                                                                                                                                                                                       |
| `src/shared/ui`           | The design library: cards, dialogs, form grids, tiles, figure tables, the money input and others                                                                                                                                                                                                                     |
| `src/shared/xlsx`         | Sheet grids for the xlsx export                                                                                                                                                                                                                                                                                      |

### When a capability moves into `src/shared`

A capability gets one owner in `src/shared` when two modules use it and both change it for the same reason. With one user, it stays in that app. Two copies that change for different reasons stay two copies.

- **Moves.** The find-or-pick resume that Loans and Investments repeat (`src/apps/loans/app.ts:61-74`) changes whenever the shared find-or-pick flow changes, so Assets' plan moves it to `src/shared/storage/presentation/resumeFileLookup.ts` before a third copy appears.
- **Stays.** The DZS house price index has one user, Assets. Investments fetches prices by GET from vendors with quotas, while the DZS takes a POST and answers JSON-stat on a statistics office's release cycle. The two change for different reasons.
- **Stays apart.** Performance's periods and the shared chart ranges look alike, but they change for different reasons, so Performance's domain does not import `src/shared/charts`.
- **No shared ledger.** Company and spending share only the fields the rules read. A shared transaction type would pull owner share and the balance chain into spending, or strip them from the company.

A shared module's contract is its exported types and functions, and none of them takes an app's books. Each app builds the input from its own model and keeps that builder, as `categorisationContextOf` does for the company (`src/apps/company/rules/domain/categorisationContext.ts`).

## Extractions for spending and AI assist

What the company app and Investments held and spending and AI assist would change for the same reason has moved, up to spending's statements stage. The duplicate-row key has no module of its own: `occurrenceKeys` sits beside `factKey` in `src/shared/text/factKey.ts`, and the camt and profile readers stay in Company, since neither OTP nor Revolut gives camt and the profile reader cannot read Revolut.

Each move is a relocation plus import paths, lands in its own commit with `npm run check`, the boundary spec and `check:figures` identical before and after, and only then does spending import it. The order:

1. The ECB rule and fetch, and the category swatches, before spending v1.
2. Spending v1, which imports none of the moved company code.
3. `foldRuleText` into `src/shared/text`, beside `fold` (`src/shared/text/fold.ts`), then the rules core.
4. Mail filing made generic, then moved.
5. The duplicate-row key, into `src/shared/text`.
6. Spending's statements stage.
7. The secrets file, as the first stage of the AI assist plan.
8. Spending's receipts stage.

The [spending plan](../features/spending/plan.md) and the [AI assist plan](../features/ai-assist/plan.md) give each step's files and checks.

## How the boundary spec will state it

None of these is a new kind of rule.

1. Add `spending` and `assets` to the apps the first test checks (`tests/importBoundaries.spec.ts:124`), and their stores to `ADAPTER_WIRING` (`:106-111`).
2. `DOMAIN_SHARED` holds `src/shared/categorising/domain/` and `src/shared/mail-filing/domain/`, so an app's domain code may import them. A shared module's adapters go in `infrastructure` folders, which domain code still may not import, and `src/shared/rates` holds only those.
3. Keep "no app imports another" (`:143-145`) with one table of exceptions: each published `facts.ts` and the one file of another app that may import it, starting with `src/apps/loans/facts.ts` read by `src/apps/assets/loans/application/assetLoans.ts`. A new case checks that every listed reader exists and imports the file, and that `facts.ts` imports nothing outside its app and `src/shared`.
4. A shared capability module imports no other capability module except through its domain, so `categorising`, `mail-filing` and `rates` do not grow into one. Moving `foldRuleText` to `src/shared/text` removes the only edge between them.

`tests/kindNames.spec.ts` extends to the new apps' kinds.

## Sources

- [Hub design](hub.md), its target and its boundary rules
- [Assets plan](../features/assets/plan.md), its module map
- [Spending code research](../features/spending/research/lane1-code.md), its module map
