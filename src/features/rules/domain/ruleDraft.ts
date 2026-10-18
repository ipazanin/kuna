import { cellText } from '../../../shared/text/cellText'
import type { Transaction, Workbook } from '../../workbook/domain/workbook'
import { categorise } from './categorise'
import { proposeRule, unusedId } from './proposeRule'
import type { RuleTabRow } from './readRules'
import { CONDITION_COLUMNS, inTryingOrder } from './rule'
import type { Rule, RuleConfidence } from './rule'
import { placeBefore } from './rulePlacement'
import { ruleTabCells } from './rulesTabChange'
import type { RuleCells, RuleRowEdit, RulesTabChange } from './rulesTabChange'
import type { CategorisableTransaction, CategorisationContext } from './transactionFacts'

export type ConditionColumn = (typeof CONDITION_COLUMNS)[number]

/** The condition columns the form offers. `counterparty_is_client` waits for a clients tab. */
export const DRAFT_CONDITION_COLUMNS = CONDITION_COLUMNS.filter((column) => column !== 'counterparty_is_client')

/** Columns that hold TRUE or nothing, so a condition on one has no value to type. */
export const FLAG_COLUMNS: ReadonlySet<ConditionColumn> = new Set(['counterparty_is_own', 'is_card', 'foreign_currency'])

export interface DraftCondition {
  readonly column: ConditionColumn
  /** The cell as it will be written: text, or TRUE and FALSE as booleans. */
  readonly value: string | number | boolean
}

/** A rule as the form edits it: the cells of one rules row, plus where it is tried. */
export interface RuleDraft {
  readonly id: string
  readonly enabled: boolean
  readonly conditions: readonly DraftCondition[]
  readonly category: string
  readonly confidence: RuleConfidence
  readonly note: string
  /** The rule it is tried just before, or null for after every rule. */
  readonly before: string | null
}

/** The rule on the tab this draft edits, as the app read it. Null for a new rule. */
export interface EditedRule {
  readonly id: string
  readonly expected: RuleCells
  readonly order: number
  readonly before: string | null
}

export function draftFromCells(cells: RuleCells, before: string | null): RuleDraft {
  const confidence = cellText(cells.confidence).toLowerCase()
  return {
    id: cellText(cells.rule),
    enabled: cellText(cells.enabled).toUpperCase() !== 'FALSE',
    conditions: CONDITION_COLUMNS.flatMap((column) => (cellText(cells[column]) === '' ? [] : [{ column, value: cells[column]! }])),
    category: cellText(cells.category).toLowerCase(),
    confidence: confidence === 'review' ? 'review' : 'rule',
    note: cellText(cells.note),
    before,
  }
}

/** The id of the rule tried right after this one, which is where it stands now. */
function ruleTriedAfter(rules: readonly Rule[], id: string): string | null {
  const ordered = inTryingOrder(rules)
  const index = ordered.findIndex((rule) => rule.id === id)
  return index === -1 ? null : (ordered[index + 1]?.id ?? null)
}

/**
 * The change the draft makes to the rules tab: a new row, or its own row edited, at the order its
 * placement gives, plus the rules renumbered to make room when two neighbours share an order. An
 * edited rule left where it stands keeps its order.
 */
export function draftChange(draft: RuleDraft, rules: readonly Rule[], rows: readonly RuleTabRow[], edited: EditedRule | null): RulesTabChange {
  const stays = edited !== null && edited.before === draft.before
  const placement = stays ? { order: edited.order, renumbered: new Map<string, number>() } : placeBefore(rules, edited?.id ?? null, draft.before)
  const cells: RuleCells = { ...cellsOf(draft), order: placement.order }
  const renumbered = [...placement.renumbered].flatMap(([id, order]): RuleRowEdit[] => {
    const row = rows.find((candidate) => cellText(candidate.cells.rule).toLowerCase() === id.toLowerCase())
    return row === undefined ? [] : [{ id, expected: row.cells, cells: { ...row.cells, order } }]
  })
  return edited === null
    ? { appended: cells, edited: renumbered }
    : { appended: null, edited: [{ id: edited.id, expected: edited.expected, cells }, ...renumbered] }
}

function cellsOf(draft: RuleDraft): RuleCells {
  const cells: Record<string, string | number | boolean> = {
    rule: draft.id.trim(),
    enabled: draft.enabled,
    category: draft.category,
    confidence: draft.confidence,
    note: draft.note.trim(),
  }
  for (const condition of draft.conditions) {
    cells[condition.column] = typeof condition.value === 'string' ? condition.value.trim() : condition.value
  }
  return cells
}

/** A draft that files rows like this one, as `proposeRule` words it, tried just before the rule that decides the row now. */
export function draftForRow(
  transaction: CategorisableTransaction & Pick<Transaction, 'category'>,
  workbook: Pick<Workbook, 'rules' | 'categories'>,
  context: CategorisationContext,
): RuleDraft {
  const proposal = proposeRule(transaction, workbook, context)
  if (proposal === null) {
    return { ...blankDraft(workbook.rules), category: workbook.categories.some((category) => category.slug === transaction.category) ? transaction.category : '' }
  }
  return draftFromCells(ruleTabCells(proposal), categorise(transaction, workbook.rules, context).ruleId)
}

/** A rule with nothing in it yet, tried after every other. */
export function blankDraft(rules: readonly Rule[]): RuleDraft {
  return { id: unusedId('new-rule', rules), enabled: true, conditions: [], category: '', confidence: 'rule', note: '', before: null }
}

/** The draft and the tab row of a rule on the tab, or null when the copy on screen has no row for it. */
export function draftOfRule(rule: Rule, rows: readonly RuleTabRow[], rules: readonly Rule[]): { readonly draft: RuleDraft; readonly edited: EditedRule } | null {
  const row = rows.find((candidate) => candidate.sheetRow === rule.sheetRow)
  if (row === undefined) {
    return null
  }
  const before = ruleTriedAfter(rules, rule.id)
  return { draft: draftFromCells(row.cells, before), edited: { id: rule.id, expected: row.cells, order: rule.order, before } }
}
