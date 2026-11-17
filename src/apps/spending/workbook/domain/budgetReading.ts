import { dueProblem } from './budget'
import type { Budget } from './budget'
import { requiredReference } from './recordReference'
import { BUDGET_RECORDS, CATEGORY_RECORDS } from './spendingKinds'
import { words } from './words'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredMoney, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

export function budgetOf(fields: StoredFields, id: RecordId | null): Budget {
  const fromText = textOf(fields.from)
  if (fromText === '') refuse(storedWords.reasons.none('from', ''))
  const from = parseMonthKey(fromText) ?? refuse(words.notAMonth('from', fromText))
  const amount = requiredMoney(fields, 'amount')
  if (amount < 0) refuse(words.amountBelowZero)
  const dueText = textOf(fields.due)
  const due = dueText === '' ? undefined : (parseMonthKey(dueText) ?? refuse(words.notAMonth('due', dueText)))
  const yearly = due === undefined ? {} : { due }
  const problem = dueProblem({ from, amount, ...yearly })
  if (problem !== null) refuse(words.dueProblems[problem])
  return { id: ownId(id), category: requiredReference(fields, 'category', CATEGORY_RECORDS), from, amount, ...yearly }
}

export const BUDGET_CODEC: RecordCodec<Budget> = withIdField(BUDGET_RECORDS, words.budgetLabel, budgetOf, (budget) =>
  filledFields({ category: keyOfRecordId(CATEGORY_RECORDS, budget.category), from: budget.from, amount: amountText(budget.amount), due: budget.due }),
)
