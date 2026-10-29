# Component catalogue

Every `.vue` in `src/shared/ui` has a row here and a specimen in the gallery at `#/gallery`. A component that is not listed does not exist. Follow the decision order in [SKILL.md](SKILL.md) and the usage in [patterns.md](patterns.md).

`tests/designCatalogue.spec.ts` fails when a component has no row in a table whose header starts with "Component", when it has no specimen, when a row names a component that does not exist, and when a count is not the number of files that render the component. Each count is the files of that app, the shell or `src/shared` outside the gallery, so zero means that app does not use the component yet. Shared means another shared component renders it.

## Cards and tiles

| Component        | Props                                                                                                                                                      | Company | Loans | Shell | Shared |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----- | ------ |
| `AppCard`        | `title?`, `subtitle?`, `definition?`, `as?`, `heading?: 'h2' \| 'h3'`, `collapseId?`, `summary?`, `startCollapsed?`, `reveal?`. Bare surface with no title | 45      | 8     | 3     | 5      |
| `KpiTile`        | `label`, `value`, `to: RouteLocationRaw \| null`, `delta?`, `higherIsBetter?`, `trend?`, `definition?`, `caption?`                                         | 8       | 3     | 0     | 0      |
| `SparkLine`      | `points`, `width?`, `height?`, `fill?`, `colour?`, `aheadFrom?`, `aheadColour?`, `zeroLine?`. Dashed from `aheadFrom`, the dot on it                       | 0       | 2     | 0     | 1      |
| `EmptyState`     | `icon`, `title`, `description?`, `actions?`, `tone?: 'empty' \| 'error'`. Slots `description`, `actions`                                                   | 11      | 1     | 0     | 0      |
| `StepCard`       | `title`, `subtitle?`. Reads `STEP_FLOW` from its screen                                                                                                    | 9       | 3     | 0     | 0      |
| `PageHeader`     | `title`, `description?`                                                                                                                                    | 9       | 4     | 2     | 0      |
| `ScreenSkeleton` | `heading?`, `cards?`. Stands in for a screen while its code or its books load                                                                              | 0       | 3     | 1     | 0      |
| `PageTabs`       | `tabs`, `label`. Slots per tab and `above`. Keeps `?tab=`                                                                                                  | 8       | 0     | 0     | 0      |

## Layout

| Component       | Props                                                                                                                            | Company | Loans | Shell | Shared |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----- | ------ |
| `DashboardGrid` | `layout?: 'tiles' \| 'cards' \| 'pair'`                                                                                          | 11      | 4     | 2     | 0      |
| `FormGrid`      | `as?: 'div' \| 'form'`. A field takes a whole row with `sm:col-span-2`                                                           | 14      | 8     | 0     | 0      |
| `AppDialog`     | `v-model:open`, `title`, `description?`, `width?: 'md' \| 'xl' \| '2xl' \| '3xl'`, `dismissible?`. Slots default, `start`, `end` | 23      | 7     | 0     | 0      |

## Charts

| Component     | Props                                                                                                                                                                                              | Company | Loans | Shell | Shared |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----- | ------ |
| `ChartCard`   | `title`, `subtitle?`, `definition?`, `description`, `option`, `loading?`, `empty?`, `emptyTitle?`, `emptyDescription?`, `height?`, `phoneHeight?`, `formatValue?`. Emits point and zoom selections | 4       | 3     | 0     | 0      |
| `ChartCanvas` | `option`, `description`. Drawn only inside `ChartCard`. Emits `select`, `zoom`                                                                                                                     | 1       | 0     | 0     | 1      |
| `ChartLegend` | `entries`, `toggleable?`, `hidden?`. Emits `toggle`                                                                                                                                                | 14      | 3     | 0     | 0      |
| `DonutCard`   | `title`, `subtitle?`, `definition?`, `description`, `parts`, `total`, `totalLabel`, `formatValue?`. Slots `beside`, `aside`                                                                        | 6       | 0     | 0     | 0      |

## Figures and tables

| Component        | Props                                                                                                                            | Company | Loans | Shell | Shared |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----- | ------ |
| `MoneyText`      | `cents`, `sign?`, `precision?: 'cents' \| 'compact'`, `tone?: 'flow' \| 'outcome'`, `format?` for a figure shown outside its app | 54      | 6     | 1     | 0      |
| `DrillLink`      | `to: RouteLocationRaw \| null`, `label?`, `inProse?`                                                                             | 45      | 0     | 0     | 3      |
| `FigureTable`    | `label?`. Wraps `.data-table` in a frame that scrolls sideways only when needed                                                  | 3       | 1     | 0     | 1      |
| `SortableHeader` | `label`, `v-model` sort direction or null                                                                                        | 1       | 0     | 0     | 0      |
| `ProgressMeter`  | `parts` of `{ value, colour, striped? }`, `label`, `height?`. Read out as its label                                              | 0       | 3     | 0     | 0      |
| `FactGrid`       | `facts` of `{ label, value, caption?, swatch? }`. Two to a row, all in one row once they fit                                     | 0       | 4     | 0     | 0      |
| `ShowAllButton`  | `total`, `v-model:expanded`. Shows the first ten entries of a list                                                               | 5       | 1     | 0     | 0      |

## Controls

| Component            | Props                                                                             | Company | Loans | Shell | Shared |
| -------------------- | --------------------------------------------------------------------------------- | ------- | ----- | ----- | ------ |
| `InfoPopover`        | `subject`, `definition?`. Default slot for richer content                         | 1       | 1     | 0     | 2      |
| `ColourSwatchPicker` | `title`, `blank`, `swatches`, `note?`, `v-model`                                  | 1       | 0     | 0     | 0      |
| `HomeLink`           | `label`. The Kuna mark and name linking to the home, `label` read after the name  | 1       | 1     | 1     | 0      |
| `AppBrand`           | `title`, `icon?`, `colour?`. A name beside the Kuna mark, or beside an app's tile | 0       | 0     | 1     | 1      |
| `AppMark`            | `icon`, `colour`, `size?`. An app's icon on a tile in the app's colour            | 0       | 0     | 2     | 1      |
