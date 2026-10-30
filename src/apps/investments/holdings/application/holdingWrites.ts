import { INVESTMENT_KINDS, bookWith, dependentRefusals } from '../../workbook/application/investmentWriteGuards'
import type { HandPrice } from '../../workbook/domain/handPrice'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS, PRICE_RECORDS } from '../../workbook/domain/investmentKinds'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** An account keeps the records that name it: trades, income, cash movements, exchanges and transfers. */
export const INVESTMENT_ACCOUNT_WRITES: WriteRules<InvestmentAccount> = {
  kind: INVESTMENT_ACCOUNT_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(INVESTMENT_ACCOUNT_RECORDS, read, records).readings.accounts,
  refusals: (_change, fresh, after) => dependentRefusals(['trades', 'income', 'cashMovements', 'exchanges', 'transfers'], fresh, after),
}

/** An instrument keeps the records that name it, and a trade or a spin-off that reads its currency. */
export const INSTRUMENT_WRITES: WriteRules<Instrument> = {
  kind: INSTRUMENT_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(INSTRUMENT_RECORDS, read, records).readings.instruments,
  refusals: (_change, fresh, after) => dependentRefusals(['trades', 'income', 'transfers', 'splits', 'spinOffs', 'prices'], fresh, after),
}

export const HAND_PRICE_WRITES: WriteRules<HandPrice> = {
  kind: PRICE_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(PRICE_RECORDS, read, records).readings.prices,
  refusals: () => [],
}
