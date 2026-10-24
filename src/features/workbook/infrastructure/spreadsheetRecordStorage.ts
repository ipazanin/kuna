import { cellText } from '../../../shared/text/cellText'
import type { RecordChange } from '../application/recordStorage'
import type { CopyStorage } from '../application/workbookPorts'
import { WorkbookWriteRefused, refuseOn } from '../application/workbookWriteRefused'
import { ID_FIELD, identityOf, labelOfRecord } from '../domain/recordCodec'
import type { RecordKind } from '../domain/recordKind'
import { NO_RECORDS, sameRecord } from '../domain/recordsRead'
import type { RecordsRead } from '../domain/recordsRead'
import type { FreshRecords } from '../domain/writeRules'
import { insertedRowNumbers, placeLedgerRows } from './ledgerPlacement'
import { cellsOfRecord, recordsOfRows, rowIdOf, spreadsheetTabOfKind } from './spreadsheetTab'
import type { Cells, SpreadsheetTab } from './spreadsheetTab'
import { WORKBOOK_TABS } from './workbookSnapshot'
import type { SheetRow, WorkbookSnapshot, WorkbookTab } from './workbookSnapshot'
import { OWNER_SHARE_COLUMN, TABS_WITH_IDS, contentColumns, missingColumnsOf, templateColumnNames } from './workbookTemplate'
import type { CellEdit, FreshTabs, NewColumn, NewTab, RowAppend, RowDeletion, RowTab, TabEdits, TabRead, WorkbookWriter } from './workbookWriter'

/** What one write does to one tab: the edits that carry it out and the rows the tab is left with. */
interface TabPlan {
  readonly tab: RowTab
  readonly changes: readonly RecordChange[]
  readonly header: readonly string[]
  readonly cells: readonly CellEdit[]
  readonly appends: readonly RowAppend[]
  readonly deletions: readonly RowDeletion[]
  readonly newTab: NewTab | null
  readonly newColumns: readonly NewColumn[]
  readonly rowsAfter: readonly SheetRow[]
  /** The cells each change of the tab leaves its record in, null for a removal, in the order of the changes. */
  readonly written: readonly (Cells | null)[]
}

/**
 * Records kept on the tabs of a Google Sheet or of the workbook kept in this browser, through the
 * grid port of either. A record is found again by the key or id its row holds, wherever the row now
 * stands. A change writes only the cells of the fields it alters, and only where the row holds
 * something else, so a formula the change leaves alone stays a formula. A removed record's row is
 * taken out whole. An added record goes below the last row, and a ledger row where its date puts it,
 * newest first, for a person reading the Sheet.
 */
export function spreadsheetRecordStorage(writer: WorkbookWriter): CopyStorage<WorkbookSnapshot> {
  let read: FreshTabs = {}
  let requested: readonly WorkbookTab[] = []

  async function readTabs(tabs: readonly WorkbookTab[]): Promise<void> {
    requested = tabs
    read = await writer.read(tabs)
  }

  function tabsOf(kinds: readonly RecordKind<unknown>[]): WorkbookTab[] {
    return [...new Set(kinds.map((kind) => spreadsheetTabOfKind(kind).tab))]
  }

  function plan(changes: readonly RecordChange[], addMissingKinds: boolean): readonly TabPlan[] {
    return [...new Set(changes.map((change) => change.kind.name))].map((name) => {
      const ofKind = changes.filter((change) => change.kind.name === name)
      return planTab(read, spreadsheetTabOfKind(ofKind[0]!.kind), ofKind, addMissingKinds)
    })
  }

  return {
    async read(kinds) {
      await readTabs(tabsOf(kinds))
      return recordsOfTabs(read)
    },

    readAgain() {
      return readTabs(requested)
    },

    readBack(copy) {
      const tabs = Object.fromEntries(Object.entries(read).map(([tab, held]) => [tab, held.rows]))
      if (copy.meta.source === 'excel') {
        return { ...copy, ...tabs }
      }
      const missingTabs = WORKBOOK_TABS.filter((tab) => read[tab] === undefined && (requested.includes(tab) || copy.meta.missingTabs.includes(tab)))
      const readHeaders = Object.entries(read).map(([tab, held]) => [tab as WorkbookTab, held.header] as const)
      const missingColumns = { ...Object.fromEntries(Object.entries(copy.meta.missingColumns ?? {}).filter(([tab]) => read[tab as WorkbookTab] === undefined)), ...missingColumnsOf(readHeaders) }
      return { ...copy, ...tabs, meta: { ...copy.meta, missingTabs, missingColumns } }
    },

    identify(kind, record) {
      return identityOf(spreadsheetTabOfKind(kind).codec, record)
    },

    labelOf(kind, record) {
      return labelOfRecord(spreadsheetTabOfKind(kind).codec, record)
    },

    preview(changes, addMissingKinds) {
      const planned = plan(changes, addMissingKinds)
      const writtenOf = new Map(planned.flatMap((tab) => tab.changes.map((change, index) => [change, tab.written[index]!] as const)))
      return {
        records: recordsOfTabs({ ...read, ...Object.fromEntries(planned.map((tab) => [tab.tab, { header: tab.header, rows: tab.rowsAfter, lastRow: 0 }])) }),
        written: changes.map((change) => {
          const cells = writtenOf.get(change) ?? null
          if (cells === null) return null
          const mapping = spreadsheetTabOfKind(change.kind)
          const read = recordsOfRows(mapping, [{ sheetRow: 0, cells }])
          return read.records[0] ?? read.refused[0]!
        }),
      }
    },

    async apply(changes, addMissingKinds) {
      const planned = plan(changes, addMissingKinds)
      const deletions = planned.flatMap((tab) => tab.deletions)
      const newTabs = planned.flatMap((tab) => (tab.newTab === null ? [] : [tab.newTab]))
      const newColumns = planned.flatMap((tab) => tab.newColumns)
      const edits: TabEdits = {
        cells: planned.flatMap((tab) => tab.cells),
        appends: [...planned.flatMap((tab) => tab.appends.filter((append) => append.at !== undefined)), ...planned.flatMap((tab) => tab.appends.filter((append) => append.at === undefined))],
        ...(deletions.length === 0 ? {} : { deletions }),
        ...(newTabs.length === 0 ? {} : { newTabs }),
        ...(newColumns.length === 0 ? {} : { newColumns }),
      }
      await writer.write(edits, read)
    },
  }
}

/** The records of every tab read, each by its kind. */
function recordsOfTabs(tabs: FreshTabs): FreshRecords {
  const memo = new Map<string, RecordsRead<unknown>>()
  return {
    of<R>(kind: RecordKind<R>): RecordsRead<R> {
      const mapping = spreadsheetTabOfKind(kind)
      const rows = tabs[mapping.tab]?.rows
      if (rows === undefined) {
        return NO_RECORDS
      }
      const records = memo.get(kind.name) ?? recordsOfRows(mapping, rows)
      memo.set(kind.name, records)
      return records as RecordsRead<R>
    },
  }
}

function carriesIds(tab: WorkbookTab): boolean {
  return (TABS_WITH_IDS as readonly WorkbookTab[]).includes(tab)
}

/** The columns the app writes on a tab, its id among them on a tab whose rows carry one. */
function writtenColumns(tab: WorkbookTab): string[] {
  return carriesIds(tab) ? [...contentColumns(tab), ID_FIELD] : contentColumns(tab)
}

function quotedList(columns: readonly string[]): string {
  return columns.map((column) => `"${column}"`).join(', ')
}

/** The tab as read, or an empty one with the template's header when the person agreed to add it. */
function tabToWrite(fresh: FreshTabs, mapping: SpreadsheetTab<unknown>, addMissingKinds: boolean): { readonly tab: TabRead; readonly newTab: NewTab | null } {
  const tab = mapping.tab as RowTab
  const held = fresh[tab]
  if (held === undefined) {
    if (!addMissingKinds) {
      throw new WorkbookWriteRefused(`The workbook has no ${tab} tab, so nothing was written.`)
    }
    const header = templateColumnNames(tab)
    return { tab: { header, rows: [], lastRow: 1 }, newTab: { tab, header } }
  }
  const missing = mapping.required.filter((column) => !held.header.some((name) => name.trim() === column))
  if (missing.length > 0) {
    throw new WorkbookWriteRefused(`The ${tab} tab has no ${quotedList(missing)} column, so nothing was written.`)
  }
  return { tab: held, newTab: null }
}

/** The one row holding a record a change or removal names: by its identity, then by the record the row reads as. */
function rowOfRecord<R>(rows: readonly SheetRow[], mapping: SpreadsheetTab<R>, record: R): readonly SheetRow[] {
  const id = identityOf(mapping.codec, record)
  return rows.filter((row) => id !== null && rowIdOf(mapping, row.cells) === id && sameRecord(recordsOfRows(mapping, [row]).records[0]?.record, record))
}

/** The rows holding a refused record: by its identity when it has one, and by its fields as stored. */
function rowsOfRefused<R>(rows: readonly SheetRow[], mapping: SpreadsheetTab<R>, refused: Extract<RecordChange, { readonly verb: 'repair' }>['refused']): readonly SheetRow[] {
  return rows.filter((row) => {
    const [held] = recordsOfRows(mapping, [row]).refused
    return held !== undefined && held.id === refused.id && sameRecord(held.fields, refused.fields)
  })
}

/** A row's cells with these columns set, a blank one taken out, as a read gives the row. */
function withCells(current: Cells, set: readonly CellEdit[]): Cells {
  const cells: Record<string, Cells[string]> = { ...current }
  for (const edit of set) {
    if (cellText(edit.value) === '') {
      delete cells[edit.column]
    } else {
      cells[edit.column] = edit.value
    }
  }
  return cells
}

function filledCells(cells: Cells): Cells {
  return Object.fromEntries(Object.entries(cells).filter(([, cell]) => cellText(cell) !== ''))
}

/**
 * One tab's part of a write, planned on the read just taken. A change or a removal finds its row by
 * the record's identity and the record the row reads as. A repair finds its row by the refused
 * record's identity and fields. Each must find exactly one row, and no row is touched twice.
 */
function planTab<R>(fresh: FreshTabs, mapping: SpreadsheetTab<R>, changes: readonly RecordChange[], addMissingKinds: boolean): TabPlan {
  const tabName = mapping.tab as RowTab
  const { tab, newTab } = tabToWrite(fresh, mapping as SpreadsheetTab<unknown>, addMissingKinds)
  const columns = writtenColumns(tabName)
  const header = new Set(tab.header.map((name) => name.trim()))
  const named = (label: string): string => `the ${mapping.codec.kind.noun.one} "${label}"`
  const refusals: string[] = []
  const taken = new Set<SheetRow>()
  const found = (holding: readonly SheetRow[], label: string): SheetRow | null => {
    const [row] = holding
    if (holding.length !== 1 || row === undefined) {
      refusals.push(
        holding.length === 0
          ? `${capitalised(named(label))} is no longer on the ${tabName} tab as the app read it. Sync and look again.`
          : `${holding.length} rows of the ${tabName} tab hold ${named(label)}, so the app cannot tell which one is meant. Change it in the Sheet.`,
      )
      return null
    }
    if (taken.has(row)) {
      refusals.push(`${capitalised(named(label))} is asked to change twice in one write.`)
      return null
    }
    taken.add(row)
    return row
  }

  const cells: CellEdit[] = []
  const removed: SheetRow[] = []
  const added: Cells[] = []
  const edited = new Map<SheetRow, CellEdit[]>()
  const written: (Cells | null)[] = []
  for (const change of changes as readonly RecordChange<R>[]) {
    switch (change.verb) {
      case 'add': {
        const row = filledCells(cellsOfRecord(mapping, change.after))
        added.push(row)
        written.push(row)
        break
      }
      case 'remove':
      case 'discard': {
        const holding = change.verb === 'remove' ? rowOfRecord(tab.rows, mapping, change.before) : rowsOfRefused(tab.rows, mapping, change.refused)
        const row = found(holding, change.verb === 'remove' ? labelOfRecord(mapping.codec, change.before) : change.refused.label)
        if (row !== null) removed.push(row)
        written.push(null)
        break
      }
      case 'change':
      case 'repair': {
        const after = cellsOfRecord(mapping, change.after)
        const row =
          change.verb === 'change'
            ? found(rowOfRecord(tab.rows, mapping, change.before), labelOfRecord(mapping.codec, change.before))
            : found(rowsOfRefused(tab.rows, mapping, change.refused), labelOfRecord(mapping.codec, change.after))
        if (row === null) {
          written.push(null)
          break
        }
        const before = change.verb === 'change' ? cellsOfRecord(mapping, change.before) : null
        const rowEdits = columns
          .filter((column) => (before === null || cellText(before[column]) !== cellText(after[column])) && cellText(row.cells[column]) !== cellText(after[column]))
          .map((column): CellEdit => ({ tab: tabName, sheetRow: row.sheetRow, column, value: after[column] ?? '' }))
        cells.push(...rowEdits)
        edited.set(row, rowEdits)
        written.push(withCells(row.cells, rowEdits))
        break
      }
    }
  }
  const cellsWritten = [...added.flatMap((row) => Object.entries(row)), ...cells.map((edit): [string, Cells[string]] => [edit.column, edit.value])]
  const unheaded = new Set(cellsWritten.filter(([column, cell]) => !header.has(column) && cellText(cell) !== '').map(([column]) => column))
  // The id and owner share columns come with the first value written there. Another template column the tab lacks comes only once the person agreed.
  const lacking = columns.filter((column) => unheaded.has(column) && (column === ID_FIELD || column === OWNER_SHARE_COLUMN || addMissingKinds))
  const missing = [...unheaded].filter((column) => !lacking.includes(column))
  if (missing.length > 0) {
    refusals.push(`The ${tabName} tab has no ${quotedList(missing)} column for what this change writes. Add the column to row 1 in the Sheet, or leave the field blank.`)
  }
  refuseOn(refusals)
  const newColumns = lacking.map((column): NewColumn => ({ tab: tabName, column }))

  const foot = tab.lastRow + 1
  const placed = tabName === 'ledger' ? placeLedgerRows(tab.rows, added, tab.lastRow) : added.map((_, index) => ({ index, before: foot }))
  const inPlace = placed.filter((place) => place.before !== foot)
  const atFoot = placed.filter((place) => place.before === foot)
  const deleted = removed.map((row) => row.sheetRow)
  // The rows move in the order the writers carry out a write: deletions first, then the placed rows.
  const closedUp = (sheetRow: number): number => sheetRow - deleted.filter((other) => other < sheetRow).length
  const insertedAt = insertedRowNumbers(inPlace.map((place) => closedUp(place.before)))
  return {
    tab: tabName,
    changes,
    header: [...tab.header, ...lacking],
    cells,
    appends: [
      ...inPlace.map(({ index }, order): RowAppend => ({ tab: tabName, cells: added[index]!, at: insertedAt[order]! })),
      ...atFoot.map(({ index }): RowAppend => ({ tab: tabName, cells: added[index]! })),
    ],
    deletions: deleted.map((sheetRow) => ({ tab: tabName, sheetRow })),
    newTab,
    newColumns,
    rowsAfter: [
      ...tab.rows.filter((row) => !removed.includes(row)).map((row) => ({ sheetRow: row.sheetRow, cells: withCells(row.cells, edited.get(row) ?? []) })),
      ...added.map((row, index) => ({ sheetRow: foot + index, cells: row })),
    ],
    written,
  }
}

function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}
