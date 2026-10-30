import type { CashMovement } from './cashMovement'
import type { Exchange } from './exchange'
import type { HandPrice } from './handPrice'
import type { Income } from './income'
import type { Instrument } from './instrument'
import type { InvestmentAccount } from './investmentAccount'
import type { InvestmentBook } from './investmentBook'
import {
  CASH_MOVEMENT_RECORDS,
  EXCHANGE_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  PRICE_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from './investmentKinds'
import type { SpinOff } from './spinOff'
import type { Split } from './split'
import type { Trade } from './trade'
import type { Transfer } from './transfer'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'

/** What the Investments file holds of each kind. */
export interface InvestmentsRecords {
  readonly accounts: RecordsRead<InvestmentAccount>
  readonly instruments: RecordsRead<Instrument>
  readonly trades: RecordsRead<Trade>
  readonly income: RecordsRead<Income>
  readonly cashMovements: RecordsRead<CashMovement>
  readonly exchanges: RecordsRead<Exchange>
  readonly transfers: RecordsRead<Transfer>
  readonly splits: RecordsRead<Split>
  readonly spinOffs: RecordsRead<SpinOff>
  readonly prices: RecordsRead<HandPrice>
}

/** The kind each part of the records holds. */
export const INVESTMENT_PARTS: { readonly [Part in keyof InvestmentsRecords]: RecordKind<InvestmentsRecords[Part]['records'][number]['record']> } = {
  accounts: INVESTMENT_ACCOUNT_RECORDS,
  instruments: INSTRUMENT_RECORDS,
  trades: TRADE_RECORDS,
  income: INCOME_RECORDS,
  cashMovements: CASH_MOVEMENT_RECORDS,
  exchanges: EXCHANGE_RECORDS,
  transfers: TRANSFER_RECORDS,
  splits: SPLIT_RECORDS,
  spinOffs: SPIN_OFF_RECORDS,
  prices: PRICE_RECORDS,
}

/** The records of every Investments kind, as `of` gives each kind. */
export function investmentsRecordsOf(of: <R>(kind: RecordKind<R>) => RecordsRead<R>): InvestmentsRecords {
  return {
    accounts: of(INVESTMENT_PARTS.accounts),
    instruments: of(INVESTMENT_PARTS.instruments),
    trades: of(INVESTMENT_PARTS.trades),
    income: of(INVESTMENT_PARTS.income),
    cashMovements: of(INVESTMENT_PARTS.cashMovements),
    exchanges: of(INVESTMENT_PARTS.exchanges),
    transfers: of(INVESTMENT_PARTS.transfers),
    splits: of(INVESTMENT_PARTS.splits),
    spinOffs: of(INVESTMENT_PARTS.spinOffs),
    prices: of(INVESTMENT_PARTS.prices),
  }
}

/** Which records of each kind count, and why the rest do not or are doubted. */
export type InvestmentReadings = { readonly [Part in keyof InvestmentsRecords]: Reading<InvestmentsRecords[Part]['records'][number]['record']> }

/** A record problem with the kind of the record it is about, by its name and by what a sentence calls it. */
export interface InvestmentProblem extends RecordProblem {
  readonly kind: string
  readonly noun: RecordNoun
}

export interface InvestmentBookReading {
  /** The records that count, which the figures are worked out from. */
  readonly book: InvestmentBook
  readonly readings: InvestmentReadings
  /** Every kind's problems, in the order of the kinds. */
  readonly problems: readonly InvestmentProblem[]
}

/** The records the reasons leave in, the rest as problems, after the problems of records the factory refused and of ids two records share. */
function readEach<R>(read: RecordsRead<R>, reasonsOf: (stored: ReadRecord<R>) => readonly string[]): Reading<R> {
  const sharesId = idSharing(read)
  const facts: R[] = []
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    const reasons = sharesId(stored) ? [SHARED_ID_REASON] : reasonsOf(stored)
    if (reasons.length === 0) facts.push(stored.record)
    problems.push(...reasons.map((reason) => problemOf(stored, reason)))
  }
  return { facts, problems }
}

/**
 * Reads the Investments file with the rules across records. Every reference names a record of the right kind that
 * counts, and no two instruments share an ISIN. A trade is in its instrument's quote currency, so its rate is filled
 * exactly when that currency is not the euro, and only a bond quoted in percent has accrued interest. A spin-off's
 * received instrument quotes in its parent's currency, and an instrument has one hand price a day. Whether a sale or a
 * transfer is within what its account holds waits for the lots, so the write rules refuse it and the figures leave it out.
 */
export function readInvestmentBook(records: InvestmentsRecords): InvestmentBookReading {
  const accountReading = readEach(records.accounts, () => [])
  const accountIds = new Set(accountReading.facts.map((account) => account.id))
  const accountReasons = (field: string, account: RecordId): string[] => (accountIds.has(account) ? [] : [words.noAccount(field)])

  const isinsShared = sharedKeys(
    records.instruments.records.filter((stored) => stored.record.isin !== null),
    (stored) => stored.record.isin!,
  )
  const instrumentReading = readEach(records.instruments, ({ record }) => (record.isin !== null && isinsShared.has(record.isin) ? [words.isinShared(record.isin)] : []))
  const instruments = new Map(instrumentReading.facts.map((instrument) => [instrument.id, instrument]))
  const instrumentReasons = (field: string, instrument: RecordId): string[] => (instruments.has(instrument) ? [] : [words.noInstrument(field)])

  const trades = readEach(records.trades, ({ record: trade }) => {
    const instrument = instruments.get(trade.instrument)
    if (instrument === undefined) return [...accountReasons('account', trade.account), words.noInstrument('instrument')]
    const reasons = accountReasons('account', trade.account)
    if (instrument.currency === EURO && trade.rate !== null) reasons.push(words.rateForEuroInstrument(instrument.name))
    if (instrument.currency !== EURO && trade.rate === null) reasons.push(words.noRateForInstrument(instrument.name, instrument.currency))
    if (trade.accrued !== null && instrument.quoted.kind !== 'percent') reasons.push(words.accruedNotBond(instrument.name))
    return reasons
  })

  const income = readEach(records.income, ({ record: payment }) => [
    ...accountReasons('account', payment.account),
    ...(payment.instrument === null ? [] : instrumentReasons('instrument', payment.instrument)),
  ])
  const cashMovements = readEach(records.cashMovements, ({ record: movement }) => accountReasons('account', movement.account))
  const exchanges = readEach(records.exchanges, ({ record: exchange }) => accountReasons('account', exchange.account))
  const transfers = readEach(records.transfers, ({ record: transfer }) => [
    ...accountReasons('from', transfer.from),
    ...accountReasons('to', transfer.to),
    ...(transfer.moved.kind === 'units' ? instrumentReasons('instrument', transfer.moved.instrument) : []),
  ])
  const splits = readEach(records.splits, ({ record: split }) => instrumentReasons('instrument', split.instrument))
  const spinOffs = readEach(records.spinOffs, ({ record: spinOff }) => {
    const parent = instruments.get(spinOff.instrument)
    const received = instruments.get(spinOff.received)
    if (parent === undefined || received === undefined) return [...instrumentReasons('instrument', spinOff.instrument), ...instrumentReasons('received', spinOff.received)]
    return received.currency === parent.currency ? [] : [words.receivedInOtherCurrency(received.name, received.currency, parent.currency)]
  })
  const pricesSharingDay = sharedKeys(records.prices.records, (stored) => `${stored.record.instrument} ${stored.record.date}`)
  const prices = readEach(records.prices, ({ record: price }) => {
    const instrument = instruments.get(price.instrument)
    if (instrument === undefined) return [words.noInstrument('instrument')]
    return pricesSharingDay.has(`${price.instrument} ${price.date}`) ? [words.priceSharesDay(instrument.name, price.date)] : []
  })

  const readings: InvestmentReadings = {
    accounts: accountReading,
    instruments: instrumentReading,
    trades,
    income,
    cashMovements,
    exchanges,
    transfers,
    splits,
    spinOffs,
    prices,
  }
  return {
    book: {
      accounts: accountReading.facts,
      instruments: instrumentReading.facts,
      trades: trades.facts,
      income: income.facts,
      cashMovements: cashMovements.facts,
      exchanges: exchanges.facts,
      transfers: transfers.facts,
      splits: splits.facts,
      spinOffs: spinOffs.facts,
      prices: prices.facts,
    },
    readings,
    problems: (Object.keys(INVESTMENT_PARTS) as (keyof InvestmentsRecords)[]).flatMap((part) =>
      readings[part].problems.map((problem) => ({ kind: INVESTMENT_PARTS[part].name, noun: INVESTMENT_PARTS[part].noun, ...problem })),
    ),
  }
}
