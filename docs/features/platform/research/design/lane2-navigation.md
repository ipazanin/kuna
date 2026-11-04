# Design lane 2: a home and per-app navigation

How Kuna's shell lists, routes and syncs its apps today, how Odoo, Zoho One, Google Workspace, Microsoft 365, Notion, Linear and the mobile guidelines move between apps, the options for a Kuna home with a sidebar per app, and one recommended design with the code it touches.

Read-only research on the Kuna repo at `afa7904`. Paths are relative to the Kuna repo root. The working tree had uncommitted edits by another session in `scripts/visual-check.mjs`, `scripts/touch-check.mjs`, `scripts/support/editorFlows.mjs` and the Company onboarding and filters folders. Line numbers in those script files are from the working tree. None of the navigation lines cited below are in that diff.

The owner's ask (plan, Design wave entry of 2026-10-29): no shared sidebar for every app, a Kuna home to choose an app that is easy to reach from every app, and inside an app only that app's sidebar.

## 1. How the shell works today

### The app seam and the registry

- `AppContribution` (`src/shared/app/appContribution.ts:37-68`) gives the shell `id`, `name`, `install`, `screens`, `menu()`, `menuCount()`, `subtitle()`, `moneyFormat()`, `firstRun()`, `startPath`, `syncGroup()`, `settings()`, `asksGoogleOnOpen()` and `start()`. An `AppScreen` (`:9-16`) has a path, title, icon, lazy component and an optional `bare` flag for screens shown without the menu.
- `main.ts:19-21` installs Company, then Loans. The registry keeps them in that order and calls the first one the home app (`src/shell/routing/appRegistry.ts:5-22`).
- The home app is special in four places: `#/` redirects to its first screen (`router.ts:34`), its screen titles carry no app name while other apps' do, so the Loans Overview is "Overview, Loans" (`appRegistry.ts:30-32`), Settings and unknown addresses format money as it does (`App.vue:51-53`), and its first run takes every address on a fresh device (`appRegistry.ts:39-45`).
- Company: 5 core screens (`src/apps/company/app.ts:18-24`), 3 pack screens Owner, Year, Salaries (`packs/hr-doo/hrDooPack.ts:21-24`) shown while `ownerPayModule` is on (`app.ts:55`, `packContribution.ts:92-94`), a bare Start screen at `/company/start` (`app.ts:48`) and the dev-only Gallery (`app.ts:51-53`). `menuCount` puts the Review queue's count beside Review (`app.ts:57`). `subtitle()` is the company name from the books (`app.ts:58`).
- Loans: Overview, Bank loan, Informal loan and a bare Start at `/loans/start` (`src/apps/loans/app.ts:27-32`). Its menu holds only Overview (`app.ts:33`). The two loan screens open from cards with `?loan=<uuid>` (`overview/presentation/loanLinks.ts:9-20`) and go back with an "All loans" link (`BankLoanScreen.vue:118`, `InformalLoanScreen.vue:49`). Loans has no subtitle and formats money with the default euro format (`app.ts:35-37`).
- The shell may not import an app. `tests/importBoundaries.spec.ts:132` pins it, so anything the shell shows about an app has to come through `AppContribution`.

### Routes

`createAppRouter` (`src/shell/routing/router.ts:29-80`) uses hash history for GitHub Pages (`:21-24`). Its table (`:33-37`):

| Route            | What it does                                                                   |
| ---------------- | ------------------------------------------------------------------------------ |
| `/`              | redirects to the home app's first screen, `/company`                           |
| every app screen | `meta.bare` and `meta.title`, the title from `screenName`                      |
| `/settings`      | the shell's Settings screen (`screens.ts:7-15`)                                |
| `/:unknown(.*)*` | redirects to `/`, so any old or mistyped address lands on the Company Overview |

`refuseScreensOutside` (`:83-88`) throws when an app's route is not under `/<id>`. `afterEach` names the browser tab and moves focus to the new screen's heading (`:59-67`). The tab reads "Overview – Kuna" for Company and "Overview, Loans – Kuna" for Loans (`src/shared/routing/browserTitle.ts:6-9`). The manifest opens the installed app at `start_url: "./"` in `standalone` display (`public/manifest.webmanifest:7-9`), which is `#/` and so Company's Overview.

### The sidebar, the top bar and the drawer

- `App.vue:29-42` builds one `Navigation`: a group per installed app with its name, subtitle and menu entries with counts, plus Settings set apart.
- `ScreenNavigation.vue:41-76` renders each group under its app heading with the subtitle below it (`:51-54`), then Settings below a rule (`:68-75`). Each group has `data-testid="nav-group"`.
- `AppShell.vue` has two layouts, switched at 1024 px (`:26`):
  - From 1024 px a 15 rem sidebar (`:55-64`): `AppBrand` with the Kuna mark and the word "Kuna" (`:58`, `AppBrand.vue:7-14`), the grouped menu, and the sync control in the sidebar's footer (`:60-62`). The brand is not a link.
  - Below 1024 px a sticky top bar (`:66-89`): a menu button at the left (`data-testid="open-navigation"`) that opens a left `USlideover` drawer with the same grouped menu (`:71-82`), then on a phone (below 640 px, `src/shared/layout/viewport.ts:5`) the screen's title with the mark (`:83`, `data-testid="top-bar-title"`), or "Kuna" on a tablet (`:84`). The sync control sits at the right (`:86-88`).
- There is no bottom bar and no keyboard shortcut anywhere in `src`.
- "The company name block": the Company group's heading with the company name under it. It sits at the top of the menu only because Company is installed first. The brand row above it carries no subtitle.

### Settings

One shell screen at `#/settings` (`screens.ts:7-15`) loads every app's `settings()` and renders `SettingsScreen.vue`:

- App tabs come first, in install order (`SettingsScreen.vue:22-34`). Company gives General, Categories and Accounts, plus the pack's Ruleset, and only once books are open (`companySettings.ts:10-23`, `hrDooPack.ts:34`). Loans gives no tab (`loansSettings.ts:5-8`). Two tabs with one value throw (`SettingsScreen.vue:21-29`).
- "This device" is the shell's tab (`:19`, `:33`, `:53-59`). It holds each app's device card first, Company's "Company books" (`DataSourceCard.vue:42`) and Loans' "Loans books" with "Set up Loans" or "Switch storage" (`LoansBooksCard.vue:16-24`), then the shell's Sync card while any file is on Drive (`:56`, `SyncCard.vue`: the last sync's steps, "Sync as the app opens", "Sign out of Google"), then Appearance and privacy (theme, language, the privacy page, `AppearanceCard.vue`).
- The page heading speaks for every app: "How each app's books and this device are set up" (`SettingsScreen.vue:46`).
- 16 links in 12 `src` files outside the shell point at `/settings`, all Company's, some with `?tab=` or `#company-registered` (`grep -rnE "['\"]/settings" src | grep -v ^src/shell`). Scripts address it 53 times (`grep -rhoE "#/[a-z-]*" scripts`).

### Sync

- One sync for the page over every app's file on Drive (`src/shared/sync/presentation/pageSync.ts:100-185`). `App.vue:46` starts it with every installed app. Each app gives a `syncGroup()` (steps, access needs, an export control). The token request joins every Drive app's scopes (`pageSync.ts:110-120`).
- `TopBarSync.vue` is the one control in the sidebar footer and the top bar. While no file is on Drive it shows each browser file's export control instead (`:36-39`). The compact form shows the time since the last sync, and the full one shows the steps list (`SyncStatus.vue:92-106`, `:227`).
- `keepPageSynced.ts:11-29` and `autoSync.ts:70` open every app's store as the page starts and sync when due. So every app's books are in memory on any screen, which a home with live figures needs.

### First runs

- `firstRunAt` (`appRegistry.ts:39-45`): on a fresh device the home app's first run takes every address. Otherwise an app's first run takes only addresses under that app. `App.vue:55-66` replaces the route with the app's `startPath`, and `:76-77` hides the shell during it.
- Company's first run counts when nothing is chosen and nothing is kept (`company/app.ts:61`). Loans' rule is the same (`loans/app.ts:38`).
- On a fresh device `#/` shows Company's welcome "What brings you here?" with the browser tab "Kuna" (`WelcomeStep.vue:28`, `scripts/visual-check.mjs:328`). Loans cannot be set up before Company.
- Loans is set up by opening Loans, Overview from the menu, which the rule sends to `/loans/start`, or with "Set up Loans" in Settings, This device (`LoansBooksCard.vue:20`). Finishing goes to `/loans` (`useLoansStart.ts:30-32`).
- `tests/firstRun.spec.ts:11-35` pins both rules, including "the home app's on a fresh device, whatever the address".

### What the checks pin about navigation

- `menuGroupsFlow` (`scripts/support/editorFlows.mjs:2824-2850`, run as `menu-groups` at `visual-check.mjs:755` with Loans on Drive and in the browser) opens the drawer where there is one, then expects exactly two `nav-group`s named Company and Loans, Company listing Overview and Transactions, Loans with no subtitle and only Overview marked current, and the tab title "Overview, Loans – Kuna".
- The touch check at 360 and 430 px (`scripts/touch-check.mjs:227-285`): the top bar names the screen "Overview", the menu button sits at the left and one 44 px Sync button with the sync age at the right. The drawer marks the current screen, keeps Tab inside, closes on Escape and on a tap outside, and a tap on Transactions opens it with the heading below the bar. `:1025` checks the top-bar title of each screen in a list. Helpers: `openDrawer`, `drawerClosed`, `topBarTitle` (`:1712-1725`).
- Fresh-device flows start at `#/` and wait for the title "Kuna": 7 in `visual-check.mjs` (`:328`, `:739-745`) and the onboarding loop in `touch-check.mjs:1650-1661`. 11 `#/` literals in scripts in all.
- The visual check renders every screen at nine widths, 360 to 2560 px (`visual-check.mjs:173-181`). The sidebar appears at five of them (1024 and up) and the drawer at four.
- Every check reaches screens by setting the hash, not by clicking the menu, apart from the drawer step. A new menu changes few flows.

## 2. How comparable products do it

Pages loaded on 2026-10-29. The Odoo shortcuts, Linear workspaces and Microsoft suite header pages were loaded twice, the second time to check the quotes. Anything not found on a loaded page is marked unconfirmed.

Most of these products use the same three layers. A home or launcher lists the apps. A strip that never changes holds the way home, the account and notifications. Each app then has its own menu below or beside that strip.

### Odoo

- **Home:** the "main Odoo dashboard" of apps (https://www.odoo.com/documentation/19.0/applications/general/apps_modules.html).
- **Per-app menu:** three menu levels. "The root menu, which is displayed in the App switcher (the Odoo Community App switcher is a dropdown menu)", then "The first level menu, displayed in the top bar", then "The action menus" (https://www.odoo.com/documentation/19.0/developer/tutorials/server_framework_101/05_firstui.html). The docs write paths as "Sales app ‣ Reporting ‣ Sales".
- **Way back:** the shortcut "Odoo Home Page" is Alt + H on Windows and Linux, and Ctrl + H on macOS. Ctrl/Command + K opens a command palette that searches menus and apps (https://www.odoo.com/documentation/18.0/applications/essentials/keyboard_shortcuts.html). That the home icon sits at the top left is unconfirmed: no official page found says so.
- **Global:** Discuss, Activities (grouped by app, with a count), the company selector and the profile icon, all in the upper-right header (https://www.odoo.com/documentation/19.0/applications/productivity/discuss.html, https://www.odoo.com/documentation/19.0/applications/essentials/activities.html, https://www.odoo.com/documentation/19.0/applications/general/companies/multi_company.html, https://www.odoo.com/documentation/19.0/applications/general/users/language.html). Settings is its own app on the home, not a header item (https://www.odoo.com/documentation/18.0/applications/essentials/search.html). Each app keeps its own configuration in its own menu.

### Zoho One

- **Home and switching:** the One Launcher "is available to access from within every Zoho app", with apps "organized into tabs" (https://help.zoho.com/portal/en/community/topic/one-launcher-the-application-superhighway).
- **Global:** "The unified navigation bar sits conveniently on the left side of your screen", with pinned and recent apps, search and a unified dashboard (https://blog.zoho.com/one/boost-employee-productivity-with-zoho-one%27s-unified-user-interface.html). The unified UI has a dark blue top bar, a left sidebar of app icons and the profile image at the top right (https://help.zoho.com/portal/en/community/topic/enforcing-the-zoho-one-unifiedui, undated). Apps group into spaces, switched with a dropdown at the top (https://help.zoho.com/portal/en/kb/one/user-guide/spaces-ui/spaces/articles/swi).
- **Per-app menu:** unconfirmed. No loaded page describes it.

### Google Workspace

- **Launcher:** "Click the Google apps menu in the top right, then click an app." Users cannot reorder or remove apps (https://support.google.com/a/users/answer/9333810). The "9-dot" name comes only from third-party snippets, so it is unconfirmed.
- **Phone:** "Mobile apps don't have the Google apps menu for switching between apps." Same page. Each phone app stands alone.
- **Per-app menu (Gmail):** a collapsible left panel, Settings at the top right, and a right side panel for Calendar, Keep and Tasks (https://support.google.com/mail/answer/11555490?hl=en).
- **Global account and search:** unconfirmed. https://support.google.com/accounts/answer/1714464 redirected to the help home.

### Microsoft 365

- **Launcher:** opened "from the upper left-corner of the page" (https://support.microsoft.com/en-us/office/meet-the-microsoft-365-app-launcher-79f12104-6fed-442f-96a0-eb089a3f476a).
- **Way back:** the organisation's logo in the suite header. Without a set URL, its on-click link will "default to the Microsoft 365 home page". "The navigation bar appears at the top on every page." The header may hide the logo on narrow screens (https://learn.microsoft.com/en-us/microsoft-365/admin/setup/customize-your-organization-theme).
- **2024 launcher change:** app search and one app order for everyone, from Message Center MC718545 on a third-party mirror (https://mc.merill.net/message/MC718545). Unconfirmed on a Microsoft page.
- **The "waffle" name, the header search and the account menu:** unconfirmed.

### Notion and Linear

- **Notion:** "Click on your current workspace's name to switch between the workspaces you belong to." The inbox stays at the top right and Settings sits at the bottom of the sidebar. The page says both that the workspace name "sits at the bottom" and "at the very top of your sidebar" (https://www.notion.com/help/navigate-with-the-sidebar).
- **Linear:** click the workspace name in the top-left corner, then "Switch workspace". "You can also switch workspaces by typing `O` then `W`" (https://linear.app/docs/workspaces). https://linear.app/docs/sidebar returned 404, so Linear's sidebar layout is unconfirmed.
- **For Kuna:** both switch the whole account, members and billing included. Kuna's apps share one person, one sign-in and one sync, so only the look carries over: a name with a menu at the top of the sidebar.

### Phones and installed apps

- **Material, through Android's Compose docs:** a navigation bar for "Three to five destinations of equal importance" on compact windows (https://developer.android.com/develop/ui/compose/components/navigation-bar), a rail for "Three to seven main destinations" on tablets and desktops (https://developer.android.com/develop/ui/compose/components/navigation-rail), and a drawer for complex apps that "Organize multiple features and settings in a single menu" (https://developer.android.com/develop/ui/compose/components/drawer). The m3.material.io guideline pages render only with JavaScript and are unconfirmed.
- **Apple tab bars** (loaded from https://developer.apple.com/tutorials/data/design/human-interface-guidelines/tab-bars.json, since the HIG page is JavaScript only): "Use a tab bar to support navigation, not to provide actions." Keep it visible, or "people can forget which area of the app they're in." "Avoid overflow tabs", since a More tab hides content. For a complex structure, "consider a sidebar or a tab bar that adapts to a sidebar."
- **Standalone display:** `standalone` excludes "UI elements such as a URL bar", while `minimal-ui` keeps back, forward and reload (https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display). web.dev suggests "adding a back button to use when your app launches in standalone mode" (https://web.dev/learn/pwa/app-design).
- **Firefox:** "Firefox does not support installing PWAs using a manifest file" on desktop, and on Android it adds a home-screen shortcut that opens the site in the browser (https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable). In Firefox, Kuna is a normal tab with a working Back button. The installed app without Back is Chrome or Edge on desktop, Safari's Add to Dock and the iPhone home screen. There the link home inside Kuna is the only way out of an app.

### What carries over

| Product          | Home                  | Way back                                        | Global                                 | Inside an app                                 |
| ---------------- | --------------------- | ----------------------------------------------- | -------------------------------------- | --------------------------------------------- |
| Odoo             | grid of apps          | home icon (position unconfirmed), Alt/Ctrl + H  | messages, activities, company, profile | the app's own top menu, its own configuration |
| Zoho One         | launcher with tabs    | launcher in every app, left rail                | rail, search, profile                  | unconfirmed                                   |
| Google Workspace | none, a launcher menu | the launcher at the top right, absent on phones | unconfirmed                            | the app's left panel                          |
| Microsoft 365    | home page             | the logo, the launcher at the top left          | the suite header                       | unconfirmed                                   |
| Notion, Linear   | none                  | workspace name menu, O then W                   | inbox, settings                        | one sidebar per workspace                     |

Three points hold across them. The way home sits in the same corner on every screen. Account, sign-in and notifications live in that fixed strip, never in an app's menu. Settings that belong to an app sit in that app, and Odoo even makes general Settings an app of its own on the home.

## 3. Options for Kuna

Each option is what the owner sees and what it costs. Costs count files and literals from the code above.

### The home screen

- **A card per app with one live figure.** Company shows cash on hand and the company name, with "3 to review" when the queue has rows. Loans shows what you owe in all. A card for an app not set up yet says "Set up" and opens its first run. The home has a reason to open every morning. Cost: one optional member on `AppContribution`, such as `homeCard()` returning a label, an amount in cents and a waiting line, and a shell `HomeScreen.vue`. Company already has the figure (`cash/domain/balances.ts:26`). Loans computes its total inside `OverviewScreen.vue:30-37`, so it moves to a function both use. Gotcha: `formatMoney` reads one page-wide format (`moneyFormat.ts:38`, `:85`), set from the app on screen (`App.vue:51-53`). Two apps on one screen need their own formats. Today both are euros, so only Company's number locale setting can differ.
- **Plain app tiles.** An icon, the name and the company name, nothing else. Cost: an icon field and the screen. The home is then one extra tap with nothing to read, which makes "skip the home" the next request.
- **The H4 hub dashboard now.** Net worth, cash across company and personal, taxes due ([hub lane 3](../../../../architecture/research/hub-lane3-apps.md), section 3). Cost: the tile and drill contract that H4 plans, before a personal-money app exists. Too early.

### The home's route

- **`#/` is the home.** The installed app opens on it (`start_url: "./"`), and unknown addresses land on it through the catch-all. Cost: `router.ts:34` becomes a route to a shell screen, the 11 `#/` literals in scripts and the welcome checks move to `#/company/start` or start at the home.
- **Keep `#/` on Company, home at `#/apps`.** Nothing moves for Company. But the phone still opens on Company, so the home is something you go to rather than where Kuna starts, and the owner asked for a place to choose.
- **Open the last app used.** Fast for a habit, but the home is never seen and an old address lands somewhere unpredictable. It also adds a device key for the last app.

### The way back to the home

- **The Kuna mark at the top of every sidebar and drawer is a link home.** Odoo's top-left home icon does the same. Cost: `AppBrand` inside a `RouterLink` with a visible "All apps" label or a grid icon, so the link is discoverable.
- **An app switcher at the top of the sidebar.** The app's name with a chevron opens a list of apps, as Notion and Linear do for workspaces. One click from Loans to Company without the home. Cost: a `DropdownMenu` (Nuxt UI has one), its keyboard and touch checks, and a second way to switch apps beside the home. Worth it only with four or more apps.
- **A keyboard shortcut.** Nuxt UI's `defineShortcuts` is in `node_modules` and supports two-key chains such as `g-h`. Cost: small. Firefox takes many Alt and Ctrl combinations, so a chain of plain letters is the safe kind. A shortcut nobody discovers is optional, so it can come later.

### The sidebar inside an app

From top to bottom: the Kuna link home, the app's name with its subtitle (Company with the company name, Loans with nothing), that app's menu with counts, the app's Settings set apart, and the sync control in the footer. `Navigation.groups` becomes one group, and `ScreenNavigation` loses the loop over apps. Cost: `App.vue:29-42` picks the app on screen (`appOnScreen` at `:52` already finds it), `menuGroupsFlow` is rewritten to expect one group, and a new flow checks that Loans shows only Loans.

On the home there is no app sidebar. The home shows the cards, the sync control and a link to Kuna settings. On a desktop it can keep the same left column with only the brand, Kuna settings and sync, so the layout does not jump between home and app.

### Settings

- **Split into app settings and Kuna settings.** Company's Settings at `#/company/settings` with General, Categories, Accounts, Ruleset and the "Company books" card. Loans' Settings at `#/loans/settings` with the "Loans books" card. Kuna settings at `#/settings` with Sync (auto sync, the last sync's steps, sign out of Google), and Appearance and privacy (theme, language). Each app's sidebar has its own Settings, and Kuna settings is on the home. Cost: `AppSettings` becomes an app screen, `SettingsScreen.vue` keeps only the shell's cards, the 16 `src` links and most of the 53 `#/settings` script addresses move to `#/company/settings`. The Settings heading and the `LINKED_SETTINGS_TAB` key move with the tabs.
- **Keep one Settings reachable from every app.** No route moves. But Settings inside Loans opens on Company's General tab, and every new app adds tabs to one strip. That is the shared sidebar problem again, one screen down.
- **One Settings, opened on the current app's tabs.** It remembers which app sent you. Cost: machinery to filter tabs by referrer, and a deep link still shows the wrong app's tabs.

### The sync button

- **One Kuna-wide sync, as today.** One Google token covers every file (`pageSync.ts:110-120`), and a sync already runs app by app with each app named in its steps. The button sits in the same spot in every app and on the home. Cost: none. On Loans, a tap also syncs Company's statements and mail. The steps list says so.
- **A sync per app.** The Loans button would sync only Loans. Cost: splitting the one sync H2 built, two buttons on the home, and the same token anyway. No user gain for one person with two files.

### First runs

- **The home shows every app, an app not set up as a "Set up" card.** A fresh device opens on the home with both cards in that state. Company's welcome stays Company's. `firstRunAt` loses the home-app clause, so Loans can be set up first. Cost: `appRegistry.ts:39-45`, `tests/firstRun.spec.ts:12-19`, and the 7 fresh-device flows start at `#/company/start` or tap the Company card first. Company's welcome copy ("What brings you here?") reads as Kuna's today and may want a Company heading.
- **Keep Company first.** A fresh device still lands in Company's welcome from any address, the home appears only after. No code change. But the home's "Set up" state never shows for Company, and Loans stays blocked behind Company for no domain reason.

### The phone

- **The home is the phone's start screen, each app keeps its drawer.** The top bar shows the screen's title, the drawer holds the Kuna link home, the app's heading and its menu. On the home the top bar shows "Kuna" and the sync control, with no menu button, since the cards are the navigation. Cost: small, mostly `AppShell.vue` and the touch check's top-bar step.
- **A bottom bar per app.** Company has 8 menu screens, Loans 1. Neither fits a 3 to 5 item bar. Company would need a "More" item, and Loans would show a bar of one. Cost: a new component with safe-area padding, and rewrites of the drawer and top-bar touch steps. Not now.
- **A home button in the top bar.** A grid icon beside the menu button goes home in one tap. Cost: a second control in a 360 px bar that already fits the menu, the title and the sync button. The drawer link is one tap more and keeps the bar as it is.

### What the checks need

- `menuGroupsFlow`: one group per screen, Company's on Company screens and Loans' on Loans screens, plus the link home.
- A new home flow: both cards, their figures on the fake books, the "Set up" state with `loans` unset, and a tap into each app.
- `touch-check.mjs` top-bar and drawer steps: the drawer's top row links home, the home's top bar has no menu button.
- The 7 visual and the touch onboarding flows that start at `#/` on `fake=empty`.
- `tests/firstRun.spec.ts`: the fresh-device rule goes.
- The tab title test in `menuGroupsFlow` if every app's screens get their app's name.
- A home screenshot at all nine widths.

## 4. Recommendation

### The design

1. **`#/` is the Kuna home.** The installed app opens on it, and every unknown address lands on it. On a desktop the home keeps the left column with the Kuna mark, Kuna settings and the sync control, and the page shows one card per installed app. On a phone it is a top bar with "Kuna" and Sync over the cards.
2. **Each card carries one live figure.** Company shows the company name, cash on hand and the Review count when rows wait. Loans shows what you owe in all and what is owed to you. A card whose app is in its first run says "Set up" and opens that app's start. Each card links to its app's first screen. A home with figures earns its tap. Plain tiles would not. Both stores already open as the page starts, so the cards need no extra loading.
3. **The way back is the Kuna mark at the top of every app's sidebar and drawer.** It is a link with the mark, "Kuna" and a grid icon, named "All apps" for screen readers and as its tooltip. Microsoft's logo works the same way. Leave out an app switcher and a shortcut for now. With two apps, going through the home costs one click more than a switcher. A shortcut can come later as a two-letter chain such as `g` then `h`, which `defineShortcuts` supports and which stays clear of the browser's Ctrl and Alt keys.
4. **Inside an app, only that app's sidebar.** From top to bottom: the link home, the app's name with its subtitle (the company name for Company), the app's menu with counts, the app's Settings set apart, and Sync in the footer. Below 1024 px the same list goes in the drawer.
5. **Settings splits.** Each app gets a Settings screen under its own route. Company's has General, Categories, Accounts and Ruleset, and the Company books card as a "Books file" tab. Loans has the Loans books card. Kuna settings stays at `#/settings`, reached from the home, with Sync (auto sync, the last sync's steps, sign out of Google), Appearance and privacy, and language. This is Odoo's split: an app's configuration inside the app, the shared setup as its own place on the home.
6. **One sync, as H2 built it.** One button in the same corner on the home and in every app. The steps list already names each app.
7. **Any app can be set up first.** The fresh-device rule goes. A fresh device opens on the home with every card in its "Set up" state. Company's welcome stays where it is and gets a Company heading, since it no longer greets Kuna as a whole.
8. **The phone keeps its drawer.** The home is the start screen. In an app the top bar shows the menu button, the screen's title and Sync, and the drawer starts with the link home. No bottom bar: Company's 8 screens need a More tab, which Apple's guidance advises against, and Loans has one screen.
9. **The home app concept goes.** No app is special. Every screen's browser tab names its app, such as "Overview, Company – Kuna" and "Overview, Loans – Kuna". The phone top bar keeps the bare screen title, since the drawer names the app. The route meta then carries the screen title and the app name apart.

### Gotchas to settle in the plan

- **Money format on the home.** `formatMoney` reads one format for the whole page (`moneyFormat.ts:38`, `:85`). The home shows two apps' amounts. Today both are euros, and only Company's number locale setting can differ. The plan picks one way to format a card in its own app's format and uses it everywhere.
- **Filters on Company's Settings.** `carriesFilters` (`src/apps/company/filters/application/filterStore.ts:25-27`) writes the period filters into every `/company/` address except `/company/start`. Company's Settings under `/company/settings` would pick them up unless it is left out too. Another session is editing that folder now.
- **Links into Settings.** The 16 `src` links and 53 script addresses to `#/settings` split between `#/company/settings` (all of the `src` ones are Company's) and Kuna settings (the device and sync flows). `MAIL_LIST_LINK` (`useMailSync.ts:23`) and the `?tab=ruleset&rule=` links keep their query.
- **The welcome copy** is in `src/apps/company/onboarding`, which another session is editing.
- **Storage keys and Drive tags do not change.** This is navigation only.

### Code it touches

Shell:

- `src/shared/app/appContribution.ts`: a home card member (label, amount, waiting line), `AppSettings` replaced by an app Settings screen, `subtitle` stays.
- `src/shell/routing/appRegistry.ts`: `homeApp` and the fresh-device clause of `firstRunAt` go, `screenName` names every app.
- `src/shell/routing/router.ts`: `/` routes to the home instead of redirecting, `/settings` loads only Kuna's cards.
- `src/shell/routing/screens.ts`: a home screen beside Kuna settings.
- `src/shell/App.vue`: the navigation for the app on screen only, the home layout, the money format with no app on screen.
- `src/shell/ui/AppShell.vue`, `ScreenNavigation.vue`, `AppBrand.vue`: one group, the link home at the top, the home's top bar without a menu button.
- New `src/shell/home/HomeScreen.vue` with its card.
- `src/shell/settings/SettingsScreen.vue`: Kuna's cards only, the heading text, and `LINKED_SETTINGS_TAB` moves to the apps' Settings screens.

Apps:

- `src/apps/company/app.ts`: the home card, the Settings screen in `screens` and `menu`.
- `src/apps/company/settings/presentation/companySettings.ts` becomes a Settings screen, with `DataSourceCard` as a tab.
- The 12 Company files linking to `/settings`, and `filterStore.ts:25-27`.
- `src/apps/loans/app.ts`, `src/apps/loans/settings/presentation/loansSettings.ts` and `LoansBooksCard.vue`. The owed totals in `overview/presentation/OverviewScreen.vue:30-37` move to a function the card and the Overview share.
- `src/apps/company/onboarding/presentation/WelcomeStep.vue`: the heading.
- `public/manifest.webmanifest:5`: the description still speaks only of company finance.

Checks:

- `tests/firstRun.spec.ts`, and a spec for each app's home card figure.
- `scripts/support/editorFlows.mjs:2824-2850` (`menuGroupsFlow`) rewritten per app, plus a home flow and a "Set up" flow.
- `scripts/touch-check.mjs:227-285` and `:1712-1725`: the drawer's link home, the home's top bar.
- The fresh-device flows at `#/` (`visual-check.mjs:328`, `:739-745`, `touch-check.mjs:1650-1661`) and the `#/settings` addresses in both scripts.
- A home screenshot at all nine widths, and the visual check's Settings list split into Company, Loans and Kuna settings.
