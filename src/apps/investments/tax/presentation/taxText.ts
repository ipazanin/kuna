import type { ForeignPayment } from '../domain/foreignIncome'
import { words as recordWords } from '../../workbook/domain/words'

/** Who paid: the holding, or for income with none the kind and the account. */
export function payerOf(entry: ForeignPayment): string {
  return entry.instrument?.name ?? [recordWords.incomeKinds[entry.kind], entry.account?.name ?? ''].filter((part) => part !== '').join(', ')
}
