import type { RuleEdits } from '../application/statementWrites'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import { ruleWithConditions } from '../../workbook/domain/spendingRule'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/**
 * A change to the rules that waits on whether the rows already in the book follow it, with what its dialog is titled and says it
 * does, and the toast once it is written. Saving a rule asks Apply or Only new rows, and moving or deleting one asks whether to
 * re-file the rows or leave them as filed.
 */
export interface RuleAsk {
  readonly edits: RuleEdits
  readonly choice: 'apply' | 'refile'
  readonly title: string
  readonly description?: string
  readonly written: string
  /** What the same write adds beside the rules, such as a label a new rule brings. */
  readonly alongside?: (unit: UnitOfWork) => void
}

/** Whether the edits add a rule with the conditions of one already there, so they change that rule instead. */
export function changesHeldRule(rules: readonly SpendingRule[], edits: RuleEdits): boolean {
  return (edits.adding ?? []).some((draft) => ruleWithConditions(rules, draft.conditions) !== undefined)
}
