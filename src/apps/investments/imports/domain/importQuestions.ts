import type { ImportedRecord } from './importedRecords'
import type { WorkbookRow } from './portfolioWorkbook'
import { bookingKey } from './reportKey'
import type { RowEntry } from './workbookEntries'
import { investmentLots } from '../../holdings/domain/lots'
import type { Instrument, InstrumentType, PriceSource } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { proposedTypedFactsOnly } from '../../prices/domain/factsBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, addDecimal, decimalOfText, decimalText, dividedDecimal, magnitude, roundedDecimal, scaledDecimal, subtractDecimal, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'
import type { AskedRow } from '../../../../shared/recipes/domain/runRecipe'

/** A split of `newUnits` for every `oldUnits`, both whole numbers. */
export interface SplitRatio {
  readonly newUnits: number
  readonly oldUnits: number
}

export interface AccountQuestion {
  /** The workbook's Account text. */
  readonly account: string
  readonly broker: string
  /** The account an earlier import of its rows wrote to, which answers the question unless the person says otherwise. */
  readonly known: RecordId | null
  readonly proposedName: string
  /** For a report's account no earlier import names, the account in Kuna whose records its rows look like most. */
  readonly likely: LikelyAccount | null
  /** The rows still to import that name it, and for an account Kuna does not know yet also those its start day leaves out. */
  readonly rows: number
  /** The earliest day of those rows. */
  readonly firstDay: CivilDate
}

export interface LikelyAccount {
  readonly account: RecordId
  /** How many of the rows look like one of its records. */
  readonly rows: number
}

/** A row that looks like a record Kuna has, for the person to say whether it is that record. */
export interface LookAlikeQuestion {
  /** The key of the row's entry. */
  readonly key: string
  readonly rows: readonly WorkbookRow[]
  readonly like: ImportedRecord
}

export interface InstrumentQuestion {
  /** The ISIN where the rows give one, else the Yahoo symbol, else the broker symbol. */
  readonly identity: string
  /** The instrument an earlier import of its rows wrote to, which answers the question unless the person says otherwise. */
  readonly known: RecordId | null
  /** An instrument in Kuna with the same ISIN, or with the same symbol where one of the two has no ISIN, offered first. */
  readonly offer: Instrument | null
  readonly proposal: Omit<Instrument, 'id'>
  /** Every symbol its rows book it under, such as a fund's two Xetra tickers. */
  readonly symbols: readonly string[]
  /** The rows still to import that name it. */
  readonly rows: number
}

export interface SplitQuestion {
  readonly key: string
  readonly identity: string
  readonly date: CivilDate
  /** The units the split's rows add, below zero for a reverse split. */
  readonly added: Decimal
  /** The units held across every account the day before, null while the instrument has no answer. */
  readonly held: Decimal | null
  /** The smallest whole numbers that turn what was held into what is held after, null when nothing was held. */
  readonly proposal: SplitRatio | null
}

export interface SpinOffQuestion {
  readonly key: string
  /** The instrument received. */
  readonly identity: string
  readonly date: CivilDate
  readonly quantity: Decimal
  /** The units received at the row's price, which `proposedCostShare` sets against a parent's cost. */
  readonly worth: Decimal
  readonly currency: CurrencyCode | null
  /** The parent's symbol or ISIN as the row's Spin-off from cell gives it, blank for none. */
  readonly from: string
  /** The row's Cost share, null when blank, unreadable or unclear, with the cell as written. */
  readonly costShare: Decimal | null
  /** The number of a Cost share cell below 1 with no percent sign, which could be either reading. */
  readonly costShareUnclear: Decimal | null
  readonly costShareText: string
}

export interface WorkbookQuestions {
  readonly accounts: readonly AccountQuestion[]
  readonly instruments: readonly InstrumentQuestion[]
  readonly splits: readonly SplitQuestion[]
  readonly spinOffs: readonly SpinOffQuestion[]
  readonly lookAlikes: readonly LookAlikeQuestion[]
}

/** What a rolling report held back from its rows. */
export interface ReportFacts {
  /** The id of the report's recipe, which a booked question's key starts with. */
  readonly recipe: string
  /**
   * Whether the report came by mail, which brings only the rows of the accounts it fills, from each one's start day. A
   * report the person uploads counts as by hand, so every row of it counts.
   */
  readonly mailed: boolean
  /** The rows its recipe would not guess at. */
  readonly asked: readonly AskedRow[]
  /** How many rows and questions were left out for being dated before their account's start day. */
  readonly beforeStart: number
  /** How many rows were left out for being of an account whose rows come in by hand. */
  readonly byHand: number
}

/** A question of a report that still waits, with the key a record booked from it keeps, or null where Book is not offered: a changed row a record already holds. */
export interface ReportQuestion extends AskedRow {
  readonly booking: string | null
}

/** How close a ratio of units has to come to whole numbers to be proposed as a split. */
const SPLIT_TOLERANCE = decimalOfText('0.0001')!
const LARGEST_OLD_UNITS = 50

/**
 * The questions of a report that still wait. One a record was booked from goes, since that record holds its booking key.
 * A changed row stays, with Hold and Leave out, and is offered Book only while no record holds its key.
 */
export function waitingQuestions(report: ReportFacts, keyed: ReadonlyMap<string, ImportedRecord>): ReportQuestion[] {
  return report.asked.flatMap((question): ReportQuestion[] => {
    const booking = bookingKey(report.recipe, question)
    if (!keyed.has(booking)) return [{ ...question, booking }]
    return question.why.kind === 'changed' ? [{ ...question, booking: null }] : []
  })
}

/** A new account is proposed under its broker's name, numbered from 2 when Kuna or another account of the file has that name. The Account text stays out of it. */
export function accountQuestions(
  entries: readonly RowEntry[],
  known: ReadonlyMap<string, RecordId>,
  likely: ReadonlyMap<string, LikelyAccount>,
  accounts: readonly InvestmentAccount[],
): AccountQuestion[] {
  const rowsOf = new Map<string, WorkbookRow[]>()
  entries.flatMap((entry) => entry.rows).forEach((row) => rowsOf.set(row.account, [...(rowsOf.get(row.account) ?? []), row]))
  const taken = new Set(accounts.map((account) => fold(account.name)))
  const freeName = (broker: string): string => {
    let name = broker
    for (let count = 2; broker !== '' && taken.has(fold(name)); count += 1) {
      name = `${broker} ${count}`
    }
    taken.add(fold(name))
    return name
  }
  return [...rowsOf.values()].map((rows) => {
    const row = rows[0]!
    const knownAccount = accounts.find((account) => account.id === known.get(row.account))
    return {
      account: row.account,
      broker: row.broker,
      known: knownAccount?.id ?? null,
      proposedName: knownAccount?.name ?? freeName(row.broker),
      likely: knownAccount === undefined ? (likely.get(row.account) ?? null) : null,
      rows: rows.length,
      firstDay: rows.reduce((first, each) => (each.date < first ? each.date : first), row.date),
    }
  })
}

/** The rows that name an instrument: trades, dividends, unit transfers, splits and spin-offs. */
const NAMES_INSTRUMENT: ReadonlySet<WorkbookRow['type']> = new Set(['BUY', 'SELL', 'DIVIDEND', 'TRANSFER OUT', 'TRANSFER IN', 'SPLIT', 'SPINOFF'])

export function instrumentQuestions(entries: readonly RowEntry[], book: InvestmentBook, known: ReadonlyMap<string, RecordId>, identityOf: (row: WorkbookRow) => string): InstrumentQuestion[] {
  const rowsOf = new Map<string, WorkbookRow[]>()
  const named = entries.flatMap((entry) => entry.rows).filter((row) => NAMES_INSTRUMENT.has(row.type))
  named.forEach((row) => rowsOf.set(identityOf(row), [...(rowsOf.get(identityOf(row)) ?? []), row]))
  const spunOffFrom = new Set(named.filter((row) => row.type === 'SPINOFF' && row.spinOffFrom !== '').map((row) => fold(row.spinOffFrom)))
  return [...rowsOf].map(([identity, rows]) => {
    const isin = rows.find((row) => row.isin !== '')?.isin ?? null
    const symbols = rows.flatMap((row) => [row.yahooSymbol, row.brokerSymbol]).filter((symbol) => symbol !== '')
    // Only a company spins off, and what it spins off is a company's share too. Nothing else in the workbook says what an instrument is.
    const share = rows.some((row) => row.type === 'SPINOFF') || [isin ?? '', ...symbols].some((identifier) => identifier !== '' && spunOffFrom.has(fold(identifier)))
    const offer =
      book.instruments.find((instrument) => isin !== null && instrument.isin === isin) ??
      book.instruments.find((instrument) => (isin === null || instrument.isin === null) && symbols.some((symbol) => fold(symbol) === fold(instrument.symbol))) ??
      null
    const booked = [...new Set(rows.map((row) => row.yahooSymbol || row.brokerSymbol).filter((symbol) => symbol !== ''))]
    return { identity, known: known.get(identity) ?? null, offer, proposal: proposedInstrument(rows, isin, share ? 'share' : null), symbols: booked, rows: rows.length }
  })
}

/**
 * A first guess the person corrects: stocks of the type the workbook shows, named by its symbol, quoting in the currency of
 * its trades, priced by Twelve Data for a US symbol and by Alpha Vantage for Xetra and Amsterdam, by hand otherwise,
 * with Don't fetch facts on where no vendor would send its facts.
 */
function proposedInstrument(rows: readonly WorkbookRow[], isin: string | null, type: InstrumentType | null): Omit<Instrument, 'id'> {
  const symbol = rows.find((row) => row.yahooSymbol !== '')?.yahooSymbol ?? rows.find((row) => row.brokerSymbol !== '')?.brokerSymbol ?? ''
  const traded = rows.find((row) => (row.type === 'BUY' || row.type === 'SELL') && row.currency !== null) ?? rows.find((row) => row.currency !== null)
  const [base = '', suffix = ''] = symbol.toUpperCase().split('.')
  const listing: { readonly exchange: string | null; readonly prices: PriceSource; readonly sourceSymbol: string } =
    suffix === ''
      ? { exchange: null, prices: 'twelvedata', sourceSymbol: base }
      : suffix === 'DE'
        ? { exchange: 'XETR', prices: 'alphavantage', sourceSymbol: `${base}.DEX` }
        : suffix === 'AS'
          ? { exchange: 'XAMS', prices: 'alphavantage', sourceSymbol: `${base}.AMS` }
          : { exchange: null, prices: 'manual', sourceSymbol: '' }
  return {
    name: rows.find((row) => row.name !== '')?.name ?? symbol,
    type,
    class: 'stocks',
    isin,
    symbol,
    exchange: listing.exchange,
    currency: traded?.currency ?? EURO,
    quoted: { kind: 'unit' },
    prices: listing.prices,
    sourceSymbol: listing.sourceSymbol,
    benchmark: false,
    sector: null,
    country: null,
    ter: null,
    distribution: null,
    typedFactsOnly: proposedTypedFactsOnly({ ...listing, type }),
    note: '',
  }
}

/** The ratio proposed from the units the split's rows add over the units held the day before, in the smallest whole numbers. */
export function splitQuestion(entry: RowEntry, planned: InvestmentBook, instrumentOf: (row: WorkbookRow) => Instrument | null, identityOf: (row: WorkbookRow) => string): SplitQuestion {
  const row = entry.rows[0]
  const added = sumDecimal(entry.rows.map((member) => member.quantity ?? DECIMAL_ZERO))
  const instrument = instrumentOf(row)
  const lots = instrument === null ? undefined : investmentLots(bookBefore(planned, row.date)).get(instrument.id)
  const held = instrument === null ? null : sumDecimal((lots?.open ?? []).map((lot) => lot.quantity))
  return { key: entry.key, identity: identityOf(row), date: row.date, added, held, proposal: held === null || held <= DECIMAL_ZERO ? null : splitRatio(held, addDecimal(held, added)) }
}

function splitRatio(before: Decimal, after: Decimal): SplitRatio | null {
  for (let oldUnits = 1; oldUnits <= LARGEST_OLD_UNITS; oldUnits += 1) {
    const newUnits = dividedDecimal(scaledDecimal(after, BigInt(oldUnits), 1n), before)
    const whole = roundedDecimal(newUnits, 0)
    if (whole > DECIMAL_ZERO && magnitude(subtractDecimal(newUnits, whole)) <= SPLIT_TOLERANCE) {
      return { newUnits: Number(decimalText(whole)), oldUnits }
    }
  }
  return null
}

/** The records dated before the day, which the lots of the day before are worked out from. */
export function bookBefore(book: InvestmentBook, day: CivilDate): InvestmentBook {
  const before = <Dated extends { readonly date: CivilDate }>(records: readonly Dated[]): Dated[] => records.filter((record) => record.date < day)
  return { ...book, trades: before(book.trades), income: before(book.income), transfers: before(book.transfers), splits: before(book.splits), spinOffs: before(book.spinOffs) }
}
