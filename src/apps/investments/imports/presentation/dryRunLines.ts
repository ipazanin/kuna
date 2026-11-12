import { goneFromWorkbook } from '../domain/editedRecords'
import type { ImportedRecord, WaitReason, WorkbookDryRun } from '../domain/importDryRun'
import { WORKBOOK_COLUMNS } from '../domain/portfolioWorkbook'
import type { RoundedCell, SkipReason, WorkbookRow } from '../domain/portfolioWorkbook'
import { words } from './words'
import type { RateBook } from '../../../../shared/money/rateBook'
import { listedTransactions } from '../../transactions/domain/listedTransactions'
import type { ListedTransaction } from '../../transactions/domain/listedTransactions'
import { transactionLine } from '../../transactions/presentation/transactionLine'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { decimalOfNumber } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { formatCurrencyAmount, formatMoney, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { AskedRow, AskedWhy } from '../../../../shared/recipes/domain/runRecipe'
import { capitalised } from '../../../../shared/text/capitalised'
import { plural } from '../../../../shared/text/translation'
import { likeCaption } from '../../../../shared/ai/presentation/copiedRowsWords'

/** The places a cell of the workbook keeps, so a figure worth a look shows the digits it was read with. */
const CELL_PLACES = 12

/** The columns of amounts of money, shown with their currency's cents. */
const AMOUNT_COLUMNS: ReadonlySet<RoundedCell['column']> = new Set(['gross', 'commission', 'netCash', 'counterAmount'])

/** One line of the dry run: a record it adds or keeps, or a row it holds back, with why. */
export interface ImportLine {
  readonly key: string
  readonly title: string
  /** The day, the account and the workbook rows it comes from. */
  readonly caption: string
  /** Null for a line that moved no money, or a row not mapped yet. */
  readonly euros: Money | null
  readonly flows: boolean
  /** What moved that is not euros, such as units or an amount in its own currency. */
  readonly figure: string
  /** The terms of a record, or why a row waits or is skipped. */
  readonly note: string
}

export interface GoneLine {
  readonly record: ImportedRecord
  readonly line: ImportLine
  /** The record the changed row makes now, beside it. */
  readonly now: ImportLine | null
}

export interface DryRunGroups {
  readonly fresh: readonly ImportLine[]
  readonly waiting: readonly ImportLine[]
  readonly inKuna: readonly ImportLine[]
  readonly skipped: readonly ImportLine[]
  /** The rows a report's recipe asks about. */
  readonly asked: readonly ImportLine[]
  /** The edited ones first. */
  readonly gone: readonly GoneLine[]
  readonly rounded: readonly string[]
  readonly commissions: readonly string[]
  readonly reversals: readonly string[]
}

/**
 * The dry run as lines in the workbook's order: what it adds in words a transaction list uses, the rows it holds back
 * and skips with why, the records gone from the workbook beside what their rows make now, and the cells and rows worth
 * a look of the rows not in Kuna yet. A record a row signed against its type makes says so in its note.
 * `accountName` names a workbook account as Kuna will.
 */
export function dryRunGroups(dryRun: WorkbookDryRun, book: InvestmentBook, rates: RateBook, accountName: (row: WorkbookRow) => string): DryRunGroups {
  const plannedOf = listedById(dryRun.planned, rates)
  // A report's rows are numbered across its files, which no file's own rows would match, so they name only the file.
  const rowsLabelOf = (rows: readonly WorkbookRow[]): string => (dryRun.report === null ? rowsLabel(rows) : '')
  const keptOf = listedById(book, rates)
  const reversalNotes = (record: RecordId): string[] => [...new Set(dryRun.reversals.filter((reversal) => reversal.record === record).map((reversal) => reversal.note))]
  const recordLine = (key: string, record: ImportedRecord, listed: ReadonlyMap<RecordId, ListedTransaction>, rows: readonly WorkbookRow[]): ImportLine => {
    const entry = listed.get(record.record.id)
    if (entry === undefined) return rowLine(key, rows[0]!, rowsLabelOf(rows), accountName, '')
    const line = transactionLine(entry)
    return {
      key,
      title: [line.kind, line.subject].join(' · '),
      caption: [dayLabel(entry.record.date), line.account, rowsLabelOf(rows), rows[0]?.sourceFile ?? ''].filter((part) => part !== '').join(' · '),
      euros: line.euros,
      flows: line.flows,
      figure: line.moved,
      note: [...reversalNotes(record.record.id), line.terms, line.foreign].filter((part) => part !== '').join(' · '),
    }
  }
  const { edited, removed } = goneFromWorkbook(dryRun)
  // A row already in Kuna was rounded the same way when it was imported, so its cells are not worth a look again.
  const keptRows = new Set(dryRun.entries.flatMap((entry) => (entry.outcome.kind === 'in-kuna' || entry.outcome.kind === 'same-record' ? entry.rows.map((row) => row.fileRow) : [])))
  const currencyOfRow = new Map(dryRun.entries.flatMap((entry) => entry.rows.flatMap((row) => (row.currency === null ? [] : [[row.fileRow, row.currency] as const]))))
  const rowsOfRecord = new Map(dryRun.entries.flatMap((entry) => (entry.outcome.kind === 'new' ? [[entry.outcome.imported.record.id, entry.rows] as const] : [])))
  return {
    fresh: dryRun.entries.flatMap(({ key, rows, outcome }) => (outcome.kind === 'new' ? [recordLine(key, outcome.imported, plannedOf, rows)] : [])),
    waiting: dryRun.entries.flatMap(({ key, rows, outcome }) => {
      if (outcome.kind !== 'waiting') return []
      const { reason } = outcome
      const note = reason.kind === 'looks-in-kuna' ? words.dryRun.looksLike(likeParts(reason.like, keptOf).join(', ')) : waitText(reason)
      return [rowLine(key, rows[0], rowsLabelOf(rows), accountName, note)]
    }),
    inKuna: dryRun.entries.flatMap(({ key, rows, outcome }) => {
      if (outcome.kind === 'same-record') return [rowLine(key, rows[0], rowsLabelOf(rows), accountName, words.dryRun.sameRecord(likeParts(outcome.kept, keptOf).join(', ')))]
      return outcome.kind === 'in-kuna' ? [rowLine(key, rows[0], rowsLabelOf(rows), accountName, '')] : []
    }),
    asked: (dryRun.report?.asked ?? []).map(askedLine),
    skipped: dryRun.skipped.map((row) => ({
      key: `skipped-${row.fileRow}`,
      title: capitalised(words.dryRun.row(row.fileRow)),
      caption: '',
      euros: null,
      flows: false,
      figure: '',
      note: skipText(row.reason),
    })),
    gone: [
      ...edited.map(({ gone, now }) => ({
        record: gone,
        line: recordLine(`gone-${gone.record.id}`, gone, keptOf, []),
        now: recordLine(`now-${now.record.id}`, now, plannedOf, rowsOfRecord.get(now.record.id) ?? []),
      })),
      ...removed.map((record) => ({ record, line: recordLine(`gone-${record.record.id}`, record, keptOf, []), now: null })),
    ],
    rounded: dryRun.rounded
      .filter((cell) => !keptRows.has(cell.fileRow))
      .map((cell) => {
        const currency = AMOUNT_COLUMNS.has(cell.column) ? (currencyOfRow.get(cell.fileRow) ?? null) : null
        const shown = (value: Decimal): string => (currency === null ? formatQuantity(value, CELL_PLACES) : formatUnitPrice(value, currency, CELL_PLACES))
        return words.dryRun.roundedLine(cell.fileRow, WORKBOOK_COLUMNS[cell.column], shown(decimalOfNumber(cell.cell, CELL_PLACES)!), shown(cell.rounded))
      }),
    commissions: dryRun.commissionDifferences.map((difference) => {
      const shown = (value: Decimal): string => formatUnitPrice(value, difference.currency, CELL_PLACES)
      return words.dryRun.commissionLine(difference.fileRow, difference.commission === null ? words.dryRun.noCommission : shown(difference.commission), shown(difference.fees))
    }),
    reversals: dryRun.reversals.map((reversal) => {
      const listed = plannedOf.get(reversal.record)
      return words.dryRun.reversalLine(reversal.fileRow, reversal.note, listed === undefined ? '' : transactionLine(listed).kind.toLowerCase())
    }),
  }
}

/** What Import would do, in a sentence or two. */
export function dryRunSummary(added: InvestmentBook, records: number, matching: number, deleting: number): string {
  const parts = [
    added.accounts.length > 0 ? plural(words.dryRun.addsAccounts(added.accounts.length), added.accounts.length) : '',
    added.instruments.length > 0 ? plural(words.dryRun.addsHoldings(added.instruments.length), added.instruments.length) : '',
  ].filter((part) => part !== '')
  const adds =
    records === 0 && parts.length === 0
      ? words.dryRun.addsNothing
      : parts.length === 0
        ? words.dryRun.addsOnly(plural(words.dryRun.adds(records), records))
        : words.dryRun.addsWith(
            plural(words.dryRun.adds(records), records),
            parts.reduce((joined, part) => words.dryRun.and(joined, part)),
          )
  return [adds, ...(matching === 0 ? [] : [plural(words.dryRun.matches(matching), matching)]), ...(deleting === 0 ? [] : [plural(words.dryRun.deletes(deleting), deleting)])].join(' ')
}

function listedById(book: InvestmentBook, rates: RateBook): Map<RecordId, ListedTransaction> {
  return new Map(listedTransactions(book, rates).map((entry) => [entry.record.id, entry]))
}

/** A row as the workbook books it: its type, what it is about, and its amount or units. */
function rowLine(key: string, row: WorkbookRow, rowsWords: string, accountName: (row: WorkbookRow) => string, note: string): ImportLine {
  const figure = rowFigure(row)
  return {
    key,
    title: [words.types[row.type], row.yahooSymbol || row.brokerSymbol].filter((part) => part !== '').join(' · '),
    caption: [dayLabel(row.date), accountName(row), rowsWords, row.sourceFile].filter((part) => part !== '').join(' · '),
    euros: null,
    flows: false,
    figure,
    note,
  }
}

/** A row a report's recipe asks about, in the words its file writes it, with why it asks. */
export function askedLine(row: AskedRow): ImportLine {
  return { key: row.key, title: row.section, caption: row.shown.map(([column, text]) => `${column} ${text}`).join(' · '), euros: null, flows: false, figure: '', note: askedText(row.why) }
}

function askedText(why: AskedWhy): string {
  switch (why.kind) {
    case 'no-kind':
      return words.dryRun.askedNoKind
    case 'unreadable':
      return words.dryRun.askedUnreadable(why.field, why.text)
    case 'changed':
      return words.dryRun.askedChanged
  }
}

/** A row beside the record Kuna has that it looks like, each as its parts. */
export interface LookAlike {
  /** The key of the row's entry, which the person's answer goes by. */
  readonly key: string
  readonly like: RecordId
  readonly fileRow: number
  readonly row: readonly string[]
  readonly record: readonly string[]
  /** The row as the dry run draws it, with the record under it. */
  readonly line: ImportLine
}

/** The rows that look like a record Kuna has, answered or not, in the file's order. */
export function lookAlikesOf(dryRun: WorkbookDryRun, book: InvestmentBook, rates: RateBook, accountName: (row: WorkbookRow) => string): LookAlike[] {
  const keptOf = listedById(book, rates)
  // A report's rows are numbered across its files, so its line names only the file, as the dry run's lines do.
  const rowsLabelOf = (rows: readonly WorkbookRow[]): string => (dryRun.report === null ? rowsLabel(rows) : '')
  return dryRun.questions.lookAlikes.map(({ key, rows, like }) => {
    const row = rows[0]!
    const record = likeParts(like, keptOf)
    return {
      key,
      like: like.record.id,
      fileRow: row.fileRow,
      row: [capitalised(words.dryRun.row(row.fileRow)), ...rowParts(row, accountName)],
      record,
      line: rowLine(key, row, rowsLabelOf(rows), accountName, likeCaption('kept', record)),
    }
  })
}

/** A record Kuna has: what it is, what it moved, and its day and account. */
function likeParts(record: ImportedRecord, listed: ReadonlyMap<RecordId, ListedTransaction>): string[] {
  const entry = listed.get(record.record.id)
  if (entry === undefined) return []
  const line = transactionLine(entry)
  const subject = line.subject === line.account ? '' : line.subject
  return [line.kind, subject, line.euros === null ? '' : formatMoney(line.euros), line.moved, dayLabel(entry.record.date), line.account].filter((part) => part !== '')
}

function rowParts(row: WorkbookRow, accountName: (row: WorkbookRow) => string): string[] {
  return [words.types[row.type], row.yahooSymbol || row.brokerSymbol, rowFigure(row), dayLabel(row.date), accountName(row)].filter((part) => part !== '')
}

function rowFigure(row: WorkbookRow): string {
  const amount = row.netCash ?? row.gross
  if (amount !== null && row.currency !== null) return formatCurrencyAmount(amount, row.currency)
  return row.quantity !== null ? words.dryRun.units(formatQuantity(row.quantity, QUANTITY_PLACES)) : ''
}

function rowsLabel(rows: readonly WorkbookRow[]): string {
  if (rows.length === 0) return ''
  return rows.length === 1 ? words.dryRun.row(rows[0]!.fileRow) : words.dryRun.rows(rows.map((row) => row.fileRow).join(', '))
}

export function waitText(reason: WaitReason): string {
  return reason.kind === 'no-rate' || reason.kind === 'other-currency' ? words.waits[reason.kind](reason.currency) : words.waits[reason.kind]
}

function skipText(reason: SkipReason): string {
  switch (reason.kind) {
    case 'unknown-type':
      return words.skips.unknownType(reason.text)
    case 'unreadable':
      return words.skips.unreadable(WORKBOOK_COLUMNS[reason.column], reason.text)
    case 'missing':
      return words.skips.missing(WORKBOOK_COLUMNS[reason.column])
    case 'against-sign':
      return words.skips.againstSign
    case 'refused':
      return words.skips.refused(reason.reason)
    case 'below-a-cent':
      return words.skips.belowACent
  }
}
