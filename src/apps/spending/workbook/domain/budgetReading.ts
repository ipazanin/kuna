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
import type { Category } from './category'
import { limitRuns, runsOverlap } from '../../budgets/domain/budgetCarry'
import { readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'

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

export function readBudgets(read: RecordsRead<Budget>, categories: readonly Category[]): Reading<Budget> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const sharingMonth = sharedKeys(read.records, (stored) => `${stored.record.category} ${stored.record.from}`)
  const onSpending = read.records.map((stored) => stored.record).filter((budget) => byId.get(budget.category)?.kind === 'spending')
  const overlapsKin = (budget: Budget): boolean => {
    const category = byId.get(budget.category)!
    const kin = categories.filter((other) => other.id === category.parent || other.parent === category.id)
    const ownRuns = limitRuns(onSpending, category.id)
    return kin.some((other) => limitRuns(onSpending, other.id).some((theirs) => ownRuns.some((own) => runsOverlap(own, theirs))))
  }
  return readEach(read, ({ record: budget }) => {
    const category = byId.get(budget.category)
    if (category === undefined) return [words.noCategory]
    if (category.kind !== 'spending') return [words.notSpending]
    if (sharingMonth.has(`${budget.category} ${budget.from}`)) return [words.budgetSharesMonth(budget.from)]
    return overlapsKin(budget) ? [words.budgetOnGroupAndChild] : []
  })
}
