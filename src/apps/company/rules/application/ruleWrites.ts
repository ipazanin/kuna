import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { definedCategorySlugs } from '../../workbook/domain/categoriesReading'
import { CATEGORY_RECORDS, RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordWithId, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { readRules } from '../domain/readRules'
import type { RuleTabRow } from '../domain/readRules'
import { rulesTabAfter } from '../domain/rulesTabChange'
import type { RulesTabChange } from '../domain/rulesTabChange'
import { categorisationContextOf } from '../domain/categorisationContext'
import { fileRows } from '../../transactions/application/fileRows'
import { waitingRowsSettledBy } from '../../transactions/domain/verdictChanges'
import type { RowVerdict } from '../../transactions/domain/verdictChanges'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { Workbook } from '../../workbook/domain/workbook'
import { rowsOfOneItem } from '../../workbook/domain/splits'

/** Rules, checked by their own reader against the categories defined now. */
export const RULE_WRITES: WriteRules<RuleTabRow> = {
  kind: RULE_RECORDS,
  reads: [CATEGORY_RECORDS],
  undoable: true,
  read: (read, records) => {
    const { rules, problems } = readRules(recordsOf(read), definedCategorySlugs(records.of(CATEGORY_RECORDS)))
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

/** The rows still waiting for review that the rule `settledBy` files once the change is saved, each with its verdict. A row a person confirmed is never among them. */
export function waitingRowsSettledBySave(workbook: Workbook, ruleRecords: WorkbookRecords['rules'], change: RulesTabChange, settledBy: string): RowVerdict[] {
  const defined = new Set(workbook.categories.map((category) => category.slug))
  const proposed = readRules(rulesTabAfter(recordsOf(ruleRecords), change).rows, defined).rules
  return waitingRowsSettledBy(settledBy, rowsOfOneItem(workbook.transactions, workbook.splits), proposed, categorisationContextOf(workbook))
}

/**
 * Writes a save of the rules and, in the same write, files the rows still waiting that the rule `settledBy` settles, with the
 * `refiled` rows beside them, so one Undo takes back the rule and its filing. A row a person confirmed since it was read is left alone.
 */
export function writeRuleSave(unit: UnitOfWork, workbook: Workbook, records: WorkbookRecords, change: RulesTabChange, settledBy: string, refiled: readonly RowVerdict[] = []): void {
  const stillWaiting = (verdict: RowVerdict) => {
    const held = recordWithId(records.ledger, verdict.id)?.record
    return held !== undefined && !isHumanConfirmed(held)
  }
  const waiting = waitingRowsSettledBySave(workbook, records.rules, change, settledBy).filter(stillWaiting)
  writeRulesChange(unit, change)
  fileRows(unit, { records, workbook }, [...waiting, ...refiled], workbook.categories)
}
