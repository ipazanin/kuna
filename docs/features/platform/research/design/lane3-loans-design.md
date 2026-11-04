# Design lane 3: the Loans screens

Design spec for the Loans Overview and the bank loan screen's top area, with the green and brass balance chart, a new principal, interest and subsidy chart, the tokens and components they need, and the decisions left for the owner.

The mockup shows every state below at 360 px and 1440 px, in dark with a light toggle. Every figure in it comes from the fake build's sample loans, worked out by Kuna's own `loanPlan` for 29 Oct 2026.

## The short version

- The Overview gains a tile row (owed in all, next payment, interest this year, when the bank loans end) and richer loan cards: a balance sparkline, a paid-back meter and three dated facts. With one loan the tiles would repeat the card, so the card grows into a hero instead.
- The bank loan screen leads with a hero band of two figures: "Owed today" with a paid-back meter, and the new "Total owed" (principal left plus interest left) split into principal, interest, what the subsidy still pays and what the owner pays. "Interest left" folds into Total owed, so four tiles follow instead of six.
- "Owed over time" splits into a green line for the past and a dashed brass line for the plan still to come. Brass is a new chart step, `--loan-ahead`, since the accent itself fails the chart checks.
- A new chart, "Where the payments go", draws a stacked bar per year: principal at the bottom, interest on top, and the subsidy's share striped in the middle. A whole-loan bar above it answers the cumulative question.
- Showing the subsidy as part principal and part interest needs a split rule. I propose a split in proportion to each instalment's principal and interest. That is the owner's call, and it also decides whether today's tile caption is right.
- Interest wears violet (`--series-7`), not the Company app's orange. Orange and brass fail the colour checks against each other.

## What is there today

Screenshots of the fake build (taken before the mockup) show the gap. The Loans Overview is a sentence ("You owe €165,064.21 in all") and two cards of plain text lines. The bank loan screen opens with six equal tiles and one green line chart whose x axis reads "Mar 23, Jul 24, Nov 25". The Company Overview, by contrast, has a headline sentence, tiles with sparklines and deltas, coloured charts with legends and a donut. The design below brings Loans to the same density with the same parts: `AppCard`, `KpiTile`, `ChartCard`, `ChartLegend`, the token palette, the 10 px card radius and Inter figures.

## Colour

Three roles carry every loan chart. Green is principal and the balance behind you. Brass is the balance still ahead. Violet is interest. The subsidy is never a colour of its own: it is the `--chart-hatch` stripes laid over the hue it pays, so its part stays principal or interest.

| Token                          | Light                     | Dark                      | Job                                                                     |
| ------------------------------ | ------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `--loan-principal` (new alias) | `var(--series-1)` #1baf7a | `var(--series-1)` #199e70 | Principal, the balance so far, the paid-back meter                      |
| `--loan-ahead` (new hex)       | #b7860f                   | #be8a1a                   | The balance still to come, the meter's remainder, the future-years band |
| `--loan-interest` (new alias)  | `var(--series-7)` #6250d6 | `var(--series-7)` #9085e9 | Interest                                                                |
| `--chart-hatch` (exists)       | white stripes             | dark stripes              | The part the subsidy pays                                               |

I ran the dataviz palette validator on the three together with `--pairs all`, since the hero meter, both charts and the cards sit on one screen.

- Light, on #ffffff: all checks pass. Worst pair green and brass at ΔE 9.8 deutan, 17.6 normal vision. Green is 2.8:1 against white (a WARN), which the table view and direct labels already relieve, as on the Company charts.
- Dark, on #131a23: all checks pass. Worst pair green and brass at ΔE 8.3 protan, 17.8 normal.

What failed, and why the table looks as it does:

- The accent as a chart colour. Dark `--accent` #d4ab63 sits above the dark lightness band (L 0.76 against 0.67), and light `--accent` #8a6421 reads grey (chroma 0.095). So `--loan-ahead` is a validated chart step near the accent, not the accent.
- Orange interest. `--series-2` against brass fails all-pairs in both themes (light ΔE 2.6 deutan and 11.7 normal). Interest takes violet instead. Blue also passes, but blue is the taxes bucket on the Company screens, and violet means nothing there.
- A fourth hue. Blue plus violet, or pink with green, fails all-pairs. Three hues is the ceiling for one screen, which is why the subsidy is texture, not a hue.

`--loan-ahead` must be a plain hex, since the canvas reads it with `getComputedStyle`. The two aliases resolve the same way the `--bucket-*` aliases already do. Charts read them with the existing `tokenColour()`, so `ChartTokens` needs no new fields.

## The Loans Overview

### Hierarchy

1. Page header: "Overview" with the line "Every loan you keep: what is owed and what comes next." and the two add buttons.
2. Tile row, only with two or more loans: Owed in all, Next payment, Interest in this year, Bank loans paid off. The Overview keeps Owed in all as the principal left over every loan. A total owed across loans would need every loan's interest, and informal loans have none, so it stays on the bank loan's page.
3. The problems alert, as today, when the file has doubted records.
4. One card per loan, bank loans first.

The current "You owe X in all" sentence becomes the first tile.

### Tiles

| Tile                | Value                | Caption                                                                                       |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| Owed in all         | €165,064.21          | "on 2 loans", or "on 2 loans, and €X is owed to you" when an informal loan runs the other way |
| Next payment        | €612.20 (your share) | "On 20 Nov, Home loan". The earliest next payment over the bank loans                         |
| Interest in 2026    | €4,840.98            | "the subsidy pays €2,520.00 of this year's instalments", with an info popover                 |
| Bank loans paid off | Mar 2048             | "Informal loans have no end date". The latest payoff over the bank loans                      |

The Owed in all tile has no sparkline at four columns. "€165,064.21" plus an 88 px sparkline overflows a 268 px tile, as the first mockup render showed.

### Loan cards

Both kinds share one frame, so a row of mixed cards lines up.

- Head: a 32 px icon chip (landmark or handshake, `--accent` on `--accent-wash`), the name, the lender or the other person, and a badge on the right. Bank loans show "Subsidised" while the subsidy runs. Informal loans show "You owe" or "Owed to you".
- Figure: the balance in `text-figure-lg`, with "owed today" or "you owe Marko" under it.
- Sparkline: the whole plan from drawdown to payoff for a bank loan, green and solid up to today, brass and dashed after, with a dot on today. An informal loan draws its balance from its start to today in green. When it crosses zero, a zero hairline appears. The sparkline sits right of the figure from 640 px and under it on a phone.
- Paid-back meter (bank loans only): 6 px, green for principal paid back and brass for the rest, with "14% of €180,000 paid back" and "€154,274 to go" under it.
- Facts, under a hairline: Next payment, Subsidy ends (while it runs), Paid off for a bank loan. Last movement and Since for an informal loan.
- The whole card is the link, as today, with the border turning `--border-strong` on hover.

The interest line leaves the card. It lives in the tile row and on the loan's page.

### States

- **Several loans**: tiles, then the cards.
- **One bank loan or one informal loan**: no tiles. The single card spans the full width as a hero, the figure at 36 px and the sparkline 420 by 96 px beside it.
- **Empty**: an `EmptyState` card (the component lane 1 proposes) with the landmark chip, "No loans yet", one line on what Kuna does with a loan, a primary "Add bank loan" and an outline "Add informal loan", and "Your Loans file is ready, kept on Google Drive as kuna-loans.json." in small print. The header shows no add buttons while the card holds them.
- **Loading** (the file is opening): skeleton tiles and skeleton cards in the shape of what comes, with the same pulse as `ScreenSkeleton`. Today the screen shows only its header while it opens.
- **Plan cannot be worked out**: the card keeps its head and shows today's sentence ("Kuna cannot work out its plan yet…") in place of the figure, meter and facts.

### Layout

| Width    | Tiles         | Cards         | Card inside                                       |
| -------- | ------------- | ------------- | ------------------------------------------------- |
| 360 px   | 2 by 2        | one column    | sparkline under the figure, facts as two plus one |
| 768 px   | 2 by 2        | two columns   | sparkline beside the figure, three facts in a row |
| 1440 px  | four in a row | two columns   | as at 768 px                                      |
| from 3xl | four in a row | three columns | as at 768 px                                      |

## The bank loan screen, top area

### Hierarchy

1. "All loans" back link, title, the description line and "Change loan", as today.
2. Hero band, one card with two halves.
   - **Owed today** (left): the label stays as it is. It is the principal left, the plan's balance after the last instalment due. The figure is at a new `text-figure-xl` (40 px desktop, 32 px phone), with "€25,725.79 of €180,000.00 paid back, 14%" under it and a 10 px paid-back meter (green paid back, brass still owed).
   - **Total owed** (right, new): everything still to pay, principal left plus interest left, €224,876.53 in the sample, at `text-figure-lg`. Caption: "Principal and interest of the 257 instalments left, to 20 Mar 2048". A 10 px meter splits it: principal green, interest violet, the subsidy's part striped across both. Under it four figures: Principal €154,274.21, Interest €70,602.32, APN pays €1,050.00, You pay €223,826.53. An info popover says the interest after a variable-rate change is an estimate.
   - A hairline divides the halves: vertical from 640 px, horizontal on a phone.
3. Tiles, four: Next payment, Subsidy ends, Paid off, Interest in 2026. Owed today moves into the hero. Interest left goes, since Total owed shows it as its interest part. Subsidy ends gains "5 instalments to go" in its caption. Without a subsidy the row is three tiles and the hero drops its "APN pays" and "You pay" figures.
4. "Owed over time".
5. "Where the payments go".
6. What if I pay extra, Plan, and the change lists follow unchanged.

### Layout

| Width    | Hero                                                | Tiles         | Charts                                      |
| -------- | --------------------------------------------------- | ------------- | ------------------------------------------- |
| 360 px   | the two halves stacked, the four figures two by two | two by two    | full width, 220 px tall                     |
| 768 px   | the halves side by side                             | two by two    | full width, 260 px                          |
| 1440 px  | side by side, the four figures in one row           | four in a row | full width, 280 px                          |
| from 3xl | side by side                                        | four in a row | the two charts side by side in `.wide-pair` |

The top area goes from six equal tiles to one hero card and four tiles. Today's six tiles fill two rows of three on desktop and three rows of two on a phone. The new one fills a hero and one row on desktop, and a hero and two rows on a phone. The odd-last-spans class below covers the three-tile row of a loan without a subsidy.

The odd-last-spans rule is one layout class in `app.css`, not a component. Lane 1 asks for tile grids to stay layout classes.

### Owed over time

- Type: the existing line with area, split at the current month. The past is `--loan-principal`, solid 2 px, with a 10% wash under it. The plan is `--loan-ahead`, dashed 5 4, with an 8% wash. The two share the current month, so they join, as today.
- Marks: a dashed hairline in `--chart-axis` at today, labelled "Today" in secondary ink, and an 8 px dot on today's balance with a 2 px surface ring. A hollow green dot marks each extra payment. On desktop, a short tick at the first variable-rate due date reads "Variable rate from here, an estimate". On a phone that note lives in the tooltip.
- X axis: years, not months. Every 2 years on desktop (2024, 2026, … 2048), every 5 on a phone (2025, 2030, …). Today's "Mar 23, Jul 24, Nov 25" labels drift through the year and do not read as a timeline.
- Legend: "Owed so far" (line) and "Still to come, by the plan" (dashed line).
- Subtitle: "At each month end. Green is behind you, the dashed brass line is the plan still to come."
- Tooltip, past month: "October 2026", then "€154,274.21 Owed at month end" and "€25,725.79 Paid back so far". Future month: "March 2030", "€136,775.xx Owed by the plan", and "An estimate at the variable rate" when it is one.
- Table toggle: as today. `ChartCard` builds it from the two named series.

### Where the payments go

The owner wants to see how much of the payments goes to principal (glavnica) and how much to interest (kamata), and how much the subsidy pays.

**Why a second chart, not one.** The balance runs to €180,000 and a year's payments to about €10,000. One chart would need two y axes, which misreads every time. The balance chart answers "how much do I still owe", this one answers "where does my money go".

**Why yearly bars.** I weighed three forms.

- Monthly stacked bars: 300 bars, 1 px each on a phone. Unreadable.
- A cumulative area (principal paid and interest paid, rising): answers the totals but hides the annuity's turn, where interest shrinks and principal grows year by year.
- Yearly stacked bars: 26 bars, 8 px each on a 360 px phone and 24 px on desktop. The turn is plain to see, the subsidy years stand out, and the extra payment shows as its own part. Chosen.

The cumulative answer goes above the bars as one horizontal bar, "Over the whole loan", with four figures: Principal €180,000.00, Interest €89,501.65, APN pays €10,080.00, You pay €259,421.65.

**Marks.**

- Stack from the baseline: extra payment (green outline, 14% fill), principal you pay (green), principal the subsidy pays (green, striped), interest the subsidy pays (violet, striped), interest you pay (violet). The two striped parts touch, so the subsidy reads as one striped band across the middle of each subsidised year.
- A 2 px surface gap between parts, a 4 px rounded top on the topmost part, at most 24 px wide, as `chartTheme.ts` already specifies.
- A dashed hairline at today with "Today", and a 3 px `--loan-ahead` band under the axis from today to the end. That ties the future years to the brass of the balance chart without recolouring the bars.
- Y axis in compact euros: 0 to €20k in steps of €5k on desktop, €10k on a phone.
- X axis: every other year on desktop, every 5 years on a phone.

**Legend:** Principal, Interest, APN pays (striped), Extra payment (outline), Still to come (brass rule). The legend drops "APN pays" on a loan without a subsidy and "Extra payment" on a loan without one.

**Tooltip** (hover on desktop, tap on a phone), for 2026: "2026, 12 instalments", then €5,025.42 Principal, €4,840.98 Interest, €2,520.00 "APN pays, €1,283.56 of it principal", and €7,346.40 You pay. A year with an extra payment adds its row. A year at a variable rate adds "An estimate".

**Table toggle:** one row per year with the five named stack series as columns. `ChartCard` reads them from the option as it does for every chart. The brass band is a line series at zero with no name, so it stays out of the table.

**Description for screen readers:** "Principal and interest of each year's instalments from 2023 to 2048. The subsidy pays €10,080.00 over 2023 to 2027. Interest is largest in 2024 at €5,398 and falls to €17 in 2048."

### The subsidy split, a decision for the owner

The plan gives each instalment a payment, its principal and interest, and the subsidy's amount. It does not say which part of the instalment the subsidy pays, and the bank's statement does not either. To draw "the subsidy pays this much principal and this much interest", Kuna needs a rule.

**Proposed rule: in proportion.** The subsidy pays the same share of an instalment's principal as of its interest. For instalment 44 of the sample (20 Nov 2026: €822.20, of which €423.66 principal and €398.54 interest), the subsidy's €210.00 splits into €108.21 principal and €101.79 interest. Over the sample loan the subsidy's €10,080.00 splits €4,942.28 principal and €5,137.72 interest.

The rule matters beyond the chart. Today the "Interest in 2026" tile and the Overview card say "€4,840.98 interest in 2026, of which the subsidy covers €2,520.00". €2,520.00 is the whole year's subsidy. The caption is only true if the subsidy pays interest first. The same goes for today's "Interest left" tile ("of which the subsidy covers €1,050.00"). Total owed sidesteps it: its "APN pays" figure is the subsidy's whole remaining amount, true under any rule, and only the stripes inside its meter follow the rule.

### Light and dark

Both themes use the same roles with their own steps, as the table under Colour gives. The stripes are `--chart-hatch`, white at 62% on light and the dark card at 60% on dark, so they read as cut-outs in both. Tooltips use `--chart-tooltip` and its border. The mockup's toggle switches every frame at once.

### Loading and edge states

- While the file opens: `ScreenSkeleton` (a heading, a tile row and a card), as the shell already draws for a screen whose code is loading.
- No plan: the warning alert as today, with the hero, tiles and both charts hidden.
- Paid off: the hero reads "Paid off on 20 Mar 2048" with a full green meter, and Total owed reads €0.00 without its meter. Both charts have no brass.
- No subsidy: no stripes, no "APN pays" in the legend, the whole-loan figures or the hero, and three tiles.

## Accessibility

- Every chart keeps the Table toggle and a written description. Identity is never colour alone: the balance chart's future is also dashed, the subsidy is also striped, the extra payment is also an outline, and each has a legend entry.
- Meters carry `role="img"` and an `aria-label` with the figure ("14% of €180,000.00 paid back"), since `<meter>` cannot draw striped parts.
- Text wears ink tokens, never a series colour. Swatches beside the text carry identity.
- Touch targets stay at 44 px on a phone, including the Table toggle and the whole card link.

## Components and tokens

| Name                                                                                             | Status                                    | Where                                                   | Note                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--loan-principal`, `--loan-interest`                                                            | new aliases                               | `tokens.css`, beside the bucket aliases                 | `var(--series-1)`, `var(--series-7)`                                                                                                                       |
| `--loan-ahead`                                                                                   | new hex per theme                         | `tokens.css`                                            | #b7860f light, #be8a1a dark, validated                                                                                                                     |
| `--text-figure-xl`                                                                               | new type size                             | `tokens.css` `@theme`                                   | 2.5rem, line 2.75rem, -0.025em. Lane 1's `type-figure` role can take an `xl` step                                                                          |
| `--color-accent-wash`                                                                            | new Tailwind mapping of an existing token | `tokens.css` `@theme inline`                            | For the icon chips without an arbitrary class                                                                                                              |
| `--chart-hatch`, `--chart-axis`, `--chart-ghost`, `--chart-grid`, `--accent-wash`                | exist                                     | `tokens.css`                                            | Stripes, today rule, hovered year, grid, chips                                                                                                             |
| `KpiTile`, `AppCard`, `ChartCard`, `PageHeader`, `MoneyText`, `InfoPopover`, `UBadge`, `UButton` | exist, unchanged                          | `src/shared/ui`, Nuxt UI                                | Tiles, cards, chart frames, badges                                                                                                                         |
| `ChartLegend`                                                                                    | exists, one new mark                      | `src/shared/ui/ChartLegend.vue`                         | A `dashed` line mark for "Still to come"                                                                                                                   |
| `ScreenSkeleton`                                                                                 | exists                                    | `src/shell/ui`                                          | The loading state of both screens                                                                                                                          |
| `EmptyState`                                                                                     | new in lane 1                             | `src/shared/ui`                                         | The Loans empty card uses it                                                                                                                               |
| `ProgressMeter`                                                                                  | new                                       | `src/shared/ui`                                         | Segments of `{ value, colour token, striped, label }`, a height, an accessible label, 2 px surface gaps. Used by the card, the hero and the whole-loan bar |
| `FactGrid`                                                                                       | new                                       | `src/shared/ui`                                         | A `dl` of label, value and caption in two or three columns, the odd last one spanning. The loan cards use it, and the What-if outcomes could               |
| Tile grid with odd-last-spans                                                                    | new layout class                          | `app.css`                                               | Two columns below `xl`, the count in a row from `xl`                                                                                                       |
| `BalanceSparkline`                                                                               | new                                       | `src/apps/loans/balances/presentation`                  | Green up to an index, brass and dashed after, a dot on today. Kept in Loans so `SparkLine` stays the neutral tile trend                                    |
| `BalanceHero`                                                                                    | new                                       | `src/apps/loans/bankLoans/presentation`                 | Owed today with its paid-back meter, and Total owed with its split meter and four figures                                                                  |
| `BankLoanCard`, `InformalLoanCard`                                                               | change                                    | `src/apps/loans/overview/presentation`                  | Rebuilt on the shared card frame described above                                                                                                           |
| `BankLoanTiles`                                                                                  | change                                    | `src/apps/loans/bankLoans/presentation`                 | Four tiles: drops Owed today and Interest left, fixes the subsidy caption                                                                                  |
| `BankLoanFigures.totalOwed`                                                                      | new field                                 | `src/apps/loans/bankLoans/presentation/bankLoanView.ts` | Principal left, interest left, the subsidy left and your share left, from the plan rows after today. `interestLeft` already sums two of them               |
| `OverviewScreen` (Loans)                                                                         | change                                    | `src/apps/loans/overview/presentation`                  | Tile row from two loans, hero card for one, empty and loading states                                                                                       |
| `balanceChart.ts`                                                                                | change                                    | `src/apps/loans/balances/presentation`                  | Two colours, year ticks, today mark, extra-payment dots, the variable-rate tick                                                                            |
| `paymentsChart.ts`                                                                               | new                                       | `src/apps/loans/bankLoans/presentation`                 | The stacked yearly bars, the brass band series and the description                                                                                         |
| Stripe decal                                                                                     | change                                    | `src/shared/charts/chartTheme.ts`                       | Export the existing `incompleteDecal` stripes under one name, so the subsidy and the part-month use one stripe                                             |
| `paymentsByYear`                                                                                 | new                                       | `src/apps/loans/bankLoans/domain/loanFigures.ts`        | Principal, interest, extra payment and the subsidy's two parts per year, by the chosen split rule                                                          |
| Overview totals                                                                                  | new                                       | `src/apps/loans/overview/presentation`                  | Owed in all, earliest next payment, this year's interest and subsidy, latest payoff                                                                        |

New strings go into Loans' `words.ts` with their Croatian, which the language layer in `afa7904` checks. Glavnica, kamata and subvencija are the terms the owner uses.

## Decisions for the owner

### 1. How the subsidy splits between principal and interest

Affects the new payments chart, the stripes in the Total owed meter, the "Interest in 2026" tile and the Overview. Today the sample's tile says "€4,840.98 interest in 2026, of which the subsidy covers €2,520.00". €2,520.00 is the whole year's subsidy.

- **Split in proportion (recommended).** The subsidy pays the same share of principal and interest in each instalment. The chart shows a striped band across both colours, and the caption becomes "the subsidy pays €1,236.44 of it". Cost: a split rule in `paymentsByYear` and a sentence in the info popover.
- **Pay interest first.** The subsidy counts as interest until the month's interest is used up. The current caption stays true and the stripes sit only on violet. Cost: the same as above, but the chart then says the state paid €10,080 of interest, which no document says.
- **No split.** The bars show principal and interest, and the subsidy is a separate thin bar beside each year. Every caption changes to "the subsidy pays €2,520.00 of this year's instalments". Cost: a wider chart on a phone and no answer to "how much principal did APN pay".

Which rule should Kuna use?

### 2. Whether the subsidy carries its payer's name

Affects every subsidy label. The data model calls it a subsidy with no payer. The mockup writes "APN pays".

- **Keep it generic.** Labels read "Subsidy pays". No change to the Loans file.
- **Add a payer name to the subsidy (recommended).** An optional field, "APN" for the owner's loan, and labels read "APN pays", falling back to "Subsidy pays". Cost: one field on the subsidy record, its codec and its dialog.

Should the subsidy get a payer name?

## Notes

- The owner asked mid-lane for a Total owed figure and said the Owed today label stays. Both are in the hero above and in the mockup.
- Choices made without asking, since they follow the rules above: violet for interest, brass as a new chart step rather than the accent, no tile row for a single loan, year ticks on the balance chart.
- The mockup draws the desktop frame at 60% with CSS `zoom`. Firefox supports `zoom` from version 126.
