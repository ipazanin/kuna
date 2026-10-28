import { ZERO, subtractMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import type { Transaction } from '../../../workbook/domain/workbook'

/** Money that left the company read positive, so a credit back, such as a refund, reads negative. */
export function paidOut(rows: readonly Pick<Transaction, 'amount'>[]): Money {
  return rows.reduce((total, transaction) => subtractMoney(total, transaction.amount), ZERO)
}
