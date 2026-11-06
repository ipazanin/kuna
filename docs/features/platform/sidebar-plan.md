# Kuna sidebar: one menu with every app in it

**Recommendation.** Build your idea, as a tree with one app open at a time, in the sidebar's current 240 px, after shrinking the logo block to one row. Add a small arrow on each closed app that opens its pages without leaving the screen you are on. Add Cmd+K later as the fast path on a laptop. Drop the narrow rail, pinned pages and most-visited pages.

This reverses two decided things, so say yes knowingly. On 2026-10-29 you asked for "No shared sidebar for every app" and "Inside an app, only that app's sidebar" (`docs/features/platform/design-plan.md`). `patterns.md` also says every menu opens with the largest Kuna mark, centred. The "nineteen menu items became eight" decision is not touched, since it was about Company's own pages, and those stay as they are.

**How far to trust the numbers.** Heights are worked out from the CSS and your two screenshots: a menu row is 36 px, an app row 40, the logo block 127, the Sync block 86. Nothing was rendered. Your window looks like about 1350 x 880, judged from the 240 px sidebar in the home screenshot, so that is an estimate too.

## 1. Is the idea right?

Yes. Today another app's page takes three clicks and a stop at the home: Kuna mark, app, page. With the tree it takes two, and every app is always named on screen. The home stops being a corridor and goes back to being a summary.

Where it strains:

- **Height. The literal idea does not fit.** With Company open, the sidebar as it stands would need 834 px: logo 127, top padding 20, five app rows 200, eight Company rows 288, the gaps, Overview and Kuna settings 88, Sync 86. That is over the check's 800 px laptop and a 768 px one. A 1366 x 768 screen leaves roughly 650 px for the page once the browser's bars are drawn. With the logo at one row and the apps at 36 px each, it comes to about 719 px, so it fits 768 and scrolls only the list at 650.
- **Rows move. This is its real cost.** Spending sits about 300 px lower while Company is open than when no app is open, so you cannot hit it from memory. Company is the longest menu and comes first, which is the worst case. Nothing in a tree fixes this.
- **More to read.** Fifteen rows at worst against nine today. It is still far from the old nineteen in one list, because only one app is ever open.
- **Two Overviews.** "Overview" (all apps) and "Overview" (Company) would sit on screen together, and which one is lit becomes ambiguous. Kuna's should get another name, see decision 2.
- **Two Settings.** This one is mostly fine, since "Kuna settings" and "Settings" already differ in words and the second sits inside its app. Pin Kuna settings just above Sync so it keeps one place.
- **App colour.** Leave the rule as it is: the colour tiles the icon and nothing else, and the selected item keeps the accent. All five tiles now show at once, and that is enough colour. Tinting the open group would make Company, whose gold is close to the accent, read as selected everywhere. Colour must not be the only cue, so the open app also gets a heavier name.
- **Badge on a closed app. There is a trap in today's data.** `menuCount` means "what waits" in Company and Spending, but in Investments it is a plain total: held holdings and all transactions. Adding those up would put a large "waiting" number on a closed Investments with nothing to do. It is also wrong today, since a screen reader hears "12 waiting" on Holdings. See decision 3.
- **Eye travel.** On a closed app's badge the eye has to go from the page to the row, then to the arrow, then to the item. That is fine for two rows of badges a day. It is too slow for repeated app switching, which is what Cmd+K is for.

## 2. The alternatives

|                                                | Reach another app's page                                                            | One app in use                       | All five in use                              | Width and height                                                                                                  | Phone                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **A. Tree, one app open (yours)**              | Two clicks, and the arrow avoids landing on Overview. Other apps' pages can be seen | Four closed rows of no use, in words | Best sight of everything, though rows move   | 240 px kept. Tall, fits once trimmed                                                                              | Same list, in the drawer                                                                         |
| **B. Rail of app tiles beside the app's menu** | Two clicks, always through the app's first screen. Other apps' pages cannot be seen | Four idle tiles, cheap               | Fastest app switch, and the tiles never move | Must fit 52 + 188 px inside the 240, leaving about 90 px for a label beside a count. Saves all the app-row height | Works in the drawer, but icons without words are hard for a new person, and touch has no tooltip |
| **C. Switcher at the top of the menu**         | Three clicks: open list, app, page                                                  | Tidy, and nearly what you have now   | No better than today's trip home             | No cost                                                                                                           | Easy                                                                                             |

A horizontal strip of five tiles above the menu is B turned sideways. It keeps tiles still within 240 px at a cost of 44 px height, but also has no names and no sight of other apps. It is the one I would try if the moving rows annoy you in use.

**Which I would drop:** C, because it hides the apps and misses your goal. Also pinned and most-visited pages, whichever layout you pick.

**What "important pages" means.** Fixed by the app, as `menu()` already does. There are 19 menu pages in all, chosen one by one in the simpler UI work, and every one is two clicks away in the tree.

- _Pinned by you_ adds a pin control, a section using height the sidebar lacks, and a list that does not follow you from laptop to phone unless it goes in a synced file.
- _Most visited_ moves rows on its own, the opposite of what muscle memory needs, and needs a visit log for a problem 19 pages do not have.

The one page that really earns a shortcut is whatever is waiting, and the count on the row already points to it.

**Cmd+K is an addition to A, not a rival.** It answers the moving rows on a laptop, adds nothing to the screen but one icon, and needs nothing new from the apps. It does nothing on a phone, so it cannot be the main path.

## 3. Other changes that help without clutter

- **Logo block: one row.** A 24 px mark and "Kuna" on the left, about 52 px tall instead of 127. It is the biggest single height gain, and `AppBrand`'s `standard` look already draws it. The `lead` look then has no user, so it goes.
- **A skip link.** The shell has none, and the tree makes the tab path to the page about twenty stops. Add one link, shown on focus, to `main`.
- **The current page on detail screens.** A holding, a bank loan, an account or an asset lights no menu item today, because `/investments/holding` is a sibling of `/investments/holdings` and `/loans/bank-loan` is not under `/loans`. So you lose your place. Fix it with a small field on the screen, see section 7.
- **Breadcrumbs: no.** Detail screens already have "All loans" and "All holdings" back links, and the tree plus a lit item says where you are. A breadcrumb would be a third statement of it.
- **Cross-app links: keep the existing pattern, add none here.** Loans publishes each bank loan's `to` in `src/apps/loans/facts.ts`, and Assets shows it. The tree makes such links better for free, because the open app follows the address, so landing in Loans opens Loans. A loan's payment to its Spending row is issue 1 and needs matching first. It should not ride on this work.
- **Keyboard.** Cmd+K on macOS and Ctrl+K elsewhere (`defineShortcuts`' `meta_k`, and `UCommandPalette`, both in the installed Nuxt UI 4.12). Each row in the palette reads "Transactions, Company", since Company and Investments share that word. Screens only at first, no individual loans or holdings. **Firefox: not confirmed.** Mozilla's shortcut page would not load, so this comes from memory: Firefox uses Cmd/Ctrl+K for its search bar and `/` for quick find, and a page can usually take the first over. Test in Firefox before relying on it. `g` then a letter (`g-c` for Company) is the non-browser fallback, since it clashes with nothing and fires only outside a field. The chat plan also wants one shortcut, so pick them together.

Dropped as behaviour nobody asked for: remembering the last page per app, and a button to hide the sidebar.

## 4. The phone

Today: below 1024 px there is no sidebar. A `USlideover` drawer slides in from the left, opened by the top bar's menu button. Its width is `min(20rem, 100vw - 3.5rem)`, so 304 px at 360. It holds `HomeLink` in the lead look and the same `ScreenNavigation`. The phone home has no drawer on purpose, because its cards are the way in, with Overview and Kuna settings as buttons. Sync lives in the top bar, not in the drawer.

What changes:

- The drawer gets the same tree, so a phone reaches another app without going home, which is where the gain is largest.
- **Length at 360 px with Company open:** head 60, Net worth 46, five apps 230, eight rows 368, Kuna settings 55, about 767 px. It just fits the check's 780 px and scrolls on a 640 px phone. Opening the drawer should scroll the current item into view. The accordion matters more here than on a laptop.
- **44 px targets.** The rule in `app.css` already covers `a[href]` and `button`. Each app row is a link and a sibling 44 x 44 arrow button in a flex row, never a button inside a link. 304 px leaves ample room for name, count and arrow, Croatian included: Potrošnja, Ulaganja.
- The arrow does not change the route, so the drawer stays open. Tapping a page closes it through the existing route watch, and the focus handling there still works.
- Head: the mark moves left to match the sidebar, and the close button stays.
- **Keep the phone home without a drawer.** No bottom tab bar either: five tabs would compete with toasts, `.phone-sheet`, the keyboard and the coming chat pane for the same strip.

The 640 to 1023 px range behaves the same at 288 px.

## 5. Sidebar and chat dock

The 1408 px threshold is one sum: 240 sidebar + 784 smallest page + 384 panel. Every pixel added to the sidebar raises it. A 296 px rail plus menu would need 1464 px and leave 728 px at a 1024 px window, under what screens are built for. This is why A and B both stay inside 240, and it is the best reason not to widen anything.

- The chat's sparkle button goes above Sync, as planned. That adds about 40 px, taking Company's sidebar to about 759 px, which still fits 768 with little to spare. If it gets tight, take menu rows down to 32 px on a laptop, which frees 32 px.
- **Your window is under the threshold.** At about 1350 px wide you would get the pane instead of the dock, every time. The chat plan left "What is your laptop's usual window width?" open.
- **A way out that the chat plan did not have.** While the chat is docked, the sidebar could shrink to 56 px of icons: 56 + 784 + 384 = 1224 px. The page's width stays at 784 px or more with no container queries. At 1224 to 1279 px the page matches what a 1024 px window gets today. At 1280 to 1407 px it gets 840 to 967 px with the `xl` layouts, more than the 784 px at `xl` the 1408 px dock already accepts. So it should not need the pass over every screen that the plan feared, though this is reasoned and not tested. See decision 4.
- In the pane below the threshold, a click on a sidebar item has to close the pane and go to the page. Chat stage 2 needs to know that.

## 6. The sketches

Company open at 1280 x 800. The sidebar is about 719 px tall, so about 80 px spare above Sync.

```
+----------------------------+---------------------------------
| [K] Kuna              (Q)  |  Overview
+----------------------------+  How the company is doing...
|  ##  Net worth             |
|                            |  [All accounts v] [+ Add filter]
| [C]  Company            v  |
|      Example Studio d.o.o.  |  October: EUR 4,200.00 came in
|  ##  Overview   <selected> |  and EUR 7,000.46 went out.
|  ==  Transactions       1  |
|  []  Invoicing             |  +--------------------------+
|  ||  Analysis              |  | Waiting for you          |
|  o   Owner                 |  | ...                      |
|  []  Year                  |
|  oo  Salaries              |
|  *   Settings              |
|                            |
| [L]  Loans              >  |
| [I]  Investments        >  |
| [A]  Assets             >  |
| [S]  Spending        3  >  |
|                            |
+----------------------------+
|  *   Kuna settings         |
+----------------------------+
|  As of today, 09:26        |
|  (Sync)              [:=]  |
+----------------------------+
```

The icons and names of items share one grid with the app rows: a 24 px icon column, then the name. So item names line up with the app's name, and the tile and weight carry the hierarchy. The indent rule in `patterns.md` stands. `(Q)` is the Cmd+K icon. The count shows on a closed app only, since on the open one its item carries it.

The home at 1280 x 800, close to what you have now with the top trimmed:

```
+----------------------------+---------------------------------
| [K] Kuna              (Q)  |  All apps
+----------------------------+  Each app keeps its own books...
|  ##  Net worth             |
|                            |  +-------------+ +-------------+
| [C]  Company         1  >  |  | Company     | | Loans       |
| [L]  Loans              >  |  | EUR 49,152  | | EUR 219,855 |
| [I]  Investments        >  |  +-------------+ +-------------+
| [A]  Assets             >  |  +-------------+ +-------------+
| [S]  Spending           >  |  | Investments | | Assets      |
|                            |
|                            |
+----------------------------+
|  *   Kuna settings         |
+----------------------------+
|  As of today, 09:26        |
|  (Sync)              [:=]  |
+----------------------------+
```

The phone at 360 px, drawer open from a Loans screen, every row 44 px or more:

```
+-------------------------------+-----+
| [K] Kuna                  (x) |     |
+-------------------------------+  p  |
|  ##  Net worth                |  a  |
|                               |  g  |
| [C]  Company            1  >  |  e  |
|                               |     |
| [L]  Loans                 v  |  d  |
|  ##  Overview    <selected>   |  i  |
|  =   Scenarios                |  m  |
|  *   Settings                 |  m  |
|                               |  e  |
| [I]  Investments           >  |  d  |
|                               |     |
| [A]  Assets                >  |     |
|                               |     |
| [S]  Spending           3  >  |     |
+-------------------------------+     |
|  *   Kuna settings            |     |
+-------------------------------+-----+
       304 px                    56 px
```

## 7. Implementing it

**Components**

- `src/shell/App.vue`: `navigation` stops branching on the app on screen and always returns one shape. It owns `openApp`.
- `src/shell/ui/ScreenNavigation.vue`: one list of app rows, the open one holding its items in `UCollapsible`, with Net worth above and Kuna settings below. `NavigationGroup` goes, and `NavigationApp` gains `entries`, `subtitle` and `waiting`.
- `src/shell/ui/AppShell.vue`: the block at the top, the drawer's head. The `15rem` grid column does not change.
- `src/shared/ui/HomeLink.vue` and `AppBrand.vue`: `lead` is removed, with the gallery specimens and the rows in `components.md`, and the Navigation section of `patterns.md` rewritten in the same change.
- `src/shell/ui/QuickJump.vue` (new, stage 5): lives in the shell, since no app needs it, so no gallery row.

**`AppContribution`**

| Member                                                                                                | What happens                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `menu()`, `settings`, `subtitle()`, `colour`, `homeCard.icon`, `firstRun()`, `startPath`, `entryPath` | Stay. They already hold everything the tree shows                                                                                                                                                        |
| `menuCount`                                                                                           | Same shape, but it must mean only "waits", as its doc comment already says. Investments stops returning totals (decision 3). The app row's count is a sum over `menu()` in `appRegistry.ts`, with a test |
| `AppScreen.under?: `/${string}``                                                                      | New and optional, stage 4. The menu item a detail screen sits under, such as the holding screen under Holdings. It passes through route meta                                                             |

Apps publish nothing else. `src/shell` still sees them only through the contribution, and `ScreenNavigation` keeps taking plain data, so no app or shell file gains an import. An app with `firstRun()` true has no items and no arrow, and its row goes to `startPath`, which leaves the shell as it does today.

**Open or closed state: not stored.** Which app is open follows the address, so nothing goes in `localStorage` and a reload or a deep link is right by itself.

```ts
const openApp = ref<string | null>(null)
watch(
  () => route.path,
  () => {
    openApp.value = appOnScreen.value?.id ?? null
  },
  { immediate: true },
)
function toggle(id: string): void {
  openApp.value = openApp.value === id ? null : id
}
```

A filter or tab change keeps the path, so it does not undo a peek. The money format still follows `appOnScreen`, so a peek changes no figure on screen.

**Routes:** no change. `/`, `/overview`, `/settings` and every app route stay.

**Motion.** `UCollapsible` already animates height over 200 ms and leaves closed content out of the page. The global reduced motion rule in `app.css` already cuts animations and transitions to almost nothing, so there is no new code for it. Check once that opening on first load does not animate.

**Accessibility.** The arrow is a `button` with `aria-expanded`, `aria-controls` and a name such as "Show Company's pages". `aria-current` stays on the link. When `under` lights a parent item, that item gets the look but not `aria-current`, since it is not the current page.

**Checks**

- **Screen widths do not break.** I expected them to, but `scripts/visual-check.mjs` asserts things and compares no images, and its folder is rebuilt each run. With 240 px kept, no screen's layout changes. This is the largest saving of A over any wider option.
- **Flows that do break, all about the menu:**
  - `scripts/support/editorFlows.mjs`, `menuShown`, `markLeads` (centred and largest mark), `headingStandsOut` (fails if the app's menu also lists apps), `homeMenu` and the `settingsShowFile` route through `nav-apart`.
  - `scripts/touch-check.mjs`, the `drawer` step (one heading, no apps, Settings set apart) and `openDrawer`.
  - The `nav-group`, `nav-heading`, `nav-apps`, `nav-apart` and `nav-count` test ids: 12 uses in `editorFlows.mjs` and 10 in `touch-check.mjs`.
  - The first counted item in the flows should remain Company's.
- **New checks:**
  - One flow at 1366 x 768 and 1280 x 800, Company open, asserting the last item and Kuna settings are on screen with no page scroll. Not a new `VIEWPORTS` row, since that multiplies every screen.
  - A touch flow at 360: open the arrow, tap another app's page, and the drawer closes on it.
  - A check of 44 px on the arrow.
  - `scripts/support/textOverlap.mjs` already reads open menus and allows nothing. Run it in Croatian with count and arrow on one row. It is the guard against a cut label, and it would fail the rail first.
- **While building:** `npm run check`, then `npm run check:visual -- --only <menu flows> --widths 360,640,1024,1280,1440` and `npm run check:touch -- --only <flow>`, with the `design-reviewer` agent on each diff, and the full suites in CI.

**Stages**

| Stage | Change                                                                                                                                       | What you get                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1     | Logo becomes one row in sidebar and drawer. `lead` removed. Docs and flows follow                                                            | 75 px back on every screen, nothing else moves                               |
| 2     | The tree, opened by the address only, with Net worth above and Kuna settings pinned. Investments' totals go and closed apps show their count | Any app from anywhere in one click, the main thing you asked for             |
| 3     | The arrow                                                                                                                                    | Another app's page without landing on its Overview                           |
| 4     | `under` on detail screens, and the skip link                                                                                                 | You keep your place on a holding or a loan, and keyboard users skip the menu |
| 5     | Cmd+K, after testing in Firefox                                                                                                              | Any page from the keyboard, which relieves the moving rows                   |
| Later | Icon-only sidebar while the chat is docked, in chat stage 2 if you pick it                                                                   | Dock on your laptop                                                          |

After stage 2, use it for a few days before building stage 3. If landing on Overview does not bother you, stage 3 can go.

## The owner's answers, 2026-11-06

- A tree with words, one app open at a time, in the same 240 px. This replaces the 2026-10-29 answer of only that app's sidebar. He tries it for a week, with a strip of tiles as the fallback.
- Kuna's own Overview becomes Net worth, in Croatian Neto imovina.
- The totals on Investments' Holdings and Transactions go, so every pill means something waits.
- The sidebar shrinks to icons while the chat is docked, which docks it from about 1224 px, replacing the 1408 px in the chat plan.
- Someone with one app still sees all five, with a quiet Set up word, as the agent recommended.

## 8. Decisions for you

**1. What does a closed app offer: a tree, or tiles that stay still?**
Example: you are on Loans and want Spending's Limits, then Company's Transactions. In the tree, Spending's row is in a different place each time, but you can read every name and see the pages. With tiles it is always in one spot, but you read icons and land on each Overview first.

- **Tree with words.** Reads easily and fits what you described. Rows jump by up to 300 px. Stages as above.
- **Rail of tiles.** Nothing ever moves and the sidebar gets shorter. Labels get tight in Croatian, there is no peek, and new people must learn the icons. A similar amount of work, plus a harder fit.

I recommend the tree. Try it for a week, and if the jumping annoys you, the horizontal strip is a small change from there.

**2. What is Kuna's own Overview called?**
Example: on Company's Overview the menu would show "Overview" twice, and only one is lit.

- **Rename it Net worth, in Croatian Neto imovina.** That matches the figure it leads with. It does also show the company's money apart from the sum, so the name covers slightly less than the page.
- **Keep Overview and rename nothing.** No copy changes, and a little confusion each time an app is open.

I recommend Net worth.

**3. Do the counts on Holdings and Transactions in Investments stay?**
Example: today Investments' menu shows totals in the same pill as Company's "1 to review". A closed app's badge needs to mean "something waits", or Investments shows a big number forever.

- **Remove them.** One meaning for every pill, and the wrong "12 waiting" for screen readers goes. You lose two totals that their screens show anyway.
- **Keep them as totals, in a different look.** You keep the figures. `MenuCount` needs a second kind, and two nearly alike pills sit in one menu.

I recommend removing them.

**4. Should the sidebar shrink to icons while the chat is docked?**
Example: at your window of about 1350 px, the chat as planned replaces the page, so you switch between the two and never see the figures while talking about them.

- **Shrink to icons, dock from about 1224 px.** You see chat and page together on your laptop. The sidebar gains a second form, with tooltips and tile-only badges, and a visual check with the panel open at 1224 and 1280 px.
- **Keep 1408 px.** Nothing new is built, and you get the pane on your laptop unless the window is wider. You can still change this later.

I recommend deciding when chat stage 2 starts, and leaning to shrink if your window really is under 1408 px. What is your usual window width?

**5. What does someone with one app see?**
Example: a new person who only uses Spending sees four more apps with Set up on every screen.

- **Show all five, with a quiet Set up word.** One simple rule, and apps stay easy to discover. Four rows do nothing for that person.
- **Gather them into one "More apps" row that opens the home.** A tidier list. It adds a row type and a rule, for people Kuna does not have yet.

I recommend showing all five, and revisiting once a real second user appears.
