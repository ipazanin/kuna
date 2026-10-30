import { CASH_MOVEMENT_CODEC } from '../domain/cashMovementReading'
import { EXCHANGE_CODEC } from '../domain/exchangeReading'
import { HAND_PRICE_CODEC } from '../domain/handPriceReading'
import { INCOME_CODEC } from '../domain/incomeReading'
import { INSTRUMENT_CODEC } from '../domain/instrumentReading'
import { INVESTMENT_ACCOUNT_CODEC } from '../domain/investmentAccountReading'
import { SPIN_OFF_CODEC } from '../domain/spinOffReading'
import { SPLIT_CODEC } from '../domain/splitReading'
import { TRADE_CODEC } from '../domain/tradeReading'
import { TRANSFER_CODEC } from '../domain/transferReading'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

const INVESTMENTS_CODECS = [
  INVESTMENT_ACCOUNT_CODEC,
  INSTRUMENT_CODEC,
  TRADE_CODEC,
  INCOME_CODEC,
  CASH_MOVEMENT_CODEC,
  EXCHANGE_CODEC,
  TRANSFER_CODEC,
  SPLIT_CODEC,
  SPIN_OFF_CODEC,
  HAND_PRICE_CODEC,
] as readonly RecordCodec<unknown>[]

/** The codec of an Investments kind. Throws for a kind the Investments file does not keep. */
export function codecOfInvestmentsKind<R>(kind: RecordKind<R>): RecordCodec<R> {
  const codec = INVESTMENTS_CODECS.find((candidate) => candidate.kind.name === kind.name)
  if (codec === undefined) {
    throw new Error(`The Investments file keeps no ${kind.noun.en.many}.`)
  }
  return codec as RecordCodec<R>
}
