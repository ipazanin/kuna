import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { definedCategorySlugs } from '../../workbook/domain/categoriesReading'
import { CATEGORY_RECORDS, ITEM_RECORDS, LABEL_RECORDS, LEDGER_RECORDS, RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { readLabels } from '../../workbook/domain/labelReading'
import { storesItems } from '../../workbook/domain/rowItems'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordWithId, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { readRules, ruleLabelIdsIn } from '../domain/readRules'
import type { RuleLabelIds, RuleTabRow } from '../domain/readRules'
import { rulesTabAfter } from '../domain/rulesTabChange'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { categorisationContextOf } from '../domain/categorisationContext'
import { fileRows } from '../../transactions/application/fileRows'
import { waitingRowsSettledBy } from '../../transactions/domain/verdictChanges'
import type { RuleFiling } from '../../transactions/domain/verdictChanges'
import { heldLabels } from '../../transactions/application/itemWrites'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { Workbook } from '../../workbook/domain/workbook'
import { rowsOfOneItem, wholeItemId } from '../../workbook/domain/splits'

/** Rules, checked by their own reader against the categories and labels defined now and whether the books keep items. */
export const RULE_WRITES: WriteRules<RuleTabRow> = {
  kind: RULE_RECORDS,
  reads: [CATEGORY_RECORDS, LABEL_RECORDS, LEDGER_RECORDS, ITEM_RECORDS],
  undoable: true,
  read: (read, records) => {
    const labels = ruleLabelIdsIn(readLabels(records.of(LABEL_RECORDS)).facts, storesItems({ ledger: records.of(LEDGER_RECORDS), items: records.of(ITEM_RECORDS) }))
    const { rules, problems } = readRules(recordsOf(read), definedCategorySlugs(records.of(CATEGORY_RECORDS)), labels)
    return { facts: rules.map((rule) => ({ id: recordIdOf(RULE_RECORDS, rule.id.toLowerCase()) })), problems }
  },
  refusals: () => [],
}

/** Writes a save of the rules: the new rule added, each edited rule changed from what the app read, and the deleted rule removed. */
export function writeRulesChange(unit: UnitOfWork, change: RulesTabChange): void {
  const rules = unit.of(RULE_WRITES)
  if (change.appended !== null) rules.add({ fields: change.appended })
  for (const edit of change.edited) rules.change({ fields: edit.expected }, { fields: edit.fields })
  if (change.removed !== null) rules.remove({ fields: change.removed })
}

/**
 * The rows still waiting for review that the rule `settledBy` files once the change is saved, each with its verdict and the labels
 * the rule puts on it, among `labels`. A row a person confirmed is never among them.
 */
export function waitingRowsSettledBySave(workbook: Workbook, ruleRecords: WorkbookRecords['rules'], change: RulesTabChange, settledBy: string, labels: RuleLabelIds): RuleFiling[] {
  const defined = new Set(workbook.categories.map((category) => category.slug))
  const proposed = readRules(rulesTabAfter(recordsOf(ruleRecords), change).rows, defined, labels).rules
  return waitingRowsSettledBy(settledBy, rowsOfOneItem(workbook.transactions, workbook.splits), proposed, categorisationContextOf(workbook))
}

/**
 * Writes a save of the rules and, in the same write, files the rows still waiting that the rule `settledBy` settles, with the
 * `refiled` rows beside them, so one Undo takes back the rule and its filing. Each row it files takes the rule's labels, among
 * `labels`, beside those it carries. A row a person confirmed since it was read is left alone, and so is a row the rule filed before.
 */
export function writeRuleSave(
  unit: UnitOfWork,
  workbook: Workbook,
  records: WorkbookRecords,
  change: RulesTabChange,
  settledBy: string,
  labels: RuleLabelIds,
  refiled: readonly RuleFiling[] = [],
): void {
  const stillWaiting = (filing: RuleFiling) => {
    const held = recordWithId(records.ledger, filing.id)?.record
    return held !== undefined && !isHumanConfirmed(held)
  }
  const filings = [...waitingRowsSettledBySave(workbook, records.rules, change, settledBy, labels).filter(stillWaiting), ...refiled]
  writeRulesChange(unit, change)
  fileRows(unit, { records, workbook }, filings, workbook.categories, labelledByRule(workbook, records, filings))
}

/** The labels each row a rule files is left with, by the row's id: those its one item carries and the rule's beside them. */
function labelledByRule(workbook: Workbook, records: WorkbookRecords, filings: readonly RuleFiling[]): ReadonlyMap<string, readonly RecordId[]> {
  return new Map(
    filings.flatMap((filing) => {
      const row = workbook.transactions.find((candidate) => candidate.id === filing.id)
      return row === undefined || filing.labels.length === 0 ? [] : [[filing.id, labelsOf([{ labels: heldLabels(records, row)(wholeItemId(row)) }, filing])] as const]
    }),
  )
}
