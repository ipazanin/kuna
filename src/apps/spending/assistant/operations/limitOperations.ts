import { NUMBER, TEXT, TEXT_OR_NULL, found, inputOf } from '../../../../shared/app/operationInput'
import { setLimit } from '../../budgets/application/budgetWrites'
import { dueProblem } from '../../workbook/domain/budget'
import type { DueProblem } from '../../workbook/domain/budget'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import { moneyFromAmount } from '../../../../shared/money/money'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const DUE_REFUSALS: Readonly<Record<DueProblem, string>> = {
  'before-from': 'due is from or up to 11 months after it.',
  'too-far': 'due is within 11 months of from, the first month it falls due.',
  'on-zero': 'A limit of zero ends it, so it takes no due.',
}

/** What Limits does: set a category's limit or yearly cost from a month on. */
export const LIMIT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'set-limit',
    about:
      'A monthly limit in euros on a spending category from a month on. With due, the month it falls due, a yearly cost of amount, set aside month by month and due every 12 months. Zero ends it.',
    input: inputOf({ category: TEXT, from: TEXT, amount: NUMBER, due: TEXT_OR_NULL }),
    refs: { category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { category: 'category', from: '2026-11', amount: 150, due: null },
  },
]

const LIMIT_OPERATION_NAMES: ReadonlySet<string> = new Set(LIMIT_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the limit operations. */
export function isLimitStep(operation: string): boolean {
  return LIMIT_OPERATION_NAMES.has(operation)
}

/** Writes a limit step through the write Limits uses. */
export function writeLimitStep(unit: UnitOfWork, book: SpendingBook, records: SpendingRecords, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): void {
  const from = parseMonthKey(field['from'])
  const due = field['due'] === null ? null : parseMonthKey(field['due'])
  if (from === null || (field['due'] !== null && due === null)) throw new StepRefused('A month reads as 2026-10.')
  const amount = moneyFromAmount(field['amount'])
  const problem = dueProblem({ from, amount, ...(due === null ? {} : { due }) })
  if (problem !== null) throw new StepRefused(DUE_REFUSALS[problem])
  setLimit(unit, records, found(book.categories, idOf(field['category']), 'category').id, from, amount, due)
}
