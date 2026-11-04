# JSON storage, lane 1: the Drive side

Research lane, read-only, 2026-10-23. Sources are Google's and Mozilla's own pages, loaded on this date. Code is cited at the working tree (deploy 3 in progress) unless marked HEAD 8666d7e.

## Findings

1. **Drive v3 has no write precondition.** `files.update` documents no `If-Match`, no ETag and no revision check. The v2-to-v3 guide lists the Files `etag` field as "n/a" in v3. A phone and a desktop can overwrite each other without an error, so the adapter has to check itself.
2. **A check before the write leaves a gap of one round trip, and a check after the write closes most of it.** Read `headRevisionId` before the upload and refuse when it moved. After the upload, list the revisions and look for one that landed between the revision the write was based on and the new one. That second check is what turns a silent loss into a detected one.
3. **Recovering a lost write needs "Keep Forever".** Google says the API can only download blob revisions marked Keep Forever. Uploading with `keepRevisionForever=true` makes every app revision downloadable, capped at 200 kept revisions per file.
4. **Drive's own history is short.** Unkept revisions are "typically preserved for 30 days" and can go sooner once a file has 100 unkept revisions. At a few writes a day that is weeks, not years, so the app should write its own dated backups into the folder.
5. **`drive.file` is enough for the whole storage.** The app can create the JSON file inside a folder the owner picked, and then sees and writes that file from then on. Picking a folder does not show its existing files. Google's pages say nothing about it, and the owner's own spikes on 2026-10-16 and 2026-10-20 saw zero children. Wave 13's `drive.readonly` is not needed for storage and should stay out of it.
6. **The app-data folder does not fit.** It needs its own scope, is hidden from the owner in Drive, cannot be shared, and is deleted when the owner removes the app.
7. **Size is no concern.** The owner's export is well under 1 MB as JSON. Simple and multipart uploads take up to 5 MB, which at today's rate is decades away. One `PATCH` with `uploadType=media` per write is the request.
8. **Firefox is fine for everything the design needs, and has no File System Access API.** `showDirectoryPicker`, `showOpenFilePicker` and `showSaveFilePicker` are not in Firefox desktop or Android, and Mozilla's position on the API is negative.
9. **The Google modules carry over almost unchanged.** Sign-in, the redirect, the session, `googleFetch` and the folder Picker are reused. `driveClient.ts` grows a download, an upload and a revisions call. Everything under the Sheets adapter goes.

## 1. Concurrency: what Drive enforces and what the adapter must check

### What Google documents

- `files.update` reference (https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update): the request is `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}` for content and `PATCH https://www.googleapis.com/drive/v3/files/{fileId}` for metadata. The page says the method "supports patch semantics" and lists no `If-Match`, ETag, precondition or revision parameter.
- v2-to-v3 comparison (https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference): the Files, Revisions, About, Apps and Permissions resources each list `etag` with the v3 equivalent "n/a". The `etag` list parameters are "n/a" too.
- File resource (https://developers.google.com/workspace/drive/api/reference/rest/v3/files): no `etag` field. `version` is "a monotonically increasing version number for the file. This reflects every change made to the file on the server, even those not visible to the user." `headRevisionId` is "the ID of the file's head revision. This is currently only available for files with binary content in Google Drive." A JSON file counts as binary content.
- Revisions guide (https://developers.google.com/workspace/drive/api/guides/manage-revisions): no concurrency control either.

So nothing on Google's side refuses a stale write. A third-party issue (https://github.com/gasizdat/GT4/issues/407) reaches the same reading, which I note as support, not as a source.

### `headRevisionId` over `version` and `md5Checksum`

`version` moves on every change "even those not visible to the user", so a rename or a property change also moves it. `headRevisionId` moves only when content is uploaded, which is what a lost write means. `md5Checksum` would need MD5 in the browser, and Web Crypto has none (see Firefox below).

### The check, inside the 12b write path

The working tree's port already fits it. `RecordStorage` is "one instance serves one write: it reads, works out what the changes would leave on that read, then applies them there" (`src/features/workbook/application/recordStorage.ts:22-42`). A Drive JSON adapter maps onto it like this:

| Port method | What the JSON adapter does                                                                                                                                                                                                                                                                                                                                                             | Requests |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `read`      | `files.get ?fields=headRevisionId` (call the answer the base), download with `?alt=media` and `cache: 'no-store'`, then `files.get` again. When the head moved during the download, read again, at most three times. Skip the download when the cached document has the same revision.                                                                                                 | 2 or 3   |
| `identify`  | The record's kind and key or id, as the spreadsheet adapter does, without row numbers.                                                                                                                                                                                                                                                                                                 | 0        |
| `preview`   | Apply the changes to the document in memory. No missing tabs or columns exist, so `addMissingKinds` has nothing to do.                                                                                                                                                                                                                                                                 | 0        |
| `apply`     | Pre-check: `files.get ?fields=headRevisionId`. Moved from the base means refuse with "changed meanwhile". Otherwise upload the whole new document with `PATCH .../upload/drive/v3/files/{id}?uploadType=media&keepRevisionForever=true&fields=headRevisionId`. Post-check: `revisions.list ?fields=revisions(id,modifiedTime,keepForever)` and look between the base and the new head. | 3        |

On "changed meanwhile", `store.write` runs its steps again from a fresh read ([the storage boundary plan](../../storage-boundary-plan.md), Repositories and the unit of work, steps 1 to 4). A record whose `before` no longer matches is refused there, as today. Three tries with the backoff Google describes (below) are enough for two devices.

The post-check handles the case the pre-check misses. Device A reads revision R1. Device B reads R1. A passes its pre-check and uploads R2. B passes its pre-check before R2 lands and uploads R3, which holds nothing of A's write. B's post-check lists R1, R2, R3 and sees R2 between its base and its own. B then downloads R2 (possible only because it was kept forever), uploads it back as the head so A's write is restored, and runs its own write again from that fresh read. A's write is in, B's is in, and nobody saw an error.

What is left:

- **Gap of the post-check.** It relies on `revisions.list` showing R2 at once and in time order. Google does not promise either. The guide only warns the list "might be incomplete for files with a large revision history". Unconfirmed until a spike.
- **Writers outside the app.** Drive for Desktop syncs the owner's Drive to a folder on the Mac, so a JSON file edited on the Mac uploads a revision without Keep Forever. The post-check sees it but cannot download it. The app can only say "the file changed outside the app during this write, check the backups". That is a loss you see, not a silent one.
- **Two tabs on one device** take a Web Lock around `store.write` (`navigator.locks.request`), so they never race each other. That is a few lines and optional.

The cost of the gap without the post-check: the pre-check alone leaves the time from B's `files.get` to the end of B's upload, a few hundred milliseconds on a 200 KB body. For one person saving on two devices that is unlikely but silent. The post-check is about 40 lines and the requirement says "cannot silently lose a write", so I would build it.

### A real compare-and-swap, as a fallback

Drive has one atomic primitive. The upload guide (https://developers.google.com/workspace/drive/api/guides/manage-uploads) says uploads with pre-generated IDs can be retried, and "if the file action is successful, subsequent retries return a `409 Conflict`" and "duplicate files aren't created". `files.generateIds` (https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds) "generates a set of file IDs which can be provided in create or copy requests".

That allows a claim file. The document names the next claim id in its `appProperties`. A writer creates an empty file with that id. A `409` means another device claimed this revision first, so read again. Otherwise upload the document with a fresh claim id, then delete the claim. It closes the gap fully, but a crash between the claim and the upload blocks every writer until a stale claim is taken over, which brings back a check without a guarantee. Google does not say whether ids generated on one device work from another token of the same user and app. I would keep this in reserve for a failed spike of the post-check.

### Rate limits and retry

The limits page (https://developers.google.com/workspace/drive/api/guides/limits) gives "403: User rate limit exceeded" and "429: Rate limit exceeded", and says to retry with exponential backoff plus a random delay of up to one second. The page now meters by quota units, with `files.update` at 50 units against 325,000 per minute per user. Ledgerboard's writes are clicks, nowhere near it. `GoogleApiError` already carries the status (`src/shared/google/googleApi.ts:2-12`).

## 2. History: revision retention and the app's own backups

### What Drive keeps

- Revisions guide (https://developers.google.com/workspace/drive/api/guides/manage-revisions): "Google Drive automatically deletes older revisions that are no longer of interest to the user." "Purgeable revisions are typically preserved for 30 days," and "can be purged earlier if a file has 100 revisions that aren't designated as "Keep Forever"". "The head revision is never auto-purged."
- Revision resource (https://developers.google.com/workspace/drive/api/reference/rest/v3/revisions): `keepForever` is "whether to keep this revision forever, even if it is no longer the head revision. If not set, the revision will be automatically purged 30 days after newer content is uploaded. This can be set on a maximum of 200 revisions for a file."
- Kept revisions "count towards your storage limit" (revisions guide).
- Downloads: "You can only download blob file content revisions marked as "Keep Forever"." The download guide (https://developers.google.com/workspace/drive/api/guides/manage-downloads) says the same.
- `files.update` has `keepRevisionForever`: "Whether to set the `keepForever` field in the new head revision." It applies only to binary-content files, with the same 200 cap.
- Drive's help page (https://support.google.com/drive/answer/2409045) gives the owner the same in the UI: "A version might be permanently deleted after 30 days or if there are 100 newer versions", Keep forever and Download per version under Manage versions.

### What that means for the app

Kept revisions are the app's short memory: they make the post-check's recovery work, and the owner can download any of them from Manage versions. They are not history. Review confirms and rules changes can mean ten or more writes on a busy day, so 200 kept revisions is a couple of weeks. The app should unkeep the oldest (`revisions.update` with `keepForever: false`) once it holds, say, 100, so it never meets the cap. Google does not say what happens at write 201 with the flag set. Unconfirmed.

So yes, the app should keep its own dated backups in the folder:

- A `backups` folder the app creates inside the picked folder. App-created, so `drive.file` sees it on every device.
- On the first write of a day, the app copies the document as it stood before that write to `ledgerboard-YYYY-MM-DD.json` (one `files.create` multipart upload, the same request as an invoice PDF).
- Keep the last 30 dailies and the first of each month for good. About 200 KB each, so a year of monthlies is a few MB.
- Restoring one is an ordinary write of its content through `store.write`, so it lands as a new head with its own revision.

Whether trashing or deleting the main file also drops its revisions is not on the pages I loaded. Separate backup files do not depend on it.

The xlsx export the plan keeps for reading is a second, human-readable backup. It does not replace the JSON backups, because restoring from it means a round trip through the xlsx reader.

## 3. Permissions and the folder flow

### What each scope allows

The scopes page (https://developers.google.com/workspace/drive/api/guides/api-specific-auth):

- `drive.file`, non-sensitive and recommended: "Create new Drive files, or modify existing files, that you open with an app." It covers files the user shares with the app "while using the Google Picker API or the app's file picker".
- `drive.appdata`, non-sensitive: "View and manage the app's own configuration data in your Google Drive."
- `drive.readonly`, restricted: "View and download all your Drive files."
- `drive`, restricted: "View and manage all your Drive files."

`files.update` lists `drive.file` among its scopes, so the app may rewrite a file it created.

### A picked folder

Google's pages do not say what picking a folder grants. The scopes page talks only of files, and the Picker guides (https://developers.google.com/workspace/drive/picker/guides/overview, https://developers.google.com/workspace/drive/picker/guides/web-picker) say only that the token for the views uses `drive.file` and that `setAppId` with the project number lets "the app to access the user's files". Community threads say the same as the owner's spikes, so I list them as support only.

What the app has observed itself:

- Wave 0 (2026-10-16, Firefox, `plan.md` Wave 0 spike results): "Folder pick: 0 children visible."
- Invoice folders (2026-10-20, `plan.md` line 538): "a `drive.file` token lists no children of the picked folder".
- Invoice filing works in production: the app creates folders and PDFs inside a picked folder and finds them again (`src/features/invoicing/infrastructure/googleInvoiceDrive.ts:19-54`, `plan.md` line 485).
- Wave 0: "The grant outlives the token. No re-pick per session."

So the flow is: the owner picks a folder once, the app creates `ledgerboard.json` there with `appProperties` naming the app and the storage, and from then on reads and writes that file. Any JSON file already in the folder, such as a backup the owner put there by hand, stays invisible until the owner picks that file in the Picker.

The second device should not need a Picker at all. `files.list` with `q: "appProperties has { key='ledgerboard' and value='company' } and trashed = false"` (syntax from https://developers.google.com/workspace/drive/api/guides/search-files, `has` operator from https://developers.google.com/workspace/drive/api/guides/ref-search-terms) finds the file the app created. That `drive.file` covers on the phone a file the app created on the desktop follows from the grant being per app, but no Google page says it. **Unconfirmed, spike it.** If it fails, the phone picks the JSON file once in a Picker view filtered to `application/json`.

### Wave 13's `drive.readonly`

Keep the storage off it. The storage reads and writes only its own file, which `drive.file` covers, while the Wave 13 token lives in page memory only (`plan.md` Wave 13, Drive read access). If storage depended on it, every reload would need the restricted grant before the app could show figures. With `drive.readonly` present the app could read a JSON file it did not create, but still not write it without a `drive.file` grant from the Picker. So nothing in the storage design changes when Wave 13 lands.

### The app-data folder

The guide (https://developers.google.com/workspace/drive/api/guides/appdata): it is "hidden from the user and from other Google Drive apps". Its files cannot be shared, moved or trashed (`notSupportedForAppDataFolderFiles`). "The folder is deleted when a user removes your app from their My Drive", and users can delete it by hand. It needs the extra `drive.appdata` scope, which is a consent-screen change in the Google Cloud project and so needs the owner's yes.

Against the owner's ask to pick a folder, it loses on every count: the owner cannot see or download the file, Drive for Desktop does not mirror it, an accountant could never be given it, and removing the app deletes the owner's books. I would not use it.

### The phone redirect sign-in

Nothing new is needed. The phone signs in by redirect with the implicit flow (`src/shared/google/googleAuth.ts:98-101`, `src/shared/google/googleRedirect.ts:41-54`) and the same `drive.file openid email` scopes (`googleAuth.ts:31`). The token is kept in `localStorage` as now (`src/shared/google/googleSession.ts:15-27`). The `'pick'` resume (`googleRedirect.ts:17`) opens the folder Picker instead of the Sheet Picker on a first run, and on a second device it can run the `appProperties` search instead.

Google's implicit-flow page (https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow) calls the flow "considered insecure for browser-based single-page applications (SPAs)" and says "you should use the Authorization Code flow with PKCE instead". That applies to the Sheet today in the same way, so the JSON storage neither adds nor removes that risk. A write that needs a fresh token on the phone loses the click to the redirect, as today (README sign-in section), so a write should keep its unit of work only in memory and say "tap again" once back.

## 4. Upload size and the request

- The upload guide: simple upload is for "a small media file (5 MB or less) without supplying metadata". Multipart is for "a small file (5 MB or less) along with metadata". Resumable is for "large files (greater than 5 MB)". "To update an existing file, use `PATCH`."
- The `files.update` reference gives a maximum file size of 5,120 GB and `uploadType` of `media`, `multipart` or `resumable`.

The owner's data was measured on an export with a scratch script, each tab as an array of objects keyed by the header, so an upper bound for any format with shorter keys. A ledger row is about 450 bytes as JSON, and the whole export is well under 1 MB.

At that size per row, the 5 MB limit of a single-request upload is more than 10,000 ledger rows away, decades for a small company. Nothing on the Drive side needs a ledger split by year. The format lane owns the exact figures.

The request: `PATCH https://www.googleapis.com/upload/drive/v3/files/{id}?uploadType=media&keepRevisionForever=true&fields=headRevisionId` with `Content-Type: application/json` and the whole document as the body. The file's name and `appProperties` do not change on a write, so no multipart is needed. Creating the file and the backups uses `POST .../upload/drive/v3/files?uploadType=multipart`, the request `googleInvoiceDrive.ts:37-54` already builds for PDFs. The download is `GET https://www.googleapis.com/drive/v3/files/{id}?alt=media` (download guide).

The Content Security Policy already allows `https://www.googleapis.com` (`index.html:7`), which serves both the Drive API and `/upload/drive/v3`. `https://sheets.googleapis.com` drops out with the Sheet. The service worker has no runtime caching of Google hosts (none in `vite.config.ts` or `src/shared/pwa`), so only the browser HTTP cache needs `cache: 'no-store'` on the download.

## 5. Firefox

From MDN's browser-compat-data (https://github.com/mdn/browser-compat-data, files `api/Window.json`, `api/LockManager.json`, `api/Crypto.json`, fetched today) and the MDN pages:

| What the design uses                                                                   | Firefox                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showDirectoryPicker`, `showOpenFilePicker`, `showSaveFilePicker` (File System Access) | Not supported, desktop or Android (`version_added: false`, Android mirrors). MDN (https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker): "not Baseline because it does not work in some of the most widely-used browsers". Mozilla's standards position is "negative" (https://github.com/mozilla/standards-positions/issues/154). So no local folder. |
| `crypto.randomUUID` for record ids                                                     | Firefox 95                                                                                                                                                                                                                                                                                                                                                                    |
| Web Locks (`navigator.locks`) for two tabs on one device                               | Firefox 96. MDN (https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API): "Widely available", "no other script executing in the same origin can acquire the same lock". Same origin only, not across devices.                                                                                                                                                         |
| `SubtleCrypto.digest`                                                                  | SHA-1, SHA-256, SHA-384, SHA-512, no MD5 (https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest). So Drive's `md5Checksum` is not a practical check.                                                                                                                                                                                                           |
| `fetch` with a `Blob` body, `TextEncoder`, `JSON`                                      | Already in use for invoice uploads                                                                                                                                                                                                                                                                                                                                            |
| GIS popup and the Picker iframe                                                        | Already in use. GIS needs a user gesture (https://developers.google.com/identity/oauth2/web/guides/use-token-model: "A user gesture triggers the token flow"), which `src/features/workbook/application/readFromGoogle.ts:24-33` already respects.                                                                                                                            |

The browser workbook therefore stays on IndexedDB with a file download and upload, as `src/features/excel/application/workbookFiles.ts` does now.

## 6. What a Drive JSON adapter reuses

| Code                                                                                                                                                                                                                                                                                                                    | Fate                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/google/googleApi.ts:14-22` `googleFetch`, `GoogleApiError`                                                                                                                                                                                                                                                  | Reused as is                                                                                                                                                                                                                                                                                                                          |
| `src/shared/google/googleAuth.ts`                                                                                                                                                                                                                                                                                       | Reused. `SCOPES` (`:31`) unchanged                                                                                                                                                                                                                                                                                                    |
| `src/shared/google/googleRedirect.ts`                                                                                                                                                                                                                                                                                   | Reused. The `'pick'` resume comment (`:16`) says "the chosen Sheet" and becomes the folder                                                                                                                                                                                                                                            |
| `src/shared/google/googleSession.ts`, `googleConfig.ts`, `loadScript.ts`                                                                                                                                                                                                                                                | Reused as is                                                                                                                                                                                                                                                                                                                          |
| `src/shared/google/picker.ts`                                                                                                                                                                                                                                                                                           | The folder view (`:61-66`) is reused. `PickerKind` `'spreadsheet'` (`:7`, `:67`) goes, and a JSON file view may come for the fallback pick                                                                                                                                                                                            |
| `src/shared/google/driveClient.ts`                                                                                                                                                                                                                                                                                      | `listChildren` (`:21-39`) reused for backups. `getFile` (`:14-18`) gains `headRevisionId`, `appProperties`. New: download, upload, `revisions.list`, `revisions.update`. `getFile` and `exportAsXlsx` (`:42-46`) are unused at HEAD 8666d7e and in the tree. `exportAsXlsx` serves Wave 14, `getFile` would get its first caller here |
| `src/features/invoicing/infrastructure/googleInvoiceDrive.ts:37-62`                                                                                                                                                                                                                                                     | Its multipart create and media update are the same requests the JSON adapter needs. Move them into `driveClient.ts` and have both call one, so the diff does not hold two upload builders                                                                                                                                             |
| `src/features/workbook/application/readFromGoogle.ts:10-22` `GoogleWorkbookPorts`                                                                                                                                                                                                                                       | Shape reused: token, pick (folder, or find by `appProperties`), read. `readSnapshot` returns the document instead of tabs                                                                                                                                                                                                             |
| `src/features/workbook/application/autoSync.ts:4`                                                                                                                                                                                                                                                                       | Reused. A sync becomes the metadata call plus a download only when the head moved                                                                                                                                                                                                                                                     |
| `src/features/workbook/application/recordStorage.ts:26-42`                                                                                                                                                                                                                                                              | The port the JSON adapter implements. `addMissingKinds` has no meaning there                                                                                                                                                                                                                                                          |
| `src/features/workbook/infrastructure/workbookChoice.ts:4-8`                                                                                                                                                                                                                                                            | Reused. `id` becomes the JSON file's id                                                                                                                                                                                                                                                                                               |
| `src/features/workbook/infrastructure/workbookCache.ts:21-26`                                                                                                                                                                                                                                                           | Each tab is a Dexie table keyed by `sheetRow`. It needs a new shape keyed by record id, or the document cached whole with its revision. The format lane should decide                                                                                                                                                                 |
| `sheetsClient.ts`, `googleWorkbookPorts.ts`, `googleWorkbookWriter.ts`, `spreadsheetRecordStorage.ts`, `spreadsheetTab.ts`, `cellFormats.ts`, `cellReading.ts`, `ledgerPlacement.ts`, `tabRowPlans.ts`, `writePlans.ts`, `rowIds.ts`, `packTabs.ts`, `spreadsheetLink.ts` under `src/features/workbook/infrastructure/` | Go with the Sheet, unless the browser workbook keeps a spreadsheet grid (open question below). `workbookTemplate.ts` and `workbookFile.ts` stay only for the xlsx export                                                                                                                                                              |

## 7. Spikes before the plan

Each is a few calls against a test file the app creates in a scratch folder, never the live Sheet or the owner's books:

1. Phone sees the desktop's file: create a file with `appProperties` on the desktop, then `files.list` by `appProperties` from the phone's token, no Picker.
2. Race: two tabs, each with its own fresh read, upload within the same second. Check that `revisions.list` shows both revisions at once, in order, and that each media upload made its own revision.
3. Keep Forever: upload with `keepRevisionForever=true`, download that revision with `revisions.get ?alt=media` after a newer upload, and see what Drive answers for the 201st kept revision.
4. Fallback only: a pre-generated id used twice gives `409`, also when the second create comes from the other device.

## Open questions

- **Does the browser workbook stay as a second storage?** The plan says replace the Sheet and keep xlsx as an export. If "Excel mode" stays as a live storage, the spreadsheet adapter and its grid code survive for it. If the browser storage becomes a JSON document in IndexedDB instead, most of `src/features/workbook/infrastructure/` goes. This changes the file count of the plan a lot.
- **Post-check with Keep Forever, or the pre-check alone?** The post-check adds one request per write and the unkeep housekeeping, and makes a lost write detectable and restorable. The pre-check alone leaves a sub-second silent gap. I recommend the post-check.
- **Backups: daily plus monthly, as above?** Or only monthly, leaning on kept revisions for the last weeks.
