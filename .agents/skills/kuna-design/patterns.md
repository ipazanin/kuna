# Patterns

What Kuna already does. Follow these before inventing a new way. Components are in [components.md](components.md).

## Screens and cards

- A screen opens with `PageHeader`, then cards. Every card is an `AppCard`, with a title, or bare for a tile.
- The welcome on a fresh device has no `PageHeader` and no subtitle. Its card is the page, with its title as the `h1` and `max-w-2xl` for a measure that suits a laptop.
- A long list or table sits in a collapsible `AppCard` with a `collapse-id` named as screen and card, such as `invoicing.months`. Its `summary` is the one line shown when collapsed. A deep link into a card passes `reveal`.
- A screen made of one table, one list or one form keeps the narrower measure (`max-w-measure`). A dashboard screen widens with `DashboardGrid`.
- A screen whose books are still opening shows `ScreenSkeleton` below its header.
- A card with nothing to show uses `EmptyState`, dashed. A card that failed uses `EmptyState` with `tone="error"`. Nothing hand-draws either.
- Cards that fold, such as a chart or a table, remember their state per device through `cardCollapse.ts`.
- A notice in a card is a subtle `UAlert` with an icon: `neutral` with `i-lucide-info` for something with nothing to do, `info` for something waiting on the person, and `warning` for something that may be wrong.

## Tiles and rows of figures

- A row of `KpiTile` goes in `DashboardGrid layout="tiles"`. Each tile has a label, a figure, an optional change against a comparison, an optional trend and a caption. The tile itself opens the rows behind it.
- A cost where a rise is bad news sets `higher-is-better` to false. The arrow and colour follow.
- A figure that opens rows is a `DrillLink`. With no rows behind it, `to` is null and it shows as plain text.
- A share of a whole, such as what is paid back, is a `ProgressMeter`, with a stripe on a part someone else pays. Labelled figures inside a card, such as a loan's dates, are a `FactGrid`.

## Tabs

- A screen's inner tabs are `PageTabs`, kept in `?tab=`. The first tab is the default and stays out of the address. A count shows where something waits.
- A page's Filters button moves into the tab row on a phone through the `above` slot.

## Charts

- A chart sits in `ChartCard` with its legend and a table view behind a Table toggle. The table comes from the chart's category axis. A chart with none, such as a treemap, or one whose cells say more than a value, such as a price chart's trades, passes its table's caption, head and rows in the `table` slot. A snapshot of at most five parts is a `DonutCard`, and so is one of a fixed list that gives each entry its own colour, such as the six classes of Investments' class ring.
- Colour follows the bucket, tax or loan part on every chart, legend and swatch, through `--bucket-*`, `--pay-*` and `--loan-*`. A fixed list never picks a colour by rank.
- An open list, such as sectors or countries, has no colour per entry. Its four largest parts take `--series-1` to `--series-4` in order of size, and the rest is one grey `--chart-deemphasis` part, "Other and not known".
- A gain or a loss tints a tile or a cell under its signed figure in ink, with `--gain-1` to `--gain-3` and `--loss-1` to `--loss-3` from small to large, or `bg-gain-1` to `bg-loss-3` in a class. The faintest steps sit under 3:1 on the card, so a treemap tile's edge is a border in `--chart-ink-muted`, and so is the edge of its legend swatch, the `tile` mark. A tile too small for its name and its signed figure shows no label, through `labelLayout` as the gallery's treemap does, and the tooltip and the table carry it.
- A dot that marks money moving on a time chart, such as a buy, a sale, a repayment or more borrowing, is filled and one fixed size on every chart. Its amount shows in the tooltip and the table, never in its size. Two kinds on one chart differ only in colour, and the legend, the tooltip line and the table name each kind in words. Two dots at one place sit side by side, through `dotOffset` in `chartDots.ts`, so neither hides the other. `ChartCanvas` moves the tooltip onto a dot's place once a pointer comes within 12 px of its centre, or a tap within 22 px on a phone, so a dot is easy to hit however many points the line has. The common kind wears `--chart-dot` in both apps, a deep cyan on the light card and a pale one on the dark card, a hue no class, mix or money-flow figure wears, and not the accent. The other is a hue of each app's own. Each is clear of the chart's own lines in both themes and for every kind of colour blindness. Neither is ink, which reads white on the dark card, and neither is green or red, since a buy is money out and a sale money in, and neither is good or bad news.
- Investments: a buy is a dot in `--invest-buy`, which is `--chart-dot`, and a sale a dot in `--invest-sale`, orange, beside the blue price line and the grey dashed lines.
- Loans: what you owe wears `--loan-you-owe` and what others owe you `--loan-owed-to-you`, each with its own icon, on tiles, cards, badges and balance lines. On a balance line, what lowers what is owed is a dot in `--loan-lowers`, which is `--chart-dot`, and what raises it a dot in `--loan-raises`, blue, since orange cannot be told from the brass plan. A new rate has no amount and falls in a month with a payment, so it stays a ring in `--loan-interest`, larger than the dot and drawn around it, so both show. Blue and that violet sit too close, so a raise and a new rate never share a chart.
- Loans: principal is `--loan-principal`, interest `--loan-interest`, and balance still to come `--loan-ahead`. The subsidy is a stripe, not a fourth colour. Several bank loans on one chart wear `--loan-band-1` to `--loan-band-3` by their place in the file, and a fourth and later `--chart-deemphasis`.
- A time chart that can span years and has no period control of its own picks its span with `ChartCard`'s `ranges` and `v-model:range`, from `useChartRange` in `src/shared/charts`. The choices are the last 1, 3 and 5 years, the next 5 years on a chart that runs on past them, and All, the default. Each is offered only where it leaves something out and keeps something. The choice lives in `?range=`, so every chart on a screen shows one span and offers one list. The button group is named after its chart for a screen reader. A label pinned to a point, such as a payoff letter, shows only while its point is in the span, and a label at the right edge gives the line's value there. The description keeps what the whole chart says. Performance's period bar and Company's period filter stay their own.
- Charts draw in over 450 ms and skip it under reduced motion. Keep it.
- The description prop says in words and euros what the chart shows.

## Money

- Show money through `MoneyText` or the formatters in `src/shared/money/moneyFormat.ts`. Never `toFixed` or `Intl` in a screen. An amount in a Spending account's own currency shows through that app's `AccountMoneyText` or `formatAccountMoney`.
- An amount shows its currency's narrow symbol in English and Croatian, $12.23 and not US$12.23, as the formatters give it. A code stays only where a symbol would be ambiguous, such as a currency picker or a mix grouped by currency.
- A screen formats money as its app does. A figure shown outside its app, as on the home, passes its app's `moneyFormat()` to `MoneyText` as `format`.
- `tone="flow"` for money in and out: green coming in, ink going out. `tone="outcome"` for a result such as a net, where negative is a loss. No tone for a cost.
- Costs that read positive use `sign="magnitude"`. Changes use `sign="always"`.

## Dialogs

- Every dialog is an `AppDialog`: a centred panel from 640 px and full screen on a phone. `v-model:open`, a `title`, and a `width` only when the default 32rem does not fit.
- The `start` slot holds a destructive action such as Delete. The `end` slot holds Cancel then the primary action.
- Set `dismissible` to false only while a step runs that closing would cut short.
- A dialog whose fields sit two to a row lays them out in a `FormGrid as="form"`. A single column of fields, or rows of its own such as a split's parts, can stay a plain form.
- After Save, a dialog shows each field's problem under that field, through `tried && errors.field`. An alert holds only a rule across fields, such as an odometer that runs backwards, and shows once every field is valid.

## Undo instead of a confirm

- A change that is cheap to reverse does not ask first. It writes and shows a toast that names the records, with Undo, through `useRecordWrites`. The toast stays 10 seconds.
- Ask first only for what Undo cannot reach, such as deleting the file or signing out.

## Saving feedback

- Every write to the books shows itself with no code on the screen: `WriteProgress` along the top of the page, and "Saving…" in the sync control, for as long as any write runs.
- Writes queue, so nothing disables on another write. Only the control that started a write grays out and spins. Give the write a `key` in its options, unique within the file, and bind `:loading="writes.saving('key')"` on that control. A write without a key is `save`, its own composable's, so a dialog's Save binds `writes.saving('save')`. `USelect` needs `:disabled` beside `:loading`. An Undo of the write spins the same control.
- A one-tap control whose value is on it (a switch, a select, an arrow, a threshold) passes `shownAtOnce: true`: it moves at once, its figures follow, a failure flips it back, and its toast is one row, the title with Undo beside it. A dialog or a form's Save leaves it out and changes the screen when the write lands. `tests/writeFeedback.spec.ts` fails on a switch or select that saves on change with no `:loading`, and on a control disabled on a busy flag with no `:loading` beside it.

## Forms

- Fields go in `FormGrid`: two to a row from 640 px, labels in one row and inputs in the next, so inputs line up whatever a label's length. Every field takes one column, and one that takes a whole row, such as a field around a switch or a checkbox, says `sm:col-span-2`. Anything that is not a field, such as a bare radio group or a note, takes the whole row. A card whose fields have lines between them, such as the assistant's, stacks its fields in one column.
- An amount of money is a `MoneyInput` bound to text that `typedAmount` reads. A rate, a percent or a count stays a `UInput` with its own `inputmode`.
- `MoneyInput`'s k and m need a hardware keyboard or a paste, since a phone's decimal keypad has no letters. Ctrl+Z does not undo its edits, because it writes the field itself.
- A `USelect` or `USelectMenu` that may stay empty offers the words for empty, such as Not set, as a row of its own whose value is a stand-in such as `-`, which the field maps to blank and back. No item has a blank value, because the list throws on one and its search then drops matches. A row also stays reachable by keyboard, touch and search, which a `clear` button is not.
- A field that takes free text with suggestions is a `UInputMenu` with `mode="autocomplete"`, such as the Assistant card's model. Its value is the text as typed, so a screen keeps what the field shows apart from what it stores while the field has focus.
- A plain table of figures is a `FigureTable`. Sortable columns use `SortableHeader`. `UTable` is only for grouped or sorted lists.
- A group of rows starts with a heading row of class `group-row`, a table's `tr` or the heading over a phone's list. `app.css` sets it on the elevated surface under a strong line with space above every group but the first, and keeps a phone's heading below the top bar. It names the group, its count and its total, and does not collapse.
- A line inside a table's body that sums up the rest, such as what you pay in all, is a `tr` of class `total-row`. `app.css` draws a strong line above it. A table's own total in its `tfoot` needs no class.

## Layout and width

- A page's grids follow the room the shell gives the screen, never the window, because the chat's dock narrows a page without narrowing the window. From 640 px the shell's content area is a container, so `@2xl:` and the like read how wide the screen really is. A window breakpoint on a page's grid fails lint, and `sm:` stays allowed: it is the phone step and every layout above it has the room.
- `DashboardGrid` has three layouts. `tiles`: two to a row, one row from `@4xl`, three tiles one row from `@2xl`, and five or six tiles take three to a row from `lg`, the one window step in the grid, and one row from `@8xl`. `cards`: one column, two from `@4xl`, and three from `@8xl` when there are three or more. `pair`: side by side from `@8xl`.
- A card that runs across both columns below `@8xl` says so itself, such as `@4xl:col-span-2 @8xl:col-span-1`.
- Two columns inside a full-width card start at `@2xl`, such as `@2xl:grid-cols-2`. A style block asks the same way, with `@container (min-width: 42rem)`.
- Without the chat, `@2xl` is reached in a 768 px window and from 1024 px beside the sidebar, `@4xl` from 1216 px and `@8xl` from 1664 px. With the chat docked, `@4xl` needs a 1416 px window and `@8xl` a 1864 px one. The steps come from what fits: a tile of about 215 px and a card of about 440 px. A rule that needs another step asks what the grid's parts need, not what a window is called.
- A part outside the content area has no such container and keeps window breakpoints: the shell's own frame, and a dialog or drawer's body, which the app draws outside the page. So does what depends on the top bar and the sidebar, such as the sticky bands' `top`.
- Cards rearrange as the width grows. The visual check fails a dashboard whose cards keep one arrangement at 768, 1440 and 1920 px, and cards side by side in a grid that is not a `DashboardGrid`, outside the gallery.

- The sidebar and the drawer end with `CompanyFooter`: the company's logo and name in `type-caption` on up to two lines, which open its contact, the privacy page and the terms page. The icon sidebar shows the logo alone, and so does the expanded sidebar beside Sync on a window under 860 px high. Shorter still, only the list of pages scrolls, with Kuna settings, Sync and the footer pinned. A first run ends with the whole footer in a row. It is left out of print.

## Navigation

- One menu holds every app, in the sidebar and the drawer alike. It opens with `HomeLink` in its standard look: a 24 px Kuna mark and the name in one row, a link home, with a thin line under it. Net worth comes next, then a row per app in use with a small `AppMark`, then Kuna settings pinned over Sync, so it keeps one place while the list scrolls. Below 1024 px the same menu is in the drawer, pinned the same way.
- One app is open at a time, and the address decides which, so nothing about it is stored. An open app shows its optional subtitle in `type-caption`, its menu and its Settings. The small arrow on a closed app's row opens its pages without leaving the screen, and the next change of address closes them. The arrow is a button beside the row's link, never inside it, and 44 px on a phone.
- Menu items and app rows share one grid: a 24 px column for the icon or tile, then the name, so an item's name lines up with its app's. The open app stands out by weight and its tile, never by indenting or tinting. The selected item keeps the accent.
- A pill on a menu item means something waits there, and nothing else. A closed app's row adds up its items' pills, and an open app's row shows none, since its item carries it. An app in its first run has no file, so it is left out.
- While any app is left out and the welcome has an answer, a quiet Add an app row closes the list and leads to the home, whose cards offer every app. Before any app is set up, Net worth is left out too, since it has nothing to show.
- Kuna's home at `#/` has a card per app, and no app is open in its menu. The phone home has the same drawer as every screen, so Net worth and Kuna settings are reached there and the home carries no buttons for them.
- Kuna settings at `#/settings` holds only what is the same for every app: sync, sign-out, where new files go, the AI key and model, Always allow and Anonymise for the AI company in use, theme and language. Each app's Assistant tab shows whether the chat asks first and links to Kuna settings.
- A first run starts with the quiet `HomeLink`, so it can be left for the home.
- From 1024 px the sidebar is expanded, icons or hidden, picked in the Sidebar layout menu beside the Kuna mark, whose icon shows the choice in force. Hidden gives the top bar and the drawer of a narrower window, with only the menu button on the left and the layout menu at the top of the drawer. Icons show each name as a tooltip and what waits as a small figure on its corner.
- A detail screen, such as a holding or a loan, lights the menu screen it opens from, without `aria-current`.
- The shell's first stop for a keyboard is Skip to content, which focuses the screen's title, or the chat's prompt while the chat holds the page. Cmd+K or Ctrl+K opens Jump to a page, every menu page grouped by app, except on a phone and while another dialog is open.
- With a key kept, the chat is a row under Kuna settings in the sidebar and a button beside Sync in the top bar, and nothing shows without a key. The chat docks beside the page while the page keeps 976 px, its two dashboard columns: from 1416 px beside the icons, 1600 px beside the expanded sidebar and 1360 px with it hidden. Where the expanded sidebar does not fit beside the chat it shows as icons until the chat closes, and the layout menu says so. Narrower, the chat takes the page's place, so it is never a popup. Its leading edge drags it from 384 to 704 px, a double-click resets it, and the arrow keys, Home and End move it.
- The chat asks in `GrantCard`, inside itself, never in a dialog. A read shows as `SentRow` above its answer, closed to one line and one tap from the exact text sent. An amount Kuna did not compute shows the warning line under the answer. A change shows as `ProposalCard` under its answer, in Kuna's words, with Accept, and Undo after it.
- An element a person can ask the chat about calls `useChatElement({ key, label, about })`, with a short label built from parts that names the element, such as a figure's title and what tells it apart ("Gross II, Alex Example, Sep 2026"), never an amount or a payee. A build-up's label may name the employee, since it stays on the device and the model gets only a ref. `AskChatButton` sits on the page, never in a dialog, and calls its `ask`. With `text` it names a task, such as Suggest categories or Set up with the chat, which the chat sends by itself, and it then has no tooltip. Set up with the chat may also make the app's file first and go to the overview, with `loading` on it while it does. The row, tile or list item binds its `marked` and carries the one highlight, `data-chat-tagged`, while the open chat is about it. Only a cell of a side-by-side comparison marks the cell alone. In a table the ask takes its own narrow column, or shows beside the amount only while a container query on the table finds room for both on one line, and never stacks under it.

## Sync steps

- A step that a setting turned off, such as Mail or Statements, shows in the step list as "Off in Settings". A step that is off because the file has nothing for it, such as ECB rates with no foreign account, Keys with no key in use or Bank sync with no good link, sets `leftOutWhenOff` and is not listed. Neither kind is counted in the sync control's place among the steps.
- Do not explain why a step is not needed. Leave it out.

## Phone

- Below 640 px every control is at least 44 px. The rule is in `app.css`. A switch, checkbox or radio stays its size and its label carries the height. A link that ends a sentence goes on its own line with `inline-target`. `DrillLink in-prose` is only for a link in the middle of a sentence, and it is underlined on a phone.
- A sheet that rises from the bottom is `.phone-sheet`. The navigation drawer is `.phone-drawer`. Both clear the safe areas.
- The top bar's one action, Sync or Export, uses `.top-bar-action`.
- Check Croatian copy at 360 px. Croatian labels run a third longer.

## First run

- Each step of a first run is a `StepCard`. The screen provides `STEP_FLOW` with the step, whether Back is allowed and `back()`. Test ids are `onboarding-step` and `onboarding-back`.
- Every first run sits on `FirstRunPage` in `src/shared/storage/presentation`, which provides `STEP_FLOW`, and its `stepper` prop numbers the steps of a longer path. An app with only the file's steps shows `FirstRunScreen`. One with steps of its own, such as Company, shows the shared folder and find steps among them.
- A step that makes the file may offer Set up with the chat, an `AskChatButton` at `size="md"`, beside its main action as the pair. Other ways on, such as opening a file already made, are quiet links above the actions.
- A new app's empty state and its Getting set up card carry Set up with the chat too, the card only while a line that an empty file shows is left.

## Theme and language

- `?theme=light` or `?theme=dark` pins the theme for one visit. `?lang=en` or `?lang=hr` pins the language for one visit. Use them in checks and in the gallery.
- Croatian terms in the English UI, such as form names and law citations, carry `lang="hr"`.

## Gallery

- The gallery at `#/gallery` is the library's page, in dev and fake builds only. It holds foundations (swatches with live contrast, type roles, radii, elevations), formatting, and a section per shared component in every state.
- An app's own specimens arrive through `AppContribution.gallery`, since the shell never imports an app.
