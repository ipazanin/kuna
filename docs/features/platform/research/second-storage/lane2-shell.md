# H2 lane 2: shell, routing, menu, settings, first run, sync button

Every place the shell and main.ts assume one installed app, what onboarding a personal app can reuse, how the menu, Settings and the sync button would take a second app, which checks assume one app, and how a second app folder fits the import-boundary spec. Read-only research at 286a002.

Read at 286a002 in the Kuna repo. Paths are relative to the repo. Nothing was run or changed.

The shell already loops over `installedApps()` for routes, menu entries, `start()` and Settings parts. What stays single is everything it takes from `homeApp()`: first run, subtitle, sync control and the Settings intro. Those, plus the Google return and the page token's scope set, are the real H2 work in this lane. The sync engine, onboarding and the fake Drive are company code today. Since one app may not import another, everything both apps need has to move to `src/shared`.

## 1. Where the shell and main.ts assume one app

| Place                         | Today                                                                                                                                                                                                                                                                                                                   | What a list of apps needs                                                          | Smallest change                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App loading                   | `src/main.ts:17-18` imports and installs the company app only                                                                                                                                                                                                                                                           | every app's `app.ts` loaded and installed in order                                 | Import each app's `app.ts` dynamically, then install them in order. The boundary spec already allows any `src/apps/*/app.ts` (`tests/importBoundaries.spec.ts:129-139`, `:82-84`)                                                                                                                      |
| Silent Google trip on open    | `src/main.ts:20` asks only `homeApp().asksGoogleOnOpen()`. The company answer reads the one choice key and the auto-sync switch (`src/apps/company/app.ts:65`, `src/shared/storage/infrastructure/workbookChoice.ts:4`)                                                                                                 | true when any app's storage is on Drive                                            | `installedApps().some((app) => app.asksGoogleOnOpen())`                                                                                                                                                                                                                                                |
| Scopes the page token carries | `needScopes` replaces one page-wide set (`src/shared/google/googleAuth.ts:79-82`), and the silent trip and every ask read it (`:164`, `:194`). The company's sync sets it from its steps (`src/apps/company/sync/presentation/useSync.ts:44-50`)                                                                        | the union of what every app needs                                                  | Key the needs by app id and join them in `googleAuth.ts`, or let the page-wide sync set them once (see the sync button below). A second caller today would wipe the company's Gmail and Drive-read scopes                                                                                              |
| Home app                      | `src/shell/routing/appRegistry.ts:15-22`, `src/shell/routing/router.ts:34` send `#/` to the first app's first screen                                                                                                                                                                                                    | stays, since the home is still the company Overview until H4                       | none                                                                                                                                                                                                                                                                                                   |
| First run                     | `src/shell/App.vue:37-48` watches only `home.firstRun()` and sends the page to `home.startPath`. `:57` hides the shell on the home's first run                                                                                                                                                                          | each app's first run, sending to its own `startPath`                               | Keep the home's first run as today, so a fresh device still lands in company onboarding from any address. Add: on a route under `/${app.id}`, that app's `firstRun()` sends the page to its `startPath`. One computed "app in first run" drives both the watch and `:57`                               |
| Subtitle                      | `src/shell/App.vue:57` passes `home.subtitle()`. `AppShell.vue:59` shows it under the brand and `:76` in the phone drawer                                                                                                                                                                                               | one line per app (company name, nothing for personal)                              | Move the subtitle under each app's heading in the grouped menu (see the menu section) and drop the brand subtitle                                                                                                                                                                                      |
| Sync control                  | `src/shell/App.vue:62-64` renders `home.syncControl`, which is `TopBarSync` (`src/apps/company/app.ts:62`)                                                                                                                                                                                                              | one control over every storage                                                     | See the sync button below                                                                                                                                                                                                                                                                              |
| Google return                 | `src/shell/App.vue:34` hands the same `googleReturn` to every app's `start()`. The company acts on `resume` `sync`, `find` and `pick` (`src/apps/company/workbook/presentation/useGoogleReturn.ts:17-28`). `PendingRedirect` names no app (`src/shared/google/googleRedirect.ts:20`, `:26-33`, validated at `:163-167`) | a `find` or `pick` resumed by the app that asked, and `sync` by the page-wide sync | Add `app: string` to `PendingRedirect`, filled by `requestAccess`/`tokenFor` callers (`googleAuth.ts:108-111`, `:193`, `:237`). `App.vue` passes the return to the app it names and null to the others. Otherwise a second app copying `useGoogleReturn` would open a second Picker after one tap      |
| Browser title                 | `src/shell/routing/router.ts:62-63` names the screen title only (`src/shared/routing/browserTitle.ts:7-8`)                                                                                                                                                                                                              | two screens called Overview tell apart                                             | Add a display `name` to `AppContribution` and put it in the title for every app screen, such as "Overview, Personal – Kuna". The checks read `screen-title`, not `document.title`, except the Settings tab flow (`scripts/support/pageTabFlows.mjs:55`, `:63`), so a Settings title must stay as it is |
| Phone top-bar title           | `src/shell/ui/AppShell.vue:52`, `:85` shows the screen's label                                                                                                                                                                                                                                                          | same ambiguity on a phone                                                          | Same `name`, shown only for a non-home app if the bar gets tight. The touch check expects "Overview" for the company (`scripts/touch-check.mjs:226`)                                                                                                                                                   |
| Settings intro                | `src/shell/settings/SettingsScreen.vue:42` shows `parts[0].intro()`, which is company wording about the workbook and the law (`src/apps/company/settings/presentation/companySettings.ts:26-29`)                                                                                                                        | text that fits the whole screen                                                    | A shell-owned sentence, or each app's intro over its own tabs                                                                                                                                                                                                                                          |
| Route prefix guard            | `src/shell/routing/router.ts:83-88`                                                                                                                                                                                                                                                                                     | already per app                                                                    | none                                                                                                                                                                                                                                                                                                   |
| Drive file per app            | `documentName(app)` and `appProperties` `kuna=<app>` (`src/shared/storage/infrastructure/driveDocument.ts:31-43`, `:74-88`)                                                                                                                                                                                             | already per app: `kuna-personal.json`, found by its own mark                       | none                                                                                                                                                                                                                                                                                                   |

`AppContribution` (`src/shared/app/appContribution.ts:37-61`) needs one new member for all of this: a display `name`. `syncControl` changes shape if the sync button follows the recommendation below.

## 2. Onboarding

Flow: `OnboardingScreen.vue:23-32` maps the steps. The place lives in the route query (`onboardingSteps.ts:81-110`). Paths are new, bring, open and move (`onboardingSteps.ts:9`, `:51-62`).

**Company-specific**

- Welcome wording about books and Kuna files (`WelcomeStep.vue:14-18`) and the tagline (`OnboardingScreen.vue:60`).
- The Company and Statement steps.
- The statements, mail and invoice-drafts parts of Access (`AccessStep.vue:38-64`, `:117-163`) and its scopes (`onboardingScopes.ts:15-26`).
- Statement settings written into new books (`HomeStep.vue:35`, `FolderStep.vue:62`).
- The mail statements folder (`FolderStep.vue:55`, `:66`, `:97-100`), the xlsx import of the bring path (`FileStep.vue:7-10`, `:61-73`) and the getting-set-up lines (`gettingSetUp.ts:20-34`).
- `FolderStep.vue:95` hardcodes `kuna-company.json`. It should read `documentName`.

**What a personal app would reuse**

| Piece                                                | Where                                                    | Ties to the company                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Drive or this browser                                | `HomeStep.vue:20-23`, `:29-43`                           | creates company books through `useWorkbook()`                                                    |
| Google access for the file alone                     | the `drive.file` line of `AccessStep.vue:98-104`         | the rest of the step is company                                                                  |
| Folder pick and confirm, then "Create the file here" | `FolderStep.vue:42-52`, `:57-73`, `:86-106`              | `store.pickBooksFolder` and `useKeepOnDrive` (`useKeepOnDrive.ts:28-57`) are company store calls |
| Find by the app's mark, or pick                      | `FindStep.vue:11-44`, `useFindDriveFile.ts:19-42`        | company store. `findDriveDocument` underneath is already per app                                 |
| Token then action in one tap                         | `withGoogleAccess.ts:9-14`                               | none, it imports only `src/shared`                                                               |
| Step card with Back                                  | `StepCard.vue:5-6`, `:14`, `:22-31`                      | calls `useOnboarding()` for Back                                                                 |
| Stepper and the ledger-page layout                   | `OnboardingScreen.vue:34-38`, `:50-78`, styles `:80-184` | none in the markup                                                                               |
| Route-held place                                     | `useOnboarding.ts:10`, `:35-45`                          | `ONBOARDING_ROUTE` is `/company/start`, and finish goes to `/company`                            |

Everything that touches the books goes through the company store (`src/apps/company/workbook/application/workbookStore.ts:49-76`). `createWorkbookStore` is typed to the company `Workbook` (`createWorkbookStore.ts:5-6`). The personal first run depends on the storage lane's generic store.

**Minimal first run for an empty personal app**: one bare route `/personal/start` with three paths.

- New on Drive: Home, Google (drive.file only), Folder.
- New in this browser: Home, which makes the empty document and finishes.
- Open on Drive: Google, Find.

It ends on `/personal`, the personal Overview. There is no bring path in H2, since there is nothing to bring.

**Where the shared part lives.** Not in `src/shell`. An app may import only its own folder and `src/shared` (`tests/importBoundaries.spec.ts:141-143`), so steps in the shell could never reach an app's store. Recommendation:

- Move to `src/shared` only what is already app-free: `withGoogleAccess` (to `src/shared/google`), and a first-run page with stepper and a step card that takes `back` as a prop (to `src/shared/ui`).
- Write the personal steps in `src/apps/personal/onboarding` against the generic store, and leave the company flow as it is.
- Lift Home, Folder and Find into shared steps when the second personal app (H3 loans, own file per the owner's decision) would copy them a second time.

One consequence to accept or change: on a fresh device the shell is hidden during company onboarding (`App.vue:56-57`), so Personal cannot be reached before the company is set up. That costs nothing while the owner is the only user.

## 3. Menu grouped by app

Today `App.vue:22-30` flattens every app's `menu()` into one list and adds Settings with `setApart`. `ScreenNavigation.vue:23-37` renders one `ul` of `NavigationEntry` (`:2-11`). From 1024 px it is a sidebar with the brand, the menu and the sync slot (`AppShell.vue:56-65`). Below that it is a top bar with a left drawer (`AppShell.vue:67-90`), and on a phone the bar shows the screen title (`:85`). There is no bottom nav.

Grouping needs:

- `App.vue` builds groups `{ name, subtitle, entries }` per installed app, then Settings set apart.
- `ScreenNavigation` renders a heading per group (a visible label with `role="group"` and `aria-labelledby`, or one `nav` list per app), and the app's subtitle under its heading.
- `name` on `AppContribution`. `menuCount` stays per app (`app.ts:57`).

The touch check's drawer step presses Tab 12 times inside the drawer (`scripts/touch-check.mjs:255-260`) and taps "Transactions" (`:270`). Both still hold with more entries.

An app with no data: with no choice kept, the first-run rule above sends `/personal` to `/personal/start`. With an empty document chosen, the personal Overview shows an empty state the way `LedgerGate.vue:44-56` does for an empty ledger. The menu shows the Personal heading with Overview alone.

## 4. Settings

- **Shell**: the frame, the tab strip with the unique-value guard (`SettingsScreen.vue:19-28`), This device last (`:29-32`) and the Appearance card (`:49-54`, `AppearanceCard.vue`).
- **Company**: General, Categories and Accounts (`companySettings.ts:11-15`), plus the pack's tabs such as Ruleset (`:24`), shown only with books on screen (`:24`).
- **Company device cards**: Data source, with Sync while on Drive (`:25`).
- **Page-wide controls in company cards**: Sign out of Google sits in Data source (`DataSourceCard.vue:72-74`, `:169-174`). The auto-sync switch sits in the Sync card (`SyncCard.vue:17-23`) under one device key `kuna.auto-sync` (`autoSyncSwitch.ts:3`). Both are page-wide, so H2 moves them to the shell or to the shared sync.

A second app adds itself through `settings()` (`appContribution.ts:25-31`), loaded with the screen (`src/shell/routing/screens.ts:12`), in install order (`SettingsScreen.vue:13-14`, `:33`). An empty personal app needs no tab yet. It adds one device card for where its file lives. Two cards both titled "Data source" (`DataSourceCard.vue:90`) need app names, such as "Company books" and "Personal books". A later Personal tab needs its own value, such as `personal`, since `general` is taken and the guard throws.

## 5. Checks that assume one app

| Check                            | Assumption                                                                                                                                                                       | H2 update                                                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/importBoundaries.spec.ts` | The sanity test names company files (`:119-120`). `SPREADSHEET_MAPPING` and `ADAPTER_WIRING` list company files (`:103`, `:106`)                                                 | Add the personal store's wiring file to `ADAPTER_WIRING`, and a sanity line for `src/apps/personal/app.ts`                                                                                                                          |
| `tests/kindNames.spec.ts`        | company kinds only (`:3-9`)                                                                                                                                                      | a personal twin once it has kinds                                                                                                                                                                                                   |
| `tests/onboarding.spec.ts`       | company step machine (`:4-7`)                                                                                                                                                    | a spec for the personal steps                                                                                                                                                                                                       |
| Fake seeding                     | runs in the company install (`app.ts:37-43`). `?fake=empty` clears the one choice key (`seedFakeWorkbook.ts:34-36`)                                                              | a personal seed in the personal install behind the same inline guard, a personal axis for the variants, and per-app choice keys from the storage lane                                                                               |
| Fake Drive                       | session and Books folder are company-private (`fakeDriveSession.ts:8-25`). The fake Picker takes the first file in Books (`:38-44`)                                              | move it to `src/shared/storage/infrastructure/fake`, since personal may not import it from the company (`importBoundaries.spec.ts:141-143`). Pick and find by app, or the Picker can return `kuna-company.json` to the personal app |
| `assert-no-fake-bytes.mjs`       | markers in `scripts/support/devOnlyMarkers.mjs`                                                                                                                                  | a personal fixture carries `FAKE_WORKBOOK_MARKER`                                                                                                                                                                                   |
| `visual-check.mjs`               | Welcome at `#/` with `fake=empty` (`:301`), onboarding at `/company/start` (`:303-311`), Settings and device lists (`:253-284`, `:312-316`)                                      | add personal first run, personal empty Overview, the grouped sidebar and drawer, and This device with two storage cards                                                                                                             |
| `touch-check.mjs`                | one 44 px sync button in the bar (`:225-243`), drawer marks Overview (`:249-251`). Google returns are written as `kuna.google-redirect` with no app (`:1384-1392`, `:1489-1502`) | add `app` to those payloads if `PendingRedirect` gains it. Add a resumed find for the personal app                                                                                                                                  |
| `check-pwa.mjs`                  | company onboarding step (`:182`), offline routes under `/company` (`:191`, `:194`, `:243`)                                                                                       | holds as is. One offline personal route is cheap to add                                                                                                                                                                             |
| `figure-digest.mjs`              | company engines only (`:14-80`)                                                                                                                                                  | no change for an empty app                                                                                                                                                                                                          |

## 6. Import boundaries

The rules live in `tests/importBoundaries.spec.ts`, a vitest spec. There is no ESLint config and no `scripts/check-*` rule. `scripts/check-foreign-import.mjs` is a browser check of xlsx import.

How `src/apps/personal` plugs in:

- **Generic already**: `appOf` (`:72-74`), `packOf` (`:77-79`), `isAppEntry` (`:82-84`), and `isStorage` for any `src/apps/<app>/workbook/` (`:94-96`).
- **Shared stays clean**: it imports nothing from the shell or the apps (`:125-127`).
- **Shell stays clean**: it imports no app, except `main.ts` loading each `app.ts` dynamically (`:129-139`).
- **Apps are walled off**: an app imports its own folder and `src/shared` only (`:141-143`). Personal can never reuse company onboarding, sync or the fake Drive in place.
- **Domain**: domain files import their own app's domain and four shared folders (`:91`, `:162-170`).
- **Storage adapters**: reachable only from storage folders, `app.ts` and fakes (`:178-190`). Personal store code must sit under `src/apps/personal/workbook/`.
- **Application off infrastructure**: application code imports no infrastructure, apart from `ADAPTER_WIRING` (`:192-194`). The personal store's wiring file has to join that list.

## Sync button

The engine is all company code:

- `createSync` takes one books step and assumes one `workbook()` (`src/apps/company/sync/application/sync.ts:9-39`). A failed read of the books skips every later step.
- The steps are company mail and statements (`useSync.ts:30-42`).
- The control is worked out from one store (`useSync.ts:123-135`).
- Auto-sync watches one store (`autoSync.ts:32-74`) and starts in the company's `start()` (`app.ts:70-83`).
- `TopBarSync` shows the export reminder for books in the browser, or the sync for books on Drive (`TopBarSync.vue:23-32`).

Two ways to sync over every storage:

- **One run with a books step per storage.** Move `syncRun`, `createSync`, auto-sync, the switch, `SyncStatus` and `SyncStepList` to `src/shared/sync`. `AppContribution.syncControl` becomes the app's steps grouped behind its books step, and the shell owns the one page sync, one control and one auto-sync loop. A failed company read then skips only the company's steps. Cost: `createSync`'s single-books model becomes a list of groups, and the scope needs join in one place, which also fixes `needScopes`.
- **Each app keeps its own sync, and the shell button runs them in turn.** Cost: two runs and two controls to merge into one button, and two auto-sync loops on the same visibility event.

Recommendation: one run. The button, the step list and Settings' Sync card then show every storage in one place.

Open for the owner: what the top bar shows when one storage is on Drive and the other in this browser. Today it shows either the sync button or the export reminder (`TopBarSync.vue:23-32`). With one export per storage, the plainest answer is the sync button for the Drive storages, plus each browser storage's reminder in its own device card and a dot on the button while an export is due.
