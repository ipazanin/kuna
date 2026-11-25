import { FLAG_OR_NULL, TEXT, TEXT_OR_NULL, flagOf, found, inputOf } from '../../../../shared/app/operationInput'
import { readLoans } from './linkOperations'
import { CONDITIONS_ABOUT, RULE_CONDITIONS, RULE_PROBLEMS, conditionsOfStep } from './ruleConditionSteps'
import { paidLoansIn } from '../../links/domain/linkTarget'
import { fold } from '../../../../shared/text/fold'
import type { AppTargets, LinkTarget } from '../../links/domain/linkTarget'
import type { RuleEdits, RuleMove } from '../../statements/application/statementWrites'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { RowLink } from '../../workbook/domain/rowLink'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LABEL_RECORDS, RULE_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { payeeCondition, ruleProblem } from '../../workbook/domain/spendingRule'
import type { RuleDraft, RuleWithdrawal, SpendingRule } from '../../workbook/domain/spendingRule'
import { inTryingOrder } from '../../../../shared/categorising/domain/ruleOrder'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What Rules does: add, change, move and delete a rule. */
export const RULE_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-rule',
    about: `A rule that files rows into a category, adds a label, or both, tried after the rules there are. A row's payee or IBAN by its ref makes the one condition, else ${CONDITIONS_ABOUT} An alias of a person in values covers every way they were written. stop yes ends the trying for a row it holds for. On Accept the person picks whether rows already in the book follow. withdrawal yes says the rows are cash taken out, as Bankomat at OTP: the category is then Between my accounts, the rule holds only for money out, and each row gets its other leg on the cash account cash_account names, or with none named on the one cash account of its currency. pays names a bank loan as Loans lists it: each row is then linked to the instalment it pays and split into its interest under the category and its principal under Loan principal. pays may instead name an asset as Assets lists it: each row is then linked to it whole and keeps the category.`,
    input: inputOf({
      row: TEXT_OR_NULL,
      conditions: RULE_CONDITIONS,
      category: TEXT_OR_NULL,
      label: TEXT_OR_NULL,
      stop: FLAG_OR_NULL,
      withdrawal: FLAG_OR_NULL,
      cash_account: TEXT_OR_NULL,
      pays: TEXT_OR_NULL,
    }),
    refs: { row: TRANSACTION_RECORDS.name, category: CATEGORY_RECORDS.name, label: LABEL_RECORDS.name, cash_account: ACCOUNT_RECORDS.name },
    spellings: ['conditions.values'],
    creates: null,
    alone: false,
    example: { row: 'transaction', conditions: [], category: 'category', label: null, stop: null, withdrawal: null, cash_account: null, pays: null },
  },
  {
    name: 'change-rule',
    about:
      'Fixes a rule: conditions in place of its own, or none to keep them, another category, a label in place of its labels, stop, whether it spots cash taken out, the cash account the cash goes to, or the bank loan its rows pay by its name in Loans or the asset they are for by its name in Assets, none for no link. Null leaves a field as it is. A rule moved off Between my accounts needs withdrawal no. On Accept the person picks whether rows already in the book follow.',
    input: inputOf({
      rule: TEXT,
      conditions: RULE_CONDITIONS,
      category: TEXT_OR_NULL,
      label: TEXT_OR_NULL,
      stop: FLAG_OR_NULL,
      withdrawal: FLAG_OR_NULL,
      cash_account: TEXT_OR_NULL,
      pays: TEXT_OR_NULL,
    }),
    refs: { rule: RULE_RECORDS.name, category: CATEGORY_RECORDS.name, label: LABEL_RECORDS.name, cash_account: ACCOUNT_RECORDS.name },
    spellings: ['conditions.values'],
    creates: null,
    alone: false,
    example: { rule: 'rule', conditions: [{ test: 'payee_starts_with', values: ['Market'], not: false }], category: null, label: null, stop: null, withdrawal: null, cash_account: null, pays: null },
  },
  {
    name: 'move-rule',
    about: 'Moves a rule one place up, tried earlier, or down, tried later. On Accept the person picks whether rows already in the book follow.',
    input: inputOf({ rule: TEXT, direction: { type: 'string', enum: ['up', 'down'] } }),
    refs: { rule: RULE_RECORDS.name },
    creates: null,
    alone: true,
    example: { rule: 'rule', direction: 'down' },
  },
  {
    name: 'delete-rule',
    about: 'Deletes a rule. On Accept the person picks whether the rows it filed follow the rules that are left.',
    input: inputOf({ rule: TEXT }),
    refs: { rule: RULE_RECORDS.name },
    creates: null,
    alone: false,
    example: { rule: 'rule' },
  },
]

/** The rule steps an import card may hold, since the rules on its card file its new rows. */
export const FILING_IMPORTED_ROWS: ReadonlySet<string> = new Set(['add-rule', 'change-rule', 'delete-rule'])

const RULE_OPERATION_NAMES: ReadonlySet<string> = new Set(RULE_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the rule operations. */
export function isRuleStep(operation: string): boolean {
  return RULE_OPERATION_NAMES.has(operation)
}

/** The rule edits a card's steps gather, which the card writes once after every step, so the rules re-run once. */
export interface CardRuleEdits {
  readonly adding: RuleDraft[]
  readonly changing: NonNullable<RuleEdits['changing']>[number][]
  readonly deleting: SpendingRule[]
  moving?: RuleMove
}

/** Whether the card's steps edit a rule. */
export function editsRules(edits: CardRuleEdits): boolean {
  return edits.adding.length + edits.changing.length + edits.deleting.length > 0 || edits.moving !== undefined
}

/** The bank loan a rule step names by its name in Loans or the asset by its name in Assets, none on none, or the one kept on null. */
function paidLoanOf(loans: AppTargets<LinkTarget>, assets: readonly LinkTarget[], name: string | null, kept: RowLink | null): RowLink | null {
  if (name === null) return kept
  if (name === 'none') return null
  const asset = assets.filter((target) => target.kind === 'asset' && fold(target.name) === fold(name))
  if (asset.length > 1) throw new StepRefused(`More than one asset is called ${name}. Rename one in Assets, or set the rule on its dialog.`)
  if (asset[0] !== undefined) return asset[0].link
  const named = paidLoansIn(readLoans(loans)).filter((loan) => loan.loanName === name)
  if (named.length > 1) throw new StepRefused(`More than one bank loan is called ${name}. Rename one in Loans, or set the rule on its dialog.`)
  if (named[0] === undefined) throw new StepRefused(`${name} is not a bank loan Loans lists with a plan.`)
  return named[0].link
}

/** The withdrawal a rule step asks for: none on no, one into the named cash account or none named on yes, and on null the one kept, or one into the cash account named alone. */
function withdrawalOf(flag: string | null, cashAccount: Account | null, kept: RuleWithdrawal | null): RuleWithdrawal | null {
  if (flag === 'no') return null
  if (flag === 'yes') return { cashAccount: cashAccount?.id ?? null }
  return cashAccount === null ? kept : { cashAccount: cashAccount.id }
}

/** The rule a step drafts, refused in a sentence when it cannot be kept. */
function draftOf(draft: RuleDraft): RuleDraft {
  const problem = ruleProblem(draft)
  if (problem !== null) throw new StepRefused(RULE_PROBLEMS[problem])
  return draft
}

/** Adds a rule step to the card's rule edits, refused in a sentence when the rule it drafts cannot be kept. */
export function editRuleStep(
  edits: CardRuleEdits,
  book: SpendingBook,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
  loans: AppTargets<LinkTarget>,
  assets: readonly LinkTarget[],
): void {
  const categoryOf = (value: unknown): RecordId => found(book.categories, idOf(value), 'category').id
  const labelOf = (value: unknown): RecordId => found(book.labels, idOf(value), 'label').id
  const cashAccount = (): Account | null => (field['cash_account'] === null ? null : found(book.accounts, idOf(field['cash_account']), 'account'))
  switch (operation) {
    case 'add-rule': {
      const row = field['row'] === null ? null : found(book.transactions, idOf(field['row']), 'row')
      const conditions = row !== null ? [payeeCondition(row)].flatMap((condition) => condition ?? []) : conditionsOfStep(field['conditions'], book.accounts)
      if (conditions.length === 0) throw new StepRefused('A rule needs a row with a payee or an IBAN, or conditions.')
      const draft: RuleDraft = {
        conditions,
        category: field['category'] === null ? null : categoryOf(field['category']),
        labels: field['label'] === null ? [] : [labelOf(field['label'])],
        stop: flagOf(field['stop'], false),
        withdrawal: withdrawalOf(field['withdrawal'], cashAccount(), null),
        link: paidLoanOf(loans, assets, field['pays'], null),
      }
      edits.adding.push(draftOf(draft))
      break
    }
    case 'change-rule': {
      const rule = found(book.rules, idOf(field['rule']), 'rule')
      const typed: readonly unknown[] = field['conditions']
      const draft: RuleDraft = {
        conditions: typed.length === 0 ? rule.conditions : conditionsOfStep(field['conditions'], book.accounts),
        category: field['category'] === null ? rule.category : categoryOf(field['category']),
        labels: field['label'] === null ? rule.labels : [labelOf(field['label'])],
        stop: flagOf(field['stop'], rule.stop),
        withdrawal: withdrawalOf(field['withdrawal'], cashAccount(), rule.withdrawal),
        link: paidLoanOf(loans, assets, field['pays'], rule.link),
      }
      edits.changing.push({ rule, draft: draftOf(draft) })
      break
    }
    case 'move-rule': {
      const rule = found(book.rules, idOf(field['rule']), 'rule')
      const tried = inTryingOrder(book.rules)
      if (tried.at(field['direction'] === 'up' ? 0 : -1) === rule) throw new StepRefused(`That rule is already ${field['direction'] === 'up' ? 'first' : 'last'}.`)
      edits.moving = { rule: rule.id, direction: field['direction'] === 'up' ? 'up' : 'down' }
      break
    }
    default:
      edits.deleting.push(found(book.rules, idOf(field['rule']), 'rule'))
  }
}
