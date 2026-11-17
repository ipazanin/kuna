import type { CompanyOperationSet } from './companyCard'
import { itemsMoveBlockers, moveToItems } from '../../workbook/application/rowIdWrites'
import { storesItems } from '../../workbook/domain/rowItems'
import { inputOf } from '../../../../shared/app/operationInput'
import { StepRefused } from '../../../../shared/app/proposedWrites'

/** The chat's move of books from before items to the items tab, as the books file's offer makes it. */
export const ITEMS_MOVE_OPERATIONS: CompanyOperationSet = {
  operations: [
    {
      name: 'move-to-items',
      about:
        "Gives every ledger row of books from before items its own items, which then hold its category, owner share, note and the invoice it pays. A split row's parts become its items, and a payment that pays several invoices gets one item per invoice. No figure changes. Undo takes it back until a reload.",
      input: inputOf({}),
      refs: {},
      creates: null,
      alone: true,
      example: {},
    },
  ],
  planStep: (card) => {
    const books = { records: card.records(), workbook: card.workbook }
    if (storesItems(books.records)) throw new StepRefused('These books keep their rows on the items tab already.')
    const blockers = itemsMoveBlockers(books)
    if (blockers.length > 0)
      throw new StepRefused(
        `${blockers.length} ledger rows or split parts need fixing first: rows that cannot be read or have no amount, and splits that cannot be read, do not add up or split a row the books count whole. The person fixes or deletes them in the file, as Settings, Books file lists them.`,
      )
    moveToItems(card.unit, books)
  },
}
