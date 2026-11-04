# Design wave: a Kuna home, one design library, the Loans screens

How Kuna gets a home with per-app navigation, a shared design library with checks that hold every app to it, and a designed Loans app, from three research lanes checked against d918b67, with the decisions it needs from the owner.

From three lanes in `research/design/`: [the design library](research/design/lane1-library.md), [the home and navigation](research/design/lane2-navigation.md) and [the Loans screens](research/design/lane3-loans-design.md), with the Loans mockup. Read against the repo at `d918b67`. Language stage 2 waits for this wave, so the shell and the Loans screens are translated once, after they are redesigned.

## What the owner asked, 2026-10-29

1. No shared sidebar for every app. A Kuna home to choose an app, reachable from every app.
2. Inside an app, only that app's sidebar.
3. A designed Loans Overview.
4. A component, token and design library for one style across apps.
5. The still-to-come part of "Owed over time" in yellow.
6. A chart of what APN pays and how payments split into principal and interest.
7. A "Total owed" tile beside "Owed today".
8. Inputs in one form row line up, with a check that holds every form to it.
9. Cards rearrange with the screen width on every app's screens, as a rule the checks enforce.

## What you will see

- **A Kuna home at `#/`.** One card per app with a live figure: Company shows cash on hand and the rows waiting on Review, Loans shows what you owe in all. An app not set up yet shows "Set up", and any app can be set up first. The installed app opens here.
- **Inside an app, its own sidebar.** At the top, the Kuna mark links home ("All apps"). Then the app's name, its screens, its own Settings, and Sync at the foot. On a phone the same list sits in the drawer.
- **Settings split.** Company's Settings (General, Categories, Accounts, Ruleset, the books file) and Loans' Settings (the Loans file) live inside each app. Kuna settings (sync, Google sign-out, theme, language) open from the home.
- **The Loans Overview designed.** A total row when there are two or more loans, then one card per loan with its balance, a sparkline, a paid-back meter and three dated facts. One loan gets one full card. A proper empty state and loading skeleton.
- **The bank loan screen.** A hero card with "Owed today" and its paid-back meter beside "Total owed" (principal left plus interest left, split into what the subsidy still pays and what you pay). Then Next payment, Subsidy ends, Paid off and Interest this year. "Interest left" goes, since Total owed shows it.
- **Owed over time:** green and solid up to today, brass and dashed after, a Today line, dots on extra payments, and year labels on the axis.
- **Where the payments go:** one stacked bar per year, principal below and interest above, the subsidy's share striped across both, and a whole-loan bar for the totals.
- **Every card grid follows one rule.** Tiles and cards rearrange with the width on every app's dashboard screens, and the form rows line up whatever a label's length.

## The design library

- **Where it lives.** Components stay in `src/shared/ui`, tokens in `src/shared/styles/tokens.css`. A component moves there when a second app needs it.
- **Tokens.** Kuna's token names stay. Templates use Nuxt UI's tone names (`error`, `success`, `warning`), and Kuna's duplicate `negative` and `positive` utilities go. Type roles become utilities (`type-caption`, `type-body`, `type-card-title`, `type-figure`). New tokens for the Loans charts: `--loan-ahead` (brass), `--loan-principal`, `--loan-interest`. `--ink-dimmed` fails 4.5:1 contrast in both themes on about 30 text uses, so it is raised to pass.
- **First components.** A dialog frame (29 dialogs repeat the phone full-screen setup), one empty and error state (copied 17 times, and Loans hand-draws its own), one step card (two identical copies), a form grid whose fields share label, input and hint rows so inputs line up, a dashboard grid that holds the card-reflow rule, and one figure table frame. Each lands with its gallery specimen.
- **The gallery moves to `#/gallery`,** app-neutral, as the library's living page: every shared component in every state, the swatches with their contrast, type roles, and a formatting section. Dev and fake builds only, as today.
- **Checks.**
  - Visual check: fails when two fields in one form row have inputs at different heights, and when a dashboard screen's cards keep one arrangement at 768, 1440 and 1920 px. Both run on every app's screens.
  - A contrast test over the token pairs that carry text, in both themes.
  - A catalogue test: every shared component has a gallery specimen.
  - The lint gate (decision below), phased: obvious bans first, then a list of exempt files that can only shrink.
- **A design skill and a design reviewer** in the repo, written for Kuna and Nuxt UI. The reviewer is read-only and reports Critical findings with `file:line`. It runs after every stage of this wave.
- **Left out on purpose:** resetting Tailwind's scales (it breaks Nuxt UI's spinners and the `xl:` to `3xl:` breakpoints), the bans on opacity shades, native elements and `useMediaQuery`, and a touch-target utility. They fight Nuxt UI or Kuna's phone layout.

## Settled without asking

- **One sync, one button,** in the same corner on the home and in every app.
- **No app switcher or shortcut yet.** With two apps, the home costs one click. A shortcut can come later.
- **No bottom bar on phones.** Company has 8 screens, and a More tab is worse than the drawer.
- **The home formats each card in its own app's money format,** so two apps can differ.
- **The table:** `.data-table` stays the figure table, in a `FigureTable` frame. `UTable` only where grouping earns it.
- **Storage keys, Drive tags and route paths inside apps do not change.** Company's Settings moves from `#/settings` to `#/company/settings`, and links follow.
- **Interest is violet in the Loans charts,** since Company's orange and the new brass can't be told apart. The subsidy is a stripe, not a fourth colour.

## Stages

Each stage is one commit, checked locally (typecheck, vitest, builds, targeted visual and touch runs), reviewed by the design reviewer, pushed, and green in CI before the next. Stages run as workflows: an Opus agent builds, an independent Opus reviewer checks against the library rules and this plan, a Sonnet agent fixes mechanical findings, and I verify and commit.

1. **Library foundations.** Tokens and type roles, the contrast fix, the dialog frame, empty state, step card, form grid, dashboard grid and figure table, the gallery at `#/gallery`, the skill, the reviewer, the contrast and catalogue tests, the two new visual-check rules, and phase 1 of the lint gate. Existing screens adopt the frames where the rules flag them, the bank loan form first.
2. **The home and per-app navigation.** The home, the per-app sidebar and drawer, the link home, the Settings split, any app set up first, and the checks that pinned the old menu.
3. **The Loans screens.** The Overview, the bank loan hero and tiles with Total owed, Owed over time in green and brass, Where the payments go, the informal loan screen in the same style, and the subsidy's payer name.
4. **Stop for your review** on the live site.
5. **Lint phases 2 and 3,** then language stage 2 on the new shell and Loans screens.

## Proof

- Company's figure digests unchanged on the four fake sets and the live file, apart from groups the plan names.
- The new rules fail on today's code where the owner saw the faults (the bank loan form, the Loans tiles at 1920 px) and pass after.
- The contrast test fails on `--ink-dimmed` today and passes after.
- The Loans screens match the mockup at 360, 768 and 1440 px in both themes.
- The design reviewer reports no Critical findings on each stage.

## The owner's answers, 2026-10-29

- **Linting: ESLint and Prettier,** installed as dev dependencies and run in CI. Prettier is configured to Kuna's current style (no semicolons, single quotes, the current line width) and applied once in its own commit, so later diffs stay clean.
- **The subsidy pays interest.** The owner's payment-plan Sheet has a column "Iznos Kamate sa APN-om", which is the interest minus the APN payment on every instalment, so the principal is all the owner's. Kuna follows it: the subsidy covers the instalment's interest first, and only a subsidy larger than the interest would reach the principal. The "Interest in 2026" caption ("of which the subsidy covers …") is therefore right and stays. The payments chart shows principal you pay, interest you pay, and interest the subsidy pays.
- **Payer name:** add an optional payer name to the subsidy. Blank shows "Subsidy pays".
- **Chart animation:** keep it.
- **An identity colour per app (asked and answered later the same day):** yes, as a light touch. Each app's icon sits on a tile in its own colour on its home card, in its sidebar header beside its name, at the top of the phone drawer and beside the title in the phone top bar. Buttons, links, focus and the selected menu item stay in Kuna's one accent. Company keeps gold, and Loans gets a colour that clashes with no tone, chart series or the Loans brass, such as teal. One token per app in both themes, a colour field on the app's registration, and the contrast test checks each app colour against the page and the card. Built in stage 2.

## Decisions for the owner

### Linting

Kuna has no lint tool. ESLint with a Tailwind plugin is the only kind of gate that catches a misspelt or removed class.

- **Install ESLint with the Vue and Tailwind plugins.** New dev dependencies, run in CI before the build.
- **A small script with no dependencies.** Catches raw colours and banned patterns, but not unknown classes.

Recommendation: ESLint.

### How the subsidy splits between principal and interest

The bank's plan says how much of each instalment the subsidy pays, not whether it pays principal or interest.

- **In proportion.** The subsidy pays the same share of an instalment's principal and interest. On the sample loan in 2026 that is about half each.
- **Interest first.** The subsidy pays interest before principal. No document says so.
- **No split.** The subsidy is its own bar beside each year's principal and interest.

Recommendation: in proportion.

### The subsidy's name

The mockup says "APN pays". The subsidy record has no field for who pays.

- **Add an optional payer name** to the subsidy, shown as "APN pays", and "Subsidy pays" when blank. One field on the record and its dialog.
- **Keep it generic.** "Subsidy pays" everywhere.

Recommendation: add the field.

### Chart animation

Kuna's charts draw in over 450 ms. Charts could also skip the animation.

- **Keep it.**
- **Drop it.** Charts appear at once.

Recommendation: none, it is taste.
