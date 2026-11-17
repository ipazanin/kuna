import { CATEGORY_WRITES } from '../../categories/application/categoryWrites'
import { heldItemsOf, writeRows } from '../../entries/application/rowRecords'
import type { RowWrite } from '../../entries/application/rowRecords'
import { differenceItem } from '../../entries/domain/entrySplit'
import { filledByBank, statementDryRun } from '../domain/statementDryRun'
import type { StatementDryRun } from '../domain/statementDryRun'
import type { InstalmentLinks } from '../../links/domain/instalmentSplit'
import { rulesRerun } from '../domain/spendingCategorisation'
import type { RowChange, RulesRerun } from '../domain/spendingCategorisation'
import type { StatementRows } from '../domain/statementRows'
import { isMadeCashLeg, withCashLeg } from '../../pairing/domain/cashWithdrawals'
import { legsOfPair } from '../../pairing/domain/transferPairs'
import { RECEIPT_WRITES } from '../../receipts/application/receiptRecords'
import { HELD_ROW_WRITES, RULE_WRITES } from './ruleRecords'
import { words as receiptWords } from '../../receipts/domain/words'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import type { Account } from '../../workbook/domain/account'
import { isTransferCategory } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { isSplit, refiledItems, rowItemsOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { RULE_RECORDS } from '../../workbook/domain/spendingKinds'
import { ruleWithConditions, withDraftAdded } from '../../workbook/domain/spendingRule'
import type { RuleDraft, SpendingRule } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { inTryingOrder } from '../../../../shared/categorising/domain/rule'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The rows and items a statement write reads of the file. */
type EntryRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>

/** Everything the import does in one write, with the waiting receipts that go on its rows and the categories its links need, so one Undo takes it all back. */
export function writeDryRun(unit: UnitOfWork, records: EntryRecords, run: Pick<StatementDryRun, 'added' | 'items' | 'changed' | 'held' | 'receipts' | 'categories'>): void {
  const itemsOf = rowItemsOf(run)
  run.categories?.forEach((category) => unit.of(CATEGORY_WRITES).add(category))
  writeRows(unit, records, [...run.added.map((row): RowWrite => ({ before: null, after: row, items: itemsOf(row) })), ...run.changed])
  run.held.forEach((held) => unit.of(HELD_ROW_WRITES).add(held))
  run.receipts.forEach(({ receipt }) => unit.of(RECEIPT_WRITES).change(receipt.before, receipt.after))
}

/** Each row's items under the category you picked, in one write, which a rule change then leaves alone. A row under Between my accounts stays a lone leg, so a later statement can still pair it. */
export function fileRows(unit: UnitOfWork, records: EntryRecords, rows: readonly Transaction[], category: Category): void {
  const itemsOf = heldItemsOf(records)
  const categorisedBy = isTransferCategory(category) ? null : 'person'
  writeRows(
    unit,
    records,
    rows.map((row): RowWrite => ({ before: row, after: { ...row, categorisedBy }, items: refiledItems(itemsOf(row), category.id) })),
  )
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

function writeRerun(unit: UnitOfWork, book: SpendingBook, { changes, categories }: RulesRerun): void {
  categories.forEach((category) => unit.of(CATEGORY_WRITES).add(category))
  writeRows(unit, book.stored, changes)
}

/** Several changes to the rules, with the rules re-run once over all of them. */
export interface RuleEdits {
  /** Each made new and tried last, or put on the rule that already has its conditions. */
  readonly adding?: readonly RuleDraft[]
  readonly changing?: readonly { readonly rule: SpendingRule; readonly draft: RuleDraft }[]
  readonly deleting?: readonly SpendingRule[]
  readonly moving?: RuleMove
}

/** A rule tried one place earlier or later, trading places with its neighbour. */
export interface RuleMove {
  readonly rule: RecordId
  readonly direction: 'up' | 'down'
}

/** The rule records the edits change, before and after, the rules as they then stand, and the rules the edits add or change. */
interface EditedRules {
  readonly rules: readonly SpendingRule[]
  readonly written: readonly { readonly before: SpendingRule | null; readonly after: SpendingRule | null }[]
  readonly applying: ReadonlySet<RecordId>
}

function editedRules(rules: readonly SpendingRule[], { adding = [], changing = [], deleting = [], moving }: RuleEdits, newKey: () => string = newRecordId): EditedRules {
  const written: { before: SpendingRule | null; after: SpendingRule | null }[] = deleting.map((rule) => ({ before: rule, after: null }))
  const applying = new Set<RecordId>()
  let after: readonly SpendingRule[] = rules.filter((rule) => !deleting.includes(rule))
  const replaced = (before: SpendingRule, fixed: SpendingRule): void => {
    written.push({ before, after: fixed })
    after = after.map((other) => (other === before ? fixed : other))
  }
  for (const { rule, draft } of changing) {
    replaced(rule, { ...rule, ...draft })
    applying.add(rule.id)
  }
  for (const draft of adding) {
    const held = ruleWithConditions(after, draft.conditions)
    if (held !== undefined) {
      replaced(held, withDraftAdded(held, draft))
      applying.add(held.id)
      continue
    }
    const added: SpendingRule = { id: recordIdOf(RULE_RECORDS, newKey()), order: Math.max(0, ...after.map((other) => other.order)) + 1, ...draft }
    written.push({ before: null, after: added })
    after = [...after, added]
    applying.add(added.id)
  }
  if (moving !== undefined) {
    const tried = inTryingOrder(after)
    const place = tried.findIndex((rule) => rule.id === moving.rule)
    const other = moving.direction === 'up' ? place - 1 : place + 1
    if (place >= 0 && other >= 0 && other < tried.length) {
      const reordered = tried.map((held, at) => (at === place ? tried[other]! : at === other ? tried[place]! : held))
      reordered.forEach((held, at) => {
        if (held.order !== at + 1) replaced(held, { ...held, order: at + 1 })
      })
    }
  }
  return { rules: after, written, applying }
}

function writeEditedRules(unit: UnitOfWork, { written }: EditedRules): void {
  const records = unit.of(RULE_WRITES)
  for (const { before, after } of written) {
    if (before === null && after !== null) records.add(after)
    else if (before !== null && after === null) records.remove(before)
    else if (before !== null && after !== null) records.change(before, after)
  }
}

/** What the edits do to the rows already in the book when they are applied. */
function editsRerun(book: SpendingBook, edited: EditedRules, links: InstalmentLinks | null): RulesRerun {
  return rulesRerun(book, edited.rules, { links, applying: edited.applying })
}

/** How many rows already in the book the edits would change when applied, for the person to read before they choose, with the instalments `links` names that a loan rule's rows pay. */
export function rowsRulesWouldChange(book: SpendingBook, edits: RuleEdits, links: InstalmentLinks | null): number {
  return editsRerun(book, editedRules(book.rules, edits), links).changes.length
}

/**
 * The rules changed in one write, so one Undo puts it all back. With `refile`, the rows already in the book follow the edits in the
 * same write as `rulesRerun` says, each rule added or changed reaching every row it decides, and a row a rule whose rows pay a loan
 * files is linked to one of the instalments `links` names. Without it, the rules file only rows that come later.
 */
export function writeRules(unit: UnitOfWork, book: SpendingBook, edits: RuleEdits, links: InstalmentLinks | null, refile = true): void {
  const edited = editedRules(book.rules, edits)
  writeEditedRules(unit, edited)
  if (refile) writeRerun(unit, book, editsRerun(book, edited, links))
}

/**
 * A statement imported with the rules that come with it, in one write with one Undo. The rules file the statement's new
 * rows in its dry run and, with `refile`, re-file the rows on the file as `writeRules` does, and a row both change is written once. A new row
 * that pays one of the instalments `links` names is linked as the Import screen links it. Gives the dry run.
 */
export function importWithRules(unit: UnitOfWork, book: SpendingBook, edits: RuleEdits, statement: StatementRows, day: CivilDate, links: InstalmentLinks, refile = true): StatementDryRun {
  const editing = (edits.adding?.length ?? 0) + (edits.changing?.length ?? 0) + (edits.deleting?.length ?? 0) > 0
  const edited = editedRules(book.rules, edits)
  if (editing) writeEditedRules(unit, edited)
  const rules = editing ? edited.rules : book.rules
  const rerun = editing && refile ? editsRerun(book, edited, links) : { changes: [], categories: [] }
  const refiled = rerun.changes
  const refiledTo = new Map(refiled.map(({ before, after }) => [before, after]))
  const refiledFrom = new Map(refiled.map((change) => [change.after, change]))
  const refiledItems = new Map(refiled.flatMap(({ before, items }) => (items === undefined ? [] : [[before.id, items] as const])))
  const items = [...book.items.filter((item) => item.transaction === null || !refiledItems.has(item.transaction)), ...[...refiledItems.values()].flat()]
  const run = statementDryRun(
    { ...book, rules, categories: [...book.categories, ...rerun.categories], transactions: book.transactions.map((row) => refiledTo.get(row) ?? row), items },
    statement,
    day,
    links,
  )
  const changedByRun = run.changed.map(({ before, after, items: runItems }): RowChange => {
    const refiledBy = refiledFrom.get(before)
    const items = runItems ?? refiledBy?.items
    return { before: refiledBy?.before ?? before, after, ...(items === undefined ? {} : { items }) }
  })
  const startsOfRun = new Set(changedByRun.map(({ before }) => before))
  const categories = [...rerun.categories, ...(run.categories ?? [])]
  writeDryRun(unit, book.stored, { ...run, changed: [...refiled.filter(({ before }) => !startsOfRun.has(before)), ...changedByRun], ...(categories.length === 0 ? {} : { categories }) })
  return run
}
