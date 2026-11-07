# Changes queue while a save runs

How a second change stops being refused while a save runs (issue #62). Checked against `704a05c`. The owner answered the two decisions at the end, and all the stages are built.

## What you will see

- Tap the loan bucket switch. It moves at once, grays out and spins until the save lands. Everything else stays usable.
- Tap another switch meanwhile. It waits its turn and saves on top of the first.
- A save that fails flips its control back, and a red toast says why.
- Closing the tab while a save waits brings up the browser's own warning, where the browser has one.

## What the code does today

- `writeCounted` throws `WorkbookWriteRefused(words.busy)` while `state.writing` is set or a sync reads (`createWorkbookStore.ts:373`). `moveIntoKuna` (`:483`) and `dropWorkbook` (`:513`) do the same.
- `readDrive` returns silently while a write runs (`:296`), so the sync waits first with `whenIdle` (`pageSync.ts:102`, `sync.ts:115`).
- A write's changes are made at the tap, by `changesOf(work)`. They hold records read at that moment, as `change(record, { ...record, bucket })` does (`LoanBucketSwitch.vue:39`). So running `work` later would change nothing.
- `checkWrite` finds each record by its identity and refuses it unless it still equals `before` (`recordWrites.ts:100-117`).
- `useRecordWrites` keeps one `running` key (`useRecordWrites.ts:53`), so the first write to finish would clear the second one's spinner.
- `state.writing` is read 54 times in 26 files, most of them to disable a control. The list is under the last stage.

Two lines of the issue are wrong, and the plan does not follow them. `CompanyFactsCard` does not save on change: its switches edit the form's draft, and the form's Save writes them. The `RulesTab` switch does not save on change either: it opens `RuleChangeDialog`, which asks first.

## The design

### The plainest queue, and why it is not enough

The plainest design is a promise chain in the store, with screens showing only what landed. It takes about ten lines, and it fails on the first real example. On the Investments checks card, turn a check's switch and then change its threshold while the switch saves. Both edits name the same record, and the second holds `before` from the old read. Its turn comes, `findStored` sees a record that differs, and it answers "changed since the app read it". The same happens to a second tap on the Spending category arrows, because each swap is worked out from the order on screen. The switch also could not move until the save landed, so a flip back would need state in each screen.

### The design: one lane, and the screen shows what is queued

**Where it lives.** Inside `createWorkbookStore`, so every app gets it through `store.write` and `store.undo` with no app code. Each store has its own lane, because one write touches one file. A lane is a promise chain, so one job of a file runs at a time, in tap order. Writes, the sync's read and a move all run in it. No library is needed. TanStack Query's serial mutation scope does the same job for its own cache.

**One new distinction: what the two copies mean.**

- `state.snapshot` stays what the file holds. It is the base for `openStorage`, the cache, `readDriveFile` and export, and none of those change.
- `state.records` and `state.workbook` become what is on screen: the snapshot with the queued changes marked `shownAtOnce` made on top of it.

`show(copy)` is the one place this happens. It sets the snapshot, makes the queued changes on a copy of it with a new port, and reads that. The copy with queued changes goes only to `ports.read`. It never reaches the cache, so a reload cannot show an unsaved change as saved.

**An edit stays right because it is made on the shown state.** A later tap reads `state.records`, which already hold the earlier queued change. Its `before` is therefore what the file will hold by its turn, and nothing is rewritten at its turn. Nothing else needs to be merged.

**Two kinds of write, chosen by the caller.**

- `shownAtOnce: true` is for a one-tap control whose value is on it: a switch, a select, a threshold field, an order arrow, and every Undo.
- The default is for a dialog or a form's Save. It queues too, with its Save spinning, and the record changes when it lands. The dialog stays open and keeps what was typed, as today. This matters because the 39 dialogs sit over screens that read the store. `BankLoanDialog` would show "Add loan" while deleting one (`book === null`), and the loan screen would empty, if a delete showed at once.

A form on a page, such as Settings, General, can meet a second edit of the same row before it lands. That second edit is refused alone with its reason. It is rare, because each setting is its own row.

### The checks on a queued write

No check is loosened, removed or rewritten. `checkWrite` and `findStored` do not change.

| When                                       | What runs                                                              | Reads                     | A refusal means                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| At the tap, for `shownAtOnce` only         | `checkWrite`: the stale checks, the kind's rules and the reader checks | The shown state, no Drive | Never shown, never queued. The value does not move, and the toast comes straight away |
| At its turn, for every write               | `checkWrite`, as today                                                 | A fresh read of the file  | That write alone is refused, and it flips back if it was shown                        |
| If another device saved at the same moment | `recheck` in `apply`, as today                                         | The other device's text   | That write alone is refused                                                           |

The check at the tap is there so the screen never shows a value the rules refuse. It finishes in microtasks with no real waiting, since the document view's `read` only reads memory, so the next tap cannot pass it.

### How a queued save meets everything else

| Meets                 | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A running sync        | The read is a job in the lane. A save tapped during a read waits for it. A sync tapped during saves waits behind them and reads what they left. A second sync while one waits shares it. `state.status` turns `syncing` only when the read's turn comes. A read that brings another device's change goes through `show`, so queued changes are made again on top of it, and one that no longer applies leaves the screen and is refused at its turn. |
| The Drive retry loop  | Stays inside the job, unchanged: fresh read, at most three retries with backoff, then `savedElsewhere`. Later jobs wait for it.                                                                                                                                                                                                                                                                                                                      |
| Undo                  | A queued write has no receipt, so it has no Undo until it lands and its toast appears. Undo then queues like any write, shown at once. Undoing a write that a queued change sits on is refused at the tap by the stale check. A second tap on the same Undo while the first waits answers `notUndoable`, because `undo` also looks in the queue.                                                                                                     |
| A move into Kuna      | Refused with `words.busy` while anything is queued, as today, and it takes the lane as one job with its read and its move inside. Writes tapped during it wait. `afterMove` runs after the job ends, as it does now, since it writes through the lane.                                                                                                                                                                                               |
| Dropping the workbook | Refused with `words.busy` while anything is queued, as today, since a queued write for a trashed file makes no sense. `fileRemoval.ts` keeps working.                                                                                                                                                                                                                                                                                                |
| Choosing another file | `chooseDriveFile` and `keepOnDrive` still do nothing while the lane is busy, because the Picker needs the tap and cannot wait. A job also remembers its workbook's id, and refuses with `noBooks` if another workbook was chosen before its turn.                                                                                                                                                                                                    |
| Reads of the file     | Export writes `state.snapshot`, so it writes what the file holds and leaves out queued changes. `BooksFileCard` and `useDriveFilePlace` read the snapshot and stay true. `readChosenNow` runs in the lane.                                                                                                                                                                                                                                           |
| A Google popup        | `requestAccess` needs the tap, since Firefox opens the popup only during a user gesture (`googleAuth.ts:186`). So the tap calls `ports.openStorage` straight away and the job awaits that. A tap while an ask is open shares it, so two popups never open. On a phone a write already fails with `staysOnPage` instead of leaving.                                                                                                                   |

`pageSync.whenIdle`, `SyncGroup.whenIdle` and the `whenIdle` of the two bank ports go. The bank import still wants the file as it stands before it works out its dry run, so it awaits `store.settled()` instead. `useInvoiceRun.ts:283` can no longer find a sync or write under way after `await store.sync()`, so that branch and `words.run.busy` go. `statementSync.ts:106` keeps its retry, which now syncs through the lane.

### One way for a control to show it is saving

The store holds the queue, so a control needs no state and a screen left and reopened still spins.

- `state.waiting` lists the queued writes with their keys.
- `writes.saving(key)` reads it. A write with no key gets a key unique to its `useRecordWrites`, so one card's `saving('save')` never spins another's. Explicit keys must be unique within the file.
- `writes.busy` stays what it says, this composable's own writes, for a dialog's other buttons.

The control binds what Nuxt UI already has: `:loading="writes.saving(key)"`. On `USwitch` and `UButton` that alone disables it and shows the spinner (`Switch.vue:61,78,84`, `Button.vue:130`). `USelect` shows the spinner but stays enabled (`Select.vue:192`), so it binds `:disabled` as well. No wrapper component is added. The value comes from the store as always, so it flips back by itself.

| Control                          | Today                               | Change                                                     |
| -------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `ChecksCard` switch              | No sign of saving                   | `:loading`, its own key `on-<check>`, shown at once        |
| `ChecksCard` threshold           | Spins, shares the switch's key      | Keeps its key, shown at once                               |
| `LoanBucketSwitch`               | Disabled on any write of the file   | `saving('loan-bucket')`, shown at once                     |
| `BenchmarkCard` select           | Disabled on its composable's writes | `saving('benchmark')`, shown at once                       |
| Spending `CategoriesCard` arrows | Spin by key                         | Shown at once, so two taps stack                           |
| `RuleEditor` Save and Delete     | `:loading="state.writing"`          | A key of their own on `store.write`, read through `saving` |
| `ReviewQueue`, `ScenarioList`    | All rows disabled on `busy`         | Only the tapped row spins, by the keys they already pass   |

These stay as they are, since they do not save to the file on change: `CompanyFactsCard`, `GeneralSettingsForm` and every dialog's switches (drafts), `RulesTab`'s switch (opens a dialog), `AppAssistCard`, `SyncCard`, `AppearanceCard`, `AccessStep` (device settings), `AssetsPanel` (a route query).

A check in `writeFeedback.spec.ts` stops this coming back: a component that calls `useRecordWrites` and has a `USwitch` or `USelect` with an update handler must bind `:loading`.

### Failure

Take three taps in a row: A on a record, B on another record, C on A's record again. A fails.

- **The write refused.** A leaves the queue, and `show` runs again without it, so its control flips back. Its toast reads as today: the `failedTitle` and the reason, or "may not have finished" for a failure after the upload started.
- **A failure after the upload started.** `refreshAfterFailedWrite` reads the file again as today. If the change did reach the file, the control stays where it is, because the screen shows what the file holds.
- **Later writes.** They go on. B saves. C's turn finds the record differs from its `before`, so it is refused alone and flips back. The stock reason ("changed since the app read it, sync and look again") would mislead here, so a write refused after a save ahead of it failed reads instead: "The change before this one was not saved, and this one was made on top of it." The reason is new wording, in English and Croatian.
- **Offline.** Each queued write fails on its own and says so, so three taps give three red toasts. That is honest and simple, and the owner's rule is per write.
- **A dialog.** It stays open with what was typed, its Save stops spinning, and the toast says why, as today.
- **A form on a page.** `GeneralSettingsForm.vue:41` and `InvoicingTermsForm.vue:33` copy the saved settings over the draft on every new settings object, so any write landing elsewhere would wipe what is being typed. Today the disabled controls make this rare, and freeing them makes it common. Both change to reset only when the saved values differ, as `ChecksCard`'s `watch(shown)` already does.

### Closing the tab

`writesInFlight` already counts from the tap to the end across every app, and `trackWrite` wraps the whole job, so a waiting save counts. A small `warnWhileSaving` in `src/shell/ui`, started from `App.vue` beside `keepPageSynced`, adds a `beforeunload` listener when the count leaves zero and removes it when the count returns to zero. Its handler calls `preventDefault()` and sets `returnValue`, which MDN gives as best practice.

| Browser                | What the person gets                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Firefox desktop        | The warning, with Firefox's own words. `preventDefault` has triggered it since Firefox 6.                 |
| Chrome, Safari desktop | The same, since Chrome 119 and Safari 11.                                                                 |
| Firefox for Android    | Listed as supported, but MDN warns the event is unreliable on mobile. Swiping the app away fires nothing. |
| Safari on iPhone       | No warning at all. MDN's data lists every part of the event as unsupported on iOS.                        |

Limits that apply everywhere:

- The text cannot be set, so it cannot say "a save is waiting". The HTML spec says the browser decides the message.
- The warning needs the person to have interacted with the page. A save started by an automatic sync on a page nobody touched gets no warning.
- The spec also lets a browser skip the prompt when it judges it annoying, deceptive or pointless. So this is a warning, not a guarantee.
- While the prompt is up the spec pauses the page, so the queue stops. Stay resumes it, and Leave loses what has not landed.
- Nothing is kept across a close. The next open shows what the file holds. A queued value was never in the cache, so it cannot look saved.
- Listening only while saves wait is what both MDN and web.dev recommend.

Not verified: what Firefox does when the whole window or app is quit, instead of a tab. The stage below includes a manual check.

## Module and contract

The module is `src/shared/storage`, part of the kernel. Apps change only by dropping guards and adding options. No app imports another's code, and `tests/importBoundaries.spec.ts` needs no change. Its published contract changes like this:

| Contract                            | Change                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `WorkbookStore.write`               | Gains `options?: { key?: string; shownAtOnce?: boolean }`. It never throws `busy` any more.                                 |
| `WorkbookStore.settled()`           | New. Resolves once nothing of the file is queued or running.                                                                |
| `WorkbookState.waiting`             | New. The queued writes and their keys. Replaces `writing`.                                                                  |
| `WorkbookState.writing`             | Deleted.                                                                                                                    |
| `WorkbookState.records`, `workbook` | Now the shown state. `snapshot` is what the file holds.                                                                     |
| `WorkbookStorePorts`                | Gains `withChanges(copy, changes): Copy` and `viewOf(copy): StorageView`, both from `documentRecords`, with nothing stored. |
| `writesInFlight`                    | Unchanged, for the shell. It now covers waiting saves.                                                                      |
| `SyncGroup`, bank ports             | `whenIdle` deleted.                                                                                                         |

The queue's pure parts, the type and how the shown copy is worked out, go in a new `src/shared/storage/application/writeQueue.ts`, since `createWorkbookStore.ts` is already 565 lines. `docs/architecture/modules.md` is not affected in shape. `docs/features/platform/json-storage.md` gets a short section on the queue.

## Stages

Each stage is a commit ending `(#62)` and leaves Kuna working. `npm run check:figures` stays identical throughout, since no figure's rule moves. Stages 3 and 4 change what a person sees, so they get the design review AGENTS.md asks for.

**1. The queue.** The lane in the store. `writeCounted` stops refusing and waits. Sync, move and drop as the table says. `state.waiting`, `settled()`, the `whenIdle` removals and the tap asking Google first. `useRecordWrites` keeps a key per write. `state.writing` stays true while anything is queued, so screens look as they do today, and what changes is that background writes wait instead of being refused.

- Specs in `workbookStore.spec.ts`: writes land in tap order, a write during a write waits, a write during a sync waits, a sync during writes reads what they left, a refused write leaves the next one going, a move and a drop are refused while anything is queued, the retry loop holds up the queue and then lets it go.
- `sync.spec.ts:336` moves to the store. `bankImport.spec.ts`, `invoiceRunChecks.spec.ts`, `pageSync.spec.ts` and `writeFeedback.spec.ts` lose what was deleted, and the last gains a waiting save in the count.
- No check flow changes. `write-in-progress` in `touch-check.mjs:1704` must still pass.

**2. The warning.** `warnWhileSaving`, listening only while saves wait.

- A spec for adding and removing the listener and for what its handler does.
- A `touch-check` step with `fake=slow-writes`: tap, then close the page and see the `beforeunload` dialog through Puppeteer, then wait for it to land and close with none. Puppeteer here drives Chromium only.
- The owner checks in Firefox once, on the live build: close a tab during a save, then quit the app during a save.

**3. Shown at once.** `withChanges`, `viewOf`, `shownAtOnce`, the check at the tap, `show` over the queue, the wording for a write after a failed one, Undo through the queue. The controls in the table move to `saving(key)`.

- Specs in a new `tests/writeQueue.spec.ts`: two changes to one record both land, a third on a failed first is refused alone and later ones go on, a rule refused at the tap never reaches the screen, the cache never holds a queued change, export holds what the file holds, a sync's read keeps queued changes on top, a queued change another device's save overtook is refused, Undo under a queued change is refused, a double Undo answers `notUndoable`, the arrows tapped twice end two places up.
- Measure the cost at the tap first. `ports.read` runs on the tap's thread, and it has only ever run after a save. A tap must stay under 100 ms on the company fake books, and if it does not, this stage stops to rethink before the controls move. Measured before the controls moved, the loan switch's tap to the frame after its value moved took 15 to 54 ms at 360 px and 55 to 88 ms with the CPU slowed fourfold, in Chromium.
- A new `visual-check` flow, `saves-waiting`, with `fake=slow-writes`: loan bucket switch and benchmark select at 360, 640, 1024 and 1440 px, both languages and themes. The company seed's `slow-writes` slows every file of the page, so the investments flow passes `fake=slow-writes` beside `investments=sample` and its seed needs nothing.
- A new fake `fake=save-fails`, through a `failNextUpload` beside `slowUploads` in `fakeDriveSession.ts`: the switch flips back and the toast names why.

**4. Everything else stays usable.** Delete `state.writing` and all its reads. Fix the two form watches and the row-wide `busy` disables.

- 18 control files lose it from `:disabled`: `InvoicesPanel`, `DataSourceCard`, `OwnerShareDialog`, company `ImportPanel`, `OwnerScreen`, hr-doo `ScenarioEditor`, `PlanEditor`, `ChangeCategoryDialog`, `RuleChangeDialog`, `TransactionsScreen`, `RulesTab`, `CategoryRulesTab`, `ClientsPanel`, `InvoiceRunDialog`, `InvoicingScreen`, `BillingPlanPanel`, `BooksFileCard`, `ReviewQueue`.
- 4 settings files lose it from their `saving`: `GeneralSettingsTab`, `AccountsSettingsTab`, `CategoriesSettingsTab`, `FactTabCard`.
- `RuleEditor` and `LoanBucketSwitch` were done in stage 3, `useInvoiceRun` and `pageSync` in stage 1.
- Specs: typing in General Settings survives another write landing, and a spec in `writeFeedback.spec.ts` for the `:loading` rule.
- `write-in-progress` gains a tap on a second review row while the first spins: both spin and both land. `saves-waiting` gains the same on Settings.
- Run locally with `--only` at 640 and 1024 px, and let CI run the full suites.

**5. Docs.** The section in `json-storage.md`, this plan kept as `docs/features/platform/saves-plan.md`, and `words.busy` reworded to cover only a move and a drop.

## Left out

- **Merging quick changes to one record.** Each write keeps its own toast, receipt and Undo, and merging would have to combine them. The cost of not merging is one upload and one kept Drive revision per tap, which `deleteOldest` trims at 100. It can come later if a real session shows a problem.
- **A way to cancel a waiting save.** Undo once it lands does the job.
- **A timeout on Drive requests.** `src/shared/google` sets none, so a request that hangs holds the queue and the warning until the browser gives up. A hang already holds `state.writing` today, but it now holds more. Proposed as a `tech-debt` issue, since a timeout on an upload raises its own questions.

## Decisions for the owner

Both are answered, and the plan above follows the answers.

- **What the rest of the screen shows while a one-tap save waits.** One-tap controls (switches, selects, arrows) move at once, grayed with a spinner, and the figures that depend on them follow. Dialogs and form Saves change the screen when the save lands, as today. A failure flips the control back with a message. For those seconds a figure on screen can be ahead of the file, which the owner accepts.
- **A phone that gives no warning.** A phone may lose a waiting save with no warning, since Safari on iPhone has no such warning and on Android the event is unreliable. This is accepted, and the queue is not stored. The saving bar and the sync control's "Saving…" are all a phone gets, and on the next open both the file and the screen show the old value.

## Sources loaded

- MDN, `beforeunload` (modified 2026-10-26): sticky activation, `preventDefault` with `returnValue`, generic text, unreliable on mobile, listen only with unsaved changes. https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- MDN browser-compat-data, `api/Window.json`: per-browser versions, `safari_ios: false` with https://webkit.org/b/219102, Firefox for Android mirrors Firefox. https://github.com/mdn/browser-compat-data
- HTML spec, the steps to fire `beforeunload`: sticky activation, "unlikely to be annoying, deceptive, or pointless", pause while waiting, message not customisable. https://html.spec.whatwg.org/multipage/browsing-the-web.html
- MDN, sticky and transient activation, for what counts as interaction and popups needing a gesture. https://developer.mozilla.org/en-US/docs/Glossary/Sticky_activation
- web.dev, back/forward cache: add the listener only with unsaved changes, and `beforeunload` no longer blocks the cache in modern browsers. https://web.dev/articles/bfcache
- TanStack Query, mutation scopes: same `scope.id` runs in serial and queues in order. It confirmed the lane and changed nothing. https://tanstack.com/query/latest/docs/framework/vue/guides/mutations
- Replicache, how it works: local changes shown at once, a pending queue, and on a pull it returns to the confirmed state, applies the patch and replays what is pending. This changed the design: `show` works the same way over the snapshot. It differs in two ways. Replicache re-runs its mutators and persists its queue. Kuna makes the stored changes again and lets the stale check refuse what no longer holds, and keeps its queue in memory. https://doc.replicache.dev/concepts/how-it-works
