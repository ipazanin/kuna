# H2: a second storage and a second app

How Kuna goes from one app with one books file to two apps with a file each, checked against 286a002, in five stages and one commit, with the two decisions it needs from the owner.

Checked against 286a002 by two lanes: [storage, store and sync](research/second-storage/lane1-storage.md) and [shell, menu, settings and first run](research/second-storage/lane2-shell.md). Line references are in the lane reports.

## What you will see

- The menu gets a heading per app. Company keeps its screens and shows the company name under its heading. The second app shows one screen, an empty Overview.
- Opening the second app the first time asks where its file lives: a new file on Drive, a new file in this browser, or an existing one on Drive. A Drive file is `kuna-<app>.json`, found on other devices by its tag, with its own backups.
- One Sync button reads both files, then the company's statements and mail. A failed read of one file skips only that app's steps.
- Settings, This device shows one card per app's file ("Company books", "<App> books"). Sign out of Google and the auto-sync switch move to a card of their own, since they act on the whole page.
- Browser titles name the app, so two Overviews tell apart.
- Every company figure stays the same. The home stays the company Overview until the hub dashboard (H4).

## What the lanes found

The document layer is already per app: file name, tag, backups, browser database, cache, format and the write path all take an app id. What assumes one app sits one level up, in code that is generic in shape but lives in the company folder: the workbook store, its Drive ports, the Google Drive access, the fake Drive, the sync engine and auto-sync. One app may not import another, so these move to `src/shared` with the app id as a parameter. An empty document already encodes, decodes and takes a first write.

Five things turn wrong with two storages and get fixed here:

1. One device key remembers which file this device uses (`kuna.workbook-file`). It becomes one key per app.
2. The store sets the page's money format each time it shows books. Two stores would race and the last one to load would win.
3. Keeping one app's file in the browser signs the whole page out of Google, which would cut the other app off Drive.
4. A phone sign-in that resumes "find" or "pick" remembers no app, so both apps would open the Picker.
5. The scopes the page token asks for are one list that the company sync overwrites. A second app would wipe the company's Gmail and Drive read scopes.

## Stages, one commit

0. **Baseline.** `check:figures` on the four fake sets and the live file at 286a002.
1. **Shared store, no behaviour change.** Move the store factory, its Drive ports, the Google Drive access, the fake Drive and `withGoogleAccess` into `src/shared`, with the app id as a parameter. The store is typed over the app's read model and keeps its field names, so the screens that read the books stay untouched. The choice key becomes `kuna.workbook-file.<app>`. Reading a file checks its `app` field. The money format moves out of the store: each app gives its format and the shell applies it for the app on screen. Keeping a file in the browser forgets Google only when no other file is on Drive. Figures identical to stage 0.
2. **Sync over every storage.** The sync engine, auto-sync, the switch and the step list move to `src/shared/sync`. A run is one group per app, each a books step plus that app's own steps, read one after another under one tap. The shell sums every app's scopes into one list. The silent sign-in on open asks every app. A pending Google redirect carries its app, and only that app resumes it.
3. **Shell for several apps.** `AppContribution` gains a display `name`. The menu is grouped by app with the subtitle under each heading. Each app's first run applies to its own routes, and the company's still applies to a fresh device. Settings gets a shell intro and a page-wide card for sign-out and auto-sync. The shell owns the one sync control.
4. **The second app.** `src/apps/<app>` with `app.ts`, an empty Overview, a three-path first run on `/<app>/start`, its device card, and an export that downloads the file as JSON. Import already reads it back. The fake build gets a seed for it, with its own browser id and a fake Picker that picks by tag.
5. **Checks.** The boundary spec learns the second app. New specs cover the per-app choice key, the grouped sync with one group failing, the redirect app, and the scope union. The visual check adds the grouped menu, the second app's first run and empty Overview, and This device with two cards. The touch check adds the app to its redirect payloads and a resumed find for the second app. `check:pwa` adds one offline route.

Size: large, mostly moves. About 50 files change imports, and the 70 that read the books do not.

## Proof

- `check:figures` identical to stage 0 after stages 1, 2 and 3, and on the live file.
- Your live file reads and saves to the same bytes.
- On the fake Drive build: the second app's first run creates `kuna-<app>.json` beside the company file, a second fake device finds it by tag, Sync reads both, and making one file fail skips only its app's steps.
- Quick checks locally, full visual and touch suites in CI.

## Settled without asking

- **The company's choice key is renamed, not read once.** Each device needs one "Find the file" tap after the deploy. Your books are on Drive, so nothing is lost. Books kept only in a browser would lose their pointer, and no device of yours does that.
- **The top bar with one file on Drive and one in the browser** shows the Sync button for the Drive files and a dot while a browser file's export is due. Each browser file's reminder sits in its own card.
- **The second app cannot be opened before company onboarding finishes** on a fresh device. That costs nothing while you are the only user.
- **The first-run steps are not lifted into shared code yet.** The second app writes its own three short steps. They get lifted when a third app would copy them.

## Decisions for the owner

The owner, 2026-10-28: both as recommended. The second app is Loans (`src/apps/loans`, `kuna-loans.json`), and each app's file keeps its own currency and format.

1. **Which app is the second one.** You decided one file per personal app. An empty "Personal" app would get `kuna-personal.json`, which no later app uses, since Loans would get `kuna-loans.json`. I recommend making the second app Loans from the start, with an empty Overview that H3 fills.
2. **Where currency and number format live.** Today they are company settings. I recommend each app's file keeps its own, and the app on screen sets the format. The alternative, one device-wide format, would make the invoice PDF change with the device that made it. Until the second app has settings, it shows euros in the en-GB format. Showing company figures inside the second app later (H5) will need money formatting that takes its currency explicitly.
