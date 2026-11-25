---
name: kuna-design
description: Load before any change that renders something in Kuna, such as a screen, dialog, component, gallery specimen, style or visible copy. Holds the decision order, the token file map, the lint rules and the component catalogue.
---

# Kuna design

Every screen in every app should look as if one person built it on one day. Screens arrange shared components, components carry the looks, and lint stops the rest.

- [components.md](components.md) lists every component in `src/shared/ui`, its props and which app uses it.
- [patterns.md](patterns.md) says what Kuna already does for cards, tiles, tabs, charts, dialogs, forms and phones.

## Decision order

1. Find a component in [components.md](components.md) that does the job and use it as it is.
2. Otherwise compose existing components with layout classes and the `type-*` roles.
3. Otherwise extend a component with a prop. Do not add a second component for the same job.
4. Otherwise add a component to `src/shared/ui` in the same change, with its gallery specimen and its catalogue row.
5. Never style a screen to get a look. A missing look belongs in a component or a token.

A component starts in the app that needs it and moves to `src/shared/ui` when a second app does. Never copy one into a second app.

## Rules

- Colours come from `tokens.css`. No Tailwind palette colour, `white`, `black`, literal, palette variable or `dark:` in a class. Every token already has a dark value.
- An app's identity colour is its `--app-*` token, passed to `AppMark` by the app's registration. It tiles the app's icon on the home card, in its menu, in the phone top bar, beside its rows on Net worth that no ring holds, and on its slice and swatch in Net worth's What you have ring, and nothing else. Buttons, links, focus and the selected menu item keep the accent.
- Tones are Nuxt UI's: `text-success`, `text-error`, `text-warning`, `text-info`. An amount takes its colour from `MoneyText`'s `tone`, never from a class. See Amounts below.
- Text roles are `type-page-title`, `type-card-title`, `type-body`, `type-label`, `type-caption`, `type-figure`, `type-figure-secondary` and `type-wordmark`. Figures that lead a hero use `text-figure-lg` or `text-figure-xl`.
- `type-row-title` is the line a row or a summary leads with at regular weight, and `type-aside` is the quiet sentence beside content, such as an empty list's line or a page's intro.
- Running text that would grow too wide takes `max-w-prose`, the one reading width. Lint refuses a width in `ch`.
- Stack with `z-control` and `z-top-bar`, and fade with `duration-fade`. No numeric `z-*` or `duration-*`.
- Colour is never the only cue. A status also has an icon or a word.
- A card shares its row or spans it, and never leaves an empty half. `DashboardGrid` stretches a card with no partner across its row, and a list card alone in a wide row shows as a table. See Layout and width in [patterns.md](patterns.md).
- Text that may be cut short goes through `CutText`, which shows its full text on hover, on keyboard focus and on a long press while it is cut. Inside a link or a button a tap opens the control, so what it opens shows the full text, or the text wraps, as Quick add's names do. A chart's canvas labels have the chart's tooltip and table, a field's ellipsis shows in full on focus, and a select's trigger has its open list. The visual check fails any other cut text outside `CutText` and lists its exceptions in `CUT_TEXT_ALLOWED`.
- Every control a thumb can reach is at least 44 px below 640 px. The rule is in `app.css`, so do not undo it with a height class.
- Every visible string goes through the app's text, with Croatian beside English. Check Croatian at 360 px.
- No new `<style>` block. A look belongs in a component, a token or `app.css`.
- A table of figures sits in `FigureTable`.
- Format money, numbers and dates with the helpers in `src/shared/money`, `src/shared/calendar` and `src/shared/text`, never with `Intl`, `toLocale*` or `toFixed` in a screen.
- A new token has a light and a dark value, and a text pair passes 4.5:1. A mark passes 3:1. A tint under a figure in ink passes 4.5:1 with that ink instead, and where its shape matters, as on a treemap tile, a border that passes 3:1 draws its edge.
- Never work around lint. Inline disables have no effect (`noInlineConfig`). Change the design, not the rule.

## Amounts

Every amount takes one of these looks by the kind of figure it is.

| Look                     | Kind of figure                        | `tone`    | Examples                                                                             |
| ------------------------ | ------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| Full red or green        | A real gain or loss of money          | `outcome` | A net, a year's profit or loss, a return and a gain on investments, a sale at a loss |
| Soft red or green        | Money coming in or going out          | `flow`    | Rows on Entries and Transactions, loan instalments, salary, refunds                  |
| Ink                      | An amount with no direction           | none      | An asset's value, You owe in all, Owed to you                                        |
| Ink, full red below zero | A standing, red only below zero       | `balance` | An account's balance, an account below zero, a limit gone over                       |
| Muted ink with its sign  | Money moved between your own accounts | `move`    | A row or part under Between my accounts, cash taken out to a cash account            |

- Two depths only. The depth follows the kind of figure, never its size. Tiles and cells that step by size, such as the holdings map and the monthly returns, keep their own scale.
- A change between two cases stays in ink with `sign="always"`, as the profit lines of Company's doubled rates do. A lower profit tax there is a saving, not a loss, so a tone would read it the wrong way.
- The soft depth is the full tone at its OKLCH lightness with 60% of its chroma, so both depths pass 4.5:1 on the card in both themes. `tests/tokenContrast.spec.ts` checks the contrast and the lightness.
- One token per depth and direction in each theme: `--tone-positive` and `--tone-negative` for the full depth, `--tone-positive-soft` and `--tone-negative-soft` for the soft one. `moneyToneClass` in `src/shared/ui/moneyTone.ts` is the only place that colours an amount.
- A toned amount always shows its sign, so colour is never the only cue. A balance shows a minus below zero. `MoneyText` refuses `sign` beside a `tone`, so `npm run typecheck` stops the pair.
- A fact in a `FactGrid` that is one amount of money in or out takes `amount` with its tone, so it reads like the tile beside it, as a loan card's Next payment and Last movement do.
- A table or a total whose column heading or title already names the direction, such as a loan's plan or a list of costs, stays in ink without a sign. A single figure of money in or out, such as a tile, a labelled total or a row that stands alone, takes the soft depth with its sign.
- An amount where no money moved through an account, such as a debt forgiven or a loan borrowed or repaid in kind, stays in ink with its sign.
- Money moved between your own accounts is neither income nor spending, so a row or part under Between my accounts, cash taken out to a cash account among it, takes `move`: muted ink with its sign. Spending's `rowTone` and `partTone` pick it, on Entries and in an import's dry run alike. Saved to investments, For the company, Loan principal and Loans to and from people keep `flow`, since that money leaves spending. A row still waiting on review, such as a proposed cash withdrawal or a Maybe a transfer row, keeps `flow` until it is filed.

## Token file map

Read values in these files. Never copy one into a component, a screen or a doc.

| File in `src/shared/styles/` | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.css`                 | Every colour, in `:root` and `.dark`. Surfaces, borders, ink steps, accent, the four tones and the soft depth of the positive and negative ones, elevations, chart values, `--series-*`, `--bucket-*`, `--pay-*`, `--loan-*`, `--ageing-*`, `--gain-*`, `--loss-*`, `--invest-*`. Also the `@theme` scales: figure sizes, radii, widths, the `8xl` container, `z-control`, `z-top-bar`, `duration-fade`. Also the Nuxt UI colour mapping |
| `app.css`                    | Type roles as `@utility`, base body and focus styles, `.data-table`, `.group-row`, `.total-row`, the 44 px phone rule, `.phone-sheet`, `.phone-drawer`, the `ListRow` grid `.list-row-*`, `.top-bar-action`, `.write-progress`, the first-run page `.first-run` with its stepper `.first-run-steps` and `.first-run-step*`, `.quiet-link`, `.company-logo`, `.tags-field` for IbanTagsField and reduced motion                           |

Chart values stay plain hex or rgba, because a canvas cannot resolve `var()`. `src/shared/charts/chartTokens.ts` reads them with `getComputedStyle`.

Nuxt UI theme overrides live in `vite.config.ts` under `ui`, such as the modal and table slots.

## Lint rules

`npm run lint` runs `eslint.config.js` with `--max-warnings 0`. Class strings are checked in `class`, `:class`, `ui` bindings and `h()` calls.

| Rule                                                                            | Catches                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-restricted-classes`                                                         | Palette colours, `white` and `black`, colour literals, palette variables, arbitrary colour values such as `text-(--ink)` or `bg-[var(--x)]`, the soft depth such as `text-negative-soft`, which only `moneyToneClass` names, `dark:`, `!`, numeric `z-*` and `duration-*`, and `md:`, `lg:`, `xl:` or `2xl:` on a page or a shared component, which follow their container                                                                                          |
| `no-restricted-classes`, cut text                                               | `truncate`, `line-clamp-*` and `text-ellipsis` outside `CutText`. A field's ellipsis is allowed in the inputs `eslint.config.js` lists, and a select trigger's `truncate` in the selects it lists, each with its reason                                                                                                                                                                                                                                             |
| `kuna/window-queries`                                                           | `useMediaQuery` with a width, since a page asks `roomAtLeast` for its room                                                                                                                                                                                                                                                                                                                                                                                          |
| `no-unknown-classes`                                                            | A misspelt or removed class. A class a stylesheet declares is known where that stylesheet applies                                                                                                                                                                                                                                                                                                                                                                   |
| `no-conflicting-classes`                                                        | Two classes that set the same property                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `no-duplicate-classes`                                                          | The same class twice                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `no-restricted-syntax`                                                          | A string in a script that spells a colour utility with an arbitrary value, such as `'ring-(--ink)'`, where no class selector looks                                                                                                                                                                                                                                                                                                                                  |
| `vue/no-restricted-block`                                                       | A `<style>` block, outside the files the baseline lists                                                                                                                                                                                                                                                                                                                                                                                                             |
| `vue/no-restricted-html-elements`                                               | A native `<table>` outside `FigureTable` and the files the baseline lists                                                                                                                                                                                                                                                                                                                                                                                           |
| `no-restricted-globals`, `no-restricted-properties`, `vue/no-restricted-syntax` | `Intl`, `toLocale*` and `toFixed` outside `src/shared/money`, `src/shared/calendar`, `src/shared/text` and the files the baseline lists                                                                                                                                                                                                                                                                                                                             |
| `vue` and `typescript` recommended                                              | Vue and TypeScript mistakes. Unused variables fail unless they are rest siblings                                                                                                                                                                                                                                                                                                                                                                                    |
| `kuna/choice-buttons`                                                           | `aria-pressed` in a template under `src/apps`, since a row of buttons that picks one choice is a `ChoiceButtons` and a setting that is on or off is a `USwitch`                                                                                                                                                                                                                                                                                                     |
| `kuna/day-fields`                                                               | A native `type="date"`, which shows a day in the browser's order, since a day is typed in a `DayField`                                                                                                                                                                                                                                                                                                                                                              |
| `kuna/day-field-labels`                                                         | A `DayField` inside a `<label>`, which sends a tap on the day to its calendar button. It takes `aria-label` or a `UFormField`                                                                                                                                                                                                                                                                                                                                       |
| `kuna/link-rows`                                                                | A `UIcon` of `i-lucide-chevron-right` inside a `RouterLink`, or a `RouterLink` that is the direct child of an `li`, under `src/apps`, since a row of a list that opens a page is a `ListRow` with `to`, which draws its arrow                                                                                                                                                                                                                                       |
| `kuna/optional-selects`                                                         | `clear` on a `USelect` or `USelectMenu` outside `OptionalSelect`, since a select whose field may stay empty is an `OptionalSelect`, which gives the cross and the row for empty together. Lint cannot tell an optional field from a required one, so review keeps hand-made Not set rows out                                                                                                                                                                        |
| `kuna/record-rows`                                                              | A `DrillLink` or `RouterLink` in the heading cell (`th scope="row"`) of a plain `tr` under `src/apps`, since a table row that stands for a record is a `RecordRow`, which opens it from anywhere on the row                                                                                                                                                                                                                                                         |
| `kuna/all-links`                                                                | A `UButton` with `variant="link"` and an `i-lucide-arrow-right` icon whose `color` is not `neutral`, since a card's All link reads as a way on, not an action in the accent                                                                                                                                                                                                                                                                                         |
| `kuna/note-lines`                                                               | A `UIcon` of a tone's icon, by name or through `TONE_ICONS`, with words after it outside `NoteLine`. A mark with only a screen reader's words beside it, as in `ComparedFigure`, stays                                                                                                                                                                                                                                                                              |
| `kuna/type-roles`                                                               | `text-xs` or `text-sm` beside `text-muted`, `text-toned`, `text-highlighted`, `text-default` or `text-dimmed`, and a `type-*` role beside a raw size or one of those inks. It reads an element's `class` and `:class` together, and each `ui` and `h()` class string. Outside `src/shared/ui` it also refuses `text-xs` and `text-sm` alone or beside a tone, so text takes its size from a role or its parent. A weight, a tone or a hover ink beside a role stays |
| `kuna/money-tone-colours`                                                       | Red, green, amber or a soft depth in the class of any `MoneyText` or `AccountMoneyText`, and any text colour on one that has a `tone`, since the class would override the tone, muted ink included, which a move takes from `tone="move"`. It reads `class` and the strings of a bound `:class`                                                                                                                                                                     |
| `max-lines`                                                                     | A `.vue` file over 600 lines, outside the files the baseline lists, since a screen or dialog that long holds parts that belong in their own components                                                                                                                                                                                                                                                                                                              |
| `noInlineConfig`                                                                | Any `eslint-disable` comment                                                                                                                                                                                                                                                                                                                                                                                                                                        |

A Nuxt UI `color` other than `primary`, `neutral`, `error`, `warning`, `info` and `success` is a type error, because `theme.colors` in `vite.config.ts` lists them. `npm run typecheck` catches it on a component, a toast and a computed.

`scripts/lint-baseline.json` lists the files that break the style block, table and formatting rules today, one list per rule. `tests/lintBaseline.spec.ts` fails when a listed file is gone or no longer breaks its rule, so take a file off its list in the change that fixes it. Only the owner adds one.

Prettier owns layout: no semicolons, single quotes, 200 columns. Run `npm run format`.

## Adding a component

1. Check [components.md](components.md) and [patterns.md](patterns.md). Extend before adding.
2. Create `src/shared/ui/<Name>.vue` with `<script setup lang="ts">`, typed props through `defineProps`, `withDefaults` for defaults and `defineModel` for two-way values. The file name is the tag.
3. Give it one root element so the caller's `class` falls through. Import Nuxt UI parts by path, such as `@nuxt/ui/components/Button.vue`.
4. Put the component's own generic words, such as Add a part or Remove, in `src/shared/ui/words.ts`, in English and Croatian. Take an app's words and colour tokens as props or slots. Name no app, bucket or business term inside it.
5. Add its specimen to the gallery in `src/shell/gallery/`, in `GalleryScreen.vue` or a specimen component it renders such as `ChartSpecimens.vue`, with a kebab-case section id, showing every state through its props. A specimen with app-specific data goes in that app's gallery, which arrives through `AppContribution.gallery`.
6. Add its row to [components.md](components.md). `tests/designCatalogue.spec.ts` fails without the row or the specimen.

## Check your work

1. `npm run format`, then the checks in AGENTS.md, Checks.
2. `npm run build` and `npm run build:fake` after a change to styles or the gallery.
3. `npm run check:visual -- --only <screen> --widths 360,768,1440,1920` and `npm run check:touch -- --only <flow>` for the screens you changed. Never run the full suites locally, CI does.
4. Open the gallery at `#/gallery` in a fake build, in light and dark (`?theme=dark`) and Croatian (`?lang=hr`). Tab through the changed screen and check the focus ring.
5. Run the `design-reviewer` agent on the diff before handing back.

## References

- Rules: [kuna-styling](../../../.claude/rules/kuna-styling.md) and [kuna-components](../../../.claude/rules/kuna-components.md).
- Reviewer: [design-reviewer](../../../.claude/agents/design-reviewer.md).
- README sections "Cards", "Wide screens" and "Dialogs and forms".
