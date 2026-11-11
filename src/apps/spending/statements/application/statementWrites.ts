import { PART_WRITES, TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import { differencePart } from '../../entries/domain/entrySplit'
import { filledByBank, statementDryRun } from '../domain/statementDryRun'
import type { StatementDryRun } from '../domain/statementDryRun'
import { rulesRerun } from '../domain/spendingCategorisation'
import type { StatementRows } from '../domain/statementRows'
import { isMadeCashLeg, withCashLeg } from '../../pairing/domain/cashWithdrawals'
import { legsOfPair } from '../../pairing/domain/transferPairs'
import { writeReceiptPlaced } from '../../receipts/application/receiptWrites'
import { words as receiptWords } from '../../receipts/domain/words'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { EntryPart } from '../../workbook/domain/entryPart'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import { HELD_ROW_RECORDS, RULE_RECORDS } from '../../workbook/domain/spendingKinds'
import { sameCondition } from '../../workbook/domain/spendingRule'
import type { RuleWithdrawal, SpendingRule, SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
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

/** A bank row on hold reads as `readHeld` says. */
export const HELD_ROW_WRITES: WriteRules<HeldBankRow> = {
  kind: HELD_ROW_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(HELD_ROW_RECORDS, read, records).readings.held,
  refusals: (_change, fresh, after) => dependentRefusals(['held'], fresh, after),
}

/** Everything the import does in one write, with the waiting receipts that go on its rows, so one Undo takes it all back. */
export function writeDryRun(unit: UnitOfWork, run: Pick<StatementDryRun, 'added' | 'changed' | 'held' | 'receipts'>): void {
  const entries = unit.of(TRANSACTION_WRITES)
  run.added.forEach((row) => entries.add(row))
  run.changed.forEach(({ before, after }) => entries.change(before, after))
  run.held.forEach((held) => unit.of(HELD_ROW_WRITES).add(held))
  run.receipts.forEach((placed) => writeReceiptPlaced(unit, placed))
}

/** The row under the category you picked, which a rule change then leaves alone. A row under Between my accounts stays a lone leg, so a later statement can still pair it. */
export function fileRow(unit: UnitOfWork, row: Transaction, category: Category): void {
  unit.of(TRANSACTION_WRITES).change(row, { ...row, category: category.id, categorisedBy: category.kind === 'transfer' ? null : 'person' })
}

/**
 * Both legs back on review, with neither a category nor a pair. `person` on a row with no category says you decided
 * about the pair, so a later import does not pair them again and To review does not offer it. A cash leg Kuna made goes,
 * since no money but the withdrawal's was ever there.
 */
export function notAPair(unit: UnitOfWork, { debit, credit }: TransferPair): void {
  const entries = unit.of(TRANSACTION_WRITES)
  for (const leg of [debit, credit]) {
    if (isMadeCashLeg(leg)) entries.remove(leg)
    else entries.change(leg, { ...leg, pair: null, category: null, categorisedBy: 'person' })
  }
}

/** A row To review took for cash taken out, which the person says is not: it stays where it is filed, as their own decision, so no rule or later list takes it for one again. */
export function notCash(unit: UnitOfWork, row: Transaction): void {
  unit.of(TRANSACTION_WRITES).change(row, { ...row, categorisedBy: 'person' })
}

/** Each withdrawal with its leg on the cash account picked for it, in one write with one Undo. */
export function writeCashLegs(unit: UnitOfWork, withdrawals: readonly { readonly row: Transaction; readonly cash: Account }[], transferCategory: RecordId): void {
  const entries = unit.of(TRANSACTION_WRITES)
  for (const { row, cash } of withdrawals) {
    const [debit, leg] = withCashLeg(row, cash, transferCategory)
    entries.change(row, debit)
    entries.add(leg)
  }
}

/** Two rows To review offered as one transfer, paired by your word. */
export function pairRows(unit: UnitOfWork, { debit, credit }: TransferPair, transferCategory: RecordId): void {
  const [debitLeg, creditLeg] = legsOfPair(debit, credit, transferCategory)
  const entries = unit.of(TRANSACTION_WRITES)
  entries.change(debit, debitLeg)
  entries.change(credit, creditLeg)
}

/** A near match joined by your word: the typed row takes the bank's facts and the bank's own row goes. A row split into parts gains a Difference part in its first part's category for what the bank's amount adds, so its parts keep adding up. */
export function joinWithTyped(unit: UnitOfWork, typed: Transaction, bank: Transaction, lines: readonly EntryPart[]): void {
  const entries = unit.of(TRANSACTION_WRITES)
  entries.remove(bank)
  entries.change(typed, filledByBank(typed, bank))
  const parts = lines.filter((part) => part.transaction === typed.id)
  const first = parts[0]
  const difference = first === undefined ? null : differencePart(bank.amount, parts, first, receiptWords.difference)
  if (difference !== null) unit.of(PART_WRITES).add(difference)
}

/** What "Always for this payee" tests on a row: its IBAN, else its payee's name. Null for a row with neither. */
export function payeeCondition(row: Pick<Transaction, 'payee' | 'counterpartyIban'>): SpendingRuleCondition | null {
  if (row.counterpartyIban !== '') return { column: 'counterparty_iban', iban: row.counterpartyIban }
  return row.payee === '' ? null : { column: 'counterparty_contains', fragment: row.payee }
}

function rerun(unit: UnitOfWork, book: SpendingBook, rules: readonly SpendingRule[]): void {
  rulesRerun(book, rules).forEach(({ before, after }) => unit.of(TRANSACTION_WRITES).change(before, after))
}

/** What a rule files a row as: its category, and whether it spots cash taken out. */
export interface RuleFiling {
  readonly category: RecordId
  readonly withdrawal: RuleWithdrawal | null
}

/** The rule this condition makes: new and tried last, or the one it already has on the new filing. */
function ruleFor(rules: readonly SpendingRule[], condition: SpendingRuleCondition, { category, withdrawal }: RuleFiling): { readonly held: SpendingRule | null; readonly rule: SpendingRule } {
  const held = rules.find((rule) => sameCondition(rule.condition, condition)) ?? null
  const rule =
    held !== null ? { ...held, category, withdrawal } : { id: recordIdOf(RULE_RECORDS, newRecordId()), order: Math.max(0, ...rules.map((other) => other.order)) + 1, condition, category, withdrawal }
  return { held, rule }
}

function rulesWith(rules: readonly SpendingRule[], held: SpendingRule | null, rule: SpendingRule): readonly SpendingRule[] {
  return held === null ? [...rules, rule] : rules.map((other) => (other === held ? rule : other))
}

/** How many rows the rule would file, for you to read before it is written. */
export function rowsRuleWouldFile(book: SpendingBook, condition: SpendingRuleCondition, category: RecordId): number {
  const { held, rule } = ruleFor(book.rules, condition, { category, withdrawal: null })
  return rulesRerun(book, rulesWith(book.rules, held, rule)).length
}

/** Several changes to the rules, with the rules re-run once over all of them. */
export interface RuleEdits {
  /** Each made new, or on the rule that already has its condition. */
  readonly filing?: readonly (RuleFiling & { readonly condition: SpendingRuleCondition })[]
  readonly fixing?: readonly (RuleFiling & { readonly rule: SpendingRule; readonly condition: SpendingRuleCondition })[]
  readonly deleting?: readonly SpendingRule[]
}

/** Writes the rule records the edits change, and gives the rules as they then stand. */
function editRules(unit: UnitOfWork, rules: readonly SpendingRule[], { filing = [], fixing = [], deleting = [] }: RuleEdits): readonly SpendingRule[] {
  const records = unit.of(RULE_WRITES)
  let after: readonly SpendingRule[] = rules.filter((rule) => !deleting.includes(rule))
  deleting.forEach((rule) => records.remove(rule))
  for (const { rule, condition, category, withdrawal } of fixing) {
    const fixed = { ...rule, condition, category, withdrawal }
    records.change(rule, fixed)
    after = after.map((other) => (other === rule ? fixed : other))
  }
  for (const { condition, ...filed } of filing) {
    const { held, rule } = ruleFor(after, condition, filed)
    if (held === null) records.add(rule)
    else records.change(held, rule)
    after = rulesWith(after, held, rule)
  }
  return after
}

/** The rules changed and the rows re-filed by them in one write, so one Undo puts it all back. A row a rule no longer files follows the rules that are left. */
export function writeRules(unit: UnitOfWork, book: SpendingBook, edits: RuleEdits): void {
  rerun(unit, book, editRules(unit, book.rules, edits))
}

/**
 * A statement imported with the rules that come with it, in one write with one Undo. The rules file the statement's new
 * rows in its dry run and re-file the rows on the file as `writeRules` does, and a row both change is written once. Gives the dry run.
 */
export function importWithRules(unit: UnitOfWork, book: SpendingBook, edits: RuleEdits, statement: StatementRows, day: CivilDate): StatementDryRun {
  const editing = (edits.filing?.length ?? 0) + (edits.fixing?.length ?? 0) + (edits.deleting?.length ?? 0) > 0
  const rules = editing ? editRules(unit, book.rules, edits) : book.rules
  const refiled = editing ? rulesRerun(book, rules) : []
  const refiledTo = new Map(refiled.map(({ before, after }) => [before, after]))
  const refiledFrom = new Map(refiled.map(({ before, after }) => [after, before]))
  const run = statementDryRun({ ...book, rules, transactions: book.transactions.map((row) => refiledTo.get(row) ?? row) }, statement, day)
  const changedByRun = run.changed.map(({ before, after }) => ({ before: refiledFrom.get(before) ?? before, after }))
  const startsOfRun = new Set(changedByRun.map(({ before }) => before))
  writeDryRun(unit, { added: run.added, changed: [...refiled.filter(({ before }) => !startsOfRun.has(before)), ...changedByRun], held: run.held, receipts: run.receipts })
  return run
}

/**
 * A rule for each condition into one category, tried after the rules there are in the order given, with the rules re-run in
 * the same write. A rule into Between my accounts may spot cash taken out, into the cash account it names or none.
 */
export function writeRulesInto(unit: UnitOfWork, book: SpendingBook, conditions: readonly SpendingRuleCondition[], category: RecordId, withdrawal: RuleWithdrawal | null): void {
  writeRules(unit, book, { filing: conditions.map((condition) => ({ condition, category, withdrawal })) })
}

/** The rule testing another condition or filing into another category or cash account, keeping its place, with the rules re-run in the same write. */
export function changeRule(unit: UnitOfWork, book: SpendingBook, rule: SpendingRule, condition: SpendingRuleCondition, category: RecordId, withdrawal: RuleWithdrawal | null): void {
  writeRules(unit, book, { fixing: [{ rule, condition, category, withdrawal }] })
}

/** The rule gone, and the rows it filed follow the rules that are left, in the same write. */
export function deleteRule(unit: UnitOfWork, book: SpendingBook, rule: SpendingRule): void {
  writeRules(unit, book, { deleting: [rule] })
}
