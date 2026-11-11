import { CASH_MOVEMENT_CODEC } from '../domain/cashMovementReading'
import { CHECK_CODEC } from '../domain/checkSettingReading'
import { EXCHANGE_CODEC } from '../domain/exchangeReading'
import { FUND_MIX_CODEC } from '../domain/fundMixReading'
import { HAND_PRICE_CODEC } from '../domain/handPriceReading'
import { INCOME_CODEC } from '../domain/incomeReading'
import { INSTRUMENT_CODEC } from '../domain/instrumentReading'
import { INVESTMENT_ACCOUNT_CODEC } from '../domain/investmentAccountReading'
import { MAIL_READER_CODEC } from '../domain/mailReaderReading'
import { SETTING_RECORDS } from '../domain/investmentKinds'
import { SURTAX_CITY_2023_KEY } from '../domain/investmentSettings'
import { words } from '../domain/words'
import { SPIN_OFF_CODEC } from '../domain/spinOffReading'
import { SPLIT_CODEC } from '../domain/splitReading'
import { TARGET_CODEC } from '../domain/targetReading'
import { TRADE_CODEC } from '../domain/tradeReading'
import { TRANSFER_CODEC } from '../domain/transferReading'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { settingCodec } from '../../../../shared/storage/domain/settingRows'

/** Settings by their label in the language of the app, or by the key of one Investments does not know. */
const SETTING_CODEC = settingCodec(SETTING_RECORDS, (key) => (key === SURTAX_CITY_2023_KEY ? words.settingLabels.surtaxCity2023 : key))

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
  FUND_MIX_CODEC,
  TARGET_CODEC,
  CHECK_CODEC,
  MAIL_READER_CODEC,
  SETTING_CODEC,
] as readonly RecordCodec<unknown>[]

/** The codec of an Investments kind. Throws for a kind the Investments file does not keep. */
export function codecOfInvestmentsKind<R>(kind: RecordKind<R>): RecordCodec<R> {
  const codec = INVESTMENTS_CODECS.find((candidate) => candidate.kind.name === kind.name)
  if (codec === undefined) {
    throw new Error(`The Investments file keeps no ${kind.noun.en.many}.`)
  }
  return codec as RecordCodec<R>
}
