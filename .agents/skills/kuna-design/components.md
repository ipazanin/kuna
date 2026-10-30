# Component catalogue

Every `.vue` in `src/shared/ui` has a row here and a specimen in the gallery at `#/gallery`. A component that is not listed does not exist. Follow the decision order in [SKILL.md](SKILL.md) and the usage in [patterns.md](patterns.md).

`tests/designCatalogue.spec.ts` fails when a component has no row in a table whose header starts with "Component", when it has no specimen, when a row names a component that does not exist, and when a count is not the number of files that import and render the component. An app's own component of the same name does not count. Each count is the files of that app, the shell or `src/shared` outside the gallery, so zero means that app does not use the component yet. Shared means another shared component renders it.

## Cards and tiles

| Component        | Props                                                                                                                                                                                                                  | Company | Loans | Investments | Shell | Shared |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----------- | ----- | ------ |
| `AppCard`        | `title?`, `subtitle?`, `definition?`, `as?`, `heading?: 'h2' \| 'h3'`, `collapseId?`, `summary?`, `startCollapsed?`, `reveal?`. Bare surface with no title                                                             | 45      | 14    | 1           | 3     | 5      |
| `KpiTile`        | `label`, `value`, `to: RouteLocationRaw \| null`, `delta?`, `higherIsBetter?`, `trend?`, `definition?`, `caption?`                                                                                                     | 8       | 3     | 0           | 0     | 0      |
| `SparkLine`      | `points`, `width?`, `height?`, `fill?`, `colour?`, `aheadFrom?`, `aheadColour?`, `zeroLine?`, `against?`, `againstColour?`. Dashed from `aheadFrom`, the dot on it, `against` a second line under it on the same scale | 0       | 3     | 0           | 0     | 1      |
| `EmptyState`     | `icon`, `title`, `description?`, `actions?`, `tone?: 'empty' \| 'error'`. Slots `description`, `actions`                                                                                                               | 11      | 2     | 1           | 0     | 0      |
| `StepCard`       | `title`, `subtitle?`. Reads `STEP_FLOW` from its screen                                                                                                                                                                | 9       | 0     | 0           | 0     | 3      |
| `PageHeader`     | `title`, `description?`                                                                                                                                                                                                | 9       | 5     | 2           | 2     | 0      |
| `ScreenSkeleton` | `heading?`, `cards?`. Stands in for a screen while its code or its books load                                                                                                                                          | 0       | 4     | 1           | 1     | 0      |
| `PageTabs`       | `tabs`, `label`. Slots per tab and `above`. Keeps `?tab=`                                                                                                                                                              | 8       | 1     | 0           | 0     | 0      |

## Layout

| Component       | Props                                                                                                                            | Company | Loans | Investments | Shell | Shared |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----------- | ----- | ------ |
| `DashboardGrid` | `layout?: 'tiles' \| 'cards' \| 'pair' \| 'row'`. A row holds up to four cards: one column, two from sm, one row from xl         | 11      | 6     | 0           | 2     | 0      |
| `FormGrid`      | `as?: 'div' \| 'form'`. A field takes a whole row with `sm:col-span-2`                                                           | 14      | 10    | 1           | 0     | 0      |
| `AppDialog`     | `v-model:open`, `title`, `description?`, `width?: 'md' \| 'xl' \| '2xl' \| '3xl'`, `dismissible?`. Slots default, `start`, `end` | 23      | 9     | 0           | 0     | 0      |

## Charts

| Component     | Props                                                                                                                                                                                              | Company | Loans | Investments | Shell | Shared |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----------- | ----- | ------ |
| `ChartCard`   | `title`, `subtitle?`, `definition?`, `description`, `option`, `loading?`, `empty?`, `emptyTitle?`, `emptyDescription?`, `height?`, `phoneHeight?`, `formatValue?`. Emits point and zoom selections | 4       | 5     | 0           | 0     | 0      |
| `ChartCanvas` | `option`, `description`. Drawn only inside `ChartCard`. Emits `select`, `zoom`                                                                                                                     | 1       | 0     | 0           | 0     | 1      |
| `ChartLegend` | `entries`, `toggleable?`, `hidden?`. Emits `toggle`                                                                                                                                                | 14      | 5     | 0           | 0     | 0      |
| `DonutCard`   | `title`, `subtitle?`, `definition?`, `description`, `parts`, `total`, `totalLabel`, `formatValue?`. Slots `beside`, `aside`                                                                        | 6       | 0     | 0           | 0     | 0      |

## Figures and tables

| Component            | Props                                                                                                                                                                                                         | Company | Loans | Investments | Shell | Shared |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----------- | ----- | ------ |
| `MoneyText`          | `cents`, `sign?`, `precision?: 'cents' \| 'compact'`, `tone?: 'flow' \| 'outcome'`, `format?` for a figure shown outside its app                                                                              | 54      | 7     | 0           | 1     | 0      |
| `DrillLink`          | `to: RouteLocationRaw \| null`, `label?`, `inProse?`                                                                                                                                                          | 45      | 0     | 0           | 0     | 3      |
| `FigureTable`        | `label?`. Wraps `.data-table` in a frame that scrolls sideways only when needed                                                                                                                               | 7       | 2     | 0           | 0     | 2      |
| `SortableHeader`     | `label`, `v-model` sort direction or null                                                                                                                                                                     | 1       | 0     | 0           | 0     | 0      |
| `ProgressMeter`      | `parts` of `{ value, colour, striped? }`, `label`, `height?`. Read out as its label                                                                                                                           | 0       | 3     | 1           | 0     | 0      |
| `FactGrid`           | `facts` of `{ label, value, caption?, swatch? }`. Two to a row, all in one row once they fit                                                                                                                  | 0       | 6     | 0           | 0     | 0      |
| `ScenarioComparison` | `columns`, `groups` of lines of cells `{ text, best, difference, warning? }`, `label`, `baseNote`, `bestNote`, `lineHeading`, `openable?`, `openLabel?`. Slot `column`. Emits `open`. Two by two below 768 px | 0       | 1     | 0           | 0     | 0      |
| `ShowAllButton`      | `total`, `v-model:expanded`. Shows the first ten entries of a list                                                                                                                                            | 5       | 1     | 0           | 0     | 0      |

## Controls

| Component            | Props                                                                                                                                                                  | Company | Loans | Investments | Shell | Shared |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----------- | ----- | ------ |
| `InfoPopover`        | `subject`, `definition?`. Default slot for richer content                                                                                                              | 1       | 1     | 0           | 0     | 2      |
| `ColourSwatchPicker` | `title`, `blank`, `swatches`, `note?`, `v-model`                                                                                                                       | 1       | 0     | 0           | 0     | 0      |
| `HomeLink`           | `label`, `look`. The Kuna mark and name linking to the home, `label` its whole name. Lead is the largest mark centred over the name, quiet sits beside a grid icon     | 1       | 0     | 0           | 1     | 1      |
| `AppBrand`           | `title`, `icon?`, `colour?`, `look?: 'standard' \                                                                                                                      | 0       | 0     | 0           | 1     | 1      |
| `ScenarioPicker`     | `options` of `{ value, label, baseLabel?, locked? }`, `picked`, `base`, `most`, `label`, `againstLabel`, `fullNote`, `lockedNote`. Slot `mark`. Emits `toggle`, `base` | 0       | 1     | 0           | 0     | 0      |
| `AppMark`            | `icon`, `colour`, `size?: 'small' \| 'medium' \| 'large'`. An app's icon on a tile in the app's colour                                                                 | 0       | 0     | 0           | 2     | 1      |
