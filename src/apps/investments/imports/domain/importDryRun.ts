import type { RoundedCell, SkipReason, SkippedRow, WorkbookColumn, WorkbookRow } from './portfolioWorkbook'
import { magnitude, workbookEntries } from './workbookEntries'
import type { RowEntry } from './workbookEntries'
import { words } from './words'
import { investmentLots } from '../../holdings/domain/lots'
import { tradeWorth } from '../../holdings/domain/quoting'
import type { RateBook } from '../../prices/domain/rateBook'
import type { CashMovement, CashMovementKind } from '../../workbook/domain/cashMovement'
import type { Exchange } from '../../workbook/domain/exchange'
import type { Income } from '../../workbook/domain/income'
import type { Instrument, PriceSource } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { CASH_MOVEMENT_RECORDS, EXCHANGE_RECORDS, INCOME_RECORDS, SPIN_OFF_RECORDS, SPLIT_RECORDS, TRADE_RECORDS, TRANSFER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Split } from '../../workbook/domain/split'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import {
  DECIMAL_ZERO,
  addDecimal,
  decimalOfText,
  decimalText,
  dividedDecimal,
  negateDecimal,
  roundedDecimal,
  scaledDecimal,
  subtractDecimal,
  sumDecimal,
  timesDecimal,
} from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'

/** A split of `newUnits` for every `oldUnits`, both whole numbers. */
export interface SplitRatio {
  readonly newUnits: number
  readonly oldUnits: number
}

export interface SpinOffAnswer {
  readonly parent: RecordId
  /** The fraction of the parent's cost that moves to the units received. */
  readonly costShare: Decimal
}

/** What the person has said so far. A new account or instrument comes with its own id, so two of the workbook's can name the same one. */
export interface WorkbookAnswers {
  /** By the workbook's Account text. */
  readonly accounts: ReadonlyMap<string, InvestmentAccount>
  /** By the instrument's identity in the workbook, as its question gives it. */
  readonly instruments: ReadonlyMap<string, Instrument>
  /** By the key of the split's entry. */
  readonly splits: ReadonlyMap<string, SplitRatio>
  /** By the key of the spin-off's entry. */
  readonly spinOffs: ReadonlyMap<string, SpinOffAnswer>
  /** The tax withheld from a dividend its broker booked net, by the key of the dividend's entry. */
  readonly withheld: ReadonlyMap<string, Decimal>
}

export const NO_ANSWERS: WorkbookAnswers = { accounts: new Map(), instruments: new Map(), splits: new Map(), spinOffs: new Map(), withheld: new Map() }

export interface DryRunInputs {
  /** The records already in Kuna. */
  readonly book: InvestmentBook
  /** The ECB rates of the prices file, which every foreign row but a Revolut top-up carries. */
  readonly rates: RateBook
  readonly answers: WorkbookAnswers
}

/** Why an entry is not imported yet. Each clears once the person answers, the missing row arrives or the job writes the rate. */
export type WaitReason =
  | { readonly kind: 'account' }
  | { readonly kind: 'instrument' }
  | { readonly kind: 'split-ratio' }
  | { readonly kind: 'spin-off' }
  | { readonly kind: 'no-partner' }
  | { readonly kind: 'no-rate'; readonly currency: CurrencyCode }
  | { readonly kind: 'other-currency'; readonly currency: CurrencyCode }
  | { readonly kind: 'same-account' }
  /** A sale or transfer of more units than its account holds on its day. */
  | { readonly kind: 'beyond-held' }

export type ImportedRecord =
  | { readonly kind: 'trade'; readonly record: Trade }
  | { readonly kind: 'income'; readonly record: Income }
  | { readonly kind: 'cash-movement'; readonly record: CashMovement }
  | { readonly kind: 'exchange'; readonly record: Exchange }
  | { readonly kind: 'transfer'; readonly record: Transfer }
  | { readonly kind: 'split'; readonly record: Split }
  | { readonly kind: 'spin-off'; readonly record: SpinOff }

export type EntryOutcome = { readonly kind: 'new'; readonly imported: ImportedRecord } | { readonly kind: 'in-kuna' } | { readonly kind: 'waiting'; readonly reason: WaitReason }

export interface DryRunEntry extends RowEntry {
  readonly outcome: EntryOutcome
}

export interface AccountQuestion {
  /** The workbook's Account text. */
  readonly account: string
  readonly broker: string
  /** The account an earlier import of its rows wrote to, which answers the question unless the person says otherwise. */
  readonly known: RecordId | null
  readonly proposedName: string
}

export interface InstrumentQuestion {
  /** The ISIN where the rows give one, else the Yahoo symbol, else the broker symbol. */
  readonly identity: string
  /** The instrument an earlier import of its rows wrote to, which answers the question unless the person says otherwise. */
  readonly known: RecordId | null
  /** An instrument in Kuna with the same ISIN or symbol, offered first. */
  readonly offer: Instrument | null
  readonly proposal: Omit<Instrument, 'id'>
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
}

export interface NetDividendQuestion {
  readonly key: string
  readonly identity: string
  readonly date: CivilDate
  readonly currency: CurrencyCode
  /** What the broker booked, after the tax withheld. */
  readonly net: Decimal
}

export interface WorkbookQuestions {
  readonly accounts: readonly AccountQuestion[]
  readonly instruments: readonly InstrumentQuestion[]
  readonly splits: readonly SplitQuestion[]
  readonly spinOffs: readonly SpinOffQuestion[]
  /** Dividends booked net, which import with a note until the person types the tax withheld. */
  readonly netDividends: readonly NetDividendQuestion[]
}

/** A trade whose fees from its net cash come out below zero or differ from its Commission cell by more than a cent. The fees from the net cash are imported. */
export interface CommissionDifference {
  readonly fileRow: number
  readonly commission: Decimal | null
  readonly fees: Decimal
}

export interface WorkbookDryRun {
  readonly entries: readonly DryRunEntry[]
  readonly skipped: readonly SkippedRow[]
  readonly rounded: readonly RoundedCell[]
  /** Records an earlier import of the workbook wrote that the file no longer has, for the person to keep or delete. */
  readonly gone: readonly ImportedRecord[]
  readonly questions: WorkbookQuestions
  readonly commissionDifferences: readonly CommissionDifference[]
  /** What Import writes in one unit of work: the new accounts and instruments the new entries name, then their records. */
  readonly added: InvestmentBook
  /** The records in Kuna with those added. */
  readonly planned: InvestmentBook
}

export interface WorkbookRows {
  readonly rows: readonly WorkbookRow[]
  readonly skipped: readonly SkippedRow[]
  readonly rounded: readonly RoundedCell[]
}

const CENT = decimalOfText('0.01')!
const ONE = decimalOfText('1')!
/** How close a ratio of units has to come to whole numbers to be proposed as a split. */
const SPLIT_TOLERANCE = decimalOfText('0.0001')!
const LARGEST_OLD_UNITS = 50

const CASH_KINDS: Partial<Record<WorkbookRow['type'], CashMovementKind>> = { DEPOSIT: 'deposit', WITHDRAWAL: 'withdrawal', FEE: 'fee', 'FEE REFUND': 'fee-refund' }

class EntryWaits extends Error {
  readonly reason: WaitReason

  constructor(reason: WaitReason) {
    super(reason.kind)
    this.reason = reason
  }
}

class EntrySkipped extends Error {
  readonly fileRow: number
  readonly reason: SkipReason

  constructor(fileRow: number, reason: SkipReason) {
    super(reason.kind)
    this.fileRow = fileRow
    this.reason = reason
  }
}

/**
 * What importing the workbook's rows would do, written nowhere. An entry whose key a record in Kuna carries is in Kuna
 * already, so a second import of the same file adds nothing. Every other entry becomes a record once its account and
 * instrument are answered, its partner is found, its split or spin-off is answered and the ECB series has a rate for a
 * foreign row's day. A sale or transfer beyond what its account holds waits for the row that is missing. A record an
 * earlier import wrote, of an account and dates the file covers, whose key the file no longer gives, is listed as gone.
 */
export function workbookDryRun(reading: WorkbookRows, inputs: DryRunInputs): WorkbookDryRun {
  const { book, answers } = inputs
  const entries = workbookEntries(reading.rows)
  const keyed = importedByKey(book)
  const identityOf = identities(reading.rows)
  const inKuna = entries.filter((entry) => keyed.has(entry.key))
  const knownAccounts = knownAccountsOf(inKuna, keyed)
  const knownInstruments = knownInstrumentsOf(inKuna, keyed, identityOf)
  const accountOf = (row: WorkbookRow): InvestmentAccount | null => answers.accounts.get(row.account) ?? book.accounts.find((account) => account.id === knownAccounts.get(row.account)) ?? null
  const accountsSoFar = [...book.accounts, ...answers.accounts.values()]
  const instrumentsSoFar = [...book.instruments, ...answers.instruments.values()]
  const instrumentOf = (row: WorkbookRow): Instrument | null =>
    answers.instruments.get(identityOf(row)) ?? book.instruments.find((instrument) => instrument.id === knownInstruments.get(identityOf(row))) ?? null

  const skipped: SkippedRow[] = [...reading.skipped]
  const differences: CommissionDifference[] = []
  const questions: Mapping['questions'] = { netDividends: [], spinOffs: [] }
  const mapping: Mapping = { inputs, accountOf, instrumentOf, identityOf, differences, questions, instruments: instrumentsSoFar }

  const firstPass = entries.flatMap((entry): { entry: RowEntry; outcome: EntryOutcome }[] => {
    if (keyed.has(entry.key)) {
      return [{ entry, outcome: { kind: 'in-kuna' } }]
    }
    try {
      return [{ entry, outcome: { kind: 'new', imported: importedRecord(entry, mapping) } }]
    } catch (failure) {
      if (failure instanceof EntryWaits) {
        return [{ entry, outcome: { kind: 'waiting', reason: failure.reason } }]
      }
      if (failure instanceof EntrySkipped) {
        skipped.push({ fileRow: failure.fileRow, reason: failure.reason })
        return []
      }
      throw failure
    }
  })

  const plannedOf = (outcomes: readonly { outcome: EntryOutcome }[]): InvestmentBook =>
    withRecords(
      book,
      outcomes.flatMap(({ outcome }) => (outcome.kind === 'new' ? [outcome.imported] : [])),
      accountsSoFar,
      instrumentsSoFar,
    )
  const refused = new Set([...investmentLots(plannedOf(firstPass)).values()].flatMap((lots) => lots.refused.map((record) => record.id)))
  const outcomes = firstPass.map(({ entry, outcome }): DryRunEntry => {
    const beyondHeld = outcome.kind === 'new' && (outcome.imported.kind === 'trade' || outcome.imported.kind === 'transfer') && refused.has(outcome.imported.record.id)
    return { ...entry, outcome: beyondHeld ? { kind: 'waiting', reason: { kind: 'beyond-held' } } : outcome }
  })
  const planned = plannedOf(outcomes)
  const toImport = outcomes.filter((entry) => entry.outcome.kind !== 'in-kuna')

  return {
    entries: outcomes,
    skipped: skipped.sort((first, second) => first.fileRow - second.fileRow),
    rounded: reading.rounded,
    gone: goneRecords(reading.rows, entries, keyed, accountOf),
    questions: {
      accounts: accountQuestions(toImport, knownAccounts),
      instruments: instrumentQuestions(toImport, book, knownInstruments, identityOf),
      splits: toImport.filter((entry) => entry.rows[0].type === 'SPLIT').map((entry) => splitQuestion(entry, planned, instrumentOf, identityOf)),
      spinOffs: questions.spinOffs,
      netDividends: questions.netDividends,
    },
    commissionDifferences: differences,
    added: addedRecords(book, planned),
    planned,
  }
}

/**
 * The fraction of a parent's cost that a spin-off's units carry: their worth at the row's price over the cost of the
 * parent's lots open the day before, in the parent's currency. Null when the parent had no cost then, or when the
 * fraction is not above zero and below one.
 */
export function proposedCostShare(planned: InvestmentBook, parent: RecordId, question: SpinOffQuestion): Decimal | null {
  const lots = investmentLots(bookBefore(planned, question.date)).get(parent)
  const cost = sumDecimal((lots?.open ?? []).map((lot) => lot.costInCurrency))
  if (cost <= DECIMAL_ZERO) {
    return null
  }
  const share = dividedDecimal(question.worth, cost)
  return share > DECIMAL_ZERO && share < ONE ? share : null
}

interface Mapping {
  readonly inputs: DryRunInputs
  readonly accountOf: (row: WorkbookRow) => InvestmentAccount | null
  readonly instrumentOf: (row: WorkbookRow) => Instrument | null
  readonly identityOf: (row: WorkbookRow) => string
  readonly differences: CommissionDifference[]
  readonly questions: { readonly netDividends: NetDividendQuestion[]; readonly spinOffs: SpinOffQuestion[] }
  readonly instruments: readonly Instrument[]
}

function importedRecord(entry: RowEntry, mapping: Mapping): ImportedRecord {
  const row = entry.rows[0]
  const cashKind = CASH_KINDS[row.type]
  if (cashKind !== undefined) {
    return { kind: 'cash-movement', record: cashMovementOf(row, cashKind, entry.key, mapping) }
  }
  switch (row.type) {
    case 'BUY':
    case 'SELL':
      return { kind: 'trade', record: tradeOf(row, entry.key, mapping) }
    case 'DIVIDEND':
    case 'INTEREST':
    case 'STOCK YIELD INCOME':
    case 'REFERRAL CREDIT':
      return { kind: 'income', record: incomeOf(entry, mapping) }
    case 'FX':
      return { kind: 'exchange', record: exchangeOf(row, entry.key, mapping) }
    case 'TRANSFER OUT':
    case 'INTERNAL CASH TRANSFER':
      return { kind: 'transfer', record: transferOf(entry, mapping) }
    case 'SPLIT':
      return { kind: 'split', record: splitOf(entry, mapping) }
    case 'SPINOFF':
      return { kind: 'spin-off', record: spinOffOf(row, entry.key, mapping) }
    default:
      // A withholding row or a transfer in that pairing left alone.
      throw new EntryWaits({ kind: 'no-partner' })
  }
}

function required<Column extends WorkbookColumn & keyof WorkbookRow>(row: WorkbookRow, column: Column): NonNullable<WorkbookRow[Column]> {
  const value = row[column]
  if (value === null || value === '') {
    throw new EntrySkipped(row.fileRow, { kind: 'missing', column })
  }
  return value as NonNullable<WorkbookRow[Column]>
}

function accountFor(row: WorkbookRow, mapping: Mapping): InvestmentAccount {
  const account = mapping.accountOf(row)
  if (account === null) {
    throw new EntryWaits({ kind: 'account' })
  }
  return account
}

function instrumentFor(row: WorkbookRow, mapping: Mapping): Instrument {
  const instrument = mapping.instrumentOf(row)
  if (instrument === null) {
    throw new EntryWaits({ kind: 'instrument' })
  }
  return instrument
}

/** The ECB rate of the day, or of the latest earlier day it published one. Null for euros. */
function ecbRate(currency: CurrencyCode, date: CivilDate, mapping: Mapping): Decimal | null {
  if (currency === EURO) {
    return null
  }
  const rate = mapping.inputs.rates.unitsPerEuroOnOrBefore(currency, date)
  if (rate === null) {
    throw new EntryWaits({ kind: 'no-rate', currency })
  }
  return rate
}

/** A buy's fees are what its net cash paid beyond quantity × price, a sale's what quantity × price got beyond its net cash. Without a net cash they are the Commission cell. */
function tradeOf(row: WorkbookRow, key: string, mapping: Mapping): Trade {
  const quantity = magnitude(required(row, 'quantity'))
  const price = required(row, 'price')
  const currency = required(row, 'currency')
  const account = accountFor(row, mapping)
  const instrument = instrumentFor(row, mapping)
  if (instrument.currency !== currency) {
    throw new EntryWaits({ kind: 'other-currency', currency })
  }
  const side = row.type === 'BUY' ? 'buy' : 'sell'
  const worth = tradeWorth(instrument.quoted, quantity, price)
  const fees = row.netCash === null ? row.commission : side === 'buy' ? subtractDecimal(magnitude(row.netCash), worth) : subtractDecimal(worth, magnitude(row.netCash))
  if (row.netCash !== null && fees !== null && (fees < DECIMAL_ZERO || magnitude(subtractDecimal(fees, row.commission ?? DECIMAL_ZERO)) > CENT)) {
    mapping.differences.push({ fileRow: row.fileRow, commission: row.commission, fees })
  }
  return {
    id: recordIdOf(TRADE_RECORDS, newRecordId()),
    account: account.id,
    instrument: instrument.id,
    side,
    date: row.date,
    quantity,
    price,
    fees,
    rate: ecbRate(currency, row.date, mapping),
    accrued: null,
    importKey: key,
    note: row.note,
  }
}

/**
 * Income with the tax its withholding rows took. A Revolut dividend comes booked net of the tax withheld, so until the
 * person types that tax its gross is its net and its note says so.
 */
function incomeOf(entry: RowEntry, mapping: Mapping): Income {
  const [row, ...withholdings] = entry.rows
  const currency = required(row, 'currency')
  const received = magnitude(row.gross ?? required(row, 'netCash'))
  const withheldRows = negateDecimal(sumDecimal(withholdings.map((withholding) => withholding.netCash ?? required(withholding, 'gross'))))
  const isDividend = row.type === 'DIVIDEND'
  const bookedNet = isDividend && withholdings.length === 0 && fold(row.broker) === 'REVOLUT'
  if (bookedNet) {
    mapping.questions.netDividends.push({ key: entry.key, identity: mapping.identityOf(row), date: row.date, currency, net: received })
  }
  const account = accountFor(row, mapping)
  const instrument = isDividend ? instrumentFor(row, mapping) : null
  const rate = ecbRate(currency, row.date, mapping)
  const typed = bookedNet ? mapping.inputs.answers.withheld.get(entry.key) : undefined
  const label = row.type === 'STOCK YIELD INCOME' ? words.stockYieldIncome : row.type === 'REFERRAL CREDIT' ? words.referralCredit : bookedNet && typed === undefined ? words.bookedNet : ''
  return {
    id: recordIdOf(INCOME_RECORDS, newRecordId()),
    account: account.id,
    kind: isDividend ? 'dividend' : row.type === 'INTEREST' ? 'interest' : 'other',
    instrument: instrument?.id ?? null,
    date: row.date,
    currency,
    gross: typed === undefined ? received : addDecimal(received, typed),
    withheld: typed ?? withheldRows,
    rate,
    importKey: entry.key,
    note: [label, row.note].filter((part) => part !== '').join('. '),
  }
}

/** A deposit or withdrawal carries the rate Revolut changed it at, where the row gives one, and anything else the ECB rate. */
function cashMovementOf(row: WorkbookRow, kind: CashMovementKind, key: string, mapping: Mapping): CashMovement {
  const amount = magnitude(row.netCash ?? required(row, 'gross'))
  const currency = required(row, 'currency')
  const account = accountFor(row, mapping)
  const ownRate = (kind === 'deposit' || kind === 'withdrawal') && currency !== EURO ? row.revolutRate : null
  return {
    id: recordIdOf(CASH_MOVEMENT_RECORDS, newRecordId()),
    account: account.id,
    kind,
    date: row.date,
    currency,
    amount,
    rate: ownRate ?? ecbRate(currency, row.date, mapping),
    importKey: key,
    note: row.note,
  }
}

/** The net cash is one leg and the FX counter amount the other, each after fees. The Commission cell is the exchange's fee in euros. */
function exchangeOf(row: WorkbookRow, key: string, mapping: Mapping): Exchange {
  const net = required(row, 'netCash')
  const currency = required(row, 'currency')
  const counter = magnitude(required(row, 'counterAmount'))
  const counterCurrency = required(row, 'counterCurrency')
  const account = accountFor(row, mapping)
  const sells = net < DECIMAL_ZERO
  return {
    id: recordIdOf(EXCHANGE_RECORDS, newRecordId()),
    account: account.id,
    date: row.date,
    sold: sells ? magnitude(net) : counter,
    soldCurrency: sells ? currency : counterCurrency,
    bought: sells ? counter : net,
    boughtCurrency: sells ? counterCurrency : currency,
    fees: row.commission !== null && row.commission > DECIMAL_ZERO ? { amount: row.commission, currency: EURO } : null,
    importKey: key,
    note: row.note,
  }
}

function transferOf(entry: RowEntry, mapping: Mapping): Transfer {
  const [out, into] = entry.rows
  if (into === undefined) {
    throw new EntryWaits({ kind: 'no-partner' })
  }
  const moved: Transfer['moved'] =
    out.type === 'TRANSFER OUT'
      ? { kind: 'units', instrument: instrumentFor(out, mapping).id, quantity: magnitude(required(out, 'quantity')) }
      : { kind: 'cash', currency: required(out, 'currency'), amount: magnitude(out.netCash ?? required(out, 'gross')) }
  const from = accountFor(out, mapping)
  const to = accountFor(into, mapping)
  if (from.id === to.id) {
    throw new EntryWaits({ kind: 'same-account' })
  }
  return { id: recordIdOf(TRANSFER_RECORDS, newRecordId()), from: from.id, to: to.id, date: out.date, moved, importKey: entry.key, note: out.note }
}

function splitOf(entry: RowEntry, mapping: Mapping): Split {
  const row = entry.rows[0]
  const instrument = instrumentFor(row, mapping)
  const ratio = mapping.inputs.answers.splits.get(entry.key)
  if (ratio === undefined) {
    throw new EntryWaits({ kind: 'split-ratio' })
  }
  return { id: recordIdOf(SPLIT_RECORDS, newRecordId()), instrument: instrument.id, date: row.date, ...ratio, importKey: entry.key, note: row.note }
}

/** The row names the instrument received. Its parent and the share of the parent's cost come from the person. */
function spinOffOf(row: WorkbookRow, key: string, mapping: Mapping): SpinOff {
  const quantity = magnitude(required(row, 'quantity'))
  const price = required(row, 'price')
  mapping.questions.spinOffs.push({ key, identity: mapping.identityOf(row), date: row.date, quantity, worth: timesDecimal(quantity, price) })
  const received = instrumentFor(row, mapping)
  const answer = mapping.inputs.answers.spinOffs.get(key)
  const parent = mapping.instruments.find((instrument) => instrument.id === answer?.parent)
  if (answer === undefined || parent === undefined) {
    throw new EntryWaits({ kind: 'spin-off' })
  }
  if (parent.currency !== received.currency) {
    throw new EntryWaits({ kind: 'other-currency', currency: received.currency })
  }
  return { id: recordIdOf(SPIN_OFF_RECORDS, newRecordId()), instrument: parent.id, received: received.id, date: row.date, quantity, costShare: answer.costShare, importKey: key, note: row.note }
}

/**
 * Each row's instrument identity: its ISIN, else the ISIN another row gives its Yahoo symbol, else the Yahoo symbol,
 * else the broker symbol. So a fund booked under two symbols with one ISIN is one instrument.
 */
function identities(rows: readonly WorkbookRow[]): (row: WorkbookRow) => string {
  const isinOfSymbol = new Map(rows.filter((row) => row.isin !== '' && row.yahooSymbol !== '').map((row) => [fold(row.yahooSymbol), row.isin]))
  return (row) => (row.isin !== '' ? row.isin : (isinOfSymbol.get(fold(row.yahooSymbol)) ?? (row.yahooSymbol !== '' ? fold(row.yahooSymbol) : fold(row.brokerSymbol))))
}

function importedByKey(book: InvestmentBook): Map<string, ImportedRecord> {
  const all: ImportedRecord[] = [
    ...book.trades.map((record) => ({ kind: 'trade', record }) as const),
    ...book.income.map((record) => ({ kind: 'income', record }) as const),
    ...book.cashMovements.map((record) => ({ kind: 'cash-movement', record }) as const),
    ...book.exchanges.map((record) => ({ kind: 'exchange', record }) as const),
    ...book.transfers.map((record) => ({ kind: 'transfer', record }) as const),
    ...book.splits.map((record) => ({ kind: 'split', record }) as const),
    ...book.spinOffs.map((record) => ({ kind: 'spin-off', record }) as const),
  ]
  return new Map(all.flatMap((imported) => (imported.record.importKey === null ? [] : [[imported.record.importKey, imported]])))
}

/** The account each of the workbook's Account texts was imported into, read off the records its rows already made. */
function knownAccountsOf(inKuna: readonly RowEntry[], keyed: ReadonlyMap<string, ImportedRecord>): Map<string, RecordId> {
  const known = new Map<string, RecordId>()
  for (const entry of inKuna) {
    const imported = keyed.get(entry.key)!
    const accounts = imported.kind === 'transfer' ? [imported.record.from, imported.record.to] : 'account' in imported.record ? [imported.record.account] : []
    accounts.forEach((account, index) => {
      const row = entry.rows[index]
      if (row !== undefined) {
        known.set(row.account, account)
      }
    })
  }
  return known
}

/** The instrument each identity was imported as, read off the records its rows already made. */
function knownInstrumentsOf(inKuna: readonly RowEntry[], keyed: ReadonlyMap<string, ImportedRecord>, identityOf: (row: WorkbookRow) => string): Map<string, RecordId> {
  const known = new Map<string, RecordId>()
  for (const entry of inKuna) {
    const imported = keyed.get(entry.key)!
    const instrument =
      imported.kind === 'trade' || imported.kind === 'split' || imported.kind === 'income'
        ? imported.record.instrument
        : imported.kind === 'spin-off'
          ? imported.record.received
          : imported.kind === 'transfer' && imported.record.moved.kind === 'units'
            ? imported.record.moved.instrument
            : null
    if (instrument !== null) {
      known.set(identityOf(entry.rows[0]), instrument)
    }
  }
  return known
}

function accountQuestions(entries: readonly DryRunEntry[], known: ReadonlyMap<string, RecordId>): AccountQuestion[] {
  const firstRows = new Map<string, WorkbookRow>()
  entries.flatMap((entry) => entry.rows).forEach((row) => firstRows.set(row.account, firstRows.get(row.account) ?? row))
  return [...firstRows.values()].map((row) => ({
    account: row.account,
    broker: row.broker,
    known: known.get(row.account) ?? null,
    proposedName: [row.broker, row.account].filter((part) => part !== '').join(' '),
  }))
}

/** The rows that name an instrument: trades, dividends, unit transfers, splits and spin-offs. */
const NAMES_INSTRUMENT: ReadonlySet<WorkbookRow['type']> = new Set(['BUY', 'SELL', 'DIVIDEND', 'TRANSFER OUT', 'TRANSFER IN', 'SPLIT', 'SPINOFF'])

function instrumentQuestions(entries: readonly DryRunEntry[], book: InvestmentBook, known: ReadonlyMap<string, RecordId>, identityOf: (row: WorkbookRow) => string): InstrumentQuestion[] {
  const rowsOf = new Map<string, WorkbookRow[]>()
  entries
    .flatMap((entry) => entry.rows)
    .filter((row) => NAMES_INSTRUMENT.has(row.type))
    .forEach((row) => rowsOf.set(identityOf(row), [...(rowsOf.get(identityOf(row)) ?? []), row]))
  return [...rowsOf].map(([identity, rows]) => {
    const isin = rows.find((row) => row.isin !== '')?.isin ?? null
    const symbols = rows.flatMap((row) => [row.yahooSymbol, row.brokerSymbol]).filter((symbol) => symbol !== '')
    const offer =
      book.instruments.find((instrument) => isin !== null && instrument.isin === isin) ??
      book.instruments.find((instrument) => symbols.some((symbol) => fold(symbol) === fold(instrument.symbol))) ??
      null
    return { identity, known: known.get(identity) ?? null, offer, proposal: proposedInstrument(rows, isin) }
  })
}

/**
 * A first guess Ivan corrects: stocks, named by its symbol, quoting in the currency of its trades, priced by Tiingo
 * for a US symbol and by Alpha Vantage for Xetra and Amsterdam, by hand otherwise.
 */
function proposedInstrument(rows: readonly WorkbookRow[], isin: string | null): Omit<Instrument, 'id'> {
  const symbol = rows.find((row) => row.yahooSymbol !== '')?.yahooSymbol ?? rows.find((row) => row.brokerSymbol !== '')?.brokerSymbol ?? ''
  const traded = rows.find((row) => (row.type === 'BUY' || row.type === 'SELL') && row.currency !== null) ?? rows.find((row) => row.currency !== null)
  const [base = '', suffix = ''] = symbol.toUpperCase().split('.')
  const listing: { readonly exchange: string | null; readonly prices: PriceSource; readonly sourceSymbol: string } =
    suffix === ''
      ? { exchange: null, prices: 'tiingo', sourceSymbol: base }
      : suffix === 'DE'
        ? { exchange: 'XETR', prices: 'alphavantage', sourceSymbol: `${base}.DEX` }
        : suffix === 'AS'
          ? { exchange: 'XAMS', prices: 'alphavantage', sourceSymbol: `${base}.AS` }
          : { exchange: null, prices: 'manual', sourceSymbol: '' }
  return {
    name: symbol,
    class: 'stocks',
    isin,
    symbol,
    exchange: listing.exchange,
    currency: traded?.currency ?? EURO,
    quoted: { kind: 'unit' },
    prices: listing.prices,
    sourceSymbol: listing.sourceSymbol,
    note: '',
  }
}

/** The ratio proposed from the units the split's rows add over the units held the day before, in the smallest whole numbers. */
function splitQuestion(entry: RowEntry, planned: InvestmentBook, instrumentOf: (row: WorkbookRow) => Instrument | null, identityOf: (row: WorkbookRow) => string): SplitQuestion {
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
function bookBefore(book: InvestmentBook, day: CivilDate): InvestmentBook {
  const before = <Dated extends { readonly date: CivilDate }>(records: readonly Dated[]): Dated[] => records.filter((record) => record.date < day)
  return { ...book, trades: before(book.trades), income: before(book.income), transfers: before(book.transfers), splits: before(book.splits), spinOffs: before(book.spinOffs) }
}

/** Kuna's records with the imported ones after them, and the accounts and instruments they name. */
function withRecords(book: InvestmentBook, imported: readonly ImportedRecord[], accounts: readonly InvestmentAccount[], instruments: readonly Instrument[]): InvestmentBook {
  const records = {
    trades: [...book.trades],
    income: [...book.income],
    cashMovements: [...book.cashMovements],
    exchanges: [...book.exchanges],
    transfers: [...book.transfers],
    splits: [...book.splits],
    spinOffs: [...book.spinOffs],
  }
  for (const item of imported) {
    switch (item.kind) {
      case 'trade':
        records.trades.push(item.record)
        break
      case 'income':
        records.income.push(item.record)
        break
      case 'cash-movement':
        records.cashMovements.push(item.record)
        break
      case 'exchange':
        records.exchanges.push(item.record)
        break
      case 'transfer':
        records.transfers.push(item.record)
        break
      case 'split':
        records.splits.push(item.record)
        break
      case 'spin-off':
        records.spinOffs.push(item.record)
        break
    }
  }
  const named = new Set<RecordId>([
    ...records.trades.flatMap((trade) => [trade.account, trade.instrument]),
    ...records.income.flatMap((payment) => [payment.account, ...(payment.instrument === null ? [] : [payment.instrument])]),
    ...records.cashMovements.map((movement) => movement.account),
    ...records.exchanges.map((exchange) => exchange.account),
    ...records.transfers.flatMap((transfer) => [transfer.from, transfer.to, ...(transfer.moved.kind === 'units' ? [transfer.moved.instrument] : [])]),
    ...records.splits.map((split) => split.instrument),
    ...records.spinOffs.flatMap((spinOff) => [spinOff.instrument, spinOff.received]),
  ])
  const inBookOrNamed = <Named extends { readonly id: RecordId }>(inBook: readonly Named[], candidates: readonly Named[]): Named[] =>
    uniqueById([...inBook, ...candidates.filter((candidate) => named.has(candidate.id))])
  return { ...book, ...records, accounts: inBookOrNamed(book.accounts, accounts), instruments: inBookOrNamed(book.instruments, instruments) }
}

function uniqueById<Record extends { readonly id: RecordId }>(records: readonly Record[]): Record[] {
  return [...new Map(records.map((record) => [record.id, record])).values()]
}

function addedRecords(book: InvestmentBook, planned: InvestmentBook): InvestmentBook {
  const after = <Record>(before: readonly Record[], all: readonly Record[]): Record[] => all.slice(before.length)
  const inBook = new Set([...book.accounts, ...book.instruments].map((record) => record.id))
  return {
    accounts: planned.accounts.filter((account) => !inBook.has(account.id)),
    instruments: planned.instruments.filter((instrument) => !inBook.has(instrument.id)),
    trades: after(book.trades, planned.trades),
    income: after(book.income, planned.income),
    cashMovements: after(book.cashMovements, planned.cashMovements),
    exchanges: after(book.exchanges, planned.exchanges),
    transfers: after(book.transfers, planned.transfers),
    splits: after(book.splits, planned.splits),
    spinOffs: after(book.spinOffs, planned.spinOffs),
    prices: [],
  }
}

/**
 * Records in Kuna with an import key the file no longer gives, of an account the file covers and dated within its rows
 * of that account. A split or a spin-off names no account, so it counts when it is dated within the file's rows.
 */
function goneRecords(
  rows: readonly WorkbookRow[],
  entries: readonly RowEntry[],
  keyed: ReadonlyMap<string, ImportedRecord>,
  accountOf: (row: WorkbookRow) => InvestmentAccount | null,
): ImportedRecord[] {
  const fileKeys = new Set(entries.map((entry) => entry.key))
  const ranges = new Map<RecordId, { from: CivilDate; to: CivilDate }>()
  for (const row of rows) {
    const account = accountOf(row)
    if (account !== null) {
      const range = ranges.get(account.id)
      ranges.set(account.id, { from: range === undefined || row.date < range.from ? row.date : range.from, to: range === undefined || row.date > range.to ? row.date : range.to })
    }
  }
  const dates = rows.map((row) => row.date).sort()
  const covers = (account: RecordId | null, date: CivilDate): boolean => {
    const range = account === null ? { from: dates[0] ?? '', to: dates.at(-1) ?? '' } : ranges.get(account)
    return range !== undefined && date >= range.from && date <= range.to
  }
  return [...keyed]
    .filter(([key]) => !fileKeys.has(key))
    .map(([, imported]) => imported)
    .filter((imported) => {
      const record = imported.record
      if (imported.kind === 'transfer') {
        return covers(imported.record.from, record.date) || covers(imported.record.to, record.date)
      }
      return covers('account' in record ? record.account : null, record.date)
    })
}
