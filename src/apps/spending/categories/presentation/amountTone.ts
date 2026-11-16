import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import { filedAsTransfer } from '../../workbook/domain/rowItems'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { MoneyTone } from '../../../../shared/money/moneyFormat'

/**
 * How a part's amount shows: muted ink for one under Between my accounts, which is the same money in another place of yours,
 * cash taken out to a cash account among it, and the soft tones of money in and out for every other category. Saved to
 * investments, For the company and the loans keep the soft tones, since that money leaves spending.
 */
export function partTone(category: Pick<Category, 'kind'> | undefined): MoneyTone {
  return category !== undefined && isTransferCategory(category) ? 'move' : 'flow'
}

/** How a row's amount shows: muted ink when every part of it is under Between my accounts, and the soft tones otherwise. */
export function rowTone(items: readonly Pick<TransactionItem, 'category'>[], categories: readonly Pick<Category, 'id' | 'kind'>[]): MoneyTone {
  return filedAsTransfer(categories)(items) ? 'move' : 'flow'
}
