# Patterns

What Kuna already does. Follow these before inventing a new way. Components are in [components.md](components.md).

## Screens and cards

- A screen opens with `PageHeader`, then cards. Every card is an `AppCard`, with a title, or bare for a tile.
- A long list or table sits in a collapsible `AppCard` with a `collapse-id` named as screen and card, such as `invoicing.months`. Its `summary` is the one line shown when collapsed. A deep link into a card passes `reveal`.
- A screen made of one table, one list or one form keeps the narrower measure (`max-w-measure`). A dashboard screen widens with `DashboardGrid`.
- A screen whose books are still opening shows `ScreenSkeleton` below its header.
- A card with nothing to show uses `EmptyState`, dashed. A card that failed uses `EmptyState` with `tone="error"`. Nothing hand-draws either.
- Cards that fold, such as a chart or a table, remember their state per device through `cardCollapse.ts`.

## Tiles and rows of figures

- A row of `KpiTile` goes in `DashboardGrid layout="tiles"`. Each tile has a label, a figure, an optional change against a comparison, an optional trend and a caption. The tile itself opens the rows behind it.
- A cost where a rise is bad news sets `higher-is-better` to false. The arrow and colour follow.
- A figure that opens rows is a `DrillLink`. With no rows behind it, `to` is null and it shows as plain text.
- A share of a whole, such as what is paid back, is a `ProgressMeter`, with a stripe on a part someone else pays. Labelled figures inside a card, such as a loan's dates, are a `FactGrid`.

## Tabs

- A screen's inner tabs are `PageTabs`, kept in `?tab=`. The first tab is the default and stays out of the address. A count shows where something waits.
- A page's Filters button moves into the tab row on a phone through the `above` slot.

## Charts

- A chart sits in `ChartCard` with its legend and a table view behind a Table toggle. A snapshot of at most five parts is a `DonutCard`.
- Colour follows the bucket, tax or loan part on every chart, legend and swatch, through `--bucket-*`, `--pay-*` and `--loan-*`. Never pick a colour by rank.
- Loans: principal is `--loan-principal`, interest `--loan-interest`, and balance still to come `--loan-ahead`. The subsidy is a stripe, not a fourth colour. Several bank loans on one chart wear `--loan-band-1` to `--loan-band-3` by their place in the file, and a fourth and later `--chart-deemphasis`.
- Charts draw in over 450 ms and skip it under reduced motion. Keep it.
- The description prop says in words and euros what the chart shows.

## Money

- Show money through `MoneyText` or the formatters in `src/shared/money/moneyFormat.ts`. Never `toFixed` or `Intl` in a screen.
- A screen formats money as its app does. A figure shown outside its app, as on the home, passes its app's `moneyFormat()` to `MoneyText` as `format`.
- `tone="flow"` for money in and out: green coming in, ink going out. `tone="outcome"` for a result such as a net, where negative is a loss. No tone for a cost.
- Costs that read positive use `sign="magnitude"`. Changes use `sign="always"`.

## Dialogs

- Every dialog is an `AppDialog`: a centred panel from 640 px and full screen on a phone. `v-model:open`, a `title`, and a `width` only when the default 32rem does not fit.
- The `start` slot holds a destructive action such as Delete. The `end` slot holds Cancel then the primary action.
- Set `dismissible` to false only while a step runs that closing would cut short.
- A dialog whose fields sit two to a row lays them out in a `FormGrid as="form"`. A single column of fields, or rows of its own such as a split's parts, can stay a plain form.

## Undo instead of a confirm

- A change that is cheap to reverse does not ask first. It writes and shows a toast that names the records, with Undo, through `useRecordWrites`. The toast stays 10 seconds.
- Ask first only for what Undo cannot reach, such as deleting the file or signing out.

## Forms

- Fields go in `FormGrid`: two to a row from 640 px, labels in one row and inputs in the next, so inputs line up whatever a label's length. Every field takes one column, and one that takes a whole row, such as a field around a switch or a checkbox, says `sm:col-span-2`. Anything that is not a field, such as a bare radio group or a note, takes the whole row.
- An amount of money is a `MoneyInput` bound to text that `typedAmount` reads. A rate, a percent or a count stays a `UInput` with its own `inputmode`.
- `MoneyInput`'s k and m need a hardware keyboard or a paste, since a phone's decimal keypad has no letters. Ctrl+Z does not undo its edits, because it writes the field itself.
- A plain table of figures is a `FigureTable`. Sortable columns use `SortableHeader`. `UTable` is only for grouped or sorted lists.

## Layout and width

- `DashboardGrid` has three layouts. `tiles`: two to a row, one row from `lg`, and five or six tiles take three to a row from `lg` and one row from `3xl`. `cards`: one column, two from `xl`, and three from `3xl` when there are three or more. `pair`: side by side from `3xl`.
- A card that runs across both columns below `3xl` says so itself, such as `xl:col-span-2 3xl:col-span-1`.
- Cards rearrange as the width grows. The visual check fails a dashboard whose cards keep one arrangement at 768, 1440 and 1920 px, and cards side by side in a grid that is not a `DashboardGrid`, outside the gallery.

## Navigation

- Every menu, in the sidebar and the drawer, opens with `HomeLink` in its lead look: the Kuna mark as the menu's largest icon, centred over Kuna, the whole block a link home, with a thin line under it. Inside an app the menu under it is that app's alone. The app's name is the heading over its menu, in `type-wordmark` beside a medium `AppMark` that is smaller than the Kuna mark and lines up with the menu items, with its subtitle in `type-caption` and more space under it before the first item. Its Settings are a screen of the app, set apart at the foot of its menu.
- Menu items keep one size and one indent. The sidebar is narrow, so the heading stands out by size and weight, never by indenting the items under it.
- Kuna's home at `#/` has a card per app. Its sidebar, and that of Kuna settings, lists every app with a small `AppMark`, leading where the app's card does, with a Set up badge during its first run, and Kuna settings set apart below a line. The phone home has no drawer, so its cards stay the way in.
- Kuna settings at `#/settings` holds only what is the same for every app: sync, sign-out, theme and language.
- A first run starts with the quiet `HomeLink`, so it can be left for the home.

## Phone

- Below 640 px every control is at least 44 px. The rule is in `app.css`. A switch, checkbox or radio stays its size and its label carries the height. A link at the end of a sentence uses `inline-target` or `DrillLink in-prose`.
- A sheet that rises from the bottom is `.phone-sheet`. The navigation drawer is `.phone-drawer`. Both clear the safe areas.
- The top bar's one action, Sync or Export, uses `.top-bar-action`.
- Check Croatian copy at 360 px. Croatian labels run a third longer.

## First run

- Each step of a first run is a `StepCard`. The screen provides `STEP_FLOW` with the step, whether Back is allowed and `back()`. Test ids are `onboarding-step` and `onboarding-back`.

## Theme and language

- `?theme=light` or `?theme=dark` pins the theme for one visit. `?lang=en` or `?lang=hr` pins the language for one visit. Use them in checks and in the gallery.
- Croatian terms in the English UI, such as form names and law citations, carry `lang="hr"`.

## Gallery

- The gallery at `#/gallery` is the library's page, in dev and fake builds only. It holds foundations (swatches with live contrast, type roles, radii, elevations), formatting, and a section per shared component in every state.
- An app's own specimens arrive through `AppContribution.gallery`, since the shell never imports an app.
