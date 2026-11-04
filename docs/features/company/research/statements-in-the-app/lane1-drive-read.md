# Wave 13, lane 1: Drive read access

Read-only research, 2026-10-23, against HEAD 8666d7e (the files in `src/shared/google/` and the Gmail call sites are unchanged in the working tree). Google pages were loaded on 2026-10-23 and are quoted or paraphrased below. Anything marked unconfirmed was not found on an official page.

## Findings first

1. **A token kept only in page memory cannot serve the sync on open.** Every reload starts without it, and on desktop a new GIS token needs a click (Google: "A user gesture triggers the token flow", use-token-model guide). Today the sync on open and on tab return runs without a click (README "Google sign-in"). So with the owner's decision as written, the statements folder is read only after a tap in each page load, or the app bounces the tab through Google once per page load. This is the one decision the planning session has to bring back to the owner. See _The sync on open_ below.
2. **The Picker cannot replace `drive.readonly` for this job.** Google's pages do not say whether picking a folder under `drive.file` grants its files. The owner's own spike did answer it: a `drive.file` token listed no children of a picked folder (plan.md, Wave 9 spike result, 2026-10-20). Every statement file is made by the Apps Script, so none is ever in view under `drive.file` unless the owner picks each XML file by hand.
3. **`drive.readonly` is restricted.** Google lists it under restricted scopes as "View and download all your Drive files". An unverified app in production shows the "unverified app" warning and is capped at "100 new users in total". A personal-use app (fewer than 100 users) needs no verification. Restricted scopes for a public app need an annual security assessment, which only matters if the app is verified later.
4. **The publishing status of the Cloud project is not recorded anywhere I could find.** plan.md says both "publishing status Production" (Wave 0) and "while the project stays in testing mode" (Wave 9 risk). In Testing, an authorization "will expire seven days from the time of consent" for any scope beyond name, email and profile. So the "one-time" grant would come back every week. The planning session must read the Audience page.
5. **Declaring the scope on the consent screen is not needed to request it.** `gmail.compose` was deliberately left off the consent screen "to stay out of verification", and the incremental grant still worked (plan.md, Wave 9 spike result). Google's page says scopes are listed "for apps used by people outside your Google Workspace organization" but does not say what happens to an undeclared scope. The handoff says to add `drive.readonly`. That contradicts the Gmail precedent and needs the owner's answer.
6. **The Drive side is small.** Two `files.list` shapes and one `files.get?alt=media`, all on `www.googleapis.com`, which the CSP already allows. `loadImportFile(fileName, bytes)` already takes an `ArrayBuffer` (src/features/imports/infrastructure/importFiles.ts:15), so a downloaded file goes straight into the Wave 6 reader.
7. **On the owner's data a no-new-files sync downloads nothing.** The archive holds the XML and PDF files in one year folder, every XML named `<label>-<account>.xml`, a few KB each. Every label is already on the ledger of the export. A skip by file name, as `CamtIngest.gs` does, means a sync with nothing new costs three or four list calls and no downloads.

## How the Gmail drafts grant works today

- `requestGmailToken` (src/shared/google/googleAuth.ts:152) asks GIS for `gmail.compose` alone with `include_granted_scopes: true` and `prompt: ''` (googleAuth.ts:161-166), checks `hasGrantedAllScopes` (googleAuth.ts:172) and keeps the token in a module variable, `gmailToken` (googleAuth.ts:139, 176). `currentGmailToken` returns it until a minute before expiry (googleAuth.ts:142-144). Sign out clears it (googleAuth.ts:191).
- The kept sign-in token asks for `drive.file openid email` with `include_granted_scopes: false` (googleAuth.ts:31, 112), so the token in localStorage never carries Gmail.
- The only caller is `invoiceDrafts` (src/features/invoicing/application/invoiceGoogle.ts:19-25): `currentGmailToken() ?? (await requestGmailToken())`, called first in the click handler.
- On a phone, `requestGmailToken` calls `redirectToGoogle('gmail', GMAIL_COMPOSE, 'none')` (googleAuth.ts:153-155). `redirectToGoogle` saves a one-time `state`, the grant kind, the resume action and the hash route in localStorage (googleAuth.ts:55-69, googleRedirect.ts:126-132), and moves the tab to the implicit-flow URL with `include_granted_scopes=true` only for Gmail (googleAuth.ts:64, googleRedirect.ts:41-54).
- Back in the app, `main.ts` calls `takeGoogleRedirect` before the router starts (src/main.ts:26). `settleRedirect` checks the state and, for Gmail, that the returned `scope` includes `gmail.compose` (googleRedirect.ts:93-122). A Gmail token goes to the page-memory variable, a sign-in token to localStorage (googleAuth.ts:83-87). `useGoogleReturn` shows "Gmail drafts allowed, make the invoice again" (src/features/workbook/presentation/useGoogleReturn.ts:27-35), because the invoice dialog is gone after the reload.

## What a Drive read grant needs in that code

Same shape as Gmail, one more grant kind:

- A `DRIVE_READONLY` constant and a not-granted message beside `GMAIL_COMPOSE` (googleRedirect.ts:84-86).
- `RedirectGrant` gains `'drive-read'` (googleRedirect.ts:14), `pendingOf` accepts it (googleRedirect.ts:161), and `settleRedirect` checks the returned scope for it the way it checks Gmail (googleRedirect.ts:117).
- `requestDriveReadToken` and `currentDriveReadToken` in googleAuth.ts, with the token in a module variable next to `gmailToken`, cleared by `forgetGoogleSignIn`.
- `takeGoogleRedirect` puts a `drive-read` answer into that variable (googleAuth.ts:83).
- `useGoogleReturn` resumes with a sync for `drive-read` plus `resume: 'sync'`. Unlike Gmail, the action that asked (a sync) can carry on by itself after the reload, so no "tap again" toast.
- The README "Google sign-in" and host table, and `public/privacy.html` (line 149 and 161 name `drive.file` and `gmail.compose`), must name `drive.readonly`.

**`include_granted_scopes` for this grant.** GIS defaults it to true, and with true "the new access token will also cover any scopes to which the user previously granted the application access" (implicit-flow page). The Gmail token uses true, so it also carries `drive.file`. For the Drive read token I would ask for `drive.readonly` alone with `include_granted_scopes: false`. Google's reference says that with false the token covers only the scopes in that request (GIS js-reference, OverridableTokenClientConfig). Consent already given is remembered either way. That keeps the read token unable to write the Sheet or send mail, and keeps one token per job. The plan says "the way Gmail drafts work". That is about the grant flow, so this detail does not contradict it, but the planning session should state it.

## Phone sign-in by redirect

The implicit flow is a full-page redirect, so unlike the popup it needs no user gesture. `window.location.assign` works from any code. Two consequences:

- A tap on Sync with no Drive read token can redirect with `grant: 'drive-read'`, `resume: 'sync'`, and the sync carries on after the return with no second tap.
- A phone with no stored sign-in token needs two round trips on its first sync of the day: one for the sign-in (stored), one for the read grant (memory). The second can follow the first automatically on return, since a redirect needs no gesture. Asking both scopes in one request would put `drive.readonly` into the token that goes to localStorage, which the owner ruled out.
- `prompt` is left out today, and Google says that then "the user will be prompted only the first time your project requests access" (implicit-flow page). Adding `prompt=none` to an automatic bounce would guarantee no Google screen: Google documents it as "Don't display any authentication or consent screens", and the answer comes back to the redirect URI as an error when consent is needed. That error path then becomes the "Allow reading statements" button.
- Google's implicit-flow page now carries a callout: "For modern web applications, you should use the Authorization Code flow with PKCE instead", and calls direct use of the implicit flow "strongly discouraged". This applies to the existing phone sign-in as well. It is not a reason to change Wave 13, since the code flow needs a client secret exchange the app has no server for. Recorded so nobody is surprised by it.

## The sync on open

Today: the sync runs on open and on tab return, at most every ten minutes, without a click while the stored token is good (README "Google sign-in"). With the Drive read token in page memory, the options for the planning session to put to the owner:

- **Read the folder on a tap, keep the token in memory (as decided).** Opening the app reads the Sheet as today. The Sync button, and a small "Check for new statements" line on Overview when the page has no read token, ask for the grant. On desktop GIS opens a popup that, once consent exists, should close by itself (unconfirmed, Google's pages do not say what the popup shows on a repeat request). On a phone the tab bounces through Google and back. After that, every automatic sync in the same page reads the folder for the hour. Cost: one tap per page load before new statements arrive. Most honest to the decision.
- **Bounce through Google on open (phones and desktop).** Use the redirect with `prompt=none` on the first sync of a page that has no read token, on every device. Statements arrive with no tap, at the price of one extra page load through accounts.google.com on every open of the app. Needs the desktop to use the redirect for this grant too, which the authorised redirect URIs already allow.
- **Keep the read token in localStorage like the sign-in token.** Fully automatic, same as today's sync. It reverses the owner's decision: a script injected into the page could read the whole Drive for up to an hour, where today it can reach only the picked Sheet and app-made files. Not recommended, listed so the trade-off is visible.

My recommendation is the first, because a new statement arrives once a day and a tap on Sync is already a habit. The question for the owner is whether the owner accepts one tap per page load.

## Drive API v3 calls

All on `https://www.googleapis.com/drive/v3/files`, which `driveClient.ts` already uses and the CSP allows (index.html:7).

**Find the statements folder by path.** Drive has no path query: "The Drive API doesn't provide a query operator or parameter to recursively search descendant subfolder trees" (search-files guide). Walk the segments from `root` ("The alias `root` can be used to refer to the root folder anywhere a file ID is provided", folder guide):

```
GET /drive/v3/files
  q = '<parentId>' in parents and name = '<segment>' and mimeType = 'application/vnd.google-apps.folder' and trashed = false
  fields = files(id,name)
```

Five calls for `work/company/business-bank-account/erste/statements`. Quotes and backslashes in a name must be escaped (search-files guide). Drive allows two folders with the same name in one parent, and the Apps Script's `childFolder` takes the first one it meets (Code.gs:518-521). The app should refuse a path with two matches and name the segment, instead of guessing. Keeping the resolved folder id in memory for the page saves the walk on later syncs. Storing the id in settings instead of the path is the plainer long-term choice, since the Picker can return it under `drive.readonly` (the Picker overview says web apps "can use `drive.file`, `drive.readonly`, etc."). Plan.md says the key holds the path, so I left it there.

**List the year folders, then the files.**

```
GET /drive/v3/files
  q = '<statementsId>' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false
  fields = nextPageToken,files(id,name)

GET /drive/v3/files
  q = ('<year1>' in parents or '<year2>' in parents) and trashed = false and mimeType != 'application/vnd.google-apps.folder'
  fields = nextPageToken,files(id,name,mimeType,size,modifiedTime)
  pageSize = 1000
```

- `pageSize`: "The maximum value is 1000". `nextPageToken`: "This will be absent if the end of the files list has been reached". The response also has `incompleteSearch` (files.list reference). `listChildren` already loops on the page token (driveClient.ts:21-39) and can be reused with a wider query and field list.
- `name contains` is a prefix match only ("The `contains` operator only performs prefix matching for a `name` term", search terms reference), so `.xml` cannot be filtered by the server. Filter by name suffix in the app, as `camtStatementFiles` does (CamtIngest.gs:440-456). The MIME type Apps Script gives an XML attachment is not known, so do not filter on it.
- Skip a file whose `<label>-<account>.xml` name has its label and account on the ledger already, as `CamtIngest.gs` does (CamtIngest.gs:418-425, Code.gs:465-475). Download the rest.

**Download one file.**

```
GET /drive/v3/files/<id>?alt=media
Authorization: Bearer <drive.readonly token>
```

Google: "use the files.get method with the ID of the file to download and the alt system parameter", and the scope must allow "read access to the file content" (manage-downloads guide). `response.arrayBuffer()` then goes to `loadImportFile`. The guide's curl sample uses `-L`, which follows redirects. Whether a browser download is ever redirected to another host was not found on Google's pages (unconfirmed). If it were, the CSP's `connect-src` would block it. The first manual test should watch the network panel for this.

**Wave 14 reuse.** The same token and calls read the accountant's xlsx with `alt=media` and the Google Sheets with `files/<id>/export` (`exportAsXlsx`, driveClient.ts:42-46, capped at 10 MB per the manage-downloads guide).

## What the planning session must change in Google Cloud

In the Cloud project: Each item is a shared-environment change: show it to the owner, wait for the owner's yes, make it through Chrome and re-read the page.

1. **Audience page: read the publishing status and record it.** If it says Testing, the owner must be on the test users list, and the Drive grant expires seven days after consent, every week. Moving to In production (unverified) removes the expiry and shows the unverified-app warning at consent, with the 100-user cap. This is the change most likely needed.
2. **Data Access page: decide with the owner whether to declare `https://www.googleapis.com/auth/drive.readonly`.** The Gmail precedent says leave it off, and the grant still works. Declaring it lists it under "Your restricted scopes", and Google's page advises against restricted scopes "to avoid unnecessary additional reviews". What the console does to a production app with an undeclared restricted scope, or a declared one without verification, is not on Google's pages (unconfirmed). My recommendation: leave it off, as `gmail.compose` is, and record that on the handoff's Cloud row.
3. **APIs and services: confirm the Google Drive API is enabled.** Wave 0 enabled it, and the invoice filing already calls it. A read only, no change expected.
4. **No change** to the OAuth client (the JavaScript origins and the two redirect URIs already cover the popup and the redirect), the API key (it is for the Picker only, Drive calls carry the OAuth token), or Branding.

Outside Cloud: the owner can see and revoke the grant at myaccount.google.com/permissions (how-user-authz-works guide). Sign out in the app revokes only the stored sign-in token (googleAuth.ts:195-207). Whether that revoke also drops the `drive.readonly` grant made through a separate request was not checked against Google's pages (unconfirmed).

## Open questions

1. Does the owner accept one tap per page load before new statements are read, or does the owner want the bounce through Google on open?
2. Is the Cloud project in Testing or In production?
3. Leave `drive.readonly` off the consent screen as `gmail.compose` is, or declare it as the handoff says?
4. Ask the read token with `include_granted_scopes: false` (read only) rather than true like Gmail?
5. The statements folder setting as a path (plan.md) or as a folder id picked once?

## Sources

- Drive scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- GIS token model: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- GIS reference (`include_granted_scopes`, `prompt`, `enable_granular_consent` "Deprecated, no effect if set"): https://developers.google.com/identity/oauth2/web/reference/js-reference
- Implicit flow: https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- How user authorization works: https://developers.google.com/identity/oauth2/web/guides/how-user-authz-works
- Unverified apps and the 100-user cap: https://support.google.com/cloud/answer/7454865
- When verification is not needed: https://support.google.com/cloud/answer/13464323
- Restricted scope security assessment: https://support.google.com/cloud/answer/13464321
- Testing status, 100 test users, seven-day expiry: https://support.google.com/cloud/answer/15549945
- Consent screen and Data Access: https://developers.google.com/workspace/guides/configure-oauth-consent
- files.list: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
- Search syntax: https://developers.google.com/workspace/drive/api/guides/search-files and https://developers.google.com/workspace/drive/api/guides/ref-search-terms
- Folders and `root`: https://developers.google.com/workspace/drive/api/guides/folder
- Downloads: https://developers.google.com/workspace/drive/api/guides/manage-downloads
- Picker for web: https://developers.google.com/workspace/drive/picker/guides/overview (says nothing about folder grants)
- Picker for desktop and mobile, `allow_folder_selection`: https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker (also silent on what a folder pick grants)
