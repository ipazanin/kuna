import type { CashMovement } from './cashMovement'
import type { Exchange } from './exchange'
import type { HandPrice } from './handPrice'
import type { Income } from './income'
import type { Instrument } from './instrument'
import type { InvestmentAccount } from './investmentAccount'
import type { SpinOff } from './spinOff'
import type { Split } from './split'
import type { Trade } from './trade'
import type { Transfer } from './transfer'

/** The records of an Investments file that count, each kind in the file's order. */
export interface InvestmentBook {
  readonly accounts: readonly InvestmentAccount[]
  readonly instruments: readonly Instrument[]
  readonly trades: readonly Trade[]
  readonly income: readonly Income[]
  readonly cashMovements: readonly CashMovement[]
  readonly exchanges: readonly Exchange[]
  readonly transfers: readonly Transfer[]
  readonly splits: readonly Split[]
  readonly spinOffs: readonly SpinOff[]
  readonly prices: readonly HandPrice[]
}
