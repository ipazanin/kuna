import type { DryRunEntry, DryRunInputs, ReversedRow, WaitReason } from './importDryRun'
import type { ImportedRecord } from './importedRecords'
import type { SpinOffQuestion } from './importQuestions'
import type { SkipReason, WorkbookColumn, WorkbookRow, WorkbookType } from './portfolioWorkbook'
import { isIncomeReversal, isWithheldRefund } from './workbookEntries'
import type { RowEntry } from './workbookEntries'
import { words } from './words'
import { bookedWorth, brokerWorthKept } from '../../holdings/domain/lots'
import { priceOfWorth, tradeWorth } from '../../holdings/domain/quoting'
import { addsCash } from '../../workbook/domain/cashMovement'
import type { CashMovement, CashMovementKind } from '../../workbook/domain/cashMovement'
import { CASH_MOVEMENT_CODEC } from '../../workbook/domain/cashMovementReading'
import type { Exchange } from '../../workbook/domain/exchange'
import { EXCHANGE_CODEC } from '../../workbook/domain/exchangeReading'
import type { Income } from '../../workbook/domain/income'
import { INCOME_CODEC } from '../../workbook/domain/incomeReading'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import { CASH_MOVEMENT_RECORDS, EXCHANGE_RECORDS, INCOME_RECORDS, SPIN_OFF_RECORDS, SPLIT_RECORDS, TRADE_RECORDS, TRANSFER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { SpinOff } from '../../workbook/domain/spinOff'
import { SPIN_OFF_CODEC } from '../../workbook/domain/spinOffReading'
import type { Split } from '../../workbook/domain/split'
import { SPLIT_CODEC } from '../../workbook/domain/splitReading'
import type { Trade } from '../../workbook/domain/trade'
import { TRADE_CODEC } from '../../workbook/domain/tradeReading'
import type { Transfer } from '../../workbook/domain/transfer'
import { TRANSFER_CODEC } from '../../workbook/domain/transferReading'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, addDecimal, decimalOfText, decimalText, magnitude, negateDecimal, scaledDecimal, subtractDecimal, sumDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { refusalOr, storedFieldsOfValues } from '../../../../shared/storage/domain/storedFields'
import { fold } from '../../../../shared/text/fold'

/** A price is taken as rounded to the cent at the coarsest. */
const CENT_PLACES = 2
/** A net cash may itself be rounded to the cent. */
const HALF_CENT = decimalOfText('0.005')!
const ONE = decimalOfText('1')!
const CASH_KINDS: Partial<Record<WorkbookRow['type'], CashMovementKind>> = { DEPOSIT: 'deposit', WITHDRAWAL: 'withdrawal', FEE: 'fee', 'FEE REFUND': 'fee-refund' }
const PAID_IN: ReadonlySet<CashMovementKind> = new Set(['deposit', 'fee-refund'])

/** What a lone row signed against its type imports as, with the words its note starts with. */
const REVERSED: Partial<Record<WorkbookType, { readonly kind: CashMovementKind; readonly note: string }>> = {
  INTEREST: { kind: 'fee', note: words.debitInterest },
  FEE: { kind: 'fee-refund', note: words.againstSign('FEE') },
  'FEE REFUND': { kind: 'fee', note: words.againstSign('FEE REFUND') },
  DEPOSIT: { kind: 'withdrawal', note: words.againstSign('DEPOSIT') },
  WITHDRAWAL: { kind: 'deposit', note: words.againstSign('WITHDRAWAL') },
}

const CODECS: { readonly [Kind in ImportedRecord['kind']]: RecordCodec<Extract<ImportedRecord, { readonly kind: Kind }>['record']> } = {
  trade: TRADE_CODEC,
  income: INCOME_CODEC,
  'cash-movement': CASH_MOVEMENT_CODEC,
  exchange: EXCHANGE_CODEC,
  transfer: TRANSFER_CODEC,
  split: SPLIT_CODEC,
  'spin-off': SPIN_OFF_CODEC,
}

export class EntryWaits extends Error {
  readonly reason: WaitReason

  constructor(reason: WaitReason) {
    super(reason.kind)
    this.reason = reason
  }
}

export class EntrySkipped extends Error {
  readonly fileRow: number
  readonly reason: SkipReason

  constructor(fileRow: number, reason: SkipReason) {
    super(reason.kind)
    this.fileRow = fileRow
    this.reason = reason
  }
}

export interface Mapping {
  readonly inputs: DryRunInputs
  readonly accountOf: (row: WorkbookRow) => InvestmentAccount | null
  readonly instrumentOf: (row: WorkbookRow) => Instrument | null
  readonly identityOf: (row: WorkbookRow) => string
  readonly questions: { readonly spinOffs: SpinOffQuestion[] }
  readonly instruments: readonly Instrument[]
}

/** The entry's record, skipped when the write rules of its kind would refuse it, so Import never fails on one row. */
export function importedRecord(entry: RowEntry, mapping: Mapping): ImportedRecord {
  const imported = recordOf(entry, mapping)
  const codec = CODECS[imported.kind] as RecordCodec<ImportedRecord['record']>
  const read = refusalOr(() => codec.make(storedFieldsOfValues(codec.fieldsOf(imported.record)), imported.record.id))
  if ('refused' in read) {
    throw new EntrySkipped(entry.rows[0].fileRow, { kind: 'refused', reason: read.refused })
  }
  return imported
}

export function recordOf(entry: RowEntry, mapping: Mapping): ImportedRecord {
  const row = entry.rows[0]
  const reversed = reversalOf(entry)
  if (reversed !== null) {
    return { kind: 'cash-movement', record: cashMovementOf(row, reversed.kind, entry.key, mapping, reversed.note) }
  }
  const cashKind = CASH_KINDS[row.type]
  if (cashKind !== undefined) {
    return { kind: 'cash-movement', record: cashMovementOf(row, cashKind, entry.key, mapping, '') }
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
    case 'WITHHOLDING TAX':
      if (isWithheldRefund(row)) {
        return { kind: 'income', record: withheldRefundOf(row, entry.key, mapping) }
      }
      throw new EntryWaits({ kind: 'no-partner' })
    default:
      // A transfer in that pairing left alone.
      throw new EntryWaits({ kind: 'no-partner' })
  }
}

/** The kind a lone row signed against its type imports as, null for a row signed as its type moves money or one with partners. */
function reversalOf(entry: RowEntry): { readonly kind: CashMovementKind; readonly note: string } | null {
  const [row, ...partners] = entry.rows
  const reversed = REVERSED[row.type]
  const amount = row.netCash ?? row.gross
  if (reversed === undefined || partners.length > 0 || amount === null || amount === DECIMAL_ZERO) {
    return null
  }
  const paysIn = amount > DECIMAL_ZERO
  return paysIn === addsCash(reversed.kind) ? reversed : null
}

/** The rows of the new entries signed against their type, with the words each gives its record's note. */
export function reversedRows(entries: readonly DryRunEntry[]): ReversedRow[] {
  return entries.flatMap((entry) => {
    if (entry.outcome.kind !== 'new') {
      return []
    }
    const record = entry.outcome.imported.record.id
    const [lead, ...partners] = entry.rows
    const reversed = incomeReversalNote(lead)
    const leadNote = reversalOf(entry)?.note ?? (isWithheldRefund(lead) ? words.withheldRefund : reversed)
    return [
      ...(leadNote === null ? [] : [{ fileRow: lead.fileRow, record, note: leadNote }]),
      ...(reversed === null ? partners.filter(isWithheldRefund).map((row) => ({ fileRow: row.fileRow, record, note: words.withheldLowered })) : []),
    ]
  })
}

/** The words that start the note of income whose row pays out, reversing an earlier payment, null for any other row. */
function incomeReversalNote(row: WorkbookRow): string | null {
  if (!isIncomeReversal(row)) {
    return null
  }
  return row.type === 'DIVIDEND' ? words.reversesDividend : words.reversesPayment
}

function required<Column extends WorkbookColumn & keyof WorkbookRow>(row: WorkbookRow, column: Column): NonNullable<WorkbookRow[Column]> {
  const value = row[column]
  if (value === null || value === '') {
    throw new EntrySkipped(row.fileRow, { kind: 'missing', column })
  }
  return value as NonNullable<WorkbookRow[Column]>
}

/** The amount without its sign, which has to be the way the row's type moves money. Zero passes either way. */
function directed(row: WorkbookRow, amount: Decimal, paidIn: boolean): Decimal {
  if (paidIn ? amount < DECIMAL_ZERO : amount > DECIMAL_ZERO) {
    throw new EntrySkipped(row.fileRow, { kind: 'against-sign' })
  }
  return magnitude(amount)
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

/**
 * A buy's fees are what its net cash paid beyond its booked worth, a sale's what its booked worth got beyond its net
 * cash, so the trade moves its net cash exactly. The booked worth is the one the row gives, kept on the trade when it is
 * not quantity × price to the cent, and otherwise quantity × price to the cent. Without a net cash the fees are the
 * Commission cell. A trade with no commission and no worth of its own whose net cash and quantity × price differ by no
 * more than the price's rounding, as a broker that shows the price to the cent books it, takes its price from the net
 * cash and has no fees.
 */
function tradeOf(row: WorkbookRow, key: string, mapping: Mapping): Trade {
  const quantity = magnitude(required(row, 'quantity'))
  const price = required(row, 'price')
  const currency = required(row, 'currency')
  const side = row.type === 'BUY' ? 'buy' : 'sell'
  const netCash = row.netCash === null ? null : directed(row, row.netCash, side === 'sell')
  const account = accountFor(row, mapping)
  const instrument = instrumentFor(row, mapping)
  if (instrument.currency !== currency) {
    throw new EntryWaits({ kind: 'other-currency', currency })
  }
  const worth = tradeWorth(instrument.quoted, quantity, price)
  const brokerWorth = brokerWorthKept(instrument.quoted, quantity, price, row.worth === null ? null : magnitude(row.worth))
  const pricedByNet =
    netCash !== null &&
    row.worth === null &&
    quantity > DECIMAL_ZERO &&
    (row.commission ?? DECIMAL_ZERO) === DECIMAL_ZERO &&
    magnitude(subtractDecimal(netCash, worth)) <= addDecimal(tradeWorth(instrument.quoted, quantity, halfStepOf(price)), HALF_CENT)
  const booked = bookedWorth(instrument.quoted, quantity, price, brokerWorth)
  const fees = netCash === null ? row.commission : pricedByNet ? DECIMAL_ZERO : side === 'buy' ? subtractDecimal(netCash, booked) : subtractDecimal(booked, netCash)
  return {
    id: recordIdOf(TRADE_RECORDS, newRecordId()),
    account: account.id,
    instrument: instrument.id,
    side,
    date: row.date,
    quantity,
    price: pricedByNet ? priceOfWorth(instrument.quoted, netCash, quantity) : price,
    ...(brokerWorth === undefined ? {} : { brokerWorth }),
    fees,
    rate: ecbRate(currency, row.date, mapping),
    accrued: null,
    importKeys: [key],
    note: row.note,
    ...(row.settles === null ? {} : { settles: row.settles }),
  }
}

/** Half a unit of the price's last decimal place, taking a price as rounded to the cent at the coarsest. */
function halfStepOf(price: Decimal): Decimal {
  const places = Math.max(decimalText(price).split('.')[1]?.length ?? 0, CENT_PLACES)
  return scaledDecimal(ONE, 1n, 2n * 10n ** BigInt(places))
}

/**
 * Income with the tax its withholding rows took. A Revolut dividend comes booked net of the tax withheld, so without a
 * withholding row its gross is its net and its note says so. A workbook that gives the tax adds its withholding row.
 * A row that pays out reverses an earlier payment, so its gross is below zero and a refund with it gives the tax back.
 */
function incomeOf(entry: RowEntry, mapping: Mapping): Income {
  const [row, ...withholdings] = entry.rows
  const currency = required(row, 'currency')
  const amount = row.gross ?? required(row, 'netCash')
  const reversal = incomeReversalNote(row)
  const received = reversal === null ? directed(row, amount, true) : amount
  const withheld = negateDecimal(sumDecimal(withholdings.map((withholding) => withholding.netCash ?? required(withholding, 'gross'))))
  const isDividend = row.type === 'DIVIDEND'
  const bookedNet = isDividend && withholdings.length === 0 && fold(row.broker) === 'REVOLUT'
  const account = accountFor(row, mapping)
  const instrument = isDividend ? instrumentFor(row, mapping) : null
  const rate = ecbRate(currency, row.date, mapping)
  const label = row.type === 'STOCK YIELD INCOME' ? words.stockYieldIncome : row.type === 'REFERRAL CREDIT' ? words.referralCredit : bookedNet ? words.bookedNet : ''
  const lowered = reversal === null && withholdings.some(isWithheldRefund) ? words.withheldLowered : ''
  return {
    id: recordIdOf(INCOME_RECORDS, newRecordId()),
    account: account.id,
    kind: isDividend ? 'dividend' : row.type === 'INTEREST' ? 'interest' : row.type === 'STOCK YIELD INCOME' ? 'lending' : row.type === 'REFERRAL CREDIT' ? 'referral' : 'other',
    instrument: instrument?.id ?? null,
    date: row.date,
    currency,
    gross: received,
    withheld,
    rate,
    importKeys: [entry.key],
    note: [reversal ?? '', label, lowered, row.note].filter((part) => part !== '').join('. '),
    ...(row.dividend === null ? {} : { dividend: row.dividend }),
  }
}

/** A refund of withheld tax with no taxed income on its day to lower, as other income of its account. */
function withheldRefundOf(row: WorkbookRow, key: string, mapping: Mapping): Income {
  const currency = required(row, 'currency')
  const refunded = magnitude(row.netCash ?? required(row, 'gross'))
  const account = accountFor(row, mapping)
  return {
    id: recordIdOf(INCOME_RECORDS, newRecordId()),
    account: account.id,
    kind: 'other',
    instrument: null,
    date: row.date,
    currency,
    gross: refunded,
    withheld: DECIMAL_ZERO,
    rate: ecbRate(currency, row.date, mapping),
    importKeys: [key],
    note: [words.withheldRefund, row.note].filter((part) => part !== '').join('. '),
  }
}

/**
 * A deposit or withdrawal carries the rate Revolut changed it at, where the row gives one, and anything else the ECB
 * rate. `label` starts the note of a row imported as what it reverses.
 */
function cashMovementOf(row: WorkbookRow, kind: CashMovementKind, key: string, mapping: Mapping, label: string): CashMovement {
  const amount = directed(row, row.netCash ?? required(row, 'gross'), PAID_IN.has(kind))
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
    importKeys: [key],
    note: [label, row.note].filter((part) => part !== '').join('. '),
  }
}

/**
 * The net cash is one leg and the FX counter amount the other, each after fees. The Commission cell is the exchange's
 * fee in euros. A report's conversion of dust keeps its fractions of a cent and is booked. A leg at zero, such as one a
 * workbook's rounding to the cent left there, is skipped.
 */
function exchangeOf(row: WorkbookRow, key: string, mapping: Mapping): Exchange {
  const net = required(row, 'netCash')
  const currency = required(row, 'currency')
  const counter = magnitude(required(row, 'counterAmount'))
  const counterCurrency = required(row, 'counterCurrency')
  if (net === DECIMAL_ZERO || counter === DECIMAL_ZERO) {
    throw new EntrySkipped(row.fileRow, { kind: 'below-a-cent' })
  }
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
    fees: row.commission !== null && row.commission > DECIMAL_ZERO ? { amount: row.commission, currency: row.commissionCurrency ?? EURO } : null,
    importKeys: [key],
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
  return { id: recordIdOf(TRANSFER_RECORDS, newRecordId()), from: from.id, to: to.id, date: out.date, moved, importKeys: [entry.key], note: out.note }
}

function splitOf(entry: RowEntry, mapping: Mapping): Split {
  const row = entry.rows[0]
  const instrument = instrumentFor(row, mapping)
  const ratio = mapping.inputs.answers.splits.get(entry.key)
  if (ratio === undefined) {
    throw new EntryWaits({ kind: 'split-ratio' })
  }
  return { id: recordIdOf(SPLIT_RECORDS, newRecordId()), instrument: instrument.id, date: row.date, ...ratio, importKeys: [entry.key], note: row.note }
}

/** The row names the instrument received. Its parent and the share of the parent's cost come from the row's own columns or the person. */
function spinOffOf(row: WorkbookRow, key: string, mapping: Mapping): SpinOff {
  const quantity = magnitude(required(row, 'quantity'))
  const price = required(row, 'price')
  mapping.questions.spinOffs.push({
    key,
    identity: mapping.identityOf(row),
    date: row.date,
    quantity,
    worth: timesDecimal(quantity, price),
    currency: row.currency,
    from: row.spinOffFrom,
    costShare: row.costShare,
    costShareUnclear: row.costShareUnclear,
    costShareText: row.costShareText,
  })
  const received = instrumentFor(row, mapping)
  const answer = mapping.inputs.answers.spinOffs.get(key)
  const parent = mapping.instruments.find((instrument) => instrument.id === answer?.parent)
  if (answer === undefined || parent === undefined) {
    throw new EntryWaits({ kind: 'spin-off' })
  }
  if (parent.currency !== received.currency) {
    throw new EntryWaits({ kind: 'other-currency', currency: received.currency })
  }
  return { id: recordIdOf(SPIN_OFF_RECORDS, newRecordId()), instrument: parent.id, received: received.id, date: row.date, quantity, costShare: answer.costShare, importKeys: [key], note: row.note }
}
