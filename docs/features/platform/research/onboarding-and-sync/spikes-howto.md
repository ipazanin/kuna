# Onboarding and sync: stage 0 spikes, how to run them

Numbered steps for the eleven stage 0 spikes of the onboarding and sync proposal, the local spike page that runs eight of them in desktop Firefox, the Android checks on the deployed app and a results template to paste back.

These are the spikes from "Stage 0: spikes you run" in [the proposal](../../onboarding-and-sync.md). Their answers decide stage 2 (one token, one trip) and stage 3 (onboarding). The mail spikes (8 to 10) come from [mail.md](mail.md). The procedure copies [the JSON storage spikes](../json-storage/spikes.md).

## What needs your yes first

- **Nothing in Google Cloud is changed by any spike.** The page asks for `gmail.readonly` as an extra grant on your own account, the way `gmail.compose` and `drive.readonly` were asked. Neither is on the consent screen's Data Access page.
- **If Google refuses `gmail.readonly` because it is not declared**, stop and tell me. Adding it to the Data Access page is a Cloud change, and I show you the exact change first.
- **If spike 1 says Testing**, publishing to production is a Cloud change that needs your yes. Do not publish from the spike.
- **Spike 8 writes to your Drive.** It creates one tiny file called `ledgerboard-spike-delete-me.txt` in a folder the scripts made and deletes it a second later. Pick the folder yourself.
- **Spike 3 only works once.** It needs `gmail.readonly` never granted. Run it before any step that grants it. If you ran a Gmail grant before, remove the app at myaccount.google.com under third-party access, sign in again, and the scopes start empty.
- **Whether a new restricted grant uses one of the 100 places is unconfirmed.** Your account already passed the unverified-app screen for `drive.readonly` and `gmail.compose`.

## Start the spike page (desktop Firefox)

1. Stop any normal `npm run dev` first. The page must run on port 5173, because `http://localhost:5173/ledgerboard/` is the only local address Google accepts for the redirect.
2. In a terminal: `cd ~/Projects/personal/ledgerboard`, then `npm run dev -- --config spike.local/onboarding-sync/vite.config.mjs`.
3. Open `http://localhost:5173/ledgerboard/` in Firefox on the Mac, where you are signed in to Google.
4. The grey box at the top shows your browser, the origin and whether the Cloud settings from `.env.local` loaded. Both must read `true`, and the origin must be `http://localhost:5173`.
5. Type your Google email into the first field. It only skips the account chooser and stays in this browser.
6. Run the spikes in the order below. Each has its own box. **Copy all results** at the top copies every box. Nothing prints a token or a message body.
7. When done, stop the server with Ctrl+C. The folder `spike.local/` is ignored by Git and is never committed.

## Spikes in the Cloud console and the Apps Script editor

### Spike 1. Testing or In production

1. Open console.cloud.google.com and pick the app's Cloud project.
2. Open Google Auth Platform, then Audience.
3. Read the **Publishing status**. It says Testing or In production.
4. Open Data Access in the same menu. Write down which scopes are listed (names only).
5. Change nothing.

### Spike 11. One payroll Executions entry

1. Open script.google.com and the payroll fetch project.
2. Open Executions in the left bar.
3. Open the newest entry that ran from a trigger (type Time-driven).
4. Write down the **Start time** exactly as shown and whether it is near noon.
5. Open Project Settings and write down the **Time zone** value.
6. Do not copy log lines.

## Spikes on the spike page (desktop Firefox)

### Spike 3. Silent trip when one scope was never granted (run first)

1. Press **Run spike 3**. The tab leaves for Google and comes straight back, with no screen if it works.
2. Read the box. It says an error name or a token, and which scopes the token holds.
3. If Google showed any screen at all, write down what it said.

### Spike 2. Silent trip with all three scopes granted

1. Press **2A**. Google shows its consent screen for `drive.file`, `drive.readonly` and `gmail.readonly`. Write down whether the unverified-app screen came first, and whether the consent screen had one checkbox per scope. Allow all three.
2. Press **2B**. The box says whether one token came back with all three scopes.

### Spike 7. Time of a silent round trip

1. Press **Run spike 7** three times. Each run adds a time and the box shows the median.
2. Press **7 extra** once. This is the popup token for the same scopes. Write down whether the popup closed by itself and the time the box prints.

### Spike 4. Parent of a picked folder under `drive.file`

1. Press **Run spike 4**. A popup asks for `drive.file` only, which matters because a wider token would read the parent anyway.
2. The Picker opens. Pick a folder at least two levels below My Drive that the app did not make.
3. The box lists the picked folder and each parent up to six levels, with HTTP 200 or 404. Names are only reported as present or absent.

### Spike 5. Picker with `setParent('root')`

1. Press **Run spike 5**.
2. Write down whether the Picker opened at the top of My Drive. Pick a folder or cancel.

### Spike 8. Create a file in a script-made folder

1. Type the path in My Drive of a folder a script made, for example the VAT returns folder, with segments split by `/`.
2. Press **Run spike 8**. The popup asks for `drive.file` and `drive.readonly` together.
3. The box prints each path step, the folder's `canAddChildren`, the create status and the delete status. A 404 on the create means stage 6 needs the one-time folder picks.
4. If the box says the test file is still there, delete `ledgerboard-spike-delete-me.txt` in Drive.

### Spike 10. `sha256Checksum` on script-filed files

1. Type up to three folder paths, one per line. Pick one folder that holds statement XML, one with payroll xlsx or PDF and one with VAT xlsx.
2. Leave the sub-folder levels at 0, or set 1 if the files sit one folder deeper.
3. Press **Run spike 10**. The popup asks for `drive.readonly`.
4. The box prints, per file type, how many files exist and how many carry `sha256Checksum`.

### Spike 9. Gmail list, get and attachment

1. Type the bank's sender address. Add subject words if you like.
2. Press **Run spike 9**. The popup asks for `gmail.readonly`.
3. The box shows the HTTP status of each call, up to 5 messages, the mime type and size of each attachment, and a check that the attachment bytes match their declared size.

## Spikes 6 and 7 on Android (deployed app)

The spike page cannot run on the phone, because localhost does not reach it and Google accepts only the two registered addresses. These checks use the deployed app at `https://ipazanin.github.io/ledgerboard/` and its existing redirect sign-in. They need no app code, except the last point.

### Spike 6. Does the trip return into the installed app

1. On the phone, open the installed app and note the time. In Settings, This device, the sign-in is kept for an hour.
2. After more than an hour, or after "Sign out of Google" in that same place, tap Sync. If you sign out, tap Sync again to sign in.
3. Watch the whole trip, ideally with the phone's screen recording:
   - Does Google's page open inside the app window, or in a separate Firefox tab?
   - Does Google first show a cookie screen?
   - After Google, are you back in the installed app window with no address bar, or in a Firefox tab?
4. After the return, read what the app shows:
   - The sync runs. The app found its saved note about where you were going, so what it keeps in localStorage survived.
   - A toast says "Signed in to Google. What you tapped did not run". It found its note and had nothing to resume.
   - A toast says Google sent back a sign-in this tab did not ask for. The return landed in a place that does not hold the note. This is the failure case.
5. Close the app from the recent apps list, open it from the home screen icon and repeat step 3's watching for the silent trip that runs on every open.
6. **Not testable without app code:** whether `sessionStorage` survives the trip in the installed app. The app already keeps its note in localStorage for this reason, so stage 2 does not depend on sessionStorage. If stage 2 wants it, I add a marker in stage 2 and you check once.
7. Optional, needs `adb` on the Mac (I did not check that it is installed): run `adb reverse tcp:5173 tcp:5173` with the phone on USB debugging, then open `http://localhost:5173/ledgerboard/` in Firefox on the phone. The same page then runs there and prints whether the `sessionStorage` marker survived. This tests a Firefox tab, not the installed app.

### Spike 7. Time of a silent round trip on Android

1. Start a screen recording on the phone.
2. Close the app from the recent apps list, open it from the home icon with the phone online, and wait until Overview shows the last sync age.
3. Repeat the same with airplane mode on. The app opens its kept copy and makes no trip.
4. Stop the recording. Read the time from tap to Overview in each case, frame by frame. Do each three times.
5. The online time minus the airplane time is the cost of the trip. Write down both medians.

## Results template

Copy this, fill it in and paste it back with the output of **Copy all results**.

```
Date, Firefox version, Mac OS:
Android Firefox version, phone:

Spike 1  Publishing status:            Scopes listed on Data Access:
Spike 3  Error name or token scopes:   Any Google screen shown:
Spike 2  2A unverified-app screen first (yes/no):   One checkbox per scope (yes/no):
         2B token holds all three (yes/no):
Spike 7  Desktop runs (ms):            Median:
         Popup closed by itself (yes/no):   Popup time (ms):
Spike 4  Parent statuses, level 1 to 6:   Names present (yes/no):   "root" status:
Spike 5  Opened at top of My Drive (yes/no):   Any error:
Spike 8  Folder found (yes/no):   canAddChildren:   Create status:   Delete status:
Spike 10 Per type, files and sha256 present (xml, pdf, xlsx):
Spike 9  list status:   messages:   get statuses:   attachment mime types and sizes:   attachments.get status and size match:
Spike 11 Start time as shown:   Near noon (yes/no):   Project time zone:

Spike 6 (Android)
  Google page opened in: app window / Firefox tab
  Cookie screen shown (yes/no):
  Return landed in: installed app / Firefox tab
  What the app showed after the return:
  Silent trip on open stays in the app (yes/no):
  sessionStorage marker (only if you used adb) survived (yes/no):
Spike 7 (Android)
  Online open times (s):   Airplane open times (s):   Difference:
```
