# Design lane 1: a design library for Kuna

What a full design library holds, what Kuna already has and where it drifts, and a phased plan for one shared token, component and lint layer across Company and Loans.

Read-only research. Kuna was read at `afa7904` with another session's uncommitted edits in about ten files (scripts, filters, onboarding), so the counts below are of the working tree. Paths are relative to the repo. Counts come from `grep` and a throwaway style-block scanner. Contrast ratios are computed from the hex values in `tokens.css`, not measured in a browser.

## The short version

- A full design library is a few CSS files of tokens, a strict ESLint gate, a skill with a component catalogue and patterns, a read-only reviewer agent, a dev-only styleguide and a browser check. The idea suits Kuna. Many rules common in such libraries do not, because they are written for server-rendered apps on other component kits. Several would break Nuxt UI or fight Kuna's phone layout.
- Kuna already has a sound token layer that feeds both Tailwind and Nuxt UI (`src/shared/styles/tokens.css:33-41`, `:194-222`) and 15 shared components in `src/shared/ui`. Colour discipline is good: zero raw palette classes, zero `dark:`. The drift is elsewhere: 101 of 202 `.vue` files carry a scoped `<style>` block (3,205 lines, 274 px and 613 rem literals, 47 hard-coded breakpoints), three spellings of the warning tone, two table systems, and dialog and empty-state markup copied 11 to 29 times.
- Plan: keep the library in `src/shared/ui` and the tokens in `src/shared/styles`, move the gallery out of Company, extract four components (dialog frame, empty and error state, step card, one table), add a lint gate in phases with a shrinking baseline, and add a Kuna-shaped skill and reviewer. Do not add token resets, an opacity ban, native-element bans or a media-query ban.

## 1. What Kuna has today

### Tokens

`src/shared/styles/tokens.css` is one file with four layers:

- **Theme scales** (`:10-31`): Inter and JetBrains Mono, two custom text sizes (`text-figure-lg`, `text-title`), two radii (`rounded-card` 10 px, `rounded-control` 6 px), two container widths and a `3xl` breakpoint. Everything else is Tailwind's default scale.
- **Raw values** (`:43-100` light, `:102-159` dark), in hex: `--surface-page/raised/elevated/accented`, `--border-default/strong`, `--ink-strong`, `--ink`, `--ink-secondary`, `--ink-muted`, `--ink-dimmed`, `--accent` (brass) with `-strong`, `-wash`, `-ink`, four tones (`--tone-positive/negative/warning/info`), two elevations, eleven `--chart-*` values, eight `--series-*` slots and five `--ageing-*` steps.
- **Meaning maps** (`:161-188`): `--bucket-*` and `--pay-*` point at series slots, so a bucket keeps its colour on every chart. `--chart-on-fill` is the ink inside a filled mark.
- **Bridges.** `@theme inline` (`:33-41`) exposes `bg-page`, `bg-raised`, `text-positive`, `text-negative`, `text-accent`, `shadow-raised` and `shadow-overlay`. An unlayered block (`:194-222`) points every Nuxt UI variable (`--ui-primary`, `--ui-error`, `--ui-bg-*`, `--ui-text-*`, `--ui-border-*`) at the raw values, so Nuxt UI's own utilities (`text-muted`, `text-highlighted`, `bg-elevated`, `border-default`) and every Nuxt UI component follow the palette. `vite.config.ts:23-36` sets `primary: 'amber'` and `neutral: 'slate'` only as a fallback, plus table slot classes.

Beside it, `src/shared/styles/app.css` holds the focus outline (`:40-43`), `.figure` and `.identifier` (`:45-55`), reduced motion (`:57-64`), the `.data-table` styles (`:66-101`), `.wide-pair`, and an unlayered 44 px phone rule for every control (`:125-149`) that works with Nuxt UI's small buttons without touching them. Theme choice and the `?theme=` pin are in `src/shared/theme/theme.ts`. Its page colours repeat two hex values from `tokens.css` (`theme.ts:17-18`), and `index.html:12-43` repeats seven more for the splash.

In templates the colour API is Nuxt UI's semantic names: `text-muted` 389, `text-highlighted` 227, `text-toned` 212, `text-dimmed` 40, `border-default` 115. The type API is raw sizes: `text-sm` 350, `text-xs` 262, `text-base` 6, `text-title` 4, `text-figure-lg` 5.

### Shared components

`src/shared/ui` has `AppCard` (title, subtitle, definition, collapsible with a remembered state, `AppCard.vue:13-27`, the one surface at `:68`), `KpiTile` (composes `AppCard`, takes a formatted `value: string`, `KpiTile.vue:21-33`, `:54`), `MoneyText` (cents, `sign`, `precision`, `tone: 'flow' | 'outcome'`, `MoneyText.vue:7-20`), `PageHeader`, `PageTabs`, `ChartCard`, `ChartCanvas`, `ChartLegend`, `DonutCard`, `SparkLine`, `DrillLink`, `InfoPopover`, `ShowAllButton`, `SortableHeader` and `ColourSwatchPicker`. `src/shell/ui` adds `AppShell`, `ScreenNavigation`, `ScreenSkeleton`, `AppBrand` and `UpdatePrompt`. `src/shared/storage/presentation` holds `BooksFileCard` and `LocalFileStatus`, which Loans already reuses through thin wrappers.

Conventions are implicit. Props are typed with `defineProps<...>()`, caller classes fall through (`<KpiTile class=...>`), formatted strings and cents are both accepted as props, and Nuxt UI components are imported one by one with `components: false` (`vite.config.ts:14-17`).

### The gallery

`src/apps/company/gallery/GalleryScreen.vue` is routed at `#/company/gallery` only in development and the fake build (`src/apps/company/app.ts:49-52`). `scripts/assert-no-fake-bytes.mjs` fails a production build that contains it, and `scripts/visual-check.mjs:448-453` screenshots it in both themes and asserts every chart and donut draws. It shows colour swatches by token, type, period and filters, sync status, KPI tiles, cards, charts, donuts, page tabs, money and drill links, a `UTable` and two empty states.

Gaps: it lives inside Company and imports Company's filter components (`GalleryScreen.vue:27-29`). It shows no dialog, no `.data-table`, no Loans component (`PlanCard`, `ChangeListCard`, `StepCard`), and none of `ShowAllButton`, `SortableHeader`, `ColourSwatchPicker` or `InfoPopover` on its own. It draws its own section styles in a scoped block (`:569-589`). Nothing fails when a shared component has no specimen.

### Where Company and Loans duplicate or drift

| What                       | Today                                                                                                                                                                                                                                                  | Count                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Onboarding step frame      | `apps/company/onboarding/presentation/StepCard.vue` and `apps/loans/onboarding/presentation/StepCard.vue` are the same card, actions row and scoped border, differing only in which store `Back` calls                                                 | 2 copies, plus look-alike `FindStep`, `FolderStep`, `HomeStep` pairs                            |
| Dialog frame               | `UModal` with `:fullscreen="phone"`, `:ui="{ header: 'pe-16 sm:pe-6' }"` and a footer of Delete, Cancel and Save (`BankLoanDialog.vue:176-182`, `:220`, `AdvanceDialog.vue:142`, `:170`)                                                               | 29 dialogs (22 Company, 7 Loans), 21 with the identical `:ui` prop                              |
| Empty state                | Company uses `UEmpty variant="outline" class="rounded-card border-dashed bg-raised/40"` (`InvoicesPanel.vue:241-251`). Loans hand-draws "No loans yet" in an `AppCard` with text classes (`apps/loans/overview/presentation/OverviewScreen.vue:52-56`) | 11 copies of the empty classes, 6 of the error variant `rounded-card border-error/40 bg-raised` |
| Tables                     | `<table class="data-table">` styled by `app.css` in 19 files, including Loans' `PlanCard.vue:63-74`, and two native tables without it, beside `UTable` themed in `vite.config.ts:29-35` in `TransactionsScreen.vue:547` and the gallery                | Two systems                                                                                     |
| Tiles                      | Already shared through `KpiTile`. The grids around them vary: `grid-cols-2 gap-3 lg:grid-cols-4` (4), `lg:grid-cols-3` (2), `sm:grid-cols-2 xl:grid-cols-4` (1), plain (2)                                                                             | Minor, leave as layout                                                                          |
| Warning tone               | `text-[var(--tone-warning)]` 32, Nuxt UI `text-warning` 9, no `--color-warning` in `@theme inline`                                                                                                                                                     | Three spellings                                                                                 |
| Negative and positive tone | Kuna's `text-negative` 17 and `text-positive` 14 beside Nuxt UI's `text-error` 22 and `text-success` 2, both mapped to the same value (`tokens.css:36-37`, `:200-203`)                                                                                 | Two names each                                                                                  |
| Type roles                 | `text-xs text-muted` 191, `text-sm text-toned` 104, `text-sm font-medium text-highlighted` 73, `text-sm text-muted` 71                                                                                                                                 | Unnamed roles repeated                                                                          |
| Reading widths             | `max-w-[65ch]` 5, `[75ch]` 4, `[60ch]` 2, `[52ch]` 2                                                                                                                                                                                                   | Four measures, no token                                                                         |

### What bypasses the tokens

| Check                                                                                         | Count today                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw Tailwind palette classes (`bg-red-500`), `bg-white`, `text-black`                         | 0                                                                                                                                                                          |
| `dark:` variant                                                                               | 0                                                                                                                                                                          |
| `!important` class modifier                                                                   | 0                                                                                                                                                                          |
| Hex or `rgb()` in `.vue`                                                                      | 5 (`PageTabs.vue` mask `#000` four times, `ColourSwatchPicker.vue:90`)                                                                                                     |
| Hex or `rgba()` in `.ts` outside data                                                         | 3 (`chartTheme.ts:55` tooltip radius and shadow, `theme.ts:18` twice)                                                                                                      |
| Arbitrary colour classes (`text-[var(--tone-warning)]`, `bg-[var(--accent)]`...)              | 41                                                                                                                                                                         |
| Other arbitrary values (`max-w-[65ch]`, `rounded-[2px]`, `grid-cols-[...]`, safe-area `calc`) | 41, not counting `data-[state=...]` variants                                                                                                                               |
| Numeric `z-*` or `duration-*`                                                                 | 4 (`AppShell.vue:69`, `KpiTile.vue:61`, `ColourSwatchPicker.vue:63`, `ChartCard.vue:185`)                                                                                  |
| Opacity shades (`bg-raised/40`, `border-error/40`, `bg-elevated/40`)                          | 31                                                                                                                                                                         |
| Files with a scoped `<style>` block                                                           | 101 of 202, 3,205 non-blank lines: Company 2,686, `shared/ui` 356, `shell/ui` 102, Loans 28                                                                                |
| Literals inside those blocks                                                                  | 274 px, 613 rem, 47 `@media` with a px breakpoint (`max-width: 639px` 22, `min-width: 640px` 16), `font-size` literals 74, `border-radius` literals 38 (`2px` 13, `4px` 7) |
| `:style` bindings                                                                             | 32 (most are chart heights and swatch colours, which are fine)                                                                                                             |
| `Intl`, `toLocale*`, `toFixed` outside `shared/money`, `shared/calendar`, `shared/text`       | 57 in 34 files (23 `toFixed`, mostly cents to an input string)                                                                                                             |
| Nuxt UI `color` props                                                                         | 252, all `neutral`, `error`, `warning` or one `info`                                                                                                                       |

The colours in the style blocks mostly go through tokens already (`--border-default` 62, `--accent` 42, `--ink-muted` 32, `--surface-elevated` 32). The bypass is sizes, radii and breakpoints, not colour.

### How charts get their colours

`chartTokens()` reads the `--chart-*`, `--series-*`, `--bucket-*` and `--ageing-*` values with `getComputedStyle` once per theme and rereads when `activeTheme` changes (`src/shared/charts/chartTokens.ts:45-79`). `buildChartTheme` turns them into one ECharts theme (`chartTheme.ts:9-62`). These stay plain hex because a canvas cannot resolve `var()` or `color-mix()` (`tokens.css:1-8`). Buckets keep one colour across charts, and `tokenColour()` reads any single token (`chartTokens.ts:82-85`). Charts mostly pick by meaning (`tokens.buckets.*`, `tokens.deemphasis`), with a few picks by slot: Loans' balance line takes `series[0]` (`apps/loans/balances/presentation/balanceChart.ts:31`) and cash takes `series[(index + 2) % 8]` (`apps/company/cash/presentation/cashChart.ts:18`). Category swatches repeat the light series hex as stored data (`apps/company/workbook/domain/categoryColour.ts:12-22`), and `tests/categoryPalette.spec.ts` keeps them in step with `tokens.css`. Charts animate for 450 ms unless reduced motion is on (`ChartCanvas.vue:32-34`).

### Contrast, computed from the tokens

Every text pair passes 4.5:1 except `--ink-dimmed`: 3.08:1 on raised in light and 3.18:1 in dark. `text-dimmed` appears 40 times, 9 on icons, the rest on text such as "None" and "–". `--ink-muted` on `--surface-elevated` in dark is 4.51:1, right at the line. `--border-strong` on raised is 1.62:1 light and 1.54:1 dark. That only matters where it is a control's only boundary. I did not check which Nuxt UI controls draw with it, so treat that as unverified. Kuna has no contrast test.

### The browser checks Kuna already has

`scripts/visual-check.mjs:1-12` and `scripts/touch-check.mjs` cover a lot already: nine widths from 360 to 2560 (`visual-check.mjs:172-182`), both themes, sideways overflow, card overflow, console and CSP errors, other origins, chart counts, card heights in a row, deep links and dozens of editor flows. CI runs both against the fake build (`.github/workflows/deploy.yml:44-54`). What they lack: Firefox (Kuna's visual and touch checks run Chrome only, `scripts/support/browsers.mjs:32-36`), a full Croatian pass (one `lang=hr` visit, `visual-check.mjs:310`), and a one-`h1` assertion.

## 2. Proposal for Kuna

### Where the library lives

Keep components in `src/shared/ui` and tokens in `src/shared/styles`. A new `src/shared/design` would move about 60 importers each of `AppCard` and `MoneyText` for no new rule. Inside `src/shared/ui`, two tiers are enough:

- **Frames**, which may draw a surface, radius or shadow: `AppCard`, the new dialog frame, the empty and error state, the table.
- **Everything else** composes a frame and draws no surface of its own. `KpiTile` already does this.

Move the gallery to `src/shell/gallery/` at `#/gallery`, app-neutral, with one section per shared component, and keep Company-only specimens (filters, period bar) as a Company section that the gallery imports. The existing dev and fake gating and `assert-no-fake-bytes.mjs` carry over.

### Token names

Keep Kuna's raw names (`--surface-*`, `--ink-*`, `--border-*`, `--accent*`, `--tone-*`, `--chart-*`, `--series-*`, `--bucket-*`). They already read well and feed Nuxt UI. Changes:

1. **One utility name per meaning, and it is Nuxt UI's.** Templates use `text-error`, `text-success`, `text-warning`, `text-info`, `bg-elevated`, `text-muted`. Drop Kuna's duplicate `--color-positive`, `--color-negative` and `--color-accent` from `@theme inline`, and replace the 41 arbitrary colour classes and 31 `text-negative/positive` uses. The other direction, Kuna names everywhere, would mean overriding every Nuxt UI component theme.
2. **Type roles as `@utility`**, named after the job: `type-caption` (`text-xs text-muted`, 191), `type-body` (`text-sm text-toned`, 104), `type-card-title` (`text-sm font-medium text-highlighted`, 73), `type-label`, `type-page-title` (today's `text-title font-semibold text-highlighted`), `type-figure` (`text-figure-lg` with `.figure`). Keep `.figure` and `.identifier` as they are.
3. **Measures and widths:** `--container-reading` for the four `ch` widths, picked once.
4. **Radius:** keep `card` and `control`, add `mark` for the 2 to 4 px chart and swatch corners, and point `chartTheme.ts:55` at the card radius and overlay elevation.
5. **Motion:** `--default-transition-duration` and one `duration-base` token. Charts keep their animation unless you decide otherwise (see the open decisions).
6. **Breakpoints:** the 47 media queries in style blocks repeat `sm`, `md`, `lg`. New CSS uses `@variant sm` or the Tailwind class. Old blocks move as they are touched.

Do not reset Tailwind's namespaces to `initial`. Nuxt UI's generated theme defines `--color-primary-50` and the other shades in `@theme default inline` (`node_modules/.nuxt-ui/ui.css`), and its component themes use `animate-spin` (25 times), `duration-200` (25), `z-1` and `z-[1]`, and opacity shades such as `/25` and `/10` on hundreds of classes in `node_modules/.nuxt-ui/ui/*.ts`. Resetting `--animate-*`, `--ease-*` or `--breakpoint-*` would break its spinners, transitions and every `xl:`, `2xl:` and `3xl:` Kuna uses.

### Components to extract first

In this order, each with its gallery specimen in the same change:

1. **Dialog frame.** First, move the header padding into `vite.config.ts` as `ui.modal.slots.header`, the way the table slots already live there. That removes 21 identical `:ui` props with no new component. Then an `AppDialog` over `UModal` that owns `fullscreen` on phones and a footer slot pattern (destructive action start, Cancel and the primary action end), so 29 dialogs stop computing `usePhoneLayout()` themselves (45 files hold a `const phone` today).
2. **Empty and error state.** One `EmptyState` over `UEmpty` with `tone: 'empty' | 'error'`, replacing the 11 and 6 class copies and the hand-drawn Loans empty card.
3. **Step card.** One `StepCard` in `src/shared/ui` that takes `canGoBack` and emits `back`, replacing the two copies. The `Find`, `Folder` and `Home` step pairs are flow duplication, not design, and belong in a separate change.
4. **One table.** Pick one: `.data-table` on a native `<table>` (19 files, container-query column dropping as in `PlanCard.vue:63-74`) or `UTable` (2 files, sorting and grouping). Recommendation: keep `.data-table` for figure tables and move its CSS into a `FigureTable` frame, and keep `UTable` only where grouping or virtualisation earns it.

Leave tile grids as layout classes. Four variants is not a component.

### How Company and Loans consume it

Apps import from `src/shared/ui` and never draw a surface, radius, shadow or tone of their own. App-only components stay in the app. A component moves to `src/shared/ui` when a second app needs it, not before. The catalogue says which app uses each component.

### A lint gate, phased

Kuna has no ESLint or Prettier (none in `package.json` or `node_modules`). Two ways:

- **ESLint with `eslint-plugin-vue` and `eslint-plugin-better-tailwindcss`.** It is the only way to get `no-unknown-classes`, which catches a typo or a removed token class, and the plugin reads `app.css` so Nuxt UI's utilities count as known. Cost: new dev dependencies, which need your go-ahead to install, and a first run whose unknown-class count I could not measure without installing.
- **A Node script** like `scripts/check-foreign-import.mjs` that scans class strings and style blocks with regexes. No dependencies, but it cannot tell an unknown class from a known one.

Recommendation: ESLint, run in the `verify` job before the build. Phases, so nothing is a big-bang rewrite:

| Phase                        | Rules                                                                                                                                                                                                                                                                                                               | Flags today                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1, on at once                | No raw palette, `white` or `black`. No `dark:`. No `!`. No hex, `rgb()` or palette variable in a class. No numeric or arbitrary `z-*` or `duration-*`. No inline disables (`noInlineConfig`). Unknown, conflicting and duplicate classes                                                                            | 4 known, plus whatever `no-unknown-classes` finds |
| 2, after one mechanical pass | No arbitrary colour classes. `color` props on Nuxt UI components limited to `primary`, `neutral`, `error`, `warning`, `info`                                                                                                                                                                                        | 41 to fix, 0                                      |
| 3, a shrinking baseline      | No new `<style>` block, no new native `<table>` outside the table frame, no `Intl`, `toLocale*` or `toFixed` outside `shared/money`, `shared/calendar` and `shared/text`. A checked-in list of today's files is exempt, and a test fails when a listed file no longer needs its exemption, so the list only shrinks | 101, 21 and 34 files on the list                  |
| 4, with the type roles       | Screens use `type-*` roles instead of `text-xs`/`text-sm` plus a colour                                                                                                                                                                                                                                             | About 600 class uses, fixed screen by screen      |

Rules common in other design libraries that Kuna should **not** copy, because they fight Nuxt UI or Kuna:

- Resetting Tailwind's namespaces. It breaks Nuxt UI's spinners and the `xl:` to `3xl:` breakpoints.
- Banning opacity shades. Nuxt UI builds its hover, disabled and soft variants from them, and Kuna's washes use them. Keep them, and test the pairs that carry text.
- Banning native `button`, `input` and `a`. Nuxt UI already wraps them, `RouterLink` is the link, and the ban adds nothing over "use `UButton`".
- Banning `useMediaQuery`. That is a server-render rule. Kuna has no server, and `UModal`'s `fullscreen` needs the phone flag in script.
- `animate-spin` only in Button. Nuxt UI's `loading` prop spins on many components. Keep the intent: Kuna draws its own spinner in four places (`ChartCard.vue:131`, `SyncStepList.vue:28`, `ImportSummary.vue:39`, `ImportPanel.vue:242`), which can stay as named exceptions or move to a static state.
- `touch-target`. Kuna's unlayered phone rule (`app.css:125-149`) already covers Nuxt UI controls without touching each one, and the touch check measures it.

### A design reviewer and a skill for Kuna

Copy the shape, not the text. Kuna has no `AGENTS.md` and an empty `.claude/` today, and the repo is public, so nothing personal goes in.

- **Skill** `.agents/skills/kuna-design/` with `SKILL.md` (decision order, the token file map, the lint table, how to add a component, the check list), `components.md` (catalogue with a "used by" column per app), and `patterns.md` written from what Kuna already does: `AppCard` sections, `KpiTile` rows, `PageTabs`, drill links, bucket colours on charts, dialogs with Undo toasts, the phone sheet and drawer, the 44 px rule, `?theme=` and `?lang=`.
- **Rules** `.claude/rules/kuna-styling.md` scoped to `src/**/*.vue` and `src/shared/styles/**`, and `kuna-components.md` scoped to `src/shared/ui/**`, each pointing at the skill.
- **Reviewer** `.claude/agents/design-reviewer.md`, read-only, same report shape (Critical with `file:line`, Concerns, Questions). It runs `npm run check` and lint, and does not run `check:visual` or `check:touch` locally, since those run in CI. Its checklist covers Kuna's concerns: bucket colour identity, flow against outcome tone on money, a component copied into a second app instead of moved to shared, phone fullscreen on dialogs, Undo instead of a confirm where the change is cheap, both themes, and Croatian copy length at 360 px.
- **Catalogue test**: every `.vue` in `src/shared/ui` has a row and a gallery specimen, and every row names a component that exists.
- **Contrast test** over a listed set of pairs in both themes from `tokens.css`, which would flag `--ink-dimmed` on its first run.

### The gallery as the living page

The gallery becomes the library's page: one section per shared component showing every state through its props, a foundations section (swatches with their contrast ratio, type roles, radii, elevations), a formatting section, and the dialog and empty-state frames. Add a `?lang=hr` visit of the gallery and a Firefox pass of the gallery to the visual check, since Firefox is the daily browser and the current checks are Chrome only.

### Open decisions

- **Lint tool.** ESLint with the Tailwind plugin (new dev dependencies, catches unknown classes) or a dependency-free script (catches less). I recommend ESLint.
- **Tone names.** Nuxt UI's `error` and `success` everywhere, or Kuna's `negative` and `positive` with a Nuxt UI theme override on every component. I recommend Nuxt UI's.
- **Table.** Keep `.data-table` as the figure table and `UTable` only for grouped lists, or move everything to `UTable`. I recommend the first.
- **Chart animation.** Keep the 450 ms entry animation or stop animating charts. This is taste, so it is your call.
- **Dimmed ink.** Raise `--ink-dimmed` to pass 4.5:1, or keep it for icons and placeholders only and move the text uses to `text-muted`.

## 3. The languages angle

`src/shared/text/translation.ts` types Croatian against English and picks forms with `Intl.PluralRules` (`:30-35`), which also handles decimals the CLDR way (1.5 takes `other`). `src/shared/text/language.ts` resolves the language per device with a `?lang=` pin (`:38-62`). Money follows the file's number locale or the language (`src/shared/money/moneyFormat.ts:20-21`, `:38-42`), and dates go through `Intl.DateTimeFormat` in `shared/calendar` (`dayLabel.ts:4-15`, `monthLabel.ts:5-9`), which the [language wave](../../language-plan.md) found writes Croatian month cases correctly. With no server render, `Intl` is safe.

Worth adding:

- **A formatting ban**, as phase 3 of the lint gate: no `Intl`, `toLocale*` or `toFixed` outside the formatter modules. 57 calls in 34 files sit outside them today. The 23 `toFixed` calls are mostly cents to an input string, which wants one `centsToInput` helper beside `typedAmount.ts`.
- **A formatting section in the gallery**, showing each money, percent, day and month formatter in English and Croatian side by side.
- **`lang="hr"` on Croatian terms in the English UI**, such as form names and law citations. Kuna marks two today.

Not worth adding: fixed Croatian number formats in English (Kuna lets the file choose, which is a product decision already made), a hand-written plural rule, or vue-i18n.
