import { heldRefusals } from '../../holdings/application/heldRefusals'
import { INVESTMENT_KINDS, bookWith } from '../../workbook/application/investmentWriteGuards'
import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Exchange } from '../../workbook/domain/exchange'
import type { Income } from '../../workbook/domain/income'
import { CASH_MOVEMENT_RECORDS, EXCHANGE_RECORDS, INCOME_RECORDS, SPIN_OFF_RECORDS, SPLIT_RECORDS, TRADE_RECORDS, TRANSFER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Split } from '../../workbook/domain/split'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A trade moves units, so no write of it may leave a sale beyond what its account holds. */
export const TRADE_WRITES: WriteRules<Trade> = {
  kind: TRADE_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(TRADE_RECORDS, read, records).readings.trades,
  refusals: (_change, fresh, after) => heldRefusals(fresh, after),
}

export const INCOME_WRITES: WriteRules<Income> = {
  kind: INCOME_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(INCOME_RECORDS, read, records).readings.income,
  refusals: () => [],
}

export const CASH_MOVEMENT_WRITES: WriteRules<CashMovement> = {
  kind: CASH_MOVEMENT_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(CASH_MOVEMENT_RECORDS, read, records).readings.cashMovements,
  refusals: () => [],
}

export const EXCHANGE_WRITES: WriteRules<Exchange> = {
  kind: EXCHANGE_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(EXCHANGE_RECORDS, read, records).readings.exchanges,
  refusals: () => [],
}

/** A transfer of units may not move more than its account holds on its day. */
export const TRANSFER_WRITES: WriteRules<Transfer> = {
  kind: TRANSFER_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(TRANSFER_RECORDS, read, records).readings.transfers,
  refusals: (_change, fresh, after) => heldRefusals(fresh, after),
}

/** A split changes the units every later sale and transfer counts on, and may not empty a lot. */
export const SPLIT_WRITES: WriteRules<Split> = {
  kind: SPLIT_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(SPLIT_RECORDS, read, records).readings.splits,
  refusals: (_change, fresh, after) => heldRefusals(fresh, after),
}

/** A spin-off gives the units a later sale of the received instrument counts on. */
export const SPIN_OFF_WRITES: WriteRules<SpinOff> = {
  kind: SPIN_OFF_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(SPIN_OFF_RECORDS, read, records).readings.spinOffs,
  refusals: (_change, fresh, after) => heldRefusals(fresh, after),
}
