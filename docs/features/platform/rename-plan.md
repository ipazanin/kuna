# Rename to Kuna

Every place the app's name lives, the order of the switch, the Google Cloud changes that wait for the owner's yes, and how the owner's Drive data moves to the new names.

The owner's decisions: the name is Kuna, the stored names change too with no code that reads the old ones, the GitHub repo and the local clone move, and the Google Cloud project leaves Testing in the same wave.

## What carries the name

| Where                 | Today                                                                                   | After                                                       |
| --------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Address               | `ipazanin.github.io/ledgerboard/`                                                       | `ipazanin.github.io/kuna/`                                  |
| Repo and clone        | `ipazanin/ledgerboard`, `~/Projects/personal/ledgerboard`                               | `ipazanin/kuna`, `~/Projects/personal/kuna`                 |
| App name              | manifest, titles, onboarding, privacy page, PDF producer, README, package name          | Kuna                                                        |
| Icons                 | `icons/ledgerboard-*.png/svg`                                                           | `icons/kuna-*`, same bar-chart mark                         |
| Books file on Drive   | `ledgerboard-company.json`, tag `ledgerboard=company`, `"format": "ledgerboard"` inside | `kuna-company.json`, tag `kuna=company`, `"format": "kuna"` |
| Daily backups         | `backups/ledgerboard-company-<day>.json` (2 today)                                      | `backups/kuna-company-<day>.json`                           |
| Files filed from mail | tags `ledgerboard-mail`, `ledgerboard-mail-id`, `ledgerboard-mail-date`                 | `kuna-mail`, `kuna-mail-id`, `kuna-mail-date`               |
| Device storage        | `ledgerboard.*` keys, `ledgerboard-workbook-*` and `ledgerboard-document-*` databases   | `kuna.*`, `kuna-workbook-*`, `kuna-document-*`              |
| Downloads             | `ledgerboard-<company>-<day>.xlsx`, `ledgerboard-transactions-<day>.csv`                | `kuna-…`                                                    |

The `source` fields inside the books file name the workbook the owner imported on 17 October (`ledgerboard-shadow-accounting-…xlsx`). That was the real file name, so they stay. The research notes keep the old name as history.

## Google Cloud changes (wait for the owner's yes)

1. OAuth client: add `https://ipazanin.github.io/kuna/` as a redirect address. The JavaScript origin `https://ipazanin.github.io` stays. The old `…/ledgerboard/` address comes off once Kuna works.
2. API key for the Picker: if its website restriction names the `/ledgerboard/` path, add `https://ipazanin.github.io/kuna/*`.
3. Branding: app name Kuna, home page `https://ipazanin.github.io/kuna/`, privacy policy `https://ipazanin.github.io/kuna/privacy.html`.
4. Audience: Publish app, so it moves from Testing to In production. Google's consent screen keeps the unverified-app warning because the Gmail and Drive read scopes are restricted, and at most 100 people can ever grant access. The grant no longer lapses after 7 days.

The console did not load in the browser tool on 28 October, so the current redirect list, key restriction and branding get read on the day, before anything changes.

## Order on the day

1. Close Ledgerboard on every device and remove the installed app (laptop, phone). The old app keeps the books file's id and would save `"format": "ledgerboard"` into it, which Kuna refuses.
2. Cloud steps 1 to 3.
3. `gh repo rename kuna`, point the clone's remote at the new name, push the rename commit. Pages deploys at `/kuna/` and `/ledgerboard/` starts returning 404.
4. Move the owner's Drive data to the new names with a one-off script run from the Kuna page in Chrome, under the app's own Google client, because tags written by the app are visible only to it. It is never committed. A dry run lists what it would change first: the books file (rename, retag, rewrite the format line), the 2 backups the same way, and every filed-mail file's three tags. This runs before Kuna opens the books, because a first mail sync without the new tags would file every mail again.
5. The owner installs Kuna from `/kuna/`, signs in and picks the books. The figure check on the live file matches the baseline, and the file's bytes differ only in the format line.
6. Cloud step 4, publish out of Testing. Remove the old redirect address.
7. Move the clone to `~/Projects/personal/kuna` (stop the spike dev server first). Move this folder to `work/products/kuna/` with inbound links fixed and a root log entry. Update the memories that name the paths.

Old `ledgerboard.*` keys stay in each browser for the `ipazanin.github.io` origin. They do nothing and are cleared from this Chrome with the script. Clearing site data instead would also wipe Shunt, which shares the origin.

## Checks

Quick checks, `check:figures` against the H1 baseline on the fake data and the live file, a fresh-device onboarding on the fake build, and CI's full suites on the push. A grep for `ledgerboard` over `src`, `public`, `scripts`, `tests` and the config comes back empty.
