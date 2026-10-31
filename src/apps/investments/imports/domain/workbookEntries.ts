import type { WorkbookRow, WorkbookType } from './portfolioWorkbook'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import { magnitude } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { factKey } from '../../../../shared/text/factKey'
import { fold } from '../../../../shared/text/fold'

/** The rows that become one record: the row that names it, then its partners, such as a dividend's withholding rows. */
export interface RowEntry {
  readonly rows: readonly [WorkbookRow, ...WorkbookRow[]]
  /** A lone row's key, or the keys of all its rows hashed together, so a partner added later makes it a new entry. */
  readonly key: string
}

/** The income a withholding row can belong to. */
const WITHHELD_FROM: ReadonlySet<WorkbookType> = new Set(['DIVIDEND', 'INTEREST', 'STOCK YIELD INCOME'])

/** Whether two rows name the same instrument, by ISIN where both give one, else by Yahoo symbol, else by broker symbol. Two rows that name none match. */
export function sameInstrument(first: WorkbookRow, second: WorkbookRow): boolean {
  if (first.isin !== '' && second.isin !== '') {
    return first.isin === second.isin
  }
  if (first.yahooSymbol !== '' && second.yahooSymbol !== '') {
    return fold(first.yahooSymbol) === fold(second.yahooSymbol)
  }
  if (first.brokerSymbol !== '' && second.brokerSymbol !== '') {
    return fold(first.brokerSymbol) === fold(second.brokerSymbol)
  }
  return [first, second].every((row) => row.isin === '' && row.yahooSymbol === '' && row.brokerSymbol === '')
}

/**
 * The rows grouped into the records they become, in the file's order of each group's first row, each group's rows in
 * the file's order. A withholding row joins the income of its account, day and instrument whose note shares the longest
 * start with its own, one with no withholding yet on a tie. Tax taken joins only income that pays in. A withholding row
 * that pays in, a refund, joins only a reversal of income or an income that tax was withheld from, so a refund with
 * none to lower stays alone. A transfer out joins a transfer in of another account with the same
 * instrument and quantity, and an internal cash transfer out its opposite in the same currency, the nearest by date.
 * Split rows of one instrument and day are one split. A row that needs a partner and has none stays alone.
 */
export function workbookEntries(rows: readonly WorkbookRow[]): RowEntry[] {
  const partners = new Map<WorkbookRow, WorkbookRow[]>()
  const taken = new Set<WorkbookRow>()
  const join = (row: WorkbookRow, partner: WorkbookRow): void => {
    partners.set(row, [...(partners.get(row) ?? []), partner])
    taken.add(partner)
  }
  const ofType = (type: WorkbookType): WorkbookRow[] => rows.filter((row) => row.type === type)

  const withholdings = ofType('WITHHOLDING TAX')
  const refunds = withholdings.filter(isWithheldRefund)
  for (const withholding of [...withholdings.filter((row) => !isWithheldRefund(row)), ...refunds]) {
    const candidates = rows.filter(
      (row) =>
        WITHHELD_FROM.has(row.type) &&
        row.account === withholding.account &&
        row.date === withholding.date &&
        sameInstrument(row, withholding) &&
        (isWithheldRefund(withholding) ? isIncomeReversal(row) || partners.has(row) : !isIncomeReversal(row)),
    )
    const shared = (row: WorkbookRow): number => sharedStart(fold(row.note), fold(withholding.note))
    const [best] = [...candidates].sort((first, second) => shared(second) - shared(first) || Number(partners.has(first)) - Number(partners.has(second)))
    if (best !== undefined) {
      join(best, withholding)
    }
  }
  for (const out of ofType('TRANSFER OUT')) {
    const into = nearest(
      out,
      ofType('TRANSFER IN').filter((row) => !taken.has(row) && row.account !== out.account && sameInstrument(row, out) && sameMagnitude(row.quantity, out.quantity)),
    )
    if (into !== undefined) {
      join(out, into)
    }
  }
  const cashTransfers = ofType('INTERNAL CASH TRANSFER')
  for (const out of cashTransfers.filter((row) => (row.netCash ?? row.gross ?? 0n) < 0n)) {
    const amount = out.netCash ?? out.gross
    const into = nearest(
      out,
      cashTransfers.filter(
        (row) => !taken.has(row) && row.account !== out.account && row.currency === out.currency && (row.netCash ?? row.gross ?? 0n) > 0n && sameMagnitude(row.netCash ?? row.gross, amount),
      ),
    )
    if (into !== undefined) {
      join(out, into)
    }
  }
  const splits = ofType('SPLIT')
  splits.forEach((split, index) => {
    const first = splits.slice(0, index).find((earlier) => !taken.has(earlier) && earlier.date === split.date && sameInstrument(earlier, split))
    if (first !== undefined) {
      join(first, split)
    }
  })

  const position = new Map(rows.map((row, index) => [row, index]))
  return rows
    .filter((row) => !taken.has(row))
    .map((row) => {
      const joined = (partners.get(row) ?? []).sort((first, second) => position.get(first)! - position.get(second)!)
      return { rows: [row, ...joined], key: joined.length === 0 ? row.key : factKey([row, ...joined].map((member) => member.key)) }
    })
}

/** The income whose row pays out to reverse an earlier payment. Interest that pays out is debit interest instead. */
const REVERSIBLE: ReadonlySet<WorkbookType> = new Set(['DIVIDEND', 'STOCK YIELD INCOME', 'REFERRAL CREDIT'])

/** An income row that pays out, which reverses an earlier payment the broker booked. */
export function isIncomeReversal(row: WorkbookRow): boolean {
  return REVERSIBLE.has(row.type) && (row.gross ?? row.netCash ?? 0n) < 0n
}

/** A withholding row that pays in, which gives back tax withheld. */
export function isWithheldRefund(row: WorkbookRow): boolean {
  return row.type === 'WITHHOLDING TAX' && (row.netCash ?? row.gross ?? 0n) > 0n
}

function sameMagnitude(first: Decimal | null, second: Decimal | null): boolean {
  return first !== null && second !== null && magnitude(first) === magnitude(second)
}

/** The candidate nearest the row by date, the first in the file's order on a tie. */
function nearest(row: WorkbookRow, candidates: readonly WorkbookRow[]): WorkbookRow | undefined {
  const distance = (candidate: WorkbookRow): number => Math.abs(daysBetween(row.date, candidate.date))
  return candidates.reduce<WorkbookRow | undefined>((best, candidate) => (best === undefined || distance(candidate) < distance(best) ? candidate : best), undefined)
}

function sharedStart(first: string, second: string): number {
  let length = 0
  while (length < first.length && length < second.length && first[length] === second[length]) {
    length += 1
  }
  return length
}
