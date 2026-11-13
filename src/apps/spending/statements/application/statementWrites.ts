import { heldItemsOf, writeRows } from '../../entries/application/rowRecords'
import type { RowWrite } from '../../entries/application/rowRecords'
import { differenceItem } from '../../entries/domain/entrySplit'
import { filledByBank, statementDryRun } from '../domain/statementDryRun'
import type { StatementDryRun } from '../domain/statementDryRun'
import { rulesRerun } from '../domain/spendingCategorisation'
import type { RowChange } from '../domain/spendingCategorisation'
import type { StatementRows } from '../domain/statementRows'
import { isMadeCashLeg, withCashLeg } from '../../pairing/domain/cashWithdrawals'
import { legsOfPair } from '../../pairing/domain/transferPairs'
import { RECEIPT_WRITES } from '../../receipts/application/receiptRecords'
import { words as receiptWords } from '../../receipts/domain/words'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { isSplit, refiledItems, rowItemsOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
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

/** The rows and items a statement write reads of the file. */
type EntryRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>

/** Everything the import does in one write, with the waiting receipts that go on its rows, so one Undo takes it all back. */
export function writeDryRun(unit: UnitOfWork, records: EntryRecords, run: Pick<StatementDryRun, 'added' | 'items' | 'changed' | 'held' | 'receipts'>): void {
  const itemsOf = rowItemsOf(run)
  writeRows(unit, records, [...run.added.map((row): RowWrite => ({ before: null, after: row, items: itemsOf(row) })), ...run.changed])
  run.held.forEach((held) => unit.of(HELD_ROW_WRITES).add(held))
  run.receipts.forEach(({ receipt }) => unit.of(RECEIPT_WRITES).change(receipt.before, receipt.after))
}

/** The row's one item under the category you picked, which a rule change then leaves alone. A row under Between my accounts stays a lone leg, so a later statement can still pair it. */
export function fileRow(unit: UnitOfWork, records: EntryRecords, row: Transaction, category: Category): void {
  writeRows(unit, records, [{ before: row, after: { ...row, categorisedBy: category.kind === 'transfer' ? null : 'person' }, items: refiledItems(heldItemsOf(records)(row), category.id) }])
}

/**
 * Both legs back on review, with neither a category nor a pair. `person` on a row with no category says you decided
 * about the pair, so a later import does not pair them again and To review does not offer it. A cash leg Kuna made goes,
 * since no money but the withdrawal's was ever there.
 */
export function notAPair(unit: UnitOfWork, records: EntryRecords, { debit, credit }: TransferPair): void {
  const itemsOf = heldItemsOf(records)
  writeRows(
    unit,
    records,
    [debit, credit].map((leg): RowWrite =>
      isMadeCashLeg(leg) ? { before: leg, after: null } : { before: leg, after: { ...leg, pair: null, categorisedBy: 'person' }, items: refiledItems(itemsOf(leg), null) },
    ),
  )
}

/** A row To review took for cash taken out, which the person says is not: it stays where it is filed, as their own decision, so no rule or later list takes it for one again. */
export function notCash(unit: UnitOfWork, records: EntryRecords, row: Transaction): void {
  writeRows(unit, records, [{ before: row, after: { ...row, categorisedBy: 'person' } }])
}

/** Each withdrawal with its leg on the cash account picked for it, in one write with one Undo. */
export function writeCashLegs(unit: UnitOfWork, records: EntryRecords, withdrawals: readonly { readonly row: Transaction; readonly cash: Account }[], transferCategory: RecordId): void {
  const itemsOf = heldItemsOf(records)
  writeRows(
    unit,
    records,
    withdrawals.flatMap(({ row, cash }): RowWrite[] => {
      const [debit, leg] = withCashLeg({ row, items: itemsOf(row) }, cash, transferCategory)
      return [changedTo(row, debit), { before: null, after: leg.row, items: leg.items }]
    }),
  )
}

function changedTo(before: Transaction, after: ItemizedRow): RowWrite {
  return { before, after: after.row, items: after.items }
}

/** Two rows To review offered as one transfer, paired by your word. */
export function pairRows(unit: UnitOfWork, records: EntryRecords, { debit, credit }: TransferPair, transferCategory: RecordId): void {
  const itemsOf = heldItemsOf(records)
  const [debitLeg, creditLeg] = legsOfPair({ row: debit, items: itemsOf(debit) }, { row: credit, items: itemsOf(credit) }, transferCategory)
  writeRows(unit, records, [changedTo(debit, debitLeg), changedTo(credit, creditLeg)])
}

/**
 * A near match joined by your word: the typed row takes the bank's facts and the bank's own row goes. A row of one item has it
 * follow the bank's amount, and a split row gains a Difference part in its first part's category for what the bank's amount
 * adds, so its parts keep adding up.
 */
export function joinWithTyped(unit: UnitOfWork, records: EntryRecords, typed: Transaction, bank: Transaction): void {
  const parts = heldItemsOf(records)(typed)
  const [first] = parts
  const difference = first === undefined || !isSplit(parts) ? null : differenceItem(bank.amount, parts, first, receiptWords.difference)
  const items = !isSplit(parts) ? parts.map((item) => ({ ...item, amount: bank.amount })) : difference === null ? parts : [...parts, difference]
  writeRows(unit, records, [
    { before: bank, after: null },
    { before: typed, after: filledByBank(typed, bank), items },
  ])
}

/** What "Always for this payee" tests on a row: its IBAN, else its payee's name. Null for a row with neither. */
export function payeeCondition(row: Pick<Transaction, 'payee' | 'counterpartyIban'>): SpendingRuleCondition | null {
  if (row.counterpartyIban !== '') return { column: 'counterparty_iban', iban: row.counterpartyIban }
  return row.payee === '' ? null : { column: 'counterparty_contains', fragment: row.payee }
}

function rerun(unit: UnitOfWork, book: SpendingBook, rules: readonly SpendingRule[]): void {
  writeRows(unit, book.stored, rulesRerun(book, rules))
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
  const refiledFrom = new Map(refiled.map((change) => [change.after, change]))
  const refiledItems = new Map(refiled.flatMap(({ before, items }) => (items === undefined ? [] : [[before.id, items] as const])))
  const items = [...book.items.filter((item) => item.transaction === null || !refiledItems.has(item.transaction)), ...[...refiledItems.values()].flat()]
  const run = statementDryRun({ ...book, rules, transactions: book.transactions.map((row) => refiledTo.get(row) ?? row), items }, statement, day)
  const changedByRun = run.changed.map(({ before, after, items: runItems }): RowChange => {
    const refiledBy = refiledFrom.get(before)
    const items = runItems ?? refiledBy?.items
    return { before: refiledBy?.before ?? before, after, ...(items === undefined ? {} : { items }) }
  })
  const startsOfRun = new Set(changedByRun.map(({ before }) => before))
  writeDryRun(unit, book.stored, { ...run, changed: [...refiled.filter(({ before }) => !startsOfRun.has(before)), ...changedByRun] })
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
