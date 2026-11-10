import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ruleFieldsOf } from '../../rules/domain/rulesTabChange'
import { vatCell } from '../domain/vatTreatment'
import { installedPack } from '../../packs/packContribution'
import { DEFAULT_SETTINGS, settingsTabEntries } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import { CORE_TABS, cellsOfRecord } from './spreadsheetTab'
import type { CellValue, SheetRow, WorkbookTabs } from './workbookSnapshot'

/** The names of the categories new books start with, the installed pack's, none without a pack. */
export function startingCategoryNames(): string[] {
  return (installedPack().workbook?.startingCategories ?? []).map((category) => category.slug)
}

/** Rows numbered from 2, under the header, as a tab holds them. */
function rowsFrom(cellsOfRows: readonly Readonly<Record<string, CellValue>>[]): SheetRow[] {
  return cellsOfRows.map((cells, index) => ({ sheetRow: index + 2, cells: withoutBlanks(cells) }))
}

/** A settings tab of core's settings and the installed pack's defaults, with any rows to keep below them. */
export function settingsTabRows(settings: Settings, keptRows: readonly SheetRow[] = []): SheetRow[] {
  const pack = installedPack().workbook
  return rowsFrom([
    ...settingsTabEntries(settings, pack === null ? null : { settings: pack.settings, values: pack.settings.defaults }).map((entry) => cellsOfRecord(CORE_TABS.settings, entry)),
    ...keptRows.map((row) => row.cells),
  ])
}

/**
 * A workbook with no transactions or accounts yet, the installed pack's starting categories and its
 * category rules for the day, and a row for every setting with these values and the pack's defaults.
 */
export function emptyWorkbookTabs(on: CivilDate, settings: Settings = DEFAULT_SETTINGS): WorkbookTabs {
  const pack = installedPack().workbook
  return {
    ledger: [],
    categories: rowsFrom(
      (pack?.startingCategories ?? []).map((category) => ({
        category: category.slug,
        family: category.family,
        bucket: category.bucket,
        colour: category.colour,
        roles: category.roles.join(', '),
        vat: vatCell(category.vat),
      })),
    ),
    accounts: [],
    settings: settingsTabRows(settings),
    rules: rowsFrom((pack?.startingRules(on) ?? []).map((rule) => cellsOfRecord(CORE_TABS.rules, { fields: ruleFieldsOf(rule) }))),
    invoices: [],
    clients: [],
    'outgoing-plan': [],
    'owner-advances': [],
    assets: [],
    grants: [],
    'year-end': [],
    plan: [],
    scenarios: [],
    employees: [],
    trips: [],
    'trip-legs': [],
    'trip-costs': [],
    splits: [],
    dismissed: [],
  }
}

function withoutBlanks(cells: Readonly<Record<string, CellValue>>): Record<string, CellValue> {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell !== ''))
}
