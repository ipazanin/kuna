import { TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import { filledByBank } from '../domain/statementDryRun'
import type { StatementDryRun } from '../domain/statementDryRun'
import { rulesRerun } from '../domain/spendingCategorisation'
import { legsOfPair } from '../../pairing/domain/transferPairs'
import { LINE_WRITES } from '../../receipts/application/receiptRecords'
import { differenceLine } from '../../receipts/domain/receiptSplit'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { ReceiptLine } from '../../workbook/domain/receiptLine'
import { RULE_RECORDS } from '../../workbook/domain/spendingKinds'
import type { SpendingRule, SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import { subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A rule names a category that counts. */
export const RULE_WRITES: WriteRules<SpendingRule> = {
  kind: RULE_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(RULE_RECORDS, read, records).readings.rules,
  refusals: (_change, fresh, after) => dependentRefusals(['rules'], fresh, after),
}

/** Everything the import does in one write, so one Undo takes it all back. */
export function writeDryRun(unit: UnitOfWork, run: StatementDryRun): void {
  const entries = unit.of(TRANSACTION_WRITES)
  run.added.forEach((row) => entries.add(row))
  run.changed.forEach(({ before, after }) => entries.change(before, after))
}

/** The row under the category you picked, which a rule change then leaves alone. A row under Between my accounts stays a lone leg, so a later statement can still pair it. */
export function fileRow(unit: UnitOfWork, row: Transaction, category: Category): void {
  unit.of(TRANSACTION_WRITES).change(row, { ...row, category: category.id, categorisedBy: category.kind === 'transfer' ? null : 'person' })
}

/**
 * Both legs back on review, with neither a category nor a pair. `person` on a row with no category says you decided
 * about the pair, so a later import does not pair them again and To review does not offer it.
 */
export function notAPair(unit: UnitOfWork, { debit, credit }: TransferPair): void {
  const entries = unit.of(TRANSACTION_WRITES)
  for (const leg of [debit, credit]) entries.change(leg, { ...leg, pair: null, category: null, categorisedBy: 'person' })
}

/** Two rows To review offered as one transfer, paired by your word. */
export function pairRows(unit: UnitOfWork, { debit, credit }: TransferPair, transferCategory: RecordId): void {
  const [debitLeg, creditLeg] = legsOfPair(debit, credit, transferCategory)
  const entries = unit.of(TRANSACTION_WRITES)
  entries.change(debit, debitLeg)
  entries.change(credit, creditLeg)
}

/** A near match joined by your word: the typed row takes the bank's facts and the bank's own row goes. A row a receipt split gains a Difference line for what the bank's amount adds, so its lines keep adding up. */
export function joinWithTyped(unit: UnitOfWork, typed: Transaction, bank: Transaction, lines: readonly ReceiptLine[]): void {
  const entries = unit.of(TRANSACTION_WRITES)
  entries.remove(bank)
  entries.change(typed, filledByBank(typed, bank))
  const first = lines.find((line) => line.transaction === typed.id)
  if (first !== undefined && bank.amount !== typed.amount) unit.of(LINE_WRITES).add(differenceLine(first, subtractAccountMoney(bank.amount, typed.amount)))
}

/** What "Always for this payee" tests on a row: its IBAN, else its payee's name. Null for a row with neither. */
export function payeeCondition(row: Pick<Transaction, 'payee' | 'counterpartyIban'>): SpendingRuleCondition | null {
  if (row.counterpartyIban !== '') return { column: 'counterparty_iban', iban: row.counterpartyIban }
  return row.payee === '' ? null : { column: 'counterparty_contains', fragment: row.payee }
}

function sameCondition(one: SpendingRuleCondition, other: SpendingRuleCondition): boolean {
  return one.column === 'counterparty_iban' ? other.column === 'counterparty_iban' && one.iban === other.iban : other.column === 'counterparty_contains' && one.fragment === other.fragment
}

function rerun(unit: UnitOfWork, book: SpendingBook, rules: readonly SpendingRule[]): void {
  rulesRerun(book, rules).forEach(({ before, after }) => unit.of(TRANSACTION_WRITES).change(before, after))
}

/** The rule this condition makes: new and tried last, or the one it already has on the new category. */
function ruleFor(book: SpendingBook, condition: SpendingRuleCondition, category: RecordId): { readonly held: SpendingRule | null; readonly rule: SpendingRule } {
  const held = book.rules.find((rule) => sameCondition(rule.condition, condition)) ?? null
  const rule = held !== null ? { ...held, category } : { id: recordIdOf(RULE_RECORDS, newRecordId()), order: Math.max(0, ...book.rules.map((other) => other.order)) + 1, condition, category }
  return { held, rule }
}

function rulesWith(book: SpendingBook, held: SpendingRule | null, rule: SpendingRule): readonly SpendingRule[] {
  return held === null ? [...book.rules, rule] : book.rules.map((other) => (other === held ? rule : other))
}

/** How many rows the rule would file, for you to read before it is written. */
export function rowsRuleWouldFile(book: SpendingBook, condition: SpendingRuleCondition, category: RecordId): number {
  const { held, rule } = ruleFor(book, condition, category)
  return rulesRerun(book, rulesWith(book, held, rule)).length
}

/** The rule written, with the rules re-run in the same write. */
export function writeRule(unit: UnitOfWork, book: SpendingBook, condition: SpendingRuleCondition, category: RecordId): void {
  const { held, rule } = ruleFor(book, condition, category)
  if (held === null) unit.of(RULE_WRITES).add(rule)
  else unit.of(RULE_WRITES).change(held, rule)
  rerun(unit, book, rulesWith(book, held, rule))
}

/** The rule gone, and the rows it filed follow the rules that are left, in the same write. */
export function deleteRule(unit: UnitOfWork, book: SpendingBook, rule: SpendingRule): void {
  unit.of(RULE_WRITES).remove(rule)
  rerun(
    unit,
    book,
    book.rules.filter((other) => other !== rule),
  )
}
